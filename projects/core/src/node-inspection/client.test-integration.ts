// @vitest-environment node
import { execFile, spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import { describe, expect, test, vi } from 'vitest';

import { RepositorySourceException } from '@moldea.ai/repository';
import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';

import { createCore } from '../core/index.js';

import { createNodeProjectInspection } from './client.js';
import { NODE_INSPECTION_TRANSPORT_BYTES } from './constants.js';

const createRepository = () => {
  const reader = createMemoryRepositoryReader([
    { path: '/moldea/moldea.yaml', type: 'file', content: 'version: 1\n' },
    { path: '/moldea/project.md', type: 'file', content: '# Private project body\n' },
  ]);
  return {
    snapshot: reader.snapshot,
    getEntry: reader.getEntry.bind(reader),
    listEntriesPage: reader.listEntriesPage.bind(reader),
    readFilePage: reader.readFilePage.bind(reader),
    compare: reader.compare.bind(reader),
  };
};

const withRegistry = async (
  operation: (url: URL) => Promise<void>,
  source = 'export const adapters = [];\n',
): Promise<void> => {
  const directory = await mkdtemp(path.join(tmpdir(), 'moldea-node-inspection-'));
  const registry = path.join(directory, 'registry.mjs');
  try {
    await writeFile(registry, source);
    await operation(pathToFileURL(registry));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

const createGate = () => {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
};

describe('real isolated Node inspection', () => {
  test('releases readers and buffers while eight disposed handles remain reachable', async () => {
    await withRegistry(async (adapterRegistryUrl) => {
      const probePath = path.join(path.dirname(fileURLToPath(adapterRegistryUrl)), 'retention.mjs');
      await writeFile(
        probePath,
        `
        import { createNodeProjectInspection } from ${JSON.stringify(import.meta.resolve('@moldea.ai/core/node'))};
        import { createMemoryRepositoryReader } from ${JSON.stringify(import.meta.resolve('@moldea.ai/repository/memory'))};
        const handles = [], references = [];
        const prepare = async (index) => {
          const repository = createMemoryRepositoryReader([
            { path: '/moldea/moldea.yaml', type: 'file', content: 'version: 1\\n' },
            { path: '/moldea/project.md', type: 'file', content: '# Project\\n' },
            { path: '/padding.bin', type: 'file', content: new Uint8Array(8_388_608).fill(index) },
          ]);
          const reference = new WeakRef(repository);
          const handle = await createNodeProjectInspection({
            repository, adapterRegistryUrl: new URL(${JSON.stringify(adapterRegistryUrl.href)}),
          });
          await handle.dispose();
          return { reference, handle };
        };
        for (let index = 0; index < 8; index++) {
          const { reference, handle } = await prepare(index);
          references.push(reference); handles.push(handle);
        }
        await new Promise(resolve => setTimeout(resolve, 0)); global.gc();
        await new Promise(resolve => setTimeout(resolve, 0)); global.gc();
        await Promise.all(handles.map(handle => handle.dispose()));
        process.stdout.write(JSON.stringify({
          handles: handles.length,
          retainedReaders: references.filter(reference => reference.deref() !== undefined).length,
          childProcesses: process.getActiveResourcesInfo().filter(kind => kind === 'ProcessWrap').length,
        }));
      `,
      );
      const { stdout, stderr } = await promisify(execFile)(
        process.execPath,
        ['--expose-gc', probePath],
        { encoding: 'utf8', maxBuffer: 16_384, timeout: 15_000 },
      );
      expect(stderr).toBe('');
      expect(JSON.parse(stdout)).toStrictEqual({
        handles: 8,
        retainedReaders: 0,
        childProcesses: 0,
      });
    });
  });

  test('preserves a paging failure through disposal and releases admission', async () => {
    await withRegistry(async (adapterRegistryUrl) => {
      const inspection = await createNodeProjectInspection({
        repository: createRepository(),
        adapterRegistryUrl,
      });
      try {
        await expect(
          inspection.readPage({ view: 'all', maxItems: 1, cursor: 'invalid' }),
        ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
        await expect(inspection.dispose()).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
      } finally {
        await inspection.dispose().catch(() => {});
      }
      const next = await createNodeProjectInspection({
        repository: createRepository(),
        adapterRegistryUrl,
      });
      await next.dispose();
    });
  });
  test.each([NODE_INSPECTION_TRANSPORT_BYTES - 1, NODE_INSPECTION_TRANSPORT_BYTES])(
    'refuses a retained budget with no room after transport reservation (%d bytes)',
    async (maxRetainedBytes) => {
      await withRegistry(async (adapterRegistryUrl) => {
        await expect(
          createNodeProjectInspection({
            repository: createRepository(),
            adapterRegistryUrl,
            limits: { maxRetainedBytes },
          }),
        ).rejects.toMatchObject({
          code: 'RESOURCE_LIMIT_EXCEEDED',
          limit: 'maxRetainedBytes',
          limitMaximum: maxRetainedBytes,
          observedUsage: NODE_INSPECTION_TRANSPORT_BYTES,
        });
      });
    },
  );
  test.each([false, true])(
    'bounds diagnostic pages without truncating records (oversized: %s)',
    async (isOversized) => {
      const count = isOversized ? 1 : 256;
      const messageBytes = isOversized ? 1_048_576 : 8_192;
      await withRegistry(
        async (adapterRegistryUrl) => {
          const repository = createMemoryRepositoryReader([
            {
              path: '/moldea/moldea.yaml',
              type: 'file',
              content: 'version: 1\nagents:\n  fixture:\n    runtime:\n      id: openai\n',
            },
            { path: '/moldea/project.md', type: 'file', content: '# Project\n' },
            { path: '/moldea/agents/fixture/description.md', type: 'file', content: 'Fixture.\n' },
            {
              path: '/moldea/agents/fixture/instruction.md',
              type: 'file',
              content: 'You are the `fixture` agent.\n',
            },
          ]);
          const inspection = await createNodeProjectInspection({ repository, adapterRegistryUrl });
          try {
            expect(inspection.counts.diagnostics).toBe(count);
            if (isOversized) {
              await expect(
                inspection.readPage({ view: 'diagnostics', maxItems: 1 }),
              ).rejects.toMatchObject({
                code: 'RESOURCE_LIMIT_EXCEEDED',
                limit: 'maxInspectionMessageBytes',
                limitMaximum: 1_048_576,
                nextAction: null,
              });
            } else {
              const codes: string[] = [];
              let cursor: string | undefined;
              do {
                const page = await inspection.readPage({
                  view: 'diagnostics',
                  maxItems: 256,
                  ...(cursor === undefined ? {} : { cursor }),
                });
                expect(page.page.records.length).toBeLessThan(256);
                for (const { item } of page.page.records) {
                  if (item.kind === 'diagnostic') codes.push(item.diagnostic.code);
                }
                cursor = page.page.nextCursor ?? undefined;
              } while (cursor !== undefined);
              expect(codes).toHaveLength(count);
              expect(new Set(codes).size).toBe(count);
            }
          } finally {
            await inspection.dispose().catch((error: unknown) => {
              if (!isOversized) throw new Error('Unexpected disposal failure.', { cause: error });
            });
          }
        },
        `export const adapters = [{ id: 'openai', supportedRepositoryFormatVersions: [1],
      inspect: async (context) => ({ evidence: [], diagnostics: Array.from({ length: ${count} }, (_, index) => ({
        code: 'OPENAI_FIXTURE_' + index, message: 'x'.repeat(${messageBytes}), severity: 'error', source: 'openai',
        entity: { adapterId: 'openai', agentId: context.agent.id }, path: null, pointer: null, range: null, details: {},
      })) }) }];`,
      );
    },
  );

  test('keeps the deadline active while disposal awaits a blocked native worker', async () => {
    await withRegistry(
      async (adapterRegistryUrl) => {
        const deadline = Date.now() + 5_000;
        const inspection = await createNodeProjectInspection({
          repository: createRepository(),
          adapterRegistryUrl,
          deadline,
        });
        try {
          await inspection.readPage({ view: 'all', maxItems: 1 });
          await new Promise<void>((resolve) =>
            setTimeout(resolve, Math.max(0, deadline - Date.now() - 100)),
          );
          await expect(inspection.dispose()).rejects.toMatchObject({ code: 'INSPECTION_TIMEOUT' });
        } finally {
          await inspection.dispose().catch(() => {});
        }
      },
      `import { parentPort } from 'node:worker_threads';
      import { pbkdf2Sync } from 'node:crypto';
      parentPort.on('message', (frame) => {
        if (JSON.parse(frame).kind === 'read-page') pbkdf2Sync('fixture', 'salt', 1_000_000_000, 32, 'sha256');
      });
      export const adapters = [];`,
    );
  }, 15_000);

  test('closes the supervisor and computing worker after abrupt parent death', async () => {
    await withRegistry(async (adapterRegistryUrl) => {
      const directory = path.dirname(fileURLToPath(adapterRegistryUrl));
      const markerPath = path.join(directory, 'worker-ready.json');
      await writeFile(
        adapterRegistryUrl,
        `import { writeFileSync } from 'node:fs';
        writeFileSync(${JSON.stringify(markerPath)}, JSON.stringify({ pid: process.pid, parentPid: process.ppid }));
        while (true) {}\nexport const adapters = [];`,
      );
      const parentPath = path.join(directory, 'parent.mjs');
      await writeFile(
        parentPath,
        `import { createNodeProjectInspection } from ${JSON.stringify(import.meta.resolve('@moldea.ai/core/node'))};
        import { createMemoryRepositoryReader } from ${JSON.stringify(import.meta.resolve('@moldea.ai/repository/memory'))};
        await createNodeProjectInspection({ repository: createMemoryRepositoryReader([]),
          adapterRegistryUrl: new URL(${JSON.stringify(adapterRegistryUrl.href)}) });`,
      );
      const parent = spawn(process.execPath, [parentPath], { stdio: 'ignore', shell: false });
      const closed = new Promise<void>((resolve, reject) => {
        parent.once('error', reject);
        parent.once('close', () => resolve());
      });
      let supervisorPid: number | undefined;
      const hasExited = (): boolean => {
        if (supervisorPid === undefined) return true;
        try {
          process.kill(supervisorPid, 0);
          return false;
        } catch (error) {
          if (error instanceof Error && 'code' in error && error.code === 'ESRCH') return true;
          throw error;
        }
      };
      try {
        await vi.waitFor(
          async () => {
            const marker: unknown = JSON.parse(await readFile(markerPath, 'utf8'));
            expect(marker).toMatchObject({ parentPid: parent.pid });
            if (
              marker === null ||
              typeof marker !== 'object' ||
              !('pid' in marker) ||
              typeof marker.pid !== 'number' ||
              !Number.isSafeInteger(marker.pid) ||
              marker.pid <= 0
            )
              throw new Error('The owned supervisor marker is invalid.');
            supervisorPid = marker.pid;
          },
          { timeout: 5_000 },
        );
        expect(parent.kill('SIGKILL')).toBe(true);
        await closed;
        await vi.waitFor(() => expect(hasExited()).toBe(true), { timeout: 5_000 });
      } finally {
        if (parent.exitCode === null && parent.signalCode === null) parent.kill('SIGKILL');
        await closed;
        if (!hasExited() && supervisorPid !== undefined) {
          process.kill(supervisorPid, 'SIGKILL');
          await vi.waitFor(() => expect(hasExited()).toBe(true), { timeout: 5_000 });
        }
      }
    });
  }, 15_000);

  test.each([
    'process.exit(42); export const adapters = [];',
    "throw new Error('private out-of-memory text'); export const adapters = [];",
    "import { parentPort, workerData } from 'node:worker_threads'; const { attemptId } = JSON.parse(workerData); parentPort.postMessage(JSON.stringify({ attemptId, kind: 'ready', maxAnalysisHeapBytes: 1 })); export const adapters = [];",
    "import { parentPort } from 'node:worker_threads'; parentPort.postMessage(JSON.stringify({ attemptId: '0'.repeat(32), kind: 'run' })); export const adapters = [];",
  ])('refuses unknown exits or inconsistent worker frames (%s)', async (source) => {
    await withRegistry(async (adapterRegistryUrl) => {
      await expect(
        createNodeProjectInspection({ repository: createRepository(), adapterRegistryUrl }),
      ).rejects.toMatchObject({ code: 'INSPECTION_PROCESS_FAILED', limit: null, nextAction: null });
      await withRegistry(async (validRegistryUrl) => {
        const next = await createNodeProjectInspection({
          repository: createRepository(),
          adapterRegistryUrl: validRegistryUrl,
        });
        await next.dispose();
      });
    }, source);
  });

  test.each([
    ['review-inspection-capacity', null],
    ['reduce-input-or-increase-limit', 2],
  ])('rejects a worker-forged capacity failure (%s, %s)', async (nextAction, observedUsage) => {
    const coreUrl = pathToFileURL(path.resolve(import.meta.dirname, '../../dist/index.js'));
    await withRegistry(
      async (adapterRegistryUrl) => {
        await expect(
          createNodeProjectInspection({ repository: createRepository(), adapterRegistryUrl }),
        ).rejects.toMatchObject({ code: 'INSPECTION_PROCESS_FAILED', limit: null });
      },
      `import { CoreOperationException } from ${JSON.stringify(coreUrl.href)};
      throw new CoreOperationException({ code: 'RESOURCE_LIMIT_EXCEEDED', operation: 'create-project-inspection',
        limit: 'maxAnalysisHeapBytes', limitMaximum: 1, observedUsage: ${JSON.stringify(observedUsage)}, nextAction: ${JSON.stringify(nextAction)} });
      export const adapters = [];`,
    );
  });

  test('preserves Core metadata, digests, cursors and content-free paging', async () => {
    await withRegistry(async (adapterRegistryUrl) => {
      const repository = createRepository();
      const expected = await createCore().createProjectInspection({ repository });
      const inspection = await createNodeProjectInspection({ repository, adapterRegistryUrl });
      try {
        expect(inspection.valid).toBe(true);
        expect(inspection.runtimeInspection).toBe('complete');
        expect(inspection.inspectionDigest).toBe(expected.inspectionDigest);
        expect(inspection.counts).toStrictEqual(expected.counts);
        expect(inspection.adapters).toStrictEqual([]);
        expect(inspection.maxAnalysisHeapBytes).toBeGreaterThan(0);
        expect(JSON.stringify(inspection)).not.toContain('Private project body');
        let cursor: string | undefined;
        do {
          const input = {
            view: 'all' as const,
            maxItems: 1,
            ...(cursor === undefined ? {} : { cursor }),
          };
          const page = await inspection.readPage(input);
          expect(page).toStrictEqual(expected.readPage(input));
          cursor = page.page.nextCursor ?? undefined;
        } while (cursor !== undefined);
      } finally {
        await inspection.dispose();
        await inspection.dispose();
      }
    });
  });

  test('propagates the original parent reader failure and releases admission after cleanup', async () => {
    await withRegistry(async (adapterRegistryUrl) => {
      const source = createRepository();
      const cause = new RepositorySourceException({
        code: 'ACCESS_DENIED',
        operation: 'get-entry',
        path: null,
        retryable: false,
        cause: new Error('private provider detail'),
      });
      const repository = { ...source, getEntry: () => Promise.reject(cause) };
      await expect(createNodeProjectInspection({ repository, adapterRegistryUrl })).rejects.toBe(
        cause,
      );
      const next = await createNodeProjectInspection({ repository: source, adapterRegistryUrl });
      await next.dispose();
    });
  });

  test('keeps admission until a cancelled real reader has actually settled', async () => {
    await withRegistry(async (adapterRegistryUrl) => {
      const source = createRepository();
      const entered = createGate();
      const settle = createGate();
      const controller = new AbortController();
      let readerSignal: AbortSignal | undefined;
      const repository = {
        ...source,
        getEntry: async (_path: unknown, options?: { signal?: AbortSignal }) => {
          readerSignal = options?.signal;
          entered.release();
          await settle.promise;
          return null;
        },
      };
      const operation = createNodeProjectInspection({
        repository,
        adapterRegistryUrl,
        signal: controller.signal,
      });
      try {
        await Promise.race([entered.promise, operation]);
        controller.abort('caller cancellation');
        expect(readerSignal?.aborted).toBe(true);
        await expect(
          createNodeProjectInspection({ repository: source, adapterRegistryUrl }),
        ).rejects.toMatchObject({ code: 'INSPECTION_BUSY', retryable: true });
      } finally {
        settle.release();
        await operation.then(
          (inspection) => inspection.dispose(),
          () => {},
        );
      }
      await expect(operation).rejects.toMatchObject({
        code: 'ABORTED',
        cause: 'caller cancellation',
      });
      const next = await createNodeProjectInspection({ repository: source, adapterRegistryUrl });
      await next.dispose();
    });
  });

  test('classifies an internally expired pending read as timeout and awaits its settlement', async () => {
    await withRegistry(async (adapterRegistryUrl) => {
      const source = createRepository();
      const entered = createGate();
      const settle = createGate();
      const aborted = createGate();
      const repository = {
        ...source,
        getEntry: async (_path: unknown, options?: { signal?: AbortSignal }) => {
          options?.signal?.addEventListener('abort', aborted.release, { once: true });
          entered.release();
          await settle.promise;
          return null;
        },
      };
      const operation = createNodeProjectInspection({
        repository,
        adapterRegistryUrl,
        deadline: Date.now() + 5_000,
      });
      try {
        await Promise.race([entered.promise, operation]);
        await aborted.promise;
        await expect(
          createNodeProjectInspection({ repository: source, adapterRegistryUrl }),
        ).rejects.toMatchObject({ code: 'INSPECTION_BUSY' });
      } finally {
        settle.release();
        await operation.then(
          (inspection) => inspection.dispose(),
          () => {},
        );
      }
      await expect(operation).rejects.toMatchObject({
        code: 'INSPECTION_TIMEOUT',
        retryable: true,
        limit: null,
      });
    });
  });
});

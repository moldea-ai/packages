// @vitest-environment node
import { execFile, spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { describe, expect, test, vi } from 'vitest';

import { RepositorySourceException } from '@moldea.ai/repository';
import {
  createMemoryLinkResolver,
  createMemoryRepositoryReader,
  createIntegratedMemoryRepositoryReader,
  INTEGRATION_TEST_ENTRIES,
} from '../repository.test-fixtures.js';

import { createCore } from '../core/index.js';

import { createNodeProjectInspection } from './client.js';
import { NODE_INSPECTION_TRANSPORT_BYTES } from './constants.js';

const createRepository = () => {
  const reader = createIntegratedMemoryRepositoryReader([
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

const withTemporaryDirectory = async (
  operation: (directory: string) => Promise<void>,
): Promise<void> => {
  const directory = await mkdtemp(path.join(tmpdir(), 'moldea-node-inspection-'));
  try {
    await operation(directory);
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
    await withTemporaryDirectory(async (directory) => {
      const probePath = path.join(directory, 'retention.mjs');
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
          const handle = await createNodeProjectInspection({repository});
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
    const inspection = await createNodeProjectInspection({
      repository: createRepository(),
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
    });
    await next.dispose();
  });
  test.each([NODE_INSPECTION_TRANSPORT_BYTES - 1, NODE_INSPECTION_TRANSPORT_BYTES])(
    'refuses a retained budget with no room after transport reservation (%d bytes)',
    async (maxRetainedBytes) => {
      await expect(
        createNodeProjectInspection({
          repository: createRepository(),
          limits: { maxRetainedBytes },
        }),
      ).rejects.toMatchObject({
        code: 'RESOURCE_LIMIT_EXCEEDED',
        limit: 'maxRetainedBytes',
        limitMaximum: maxRetainedBytes,
        observedUsage: NODE_INSPECTION_TRANSPORT_BYTES,
      });
    },
  );

  test('bounds diagnostic transport pages without losing or repeating records', async () => {
    const bindings = Array.from({ length: 4096 }, (_, index) => ({
      path: `/src/${'x'.repeat(48)}/${index}-${'x'.repeat(48)}.ts`,
    }));
    const repository = createIntegratedMemoryRepositoryReader([
      {
        path: '/moldea/moldea.yaml',
        type: 'file',
        content: JSON.stringify({ version: 1, context: { '/moldea/project.md': { bindings } } }),
      },
      { path: '/moldea/project.md', type: 'file', content: '# Project\n' },
    ]);
    const inspection = await createNodeProjectInspection({
      repository,
      limits: { maxManifestBytes: 4_194_304 },
    });
    try {
      const pointers: (string | null)[] = [];
      let cursor: string | undefined;
      do {
        const page = await inspection.readPage({
          view: 'diagnostics',
          maxItems: 4096,
          ...(cursor === undefined ? {} : { cursor }),
        });
        expect(page.page.records.length).toBeGreaterThan(0);
        expect(page.page.records.length).toBeLessThan(4096);
        for (const { item } of page.page.records)
          if (item.kind === 'diagnostic') pointers.push(item.diagnostic.pointer);
        cursor = page.page.nextCursor ?? undefined;
      } while (cursor !== undefined);
      expect(pointers).toHaveLength(4096);
      expect(new Set(pointers).size).toBe(4096);
      expect(inspection.counts.diagnostics).toBe(4096);
    } finally {
      await inspection.dispose();
    }
  });

  test('closes the supervisor and worker after abrupt parent death', async () => {
    await withTemporaryDirectory(async (directory) => {
      const markerPath = path.join(directory, 'worker-ready.json');
      const parentPath = path.join(directory, 'parent.mjs');
      await writeFile(
        parentPath,
        `
        import childProcess from 'node:child_process';
        import {syncBuiltinESMExports} from 'node:module';
        import {writeFileSync} from 'node:fs';
        const realFork = childProcess.fork;
        let child;
        childProcess.fork = (...args) => { child = realFork(...args); return child; };
        syncBuiltinESMExports();
        const {createNodeProjectInspection} = await import(${JSON.stringify(import.meta.resolve('@moldea.ai/core/node'))});
        const {createMemoryRepositoryReader} = await import(${JSON.stringify(import.meta.resolve('@moldea.ai/repository/memory'))});
        const source = createMemoryRepositoryReader([]);
        const repository = {snapshot: source.snapshot, compare: source.compare.bind(source), listEntriesPage: source.listEntriesPage.bind(source), readFilePage: source.readFilePage.bind(source), getEntry: async () => {
          writeFileSync(${JSON.stringify(markerPath)}, JSON.stringify({pid: child.pid, parentPid: process.pid}));
          await new Promise(() => {});
        }};
        await createNodeProjectInspection({repository});
      `,
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

  test('preserves Core metadata, digests, cursors and content-free paging', async () => {
    const repository = createRepository();
    const expected = await createCore().createProjectInspection({ repository });
    const inspection = await createNodeProjectInspection({ repository });
    try {
      expect(inspection.valid).toBe(true);
      expect(inspection.inspectionDigest).toBe(expected.inspectionDigest);
      expect(inspection.counts).toStrictEqual(expected.counts);
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

  test('preserves accepted warning counts and reasons across the isolated boundary', async () => {
    const reason = 'This directory is reserved for a future release.';
    const repository = createIntegratedMemoryRepositoryReader([
      {
        path: '/moldea/moldea.yaml',
        type: 'file',
        content: JSON.stringify({
          version: 1,
          context: { '/moldea/project.md': { affectedBy: ['/future/**'] } },
          acceptedWarnings: [
            {
              code: 'MOLDEA_IMPACT_PATTERN_UNMATCHED',
              subject: '/moldea/project.md',
              qualifier: '/future/**',
              reason,
            },
          ],
        }),
      },
      { path: '/moldea/project.md', type: 'file', content: '# Project\n' },
    ]);
    const inspection = await createNodeProjectInspection({ repository });
    try {
      expect(inspection.valid).toBe(true);
      expect(inspection.counts).toMatchObject({
        diagnostics: 1,
        errors: 0,
        warnings: 0,
        acceptedWarnings: 1,
      });
      const page = await inspection.readPage({ view: 'diagnostics', maxItems: 1 });
      expect(page.counts).toStrictEqual(inspection.counts);
      expect(page.page.records).toMatchObject([
        {
          item: {
            kind: 'diagnostic',
            diagnostic: {
              accepted: true,
              acceptable: true,
              reason,
              subject: '/moldea/project.md',
              qualifier: '/future/**',
            },
          },
        },
      ]);
    } finally {
      await inspection.dispose();
    }
  });

  test.each(['missing', 'symlink'] as const)(
    'reports a %s root integration through both real reader bridges',
    async (entryKind) => {
      const repository = createMemoryRepositoryReader([
        { path: '/moldea/moldea.yaml', type: 'file', content: 'version: 1\n' },
        { path: '/moldea/project.md', type: 'file', content: '# Project\n' },
        ...(entryKind === 'symlink' ? [{ path: '/AGENTS.md', type: 'symlink' as const }] : []),
      ]);
      const inspection = await createNodeProjectInspection({ repository });
      try {
        expect(inspection.valid).toBe(true);
        expect(inspection.counts).toMatchObject({ errors: 0, warnings: 1 });
        expect(
          (await inspection.readPage({ view: 'diagnostics', maxItems: 8 })).page.records,
        ).toMatchObject([
          {
            item: {
              diagnostic:
                entryKind === 'symlink'
                  ? {
                      code: 'MOLDEA_INTEGRATION_UNVERIFIED',
                      details: { entryKind: 'symlink', linkState: 'unavailable' },
                    }
                  : { code: 'MOLDEA_INTEGRATION_BLOCK_MISSING', details: { entryKind: 'missing' } },
            },
          },
        ]);
      } finally {
        await inspection.dispose();
      }
    },
  );

  test('reads a linked AGENTS.md through the instruction source and its resolver over both bridges', async () => {
    const agents = INTEGRATION_TEST_ENTRIES.find((entry) => entry.path === '/AGENTS.md')!;
    const repository = createMemoryRepositoryReader([
      { path: '/moldea/moldea.yaml', type: 'file', content: 'version: 1\n' },
      { path: '/moldea/project.md', type: 'file', content: '# Project\n' },
      ...INTEGRATION_TEST_ENTRIES.filter((entry) => entry.path !== '/AGENTS.md'),
    ]);
    const reader = createMemoryRepositoryReader([{ path: '/AGENTS.md', type: 'symlink' }]);
    const linkResolver = createMemoryLinkResolver(reader, {
      '/AGENTS.md': {
        content: agents.type === 'file' ? String(agents.content) : '',
        resolution: { state: 'outside', targetIdentity: 'identity:shared', targetType: 'file' },
      },
    });
    const inspection = await createNodeProjectInspection({
      instructions: { linkResolver, reader },
      repository,
    });
    try {
      expect(inspection.counts).toMatchObject({ errors: 0, warnings: 0 });
    } finally {
      await inspection.dispose();
    }

    const unresolvable = await createNodeProjectInspection({
      instructions: {
        linkResolver: createMemoryLinkResolver(reader, {
          '/AGENTS.md': { resolution: { state: 'denied' } },
        }),
        reader,
      },
      repository,
    });
    try {
      expect(
        (await unresolvable.readPage({ view: 'diagnostics', maxItems: 8 })).page.records,
      ).toMatchObject([
        {
          item: {
            diagnostic: {
              code: 'MOLDEA_INTEGRATION_UNVERIFIED',
              details: { entryKind: 'symlink', linkState: 'denied' },
            },
          },
        },
      ]);
    } finally {
      await unresolvable.dispose();
    }
  });

  test('reports a linked AGENTS.md from an instruction source without a resolver as unavailable', async () => {
    const repository = createRepository();
    const reader = createMemoryRepositoryReader([{ path: '/AGENTS.md', type: 'symlink' }]);
    const inspection = await createNodeProjectInspection({ instructions: { reader }, repository });
    try {
      expect(
        (await inspection.readPage({ view: 'diagnostics', maxItems: 8 })).page.records,
      ).toMatchObject([
        {
          item: {
            diagnostic: {
              code: 'MOLDEA_INTEGRATION_UNVERIFIED',
              details: { linkState: 'unavailable' },
            },
          },
        },
      ]);
    } finally {
      await inspection.dispose();
    }
  });

  test.each([
    [
      'an unknown property',
      (reader: ReturnType<typeof createMemoryRepositoryReader>) => ({ reader, extra: true }),
    ],
    [
      'a resolver of another snapshot',
      (reader: ReturnType<typeof createMemoryRepositoryReader>) => ({
        linkResolver: createMemoryLinkResolver(createMemoryRepositoryReader([]), {}),
        reader,
      }),
    ],
  ])('rejects an instruction source with %s before starting a worker', async (_label, create) => {
    const reader = createMemoryRepositoryReader([{ path: '/AGENTS.md', type: 'symlink' }]);
    await expect(
      createNodeProjectInspection({
        instructions: create(reader),
        repository: createRepository(),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
  });

  test('suppresses an incomplete optional pattern check after a reader resource refusal across both bridges', async () => {
    const source = createIntegratedMemoryRepositoryReader([
      {
        path: '/moldea/moldea.yaml',
        type: 'file',
        content: JSON.stringify({
          version: 1,
          context: { '/moldea/project.md': { affectedBy: ['/future/**'] } },
          acceptedWarnings: [
            {
              code: 'MOLDEA_IMPACT_PATTERN_UNMATCHED',
              subject: '/moldea/project.md',
              qualifier: '/future/**',
              reason: 'Reserved for later.',
            },
          ],
        }),
      },
      { path: '/moldea/project.md', type: 'file', content: '# Project\n' },
      { path: '/future', type: 'directory' },
    ]);
    const repository = {
      ...source,
      listEntriesPage: (options: Parameters<typeof source.listEntriesPage>[0]) =>
        options.prefix === '/future'
          ? Promise.reject(
              new RepositorySourceException({
                code: 'RESOURCE_LIMIT_EXCEEDED',
                operation: 'list-entries-page',
                path: options.prefix,
                retryable: false,
                resource: { dimension: 'entries', limit: 1, observed: 2 },
              }),
            )
          : source.listEntriesPage(options),
    };
    const inspection = await createNodeProjectInspection({ repository });
    try {
      expect(inspection.valid).toBe(true);
      expect(inspection.counts).toMatchObject({
        diagnostics: 0,
        errors: 0,
        warnings: 0,
        acceptedWarnings: 0,
      });
    } finally {
      await inspection.dispose();
    }
  });

  test('propagates an unhandled reader absence from a required file through both bridges', async () => {
    const source = createRepository();
    const repository = {
      ...source,
      readFilePage: (
        path: Parameters<typeof source.readFilePage>[0],
        options: Parameters<typeof source.readFilePage>[1],
      ) =>
        path === '/moldea/moldea.yaml'
          ? Promise.reject(
              new RepositorySourceException({
                code: 'ENTRY_NOT_FOUND',
                operation: 'read-file-page',
                path,
                retryable: false,
              }),
            )
          : source.readFilePage(path, options),
    };
    await expect(createNodeProjectInspection({ repository })).rejects.toMatchObject({
      code: 'ENTRY_NOT_FOUND',
      path: '/moldea/moldea.yaml',
    });
    const next = await createNodeProjectInspection({ repository: source });
    await next.dispose();
  });

  test('propagates the original parent reader failure and releases admission after cleanup', async () => {
    const source = createRepository();
    const cause = new RepositorySourceException({
      code: 'ACCESS_DENIED',
      operation: 'get-entry',
      path: null,
      retryable: false,
      cause: new Error('private provider detail'),
    });
    const repository = { ...source, getEntry: () => Promise.reject(cause) };
    await expect(createNodeProjectInspection({ repository })).rejects.toBe(cause);
    const next = await createNodeProjectInspection({ repository: source });
    await next.dispose();
  });

  test('keeps admission until a cancelled real reader has actually settled', async () => {
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
      signal: controller.signal,
    });
    try {
      await Promise.race([entered.promise, operation]);
      controller.abort('caller cancellation');
      expect(readerSignal?.aborted).toBe(true);
      await expect(createNodeProjectInspection({ repository: source })).rejects.toMatchObject({
        code: 'INSPECTION_BUSY',
        retryable: true,
      });
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
    const next = await createNodeProjectInspection({ repository: source });
    await next.dispose();
  });

  test('classifies an internally expired pending read as timeout and awaits its settlement', async () => {
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
      deadline: Date.now() + 5_000,
    });
    try {
      await Promise.race([entered.promise, operation]);
      await aborted.promise;
      await expect(createNodeProjectInspection({ repository: source })).rejects.toMatchObject({
        code: 'INSPECTION_BUSY',
      });
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

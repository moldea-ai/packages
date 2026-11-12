// @vitest-environment node
import { execFile, spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { expectToRejectCode } from 'jg-exception/testing';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { RepositorySourceException } from '@moldea.ai/repository';
import {
  createMemoryRepositoryReader,
  createIntegratedMemoryRepositoryReader,
  INTEGRATION_TEST_ENTRIES,
  LOCATION_TEST_ENTRIES,
} from '../repository.test-fixtures.js';

import { createCore } from '../core/index.js';

import { createNodeProjectInspection } from './client.js';
import { NODE_INSPECTION_TRANSPORT_BYTES } from './constants.js';
import type { INodeProjectInspection, INodeProjectInspectionInput } from './types.js';

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
    readLinkText: reader.readLinkText.bind(reader),
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
  test('transports final cross-file and acceptance diagnostic locations', async () => {
    const inspection = await createNodeProjectInspection({
      repository: createIntegratedMemoryRepositoryReader(LOCATION_TEST_ENTRIES),
    });
    try {
      const page = await inspection.readPage({ view: 'diagnostics', maxItems: 8 });
      const diagnostics = page.page.records.flatMap(({ item }) =>
        item.kind === 'diagnostic' ? [item.diagnostic] : [],
      );
      expect(
        diagnostics.find(({ code }) => code === 'MOLDEA_REFERENCE_EXPORT_MISSING'),
      ).toMatchObject({
        range: { start: { line: 5, column: 9 } },
      });
      expect(diagnostics.find(({ code }) => code === 'MOLDEA_ACCEPTANCE_UNMATCHED')).toMatchObject({
        range: { start: { line: 8, column: 5 } },
      });
    } finally {
      await inspection.dispose();
    }
  });

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
        const repository = {snapshot: source.snapshot, compare: source.compare.bind(source), listEntriesPage: source.listEntriesPage.bind(source), readFilePage: source.readFilePage.bind(source), readLinkText: source.readLinkText.bind(source), getEntry: async () => {
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
        ...(entryKind === 'symlink'
          ? [{ path: '/AGENTS.md', target: '../shared/AGENTS.md', type: 'symlink' as const }]
          : []),
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
                      code: 'MOLDEA_INTEGRATION_LINK_UNRESOLVED',
                      qualifier: 'outside',
                      details: { entryKind: 'symlink', reason: 'outside' },
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

  test('resolves links across the instruction reader and the repository over both bridges', async () => {
    const agents = INTEGRATION_TEST_ENTRIES.find((entry) => entry.path === '/AGENTS.md')!;
    const agentsText = agents.type === 'file' ? String(agents.content) : '';
    const repository = createMemoryRepositoryReader([
      { path: '/moldea/moldea.yaml', type: 'file', content: 'version: 1\n' },
      { path: '/moldea/project.md', type: 'file', content: '# Project\n' },
      { path: '/docs/AGENTS.md', type: 'file', content: agentsText },
      ...INTEGRATION_TEST_ENTRIES.filter((entry) => entry.path !== '/AGENTS.md'),
    ]);
    const toRepository = await createNodeProjectInspection({
      instructions: createMemoryRepositoryReader([
        { path: '/AGENTS.md', target: 'docs/AGENTS.md', type: 'symlink' },
      ]),
      repository,
    });
    try {
      expect(toRepository.counts).toMatchObject({ errors: 0, warnings: 0 });
    } finally {
      await toRepository.dispose();
    }

    const toIgnoredInstruction = await createNodeProjectInspection({
      instructions: createMemoryRepositoryReader([
        { path: '/AGENTS.md', target: 'CLAUDE.local.md', type: 'symlink' },
        { path: '/CLAUDE.local.md', type: 'file', content: agentsText },
      ]),
      repository,
    });
    try {
      expect(toIgnoredInstruction.counts).toMatchObject({ errors: 0, warnings: 0 });
    } finally {
      await toIgnoredInstruction.dispose();
    }

    const unresolved = await createNodeProjectInspection({
      instructions: createMemoryRepositoryReader([
        { path: '/AGENTS.md', target: 'docs/missing.md', type: 'symlink' },
      ]),
      repository,
    });
    try {
      expect(
        (await unresolved.readPage({ view: 'diagnostics', maxItems: 8 })).page.records,
      ).toMatchObject([
        {
          item: {
            diagnostic: {
              code: 'MOLDEA_INTEGRATION_LINK_UNRESOLVED',
              qualifier: 'missing',
              details: { entryKind: 'symlink', reason: 'missing' },
            },
          },
        },
      ]);
    } finally {
      await unresolved.dispose();
    }
  });

  test.each([
    ['a wrapper object', (reader: ReturnType<typeof createMemoryRepositoryReader>) => ({ reader })],
    [
      'a reader without link text',
      (reader: ReturnType<typeof createMemoryRepositoryReader>) => ({
        getEntry: reader.getEntry.bind(reader),
        readFilePage: reader.readFilePage.bind(reader),
        snapshot: reader.snapshot,
      }),
    ],
  ])(
    'rejects an instruction reader that is %s before starting a worker',
    async (_label, create) => {
      const reader = createMemoryRepositoryReader([
        { path: '/AGENTS.md', target: 'docs/AGENTS.md', type: 'symlink' },
      ]);
      await expect(
        createNodeProjectInspection({
          instructions: create(reader) as never,
          repository: createRepository(),
        }),
      ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    },
  );

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

describe('inspection admission', () => {
  const inspections = new Map<INodeProjectInspection, string | undefined>();
  const pending = new Set<Promise<INodeProjectInspection>>();
  const controllers = new Set<AbortController>();
  const gates = new Set<ReturnType<typeof createGate>>();

  const gate = () => {
    const owned = createGate();
    gates.add(owned);
    return owned;
  };

  /** Retains every successful handle for teardown, including partial test setup. */
  const inspect = (input: INodeProjectInspectionInput): Promise<INodeProjectInspection> => {
    const operation = (async () => {
      const inspection = await createNodeProjectInspection(input);
      inspections.set(inspection, undefined);
      return inspection;
    })();
    pending.add(operation);
    void operation.catch(() => {});
    return operation;
  };

  afterEach(async () => {
    try {
      for (const controller of controllers) controller.abort();
      for (const owned of gates) owned.release();
      await Promise.allSettled(pending);
      const cleanup = await Promise.allSettled(
        [...inspections].map(async ([inspection, failureCode]) => {
          if (failureCode === undefined) await inspection.dispose();
          else await expectToRejectCode(inspection.dispose(), failureCode);
        }),
      );
      expect(cleanup).toStrictEqual(cleanup.map(() => ({ status: 'fulfilled', value: undefined })));
    } finally {
      inspections.clear();
      pending.clear();
      controllers.clear();
      gates.clear();
    }
  });

  /** Proves no reservation remains by refilling the complete two-slot capacity. */
  const verifyEmptyAdmission = async (): Promise<void> => {
    const first = await inspect({ repository: createRepository(), maxConcurrentInspections: 2 });
    const second = await inspect({ repository: createRepository(), maxConcurrentInspections: 2 });
    await expectToRejectCode(
      inspect({ repository: createRepository(), maxConcurrentInspections: 2 }),
      'INSPECTION_BUSY',
      'Project inspection capacity is busy. Try again shortly.',
    );
    await Promise.all([first.dispose(), second.dispose()]);
  };

  test.each([
    ['omitted', {}],
    ['undefined', { maxConcurrentInspections: undefined }],
    ['one', { maxConcurrentInspections: 1 }],
  ])('preserves single admission with %s maximum', async (_label, options) => {
    const input = { repository: createRepository(), ...options } as INodeProjectInspectionInput;
    const first = await inspect(input);
    await first.readPage({ maxItems: 1, view: 'all' });
    await expectToRejectCode(
      inspect(input),
      'INSPECTION_BUSY',
      'Project inspection capacity is busy. Try again shortly.',
    );
    await expectToRejectCode(
      inspect({ ...input, maxConcurrentInspections: 0 }),
      'INVALID_ARGUMENT',
      'The Core operation received an invalid argument.',
    );
    await Promise.all([first.dispose(), first.dispose()]);
    const next = await inspect(input);
    await next.dispose();
    await verifyEmptyAdmission();
  });

  test('admits two gated preparations, keeps their pages independent and releases each slot once', async () => {
    const repository = createRepository();
    const expected = await createCore().createProjectInspection({ repository });
    const entries = [gate(), gate()];
    const settlements = [gate(), gate()];
    const operations = entries.map((entered, index) =>
      inspect({
        repository: {
          ...repository,
          getEntry: async (...args: Parameters<typeof repository.getEntry>) => {
            entered.release();
            await settlements[index]!.promise;
            return repository.getEntry(...args);
          },
        },
        maxConcurrentInspections: 2,
      }),
    );
    await Promise.race([
      Promise.all(entries.map((entered) => entered.promise)),
      Promise.all(operations),
    ]);
    await expectToRejectCode(
      inspect({ repository, maxConcurrentInspections: 2 }),
      'INSPECTION_BUSY',
    );
    for (const settlement of settlements) settlement.release();
    const [first, second] = await Promise.all(operations);
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    for (const inspection of [first!, second!]) {
      expect(inspection.inspectionDigest).toBe(expected.inspectionDigest);
      expect(inspection.counts).toStrictEqual(expected.counts);
      for (const view of ['all', 'metadata', 'diagnostics', 'coverage'] as const) {
        let cursor: string | undefined;
        do {
          const input = { maxItems: 1, view, ...(cursor === undefined ? {} : { cursor }) };
          const page = await inspection.readPage(input);
          expect(page).toStrictEqual(expected.readPage(input));
          cursor = page.page.nextCursor ?? undefined;
        } while (cursor !== undefined);
      }
    }
    await Promise.all([first!.dispose(), first!.dispose()]);
    const replacement = await inspect({ repository, maxConcurrentInspections: 2 });
    await expectToRejectCode(
      inspect({ repository, maxConcurrentInspections: 2 }),
      'INSPECTION_BUSY',
    );
    await second!.readPage({ maxItems: 1, view: 'all' });
    await Promise.all([second!.dispose(), replacement.dispose()]);
    await verifyEmptyAdmission();
  });

  test('uses each incoming maximum without remembering an earlier caller value', async () => {
    const repository = createRepository();
    const first = await inspect({ repository, maxConcurrentInspections: 2 });
    await expectToRejectCode(inspect({ repository }), 'INSPECTION_BUSY');
    const second = await inspect({ repository, maxConcurrentInspections: 2 });
    const third = await inspect({ repository, maxConcurrentInspections: 3 });
    await expectToRejectCode(
      inspect({ repository, maxConcurrentInspections: 2 }),
      'INSPECTION_BUSY',
    );
    await Promise.all([first.dispose(), second.dispose(), third.dispose()]);
    await verifyEmptyAdmission();
  });

  test.each([
    ['reader failure', 'ACCESS_DENIED'],
    ['abort', 'ABORTED'],
    ['timeout', 'INSPECTION_TIMEOUT'],
  ])('releases only its own pending slot after %s and reader settlement', async (mode, code) => {
    const repository = createRepository();
    const companion = await inspect({ repository, maxConcurrentInspections: 2 });
    const entered = gate();
    const settlement = gate();
    const aborted = gate();
    const controller = new AbortController();
    controllers.add(controller);
    const operation = inspect({
      repository: {
        ...repository,
        getEntry: async (...args: Parameters<typeof repository.getEntry>) => {
          args[1]?.signal?.addEventListener('abort', aborted.release, { once: true });
          entered.release();
          await settlement.promise;
          if (mode === 'reader failure')
            throw new RepositorySourceException({
              code: 'ACCESS_DENIED',
              operation: 'get-entry',
              path: null,
              retryable: false,
            });
          return repository.getEntry(...args);
        },
      },
      maxConcurrentInspections: 2,
      signal: controller.signal,
      ...(mode === 'timeout' ? { deadline: Date.now() + 5_000 } : {}),
    });
    await Promise.race([entered.promise, operation]);
    if (mode === 'abort') controller.abort();
    if (mode !== 'reader failure') await aborted.promise;
    await expectToRejectCode(
      inspect({ repository, maxConcurrentInspections: 2 }),
      'INSPECTION_BUSY',
    );
    settlement.release();
    await expectToRejectCode(operation, code);
    const replacement = await inspect({ repository, maxConcurrentInspections: 2 });
    await expectToRejectCode(
      inspect({ repository, maxConcurrentInspections: 2 }),
      'INSPECTION_BUSY',
    );
    await companion.readPage({ view: 'all', maxItems: 1 });
    await Promise.all([companion.dispose(), replacement.dispose()]);
    await verifyEmptyAdmission();
  });

  test.each(['paging failure', 'prepared abort', 'dispose'] as const)(
    'releases only its own prepared slot after %s',
    async (mode) => {
      const repository = createRepository();
      const companion = await inspect({ repository, maxConcurrentInspections: 2 });
      const controller = new AbortController();
      controllers.add(controller);
      const inspection = await inspect({
        repository,
        maxConcurrentInspections: 2,
        signal: controller.signal,
      });
      if (mode === 'paging failure') {
        inspections.set(inspection, 'INVALID_ARGUMENT');
        await expectToRejectCode(
          inspection.readPage({ maxItems: 1, view: 'all', cursor: 'invalid' }),
          'INVALID_ARGUMENT',
        );
        await expectToRejectCode(inspection.dispose(), 'INVALID_ARGUMENT');
      } else if (mode === 'prepared abort') {
        inspections.set(inspection, 'ABORTED');
        controller.abort();
        await expectToRejectCode(inspection.dispose(), 'ABORTED');
      } else await Promise.all([inspection.dispose(), inspection.dispose()]);
      const replacement = await inspect({ repository, maxConcurrentInspections: 2 });
      await expectToRejectCode(
        inspect({ repository, maxConcurrentInspections: 2 }),
        'INSPECTION_BUSY',
      );
      await companion.readPage({ view: 'all', maxItems: 1 });
      await Promise.all([companion.dispose(), replacement.dispose()]);
      await verifyEmptyAdmission();
    },
  );

  test('accepts the largest positive safe integer without preallocating capacity', async () => {
    const inspection = await inspect({
      repository: createRepository(),
      maxConcurrentInspections: Number.MAX_SAFE_INTEGER,
    });
    await inspection.dispose();
    await verifyEmptyAdmission();
  });

  test('releases a synchronous fork failure without releasing a live companion slot', async () => {
    await withTemporaryDirectory(async (directory) => {
      const probePath = path.join(directory, 'fork-failure.mjs');
      await writeFile(
        probePath,
        `
        import childProcess from 'node:child_process';
        import {syncBuiltinESMExports} from 'node:module';
        import {expectToRejectCode} from ${JSON.stringify(import.meta.resolve('jg-exception/testing'))};
        import {createNodeProjectInspection} from ${JSON.stringify(import.meta.resolve('@moldea.ai/core/node'))};
        import {createMemoryRepositoryReader} from ${JSON.stringify(import.meta.resolve('@moldea.ai/repository/memory'))};
        const repository = createMemoryRepositoryReader([]);
        const realFork = childProcess.fork;
        const handles = [];
        const inspect = async () => {
          const handle = await createNodeProjectInspection({repository, maxConcurrentInspections: 2});
          handles.push(handle);
          return handle;
        };
        try {
          await inspect();
          try {
            childProcess.fork = () => { throw new Error('injected synchronous fork failure'); };
            syncBuiltinESMExports();
            await expectToRejectCode(inspect(), 'INSPECTION_PROCESS_FAILED');
          } finally {
            childProcess.fork = realFork;
            syncBuiltinESMExports();
          }
          const replacement = await inspect();
          await expectToRejectCode(inspect(), 'INSPECTION_BUSY');
          await Promise.all([replacement.dispose(), replacement.dispose()]);
          await inspect();
          await expectToRejectCode(inspect(), 'INSPECTION_BUSY');
          await Promise.all(handles.map(handle => handle.dispose()));
          await inspect();
          await inspect();
          await expectToRejectCode(inspect(), 'INSPECTION_BUSY');
          process.stdout.write('admission recovered');
        } finally {
          childProcess.fork = realFork;
          syncBuiltinESMExports();
          await Promise.all(handles.map(handle => handle.dispose()));
        }
      `,
      );
      const { stdout, stderr } = await promisify(execFile)(process.execPath, [probePath], {
        encoding: 'utf8',
        maxBuffer: 16_384,
        timeout: 15_000,
      });
      expect(stdout).toBe('admission recovered');
      expect(stderr).toBe('');
    });
  });
});

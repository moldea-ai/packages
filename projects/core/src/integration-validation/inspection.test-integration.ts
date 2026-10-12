// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { createCore } from '../core/index.js';
import {
  createMemoryRepositoryReader,
  INTEGRATION_TEST_ENTRIES,
  INTEGRATION_TEST_TEMPLATE,
  type IMemoryRepositoryEntry,
} from '../repository.test-fixtures.js';
import { matchManifestScope } from '../scope/index.js';
import { parseRepositoryPath, RepositorySourceException } from '@moldea.ai/repository';

const agentsPath = '/AGENTS.md';
const skillPath = '/.agents/skills/moldea';
const block = INTEGRATION_TEST_TEMPLATE.replaceAll('{{skill-path}}', '.agents/skills/moldea');
const createRepository = (entries: IMemoryRepositoryEntry[], acceptedWarnings?: unknown[]) =>
  createMemoryRepositoryReader([
    {
      path: '/moldea/moldea.yaml',
      type: 'file',
      content: JSON.stringify({
        version: 1,
        ...(acceptedWarnings === undefined ? {} : { acceptedWarnings }),
      }),
    },
    { path: '/moldea/project.md', type: 'file', content: '# Project\n' },
    ...entries,
  ]);

describe('coding-agent integration through Core', () => {
  test.each([
    [[], 'missing'],
    [[{ path: agentsPath, type: 'symlink' }], 'non-regular'],
    [[{ path: agentsPath, type: 'directory' }], 'non-regular'],
    [[{ path: agentsPath, type: 'file', content: '# Instructions\n' }], 'file'],
  ] satisfies [IMemoryRepositoryEntry[], string][])(
    'reports a missing block for %o (%s)',
    async (entries, entryKind) => {
      const result = await createCore().validateProject({ repository: createRepository(entries) });
      expect(result.valid).toBe(true);
      expect(result.diagnostics).toMatchObject([
        {
          code: 'MOLDEA_INTEGRATION_BLOCK_MISSING',
          severity: 'warning',
          group: 'integration',
          subject: agentsPath,
          qualifier: null,
          acceptable: true,
          entity: { integrationPath: agentsPath },
          details: { entryKind },
        },
      ]);
    },
  );
  test('reports a block with no extractable gate path as a missing installation', async () => {
    const result = await createCore().validateProject({
      repository: createRepository([
        {
          path: agentsPath,
          type: 'file',
          content: '<!-- moldea:start -->\nNo gate.\n<!-- moldea:end -->\n',
        },
      ]),
    });
    expect(result.diagnostics).toMatchObject([
      { code: 'MOLDEA_INTEGRATION_SKILL_MISSING', details: { reason: 'skill-path-missing' } },
    ]);
  });
  test.each(['SKILL.md', 'scripts/relevance-gate.mjs', 'assets/managed-agents-block.md'])(
    'reports the missing regular installation file %s',
    async (file) => {
      const result = await createCore().validateProject({
        repository: createRepository(
          INTEGRATION_TEST_ENTRIES.filter((entry) => entry.path !== `${skillPath}/${file}`),
        ),
      });
      expect(result.diagnostics).toMatchObject([
        {
          code: 'MOLDEA_INTEGRATION_SKILL_MISSING',
          details: { referencedPath: skillPath, missingFile: `${skillPath}/${file}` },
        },
      ]);
    },
  );
  test('reports a block naming an absent installation', async () => {
    const result = await createCore().validateProject({
      repository: createRepository([{ path: agentsPath, type: 'file', content: block }]),
    });
    expect(result.diagnostics).toMatchObject([
      {
        code: 'MOLDEA_INTEGRATION_SKILL_MISSING',
        details: { missingFile: `${skillPath}/SKILL.md` },
      },
    ]);
  });
  test('reports text drift against the installed asset', async () => {
    const entries = INTEGRATION_TEST_ENTRIES.map((entry) =>
      entry.path === agentsPath
        ? { ...entry, content: block.replace('--repository', '--changed') }
        : entry,
    );
    const result = await createCore().validateProject({ repository: createRepository(entries) });
    expect(result.diagnostics).toMatchObject([{ code: 'MOLDEA_INTEGRATION_BLOCK_STALE' }]);
  });

  test('reports invalid UTF-8 in AGENTS.md as a missing integration block', async () => {
    const entries = INTEGRATION_TEST_ENTRIES.map((entry) =>
      entry.path === agentsPath ? { ...entry, content: new Uint8Array([255]) } : entry,
    );
    const result = await createCore().validateProject({ repository: createRepository(entries) });
    expect(result.diagnostics).toMatchObject([
      {
        code: 'MOLDEA_INTEGRATION_BLOCK_MISSING',
        details: { entryKind: 'file', reason: 'invalid-utf8' },
      },
    ]);
  });

  test('reports invalid UTF-8 in the installed asset as a stale integration block', async () => {
    const entries = INTEGRATION_TEST_ENTRIES.map((entry) =>
      entry.path === `${skillPath}/assets/managed-agents-block.md`
        ? { ...entry, content: new Uint8Array([255]) }
        : entry,
    );
    const result = await createCore().validateProject({ repository: createRepository(entries) });
    expect(result.diagnostics).toMatchObject([
      {
        code: 'MOLDEA_INTEGRATION_BLOCK_STALE',
        details: { referencedPath: skillPath, reason: 'invalid-utf8-asset' },
      },
    ]);
  });

  test.each(['\n', '\r\n'])(
    'recognizes a current installation with %o line endings',
    async (ending) => {
      const entries = INTEGRATION_TEST_ENTRIES.map((entry) =>
        entry.path === agentsPath
          ? { ...entry, content: '# Instructions' + ending + block.replaceAll('\n', ending) }
          : entry,
      );
      const result = await createCore().validateProject({ repository: createRepository(entries) });
      expect(result.diagnostics).toStrictEqual([]);
      expect(result.valid).toBe(true);
    },
  );
  test('accepts an integration warning with its reason and reports obsolete acceptance after repair', async () => {
    const reason = 'The shared instructions own this integration.';
    const acceptance = { code: 'MOLDEA_INTEGRATION_BLOCK_MISSING', subject: agentsPath, reason };
    const result = await createCore().validateProject({
      repository: createRepository([], [acceptance]),
    });
    expect(result.diagnostics).toMatchObject([{ accepted: true, reason }]);
    expect(result.warningCount).toBe(0);
    expect(result.acceptedWarningCount).toBe(1);
    const repaired = await createCore().validateProject({
      repository: createRepository([...INTEGRATION_TEST_ENTRIES], [acceptance]),
    });
    expect(repaired.diagnostics).toMatchObject([
      { code: 'MOLDEA_ACCEPTANCE_UNMATCHED', acceptable: false },
    ]);
  });
  test('uses only two bounded integration reads and two integration entry lookups', async () => {
    const source = createRepository([...INTEGRATION_TEST_ENTRIES]);
    const reads: string[] = [];
    const lookups: string[] = [];
    const repository = {
      ...source,
      getEntry: (
        path: Parameters<typeof source.getEntry>[0],
        options: Parameters<typeof source.getEntry>[1],
      ) => {
        if (path === agentsPath || path.startsWith(skillPath + '/')) lookups.push(path);
        return source.getEntry(path, options);
      },
      readFilePage: (
        path: Parameters<typeof source.readFilePage>[0],
        options: Parameters<typeof source.readFilePage>[1],
      ) => {
        if (path === agentsPath || path.startsWith(skillPath + '/')) reads.push(path);
        return source.readFilePage(path, options);
      },
    };
    expect((await createCore().validateProject({ repository })).diagnostics).toStrictEqual([]);
    expect(reads).toStrictEqual([agentsPath, `${skillPath}/assets/managed-agents-block.md`]);
    expect(lookups).toStrictEqual([
      `${skillPath}/SKILL.md`,
      `${skillPath}/scripts/relevance-gate.mjs`,
    ]);
  });
  test.each(['SKILL.md', 'scripts/relevance-gate.mjs', 'assets/managed-agents-block.md'])(
    'rejects a symlinked installation file without following it (%s)',
    async (file) => {
      const entries = INTEGRATION_TEST_ENTRIES.map((entry) =>
        entry.path === `${skillPath}/${file}`
          ? { path: entry.path, type: 'symlink' as const }
          : entry,
      );
      const result = await createCore().validateProject({ repository: createRepository(entries) });
      expect(result.diagnostics).toMatchObject([
        {
          code: 'MOLDEA_INTEGRATION_SKILL_MISSING',
          details: { missingFile: `${skillPath}/${file}` },
        },
      ]);
    },
  );

  test('propagates source failures instead of replacing them with an integration warning', async () => {
    const source = createRepository([...INTEGRATION_TEST_ENTRIES]);
    const failure = new RepositorySourceException({
      code: 'ACCESS_DENIED',
      operation: 'read-file-page',
      path: parseRepositoryPath(agentsPath),
      retryable: false,
    });
    const repository = {
      ...source,
      readFilePage: (
        path: Parameters<typeof source.readFilePage>[0],
        options: Parameters<typeof source.readFilePage>[1],
      ) => (path === agentsPath ? Promise.reject(failure) : source.readFilePage(path, options)),
    };
    await expect(createCore().validateProject({ repository })).rejects.toBe(failure);
  });

  test('propagates cancellation during the integration read without returning a partial result', async () => {
    const source = createRepository([...INTEGRATION_TEST_ENTRIES]);
    const controller = new AbortController();
    const repository = {
      ...source,
      readFilePage: (
        path: Parameters<typeof source.readFilePage>[0],
        options: Parameters<typeof source.readFilePage>[1],
      ) => {
        if (path === agentsPath) controller.abort();
        return source.readFilePage(path, options);
      },
    };
    await expect(
      createCore().validateProject({ repository, signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'ABORTED' });
  });

  test('rejects an integration file beyond maxFileBytes without returning partial warnings', async () => {
    const entries = INTEGRATION_TEST_ENTRIES.map((entry) =>
      entry.path === agentsPath ? { ...entry, content: 'x'.repeat(2048) } : entry,
    );
    await expect(
      createCore({ limits: { maxFileBytes: 1024 } }).validateProject({
        repository: createRepository(entries),
      }),
    ).rejects.toMatchObject({ code: 'RESOURCE_LIMIT_EXCEEDED', limit: 'maxFileBytes' });
  });

  test('reserves placeholder expansion before constructing rendered asset text', async () => {
    const entries = INTEGRATION_TEST_ENTRIES.map((entry) =>
      entry.path === `${skillPath}/assets/managed-agents-block.md`
        ? { ...entry, content: '{{skill-path}}'.repeat(4096) }
        : entry,
    );
    await expect(
      createCore({ limits: { maxRetainedBytes: 524_288 } }).validateProject({
        repository: createRepository(entries),
      }),
    ).rejects.toMatchObject({ code: 'RESOURCE_LIMIT_EXCEEDED', limit: 'maxRetainedBytes' });
  });

  test('scope and manifest-only operations never read the root integration', async () => {
    const manifest = { path: parseRepositoryPath('/moldea/moldea.yaml'), content: 'version: 1\n' };
    expect((await createCore().parseManifest(manifest)).valid).toBe(true);
    expect((await matchManifestScope({ manifest, paths: [agentsPath] })).diagnostics).toStrictEqual(
      [],
    );
  });
});

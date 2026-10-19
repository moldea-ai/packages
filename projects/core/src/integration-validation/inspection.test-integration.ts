// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { createCore } from '../core/index.js';
import {
  createMemoryLinkResolver,
  createMemoryRepositoryReader,
  INTEGRATION_TEST_ENTRIES,
  INTEGRATION_TEST_TEMPLATE,
  type IMemoryLinkFixture,
  type IMemoryRepositoryEntry,
} from '../repository.test-fixtures.js';
import { matchManifestScope } from '../scope/index.js';
import {
  parseRepositoryPath,
  RepositorySourceException,
  type IRepositoryLinkResolution,
} from '@moldea.ai/repository';

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
  test('reports a symlinked AGENTS.md without a link resolver as unverifiable', async () => {
    const result = await createCore().validateProject({
      repository: createRepository([{ path: agentsPath, type: 'symlink' }]),
    });
    expect(result.valid).toBe(true);
    expect(result.diagnostics).toMatchObject([
      {
        code: 'MOLDEA_INTEGRATION_UNVERIFIED',
        message: "The instruction file's moldea integration cannot be verified.",
        severity: 'warning',
        group: 'integration',
        subject: agentsPath,
        qualifier: null,
        acceptable: true,
        entity: { integrationPath: agentsPath },
        details: { entryKind: 'symlink', linkState: 'unavailable' },
      },
    ]);
  });
  test.each([
    [[], 'missing'],
    [[{ path: agentsPath, type: 'directory' }], 'directory'],
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
  test('uses only two bounded integration reads and three integration entry lookups', async () => {
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
      agentsPath,
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

const currentBlock = INTEGRATION_TEST_ENTRIES.find((entry) => entry.path === agentsPath)!;
const currentText = currentBlock.type === 'file' ? String(currentBlock.content) : '';
const insideFile = (content?: string): IMemoryLinkFixture => ({
  ...(content === undefined ? {} : { content }),
  resolution: {
    state: 'inside',
    targetIdentity: 'identity:shared',
    targetPath: parseRepositoryPath('/shared/AGENTS.md'),
    targetType: 'file',
  },
});
const outsideFile = (content?: string): IMemoryLinkFixture => ({
  ...(content === undefined ? {} : { content }),
  resolution: { state: 'outside', targetIdentity: 'identity:outside', targetType: 'file' },
});

/** Creates the main repository with a current installation and an instruction source. */
const createLinkedInput = (link: IMemoryLinkFixture | null, acceptedWarnings?: unknown[]) => {
  const repository = createRepository(
    INTEGRATION_TEST_ENTRIES.filter((entry) => entry.path !== agentsPath),
    acceptedWarnings,
  );
  const reader = createMemoryRepositoryReader([{ path: agentsPath, type: 'symlink' }]);
  return {
    instructions: {
      reader,
      ...(link === null
        ? {}
        : { linkResolver: createMemoryLinkResolver(reader, { [agentsPath]: link }) }),
    },
    repository,
  };
};

describe('linked AGENTS.md through an instruction source', () => {
  test.each([
    ['an inside regular file', insideFile(currentText)],
    ['an outside regular file', outsideFile(currentText)],
  ])('checks %s with a current block without warnings', async (_label, link) => {
    const result = await createCore().validateProject(createLinkedInput(link));
    expect(result.diagnostics).toStrictEqual([]);
  });

  test.each([
    ['inside', insideFile(currentText.replace('--repository', '--changed'))],
    ['outside', outsideFile(currentText.replace('--repository', '--changed'))],
  ])('reports drift in an %s target as a stale block', async (_label, link) => {
    const result = await createCore().validateProject(createLinkedInput(link));
    expect(result.diagnostics).toMatchObject([
      { code: 'MOLDEA_INTEGRATION_BLOCK_STALE', subject: agentsPath },
    ]);
  });

  test('reports a target without a block as a missing block on the link itself', async () => {
    const result = await createCore().validateProject(
      createLinkedInput(outsideFile('# Shared instructions\n')),
    );
    expect(result.diagnostics).toMatchObject([
      {
        code: 'MOLDEA_INTEGRATION_BLOCK_MISSING',
        subject: agentsPath,
        details: { entryKind: 'symlink', linkTarget: 'outside', reason: 'block-missing' },
      },
    ]);
  });

  test.each([
    [{ state: 'broken' }, 'broken'],
    [{ state: 'loop' }, 'loop'],
    [{ state: 'denied' }, 'denied'],
    [{ state: 'unsafe' }, 'unsafe'],
    [{ state: 'not-link' }, 'not-link'],
    [
      {
        state: 'inside',
        targetIdentity: 'identity:docs',
        targetPath: parseRepositoryPath('/docs'),
        targetType: 'directory',
      },
      'directory',
    ],
    [{ state: 'outside', targetIdentity: 'identity:pipe', targetType: 'other' }, 'other'],
  ] satisfies [IRepositoryLinkResolution, string][])(
    'reports a %o link as unverifiable without reading it',
    async (resolution, linkState) => {
      const result = await createCore().validateProject(createLinkedInput({ resolution }));
      expect(result.valid).toBe(true);
      expect(result.diagnostics).toMatchObject([
        {
          code: 'MOLDEA_INTEGRATION_UNVERIFIED',
          subject: agentsPath,
          entity: { integrationPath: agentsPath },
          details: { entryKind: 'symlink', linkState },
        },
      ]);
    },
  );

  test('reports a link from a source without a resolver as unverifiable', async () => {
    const result = await createCore().validateProject(createLinkedInput(null));
    expect(result.diagnostics).toMatchObject([
      { code: 'MOLDEA_INTEGRATION_UNVERIFIED', details: { linkState: 'unavailable' } },
    ]);
  });

  test('reads the skill installation from the repository, never the instruction source', async () => {
    const input = createLinkedInput(outsideFile(currentText));
    const instructionCalls: string[] = [];
    const repositoryCalls: string[] = [];
    const { reader, linkResolver } = input.instructions;
    const observedReader = {
      ...reader,
      getEntry: (
        path: Parameters<typeof reader.getEntry>[0],
        options?: Parameters<typeof reader.getEntry>[1],
      ) => {
        instructionCalls.push(`get:${path}`);
        return reader.getEntry(path, options);
      },
      readFilePage: (
        path: Parameters<typeof reader.readFilePage>[0],
        options: Parameters<typeof reader.readFilePage>[1],
      ) => {
        instructionCalls.push(`read:${path}`);
        return reader.readFilePage(path, options);
      },
    };
    const observedResolver = {
      ...linkResolver!,
      resolveLink: (
        path: Parameters<typeof reader.getEntry>[0],
        options?: Parameters<typeof reader.getEntry>[1],
      ) => {
        instructionCalls.push(`resolve:${path}`);
        return linkResolver!.resolveLink(path, options);
      },
      readLinkTargetPage: (
        path: Parameters<typeof reader.readFilePage>[0],
        options: Parameters<typeof reader.readFilePage>[1],
      ) => {
        instructionCalls.push(`read-target:${path}`);
        return linkResolver!.readLinkTargetPage(path, options);
      },
    };
    const repository = {
      ...input.repository,
      getEntry: (
        path: Parameters<typeof reader.getEntry>[0],
        options?: Parameters<typeof reader.getEntry>[1],
      ) => {
        if (path.startsWith(skillPath)) repositoryCalls.push(`get:${path}`);
        return input.repository.getEntry(path, options);
      },
      readFilePage: (
        path: Parameters<typeof reader.readFilePage>[0],
        options: Parameters<typeof reader.readFilePage>[1],
      ) => {
        if (path.startsWith(skillPath)) repositoryCalls.push(`read:${path}`);
        return input.repository.readFilePage(path, options);
      },
    };
    const result = await createCore().validateProject({
      instructions: { linkResolver: observedResolver, reader: observedReader },
      repository,
    });
    expect(result.diagnostics).toStrictEqual([]);
    expect(instructionCalls).toStrictEqual([
      `get:${agentsPath}`,
      `resolve:${agentsPath}`,
      `read-target:${agentsPath}`,
    ]);
    expect(repositoryCalls).toStrictEqual([
      `get:${skillPath}/SKILL.md`,
      `get:${skillPath}/scripts/relevance-gate.mjs`,
      `read:${skillPath}/assets/managed-agents-block.md`,
    ]);
  });

  test('keeps instruction files out of reference checks, pattern matching, and coverage', async () => {
    const reader = createMemoryRepositoryReader([
      { path: agentsPath, type: 'file', content: currentText },
    ]);
    const repository = createMemoryRepositoryReader([
      ...INTEGRATION_TEST_ENTRIES.filter((entry) => entry.path !== agentsPath),
      {
        path: '/moldea/moldea.yaml',
        type: 'file',
        content: JSON.stringify({
          version: 1,
          context: { '/moldea/project.md': { affectedBy: ['/AGENTS.md', '/AGENTS*.md'] } },
        }),
      },
      { path: '/moldea/project.md', type: 'file', content: '# Project\n' },
    ]);
    const withoutSource = await createCore().validateProject({ repository });
    const withSource = await createCore().validateProject({ instructions: { reader }, repository });
    const outsideIntegration = (result: typeof withSource) =>
      result.diagnostics.filter((diagnostic) => diagnostic.group !== 'integration');

    expect(
      outsideIntegration(withoutSource)
        .map((diagnostic) => diagnostic.code)
        .sort(),
    ).toStrictEqual(['MOLDEA_IMPACT_PATH_MISSING', 'MOLDEA_IMPACT_PATTERN_UNMATCHED']);
    expect(outsideIntegration(withSource)).toStrictEqual(outsideIntegration(withoutSource));
    expect(withoutSource.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      'MOLDEA_INTEGRATION_BLOCK_MISSING',
    );
    expect(
      withSource.diagnostics.filter((diagnostic) => diagnostic.group === 'integration'),
    ).toStrictEqual([]);
    expect(withSource.summary).toStrictEqual(withoutSource.summary);
    expect(withSource.coverage).toStrictEqual(withoutSource.coverage);
  });

  test('accepts an unverifiable link and reports the acceptance unmatched once it is readable', async () => {
    const reason = 'The shared instructions live outside this checkout.';
    const acceptance = { code: 'MOLDEA_INTEGRATION_UNVERIFIED', subject: agentsPath, reason };
    const accepted = await createCore().validateProject(
      createLinkedInput({ resolution: { state: 'broken' } }, [acceptance]),
    );
    expect(accepted.diagnostics).toMatchObject([
      { code: 'MOLDEA_INTEGRATION_UNVERIFIED', accepted: true, reason },
    ]);
    expect(accepted.warningCount).toBe(0);
    const repaired = await createCore().validateProject(
      createLinkedInput(outsideFile(currentText), [acceptance]),
    );
    expect(repaired.diagnostics).toMatchObject([
      { code: 'MOLDEA_ACCEPTANCE_UNMATCHED', acceptable: false },
    ]);
  });

  test.each([
    [
      'an unknown property',
      (input: ReturnType<typeof createLinkedInput>) => ({ ...input.instructions, extra: true }),
    ],
    [
      'a resolver bound to another snapshot',
      (input: ReturnType<typeof createLinkedInput>) => ({
        ...input.instructions,
        linkResolver: createMemoryLinkResolver(input.repository, {}),
      }),
    ],
    ['a reader without operations', () => ({ reader: {} })],
  ])('rejects an instruction source with %s', async (_label, createInstructions) => {
    const input = createLinkedInput(outsideFile(currentText));
    await expect(
      createCore().validateProject({
        instructions: createInstructions(input) as never,
        repository: input.repository,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
  });

  test('uses three entry lookups, one link resolution, and two bounded reads for a link', async () => {
    const input = createLinkedInput(outsideFile(currentText));
    const operations: string[] = [];
    const { reader, linkResolver } = input.instructions;
    const result = await createCore().validateProject({
      instructions: {
        reader: {
          ...reader,
          getEntry: (path, options) => {
            operations.push(`lookup:${path}`);
            return reader.getEntry(path, options);
          },
        },
        linkResolver: {
          ...linkResolver!,
          resolveLink: (path, options) => {
            operations.push(`resolve:${path}`);
            return linkResolver!.resolveLink(path, options);
          },
          readLinkTargetPage: (path, options) => {
            operations.push(`read:${path}`);
            return linkResolver!.readLinkTargetPage(path, options);
          },
        },
      },
      repository: {
        ...input.repository,
        getEntry: (path, options) => {
          if (path.startsWith(skillPath)) operations.push(`lookup:${path}`);
          return input.repository.getEntry(path, options);
        },
        readFilePage: (path, options) => {
          if (path.startsWith(skillPath)) operations.push(`read:${path}`);
          return input.repository.readFilePage(path, options);
        },
      },
    });
    expect(result.diagnostics).toStrictEqual([]);
    expect(operations).toStrictEqual([
      `lookup:${agentsPath}`,
      `resolve:${agentsPath}`,
      `read:${agentsPath}`,
      `lookup:${skillPath}/SKILL.md`,
      `lookup:${skillPath}/scripts/relevance-gate.mjs`,
      `read:${skillPath}/assets/managed-agents-block.md`,
    ]);
  });
});

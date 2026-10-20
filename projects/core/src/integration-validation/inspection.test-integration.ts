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

const link = (path: string, target: string): IMemoryRepositoryEntry => ({
  path,
  target,
  type: 'symlink',
});
const textFile = (path: string, content: string): IMemoryRepositoryEntry => ({
  path,
  type: 'file',
  content,
});

describe('coding-agent integration through Core', () => {
  test('reports a symlinked AGENTS.md that leaves the repository with its reason', async () => {
    const result = await createCore().validateProject({
      repository: createRepository([link(agentsPath, '../shared/AGENTS.md')]),
    });
    expect(result.valid).toBe(true);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics).toMatchObject([
      {
        code: 'MOLDEA_INTEGRATION_LINK_UNRESOLVED',
        message: "This instruction file's link doesn't lead to a file in the repository.",
        severity: 'warning',
        group: 'integration',
        subject: agentsPath,
        qualifier: 'outside',
        acceptable: true,
        entity: { integrationPath: agentsPath },
        details: { entryKind: 'symlink', reason: 'outside' },
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
        entry.path === `${skillPath}/${file}` ? link(entry.path, 'elsewhere.md') : entry,
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
const agentsFile = textFile(agentsPath, currentText);

/** Creates a repository with a current installation plus files, and an instruction reader. */
const createInput = (
  instructionEntries: IMemoryRepositoryEntry[],
  repositoryEntries: IMemoryRepositoryEntry[] = [],
  acceptedWarnings?: unknown[],
) => ({
  instructions: createMemoryRepositoryReader(instructionEntries),
  repository: createRepository(
    [
      ...INTEGRATION_TEST_ENTRIES.filter((entry) => entry.path !== agentsPath),
      ...repositoryEntries,
    ],
    acceptedWarnings,
  ),
});

/** Records the paths each source is asked about, so tests can prove where Core reads. */
const observe = (
  calls: string[],
  reader: ReturnType<typeof createMemoryRepositoryReader>,
  shouldRecord: (path: string) => boolean = () => true,
) => ({
  ...reader,
  getEntry: (
    path: Parameters<typeof reader.getEntry>[0],
    options?: Parameters<typeof reader.getEntry>[1],
  ) => {
    if (shouldRecord(path)) calls.push(`get:${path}`);
    return reader.getEntry(path, options);
  },
  readFilePage: (
    path: Parameters<typeof reader.readFilePage>[0],
    options: Parameters<typeof reader.readFilePage>[1],
  ) => {
    if (shouldRecord(path)) calls.push(`read:${path}`);
    return reader.readFilePage(path, options);
  },
  readLinkText: (
    path: Parameters<typeof reader.readLinkText>[0],
    options?: Parameters<typeof reader.readLinkText>[1],
  ) => {
    if (shouldRecord(path)) calls.push(`link:${path}`);
    return reader.readLinkText(path, options);
  },
});

describe('linked AGENTS.md', () => {
  test.each([
    [
      'an inside link read from the repository',
      () => ({
        repository: createRepository([
          ...INTEGRATION_TEST_ENTRIES.filter((entry) => entry.path !== agentsPath),
          link(agentsPath, 'docs/AGENTS.md'),
          textFile('/docs/AGENTS.md', currentText),
        ]),
      }),
    ],
    [
      'an instruction link to a repository file',
      () =>
        createInput(
          [link(agentsPath, 'docs/AGENTS.md')],
          [textFile('/docs/AGENTS.md', currentText)],
        ),
    ],
    [
      'a chain through a repository link',
      () =>
        createInput(
          [link(agentsPath, './shared/AGENTS.md')],
          [
            link('/shared/AGENTS.md', '../docs/AGENTS.md'),
            textFile('/docs/AGENTS.md', currentText),
          ],
        ),
    ],
    [
      'a link to an ignored CLAUDE.local.md',
      () =>
        createInput([
          link(agentsPath, 'CLAUDE.local.md'),
          textFile('/CLAUDE.local.md', currentText),
        ]),
    ],
  ])('checks %s with a current block without warnings', async (_label, createLinkedInput) => {
    const result = await createCore().validateProject(createLinkedInput());
    expect(result.diagnostics).toStrictEqual([]);
  });

  test('reports drift in a linked target as a stale block on the link itself', async () => {
    const result = await createCore().validateProject(
      createInput(
        [link(agentsPath, 'docs/AGENTS.md')],
        [textFile('/docs/AGENTS.md', currentText.replace('--repository', '--changed'))],
      ),
    );
    expect(result.diagnostics).toMatchObject([
      { code: 'MOLDEA_INTEGRATION_BLOCK_STALE', subject: agentsPath },
    ]);
  });

  test('reports a target without a block as a missing block on the link itself', async () => {
    const result = await createCore().validateProject(
      createInput([link(agentsPath, 'docs/AGENTS.md')], [textFile('/docs/AGENTS.md', '# Docs\n')]),
    );
    expect(result.diagnostics).toMatchObject([
      {
        code: 'MOLDEA_INTEGRATION_BLOCK_MISSING',
        subject: agentsPath,
        qualifier: null,
        details: { entryKind: 'symlink', reason: 'block-missing' },
      },
    ]);
  });

  test.each([
    ['outside', '../shared/AGENTS.md', []],
    ['outside', '/home/user/AGENTS.md', []],
    ['missing', 'docs/missing.md', []],
    ['loop', 'docs/back.md', [link('/docs/back.md', '../AGENTS.md')]],
    ['not-file', 'docs', [textFile('/docs/guide.md', '# Guide\n')]],
    ['unsupported', 'docs/../AGENTS.md', []],
  ] satisfies [string, string, IMemoryRepositoryEntry[]][])(
    'reports an AGENTS.md link with reason %s (%s) without reading a target',
    async (reason, target, repositoryEntries) => {
      const calls: string[] = [];
      const input = createInput([link(agentsPath, target)], repositoryEntries);
      const result = await createCore().validateProject({
        instructions: input.instructions,
        repository: observe(calls, input.repository, (path) => !path.startsWith('/moldea/')),
      });
      expect(result.valid).toBe(true);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics).toMatchObject([
        {
          code: 'MOLDEA_INTEGRATION_LINK_UNRESOLVED',
          subject: agentsPath,
          qualifier: reason,
          acceptable: true,
          entity: { integrationPath: agentsPath },
          details: { entryKind: 'symlink', reason },
        },
      ]);
      expect(calls.filter((call) => call.startsWith('read:'))).toStrictEqual([]);
    },
  );

  test('reads instruction paths from the instruction reader and every other path from the repository', async () => {
    const instructionCalls: string[] = [];
    const repositoryCalls: string[] = [];
    const input = createInput(
      [link(agentsPath, 'docs/AGENTS.md')],
      [textFile('/docs/AGENTS.md', currentText)],
    );
    const result = await createCore().validateProject({
      instructions: observe(instructionCalls, input.instructions),
      repository: observe(
        repositoryCalls,
        input.repository,
        (path) => path.startsWith('/docs/') || path.startsWith(skillPath) || path === agentsPath,
      ),
    });
    expect(result.diagnostics).toStrictEqual([]);
    expect(instructionCalls).toStrictEqual([
      `get:${agentsPath}`,
      `get:${agentsPath}`,
      `link:${agentsPath}`,
      'get:/CLAUDE.md',
      'get:/.claude/CLAUDE.md',
      'get:/CLAUDE.local.md',
    ]);
    expect(repositoryCalls).toStrictEqual([
      'get:/docs/AGENTS.md',
      'read:/docs/AGENTS.md',
      `get:${skillPath}/SKILL.md`,
      `get:${skillPath}/scripts/relevance-gate.mjs`,
      `read:${skillPath}/assets/managed-agents-block.md`,
    ]);
  });

  test('follows at most 32 links for one instruction file and reports a longer chain as a loop', async () => {
    const calls: string[] = [];
    const chain = Array.from({ length: 40 }, (_value, index) =>
      link(`/chain/${index + 1}`, String(index + 2)),
    );
    const input = createInput([link(agentsPath, 'chain/1')], chain);
    const result = await createCore().validateProject({
      instructions: input.instructions,
      repository: observe(calls, input.repository, (path) => path.startsWith('/chain/')),
    });
    expect(result.diagnostics).toMatchObject([
      { code: 'MOLDEA_INTEGRATION_LINK_UNRESOLVED', qualifier: 'loop' },
    ]);
    expect(calls.filter((call) => call.startsWith('link:'))).toHaveLength(31);
    expect(calls.filter((call) => call.startsWith('get:'))).toHaveLength(32);
  });

  test('keeps instruction files out of reference checks, pattern matching, and coverage', async () => {
    const reader = createMemoryRepositoryReader([agentsFile]);
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
    const withSource = await createCore().validateProject({ instructions: reader, repository });
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

  test('accepts an unresolved link only for its reason and reports the acceptance unmatched once it resolves', async () => {
    const reason = 'The shared instructions live outside this checkout.';
    const acceptance = {
      code: 'MOLDEA_INTEGRATION_LINK_UNRESOLVED',
      subject: agentsPath,
      qualifier: 'outside',
      reason,
    };
    const accepted = await createCore().validateProject(
      createInput([link(agentsPath, '../shared/AGENTS.md')], [], [acceptance]),
    );
    expect(accepted.diagnostics).toMatchObject([
      { code: 'MOLDEA_INTEGRATION_LINK_UNRESOLVED', accepted: true, reason },
    ]);
    expect(accepted.warningCount).toBe(0);

    const otherReason = await createCore().validateProject(
      createInput([link(agentsPath, 'docs/missing.md')], [], [acceptance]),
    );
    expect(
      otherReason.diagnostics
        .map((diagnostic) => [
          diagnostic.code,
          diagnostic.severity === 'warning' ? diagnostic.qualifier : null,
          diagnostic.severity === 'warning' && diagnostic.accepted === true,
        ])
        .sort(),
    ).toStrictEqual([
      ['MOLDEA_ACCEPTANCE_UNMATCHED', '/acceptedWarnings/0', false],
      ['MOLDEA_INTEGRATION_LINK_UNRESOLVED', 'missing', false],
    ]);

    const repaired = await createCore().validateProject(
      createInput(
        [link(agentsPath, 'docs/AGENTS.md')],
        [textFile('/docs/AGENTS.md', currentText)],
        [acceptance],
      ),
    );
    expect(repaired.diagnostics).toMatchObject([
      { code: 'MOLDEA_ACCEPTANCE_UNMATCHED', acceptable: false },
    ]);
  });

  test.each([
    ['a value without reader operations', () => ({})],
    [
      'a reader without link text',
      () => {
        const reader = createMemoryRepositoryReader([]);
        return {
          compare: reader.compare.bind(reader),
          getEntry: reader.getEntry.bind(reader),
          listEntriesPage: reader.listEntriesPage.bind(reader),
          readFilePage: reader.readFilePage.bind(reader),
          snapshot: reader.snapshot,
        };
      },
    ],
  ])('rejects an instruction reader that is %s', async (_label, createInstructions) => {
    await expect(
      createCore().validateProject({
        instructions: createInstructions() as never,
        repository: createRepository([...INTEGRATION_TEST_ENTRIES]),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
  });
});

describe('Claude Code integration', () => {
  test.each([
    ['no Claude file', [agentsFile], [], []],
    ['a root import', [agentsFile, textFile('/CLAUDE.md', '# Claude\n@AGENTS.md\n')], [], []],
    [
      'a root file without an import',
      [agentsFile, textFile('/CLAUDE.md', '# Claude\n')],
      [],
      [['MOLDEA_INTEGRATION_CLAUDE_IMPORT_MISSING', '/CLAUDE.md']],
    ],
    [
      'a nested relative import',
      [agentsFile, textFile('/.claude/CLAUDE.md', '@../AGENTS.md\n')],
      [],
      [],
    ],
    [
      'a nested import relative to the root',
      [agentsFile, textFile('/.claude/CLAUDE.md', '@AGENTS.md\n')],
      [],
      [['MOLDEA_INTEGRATION_CLAUDE_IMPORT_MISSING', '/.claude/CLAUDE.md']],
    ],
    [
      'either shared file importing AGENTS.md',
      [
        agentsFile,
        textFile('/CLAUDE.md', '# Claude\n'),
        textFile('/.claude/CLAUDE.md', '@../AGENTS.md\n'),
      ],
      [],
      [],
    ],
    [
      'shared files before the personal file',
      [
        agentsFile,
        textFile('/CLAUDE.md', '# Claude\n'),
        textFile('/CLAUDE.local.md', '@AGENTS.md\n'),
      ],
      [],
      [['MOLDEA_INTEGRATION_CLAUDE_IMPORT_MISSING', '/CLAUDE.md']],
    ],
    ['only a personal import', [agentsFile, textFile('/CLAUDE.local.md', '@AGENTS.md\n')], [], []],
    [
      'only a personal file without an import',
      [agentsFile, textFile('/CLAUDE.local.md', '# Mine\n')],
      [],
      [['MOLDEA_INTEGRATION_CLAUDE_IMPORT_MISSING', '/CLAUDE.local.md']],
    ],
    [
      'a CLAUDE.md directory',
      [agentsFile, { path: '/CLAUDE.md', type: 'directory' }],
      [],
      [['MOLDEA_INTEGRATION_CLAUDE_IMPORT_MISSING', '/CLAUDE.md']],
    ],
    [
      'a CLAUDE.md link to a regular AGENTS.md',
      [agentsFile, link('/CLAUDE.md', 'AGENTS.md')],
      [],
      [],
    ],
    [
      'AGENTS.md linking to CLAUDE.md',
      [link(agentsPath, 'CLAUDE.md'), textFile('/CLAUDE.md', currentText)],
      [],
      [],
    ],
    [
      'CLAUDE.md and AGENTS.md reaching one repository file',
      [link(agentsPath, 'docs/AGENTS.md'), link('/CLAUDE.md', 'docs/AGENTS.md')],
      [textFile('/docs/AGENTS.md', currentText)],
      [],
    ],
    [
      'CLAUDE.md and AGENTS.md reaching different repository files',
      [link(agentsPath, 'docs/AGENTS.md'), link('/CLAUDE.md', 'docs/CLAUDE.md')],
      [textFile('/docs/AGENTS.md', currentText), textFile('/docs/CLAUDE.md', '# Other\n')],
      [['MOLDEA_INTEGRATION_CLAUDE_IMPORT_MISSING', '/CLAUDE.md']],
    ],
    [
      'a linked CLAUDE.md whose target imports AGENTS.md',
      [agentsFile, link('/CLAUDE.md', 'docs/CLAUDE.md')],
      [textFile('/docs/CLAUDE.md', '@AGENTS.md\n')],
      [],
    ],
    [
      'a linked nested file checked at its own location',
      [agentsFile, link('/.claude/CLAUDE.md', '../docs/CLAUDE.md')],
      [textFile('/docs/CLAUDE.md', '@../AGENTS.md\n')],
      [],
    ],
    [
      'an unresolved shared file',
      [agentsFile, link('/CLAUDE.md', '../outside.md')],
      [],
      [['MOLDEA_INTEGRATION_LINK_UNRESOLVED', '/CLAUDE.md', 'outside']],
    ],
    [
      'a CLAUDE.md link through an AGENTS.md link that leaves the repository',
      [link(agentsPath, '../shared/AGENTS.md'), link('/CLAUDE.md', 'AGENTS.md')],
      [],
      [
        ['MOLDEA_INTEGRATION_LINK_UNRESOLVED', '/AGENTS.md', 'outside'],
        ['MOLDEA_INTEGRATION_LINK_UNRESOLVED', '/CLAUDE.md', 'outside'],
      ],
    ],
    [
      'an unresolved shared file beside a loading one',
      [
        agentsFile,
        link('/CLAUDE.md', 'missing.md'),
        textFile('/.claude/CLAUDE.md', '@../AGENTS.md\n'),
      ],
      [],
      [],
    ],
    [
      'a non-loading and an unresolved shared file',
      [agentsFile, textFile('/CLAUDE.md', '# Claude\n'), link('/.claude/CLAUDE.md', 'CLAUDE.md')],
      [],
      [['MOLDEA_INTEGRATION_LINK_UNRESOLVED', '/.claude/CLAUDE.md', 'loop']],
    ],
    [
      'an unresolved personal file',
      [agentsFile, link('/CLAUDE.local.md', 'docs')],
      [textFile('/docs/guide.md', '# Guide\n')],
      [['MOLDEA_INTEGRATION_LINK_UNRESOLVED', '/CLAUDE.local.md', 'not-file']],
    ],
  ] satisfies [string, IMemoryRepositoryEntry[], IMemoryRepositoryEntry[], string[][]][])(
    'reports %s',
    async (_label, instructionEntries, repositoryEntries, expected) => {
      const result = await createCore().validateProject(
        createInput(instructionEntries, repositoryEntries),
      );
      expect(result.valid).toBe(true);
      expect(
        result.diagnostics.map((diagnostic) =>
          diagnostic.severity === 'warning' && diagnostic.qualifier !== null
            ? [diagnostic.code, diagnostic.subject, diagnostic.qualifier]
            : [diagnostic.code, diagnostic.severity === 'warning' ? diagnostic.subject : null],
        ),
      ).toStrictEqual(expected);
    },
  );

  test('identifies a missing import with its message, entity, and entry kind', async () => {
    const result = await createCore().validateProject(
      createInput([agentsFile, textFile('/CLAUDE.md', '# Claude\n')]),
    );
    expect(result.diagnostics).toMatchObject([
      {
        code: 'MOLDEA_INTEGRATION_CLAUDE_IMPORT_MISSING',
        message: 'Claude Code instructions do not load AGENTS.md.',
        group: 'integration',
        severity: 'warning',
        subject: '/CLAUDE.md',
        qualifier: null,
        acceptable: true,
        entity: { integrationPath: '/CLAUDE.md' },
        details: { entryKind: 'file' },
      },
    ]);
  });

  test('resolves Claude links from the repository when no instruction reader is supplied', async () => {
    const loading = await createCore().validateProject({
      repository: createRepository([...INTEGRATION_TEST_ENTRIES, link('/CLAUDE.md', 'AGENTS.md')]),
    });
    expect(loading.diagnostics).toStrictEqual([]);
    const unresolved = await createCore().validateProject({
      repository: createRepository([
        ...INTEGRATION_TEST_ENTRIES,
        link('/CLAUDE.md', '../../home/CLAUDE.md'),
      ]),
    });
    expect(unresolved.diagnostics).toMatchObject([
      {
        code: 'MOLDEA_INTEGRATION_LINK_UNRESOLVED',
        subject: '/CLAUDE.md',
        qualifier: 'outside',
        details: { entryKind: 'symlink', reason: 'outside' },
      },
    ]);
  });

  test('accepts a missing import and reports the acceptance unmatched once it loads', async () => {
    const reason = 'Claude Code is configured to load both files.';
    const acceptance = {
      code: 'MOLDEA_INTEGRATION_CLAUDE_IMPORT_MISSING',
      subject: '/CLAUDE.md',
      reason,
    };
    const accepted = await createCore().validateProject(
      createInput([agentsFile, textFile('/CLAUDE.md', '# Claude\n')], [], [acceptance]),
    );
    expect(accepted.diagnostics).toMatchObject([{ accepted: true, reason }]);
    expect(accepted.warningCount).toBe(0);
    const repaired = await createCore().validateProject(
      createInput([agentsFile, textFile('/CLAUDE.md', '@AGENTS.md\n')], [], [acceptance]),
    );
    expect(repaired.diagnostics).toMatchObject([
      { code: 'MOLDEA_ACCEPTANCE_UNMATCHED', acceptable: false },
    ]);
  });

  test('stays within five bounded reads with every counted instruction file linked', async () => {
    const reads: string[] = [];
    const input = createInput(
      [
        link(agentsPath, 'docs/AGENTS.md'),
        link('/CLAUDE.md', 'docs/one.md'),
        link('/.claude/CLAUDE.md', '../docs/two.md'),
        link('/CLAUDE.local.md', 'docs/three.md'),
      ],
      [
        textFile('/docs/AGENTS.md', currentText),
        textFile('/docs/one.md', '# One\n'),
        textFile('/docs/two.md', '# Two\n'),
        textFile('/docs/three.md', '# Three\n'),
      ],
    );
    const result = await createCore().validateProject({
      instructions: input.instructions,
      repository: observe(
        reads,
        input.repository,
        (path) => path.startsWith('/docs/') || path.startsWith(skillPath),
      ),
    });
    expect(result.diagnostics).toMatchObject([
      { code: 'MOLDEA_INTEGRATION_CLAUDE_IMPORT_MISSING', subject: '/CLAUDE.md' },
    ]);
    expect(reads.filter((call) => call.startsWith('read:')).length).toBeLessThanOrEqual(5);
  });
});

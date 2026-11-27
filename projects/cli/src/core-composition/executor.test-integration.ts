// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import type { IRepositoryReader } from '@moldea.ai/repository';
import {
  createMemoryRepositoryReader,
  type IMemoryRepositoryEntry,
} from '@moldea.ai/repository/memory';

import { createMoldeaCliValidateExecutionResult } from '../cli-execution/results.js';
import { INSTALLED_PACKAGE_METADATA } from '../composition/composition.test-fixtures.js';
import {
  commitFixtureGitIndex,
  createGitRepository,
  runFixtureGit,
  type IGitRepositoryFixture,
} from '../git-inventory/probe.test-fixtures.js';
import { createMoldeaCliRecordKey } from '../output-page/index.js';
import type { IMoldeaCliValidateResult } from '../presentation/index.js';
import { executeWorkingTreeSnapshot } from '../working-tree-snapshot/index.js';

import { executeMoldeaCliCoreInspection } from './executor.js';

const RESOURCE_LIMITS = {
  maxDiagnostics: 32,
  maxEntries: 128,
  maxCoverage: 16,
  maxFileBytes: 4096,
  maxManifestBytes: 2048,
  maxTotalBytes: 16 * 1_048_576,
};

const createRepository = (symbol = 'alphaAgent', shouldAcceptWarning = false) =>
  createMemoryRepositoryReader([
    {
      path: '/moldea/moldea.yaml',
      type: 'file',
      content: JSON.stringify({
        version: 1,
        agents: {
          alpha: {
            bindings: { runtimeAgent: { path: '/src/agent.ts', symbol } },
          },
        },
        ...(shouldAcceptWarning
          ? {
              acceptedWarnings: [
                {
                  code: 'MOLDEA_INTEGRATION_BLOCK_MISSING',
                  subject: '/AGENTS.md',
                  reason: 'Instructions are shared outside this snapshot.',
                },
              ],
            }
          : {}),
      }),
    },
    { path: '/moldea/project.md', type: 'file', content: '# Project\n' },
    { path: '/moldea/agents/alpha/description.md', type: 'file', content: 'Alpha agent.\n' },
    {
      path: '/moldea/agents/alpha/instruction.md',
      type: 'file',
      content: 'You are the `alpha` agent.\n',
    },
    { path: '/src/agent.ts', type: 'file', content: 'export const alphaAgent = () => 1;\n' },
  ]);

const execute = (command: 'validate' | 'inspect', symbol?: string, shouldAcceptWarning?: boolean) =>
  executeMoldeaCliCoreInspection({
    command,
    repository: createRepository(symbol, shouldAcceptWarning),
    resourceLimits: RESOURCE_LIMITS,
    packageMetadata: INSTALLED_PACKAGE_METADATA,
  });

describe('CLI Core composition through the real isolated boundary', () => {
  test('reports universal file and export coverage without requiring an SDK installation', async () => {
    const result = await execute('validate');
    expect(result).toMatchObject({
      valid: true,
      diagnosticCount: 1,
      errorCount: 0,
      warningCount: 1,
      acceptedWarningCount: 0,
      coverageCounts: { bindings: 1, exportsPassed: 1, exportsFailed: 0, exportsNotChecked: 0 },
      coverage: [
        {
          path: '/src/agent.ts',
          symbol: 'alphaAgent',
          relationship: 'runtime-agent',
          fileCheck: 'passed',
          exportCheck: 'passed',
        },
      ],
      diagnostics: [
        { code: 'MOLDEA_INTEGRATION_BLOCK_MISSING', severity: 'warning', group: 'integration' },
      ],
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  test('returns a proven missing export together with the matching failed coverage record', async () => {
    expect(await execute('validate', 'missing')).toMatchObject({
      valid: false,
      errorCount: 1,
      warningCount: 1,
      diagnosticCount: 2,
      coverage: [{ symbol: 'missing', exportCheck: 'failed' }],
      coverageCounts: { exportsFailed: 1 },
    });
  });

  test('keeps file failures in diagnostics and explains unchecked exports in coverage', async () => {
    const result = await executeMoldeaCliCoreInspection({
      command: 'validate',
      packageMetadata: INSTALLED_PACKAGE_METADATA,
      resourceLimits: RESOURCE_LIMITS,
      repository: createMemoryRepositoryReader([
        {
          path: '/moldea/moldea.yaml',
          type: 'file',
          content: JSON.stringify({
            version: 1,
            context: {
              '/moldea/project.md': {
                bindings: [
                  { path: '/src/missing.ts', symbol: 'entry' },
                  { path: '/src/directory', symbol: 'entry' },
                  { path: '/src/broken.ts', symbol: 'entry' },
                  { path: '/src/without-symbol.ts' },
                ],
              },
            },
          }),
        },
        { path: '/moldea/project.md', type: 'file', content: '# Project\n' },
        { path: '/src/directory', type: 'directory' },
        { path: '/src/broken.ts', type: 'file', content: 'export const entry = ;\n' },
        { path: '/src/without-symbol.ts', type: 'file', content: 'export const entry = 1;\n' },
      ]),
    });
    if (!('diagnostics' in result)) throw new Error('A validation result was expected.');
    const response = createMoldeaCliValidateExecutionResult(result, '15.0.0', true, null, 65_536);
    expect(response.exitCode).toBe(1);
    const { result: output } = JSON.parse(response.stdout) as {
      result: Omit<IMoldeaCliValidateResult, 'formatVersion'>;
    };
    expect(output.diagnosticCount).toBe(3);
    expect(output.errorCount).toBe(2);
    expect(output.coverageCounts).toStrictEqual({
      bindings: 2,
      exportsFailed: 0,
      exportsPassed: 0,
      exportsNotChecked: 2,
    });
    expect(output.page.records.map(({ kind }) => kind)).toStrictEqual([
      'diagnostic',
      'diagnostic',
      'diagnostic',
      'coverage',
      'coverage',
    ]);
    expect(output.page.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'MOLDEA_REFERENCE_MISSING' }),
        expect.objectContaining({ code: 'MOLDEA_REFERENCE_NOT_FILE' }),
        expect.objectContaining({
          kind: 'coverage',
          path: '/src/broken.ts',
          exportNotCheckedReason: 'unparseable-source',
        }),
        expect.objectContaining({
          kind: 'coverage',
          path: '/src/without-symbol.ts',
          exportNotCheckedReason: 'no-symbol',
        }),
      ]),
    );
  });

  test('keeps accepted integration warnings visible with their reason and separate count', async () => {
    expect(await execute('validate', undefined, true)).toMatchObject({
      valid: true,
      errorCount: 0,
      warningCount: 0,
      acceptedWarningCount: 1,
      diagnosticCount: 1,
      diagnostics: [{ accepted: true, reason: 'Instructions are shared outside this snapshot.' }],
    });
  });

  test('inspect pages keep warning totals and identify agents through their canonical inventory', async () => {
    const result = await execute('inspect', undefined, true);
    expect(result).toMatchObject({
      valid: true,
      counts: { coverage: 1, errors: 0, warnings: 0, acceptedWarnings: 1, diagnostics: 1 },
      coverageCounts: { bindings: 1, exportsPassed: 1 },
    });
    if (!('records' in result)) throw new Error('An inspection page was expected.');
    const items = result.records.map((record) => record.item);
    expect(
      items.find(
        (item) =>
          item.kind === 'metadata' && item.metadata.path === '/moldea/agents/alpha/instruction.md',
      ),
    ).toMatchObject({ kind: 'metadata', metadata: { agentId: 'alpha' } });
    expect(items.at(-1)).toMatchObject({ kind: 'diagnostic' });
    expect(items.every(({ kind }) => kind === 'metadata' || kind === 'diagnostic')).toBe(true);
  });

  test('continues past the worker batch boundary without returning agent assignments', async () => {
    const entries: IMemoryRepositoryEntry[] = [
      { path: '/moldea/moldea.yaml', type: 'file', content: 'version: 1\nagents: { alpha: {} }\n' },
      { path: '/moldea/project.md', type: 'file', content: '# Project\n' },
      { path: '/moldea/agents/alpha/description.md', type: 'file', content: 'Alpha.\n' },
      { path: '/moldea/agents/alpha/instruction.md', type: 'file', content: 'You are `alpha`.\n' },
      ...Array.from({ length: 256 }, (_, index): IMemoryRepositoryEntry => ({
        path: `/moldea/context/note-${index}.md`,
        type: 'file',
        content: '# Note\n',
      })),
    ];
    const input = {
      command: 'inspect',
      repository: createMemoryRepositoryReader(entries),
      resourceLimits: { ...RESOURCE_LIMITS, maxEntries: 1024 },
      packageMetadata: INSTALLED_PACKAGE_METADATA,
    } as const;
    const first = await executeMoldeaCliCoreInspection(input);
    if (!('records' in first)) throw new Error('An inspection page was expected.');
    expect(first.records).toHaveLength(256);
    expect(first.records.every(({ item }) => item.kind === 'metadata')).toBe(true);
    const continuation = first.records.at(-1)?.nextCursor;
    expect(typeof continuation).toBe('string');
    const final = await executeMoldeaCliCoreInspection({
      ...input,
      cursor: {
        lastKey: createMoldeaCliRecordKey(255),
        snapshotDigest: first.inspectionDigest,
        sourceCursor: continuation ?? null,
      },
    });
    if (!('records' in final)) throw new Error('An inspection page was expected.');
    expect(final.startIndex).toBe(256);
    expect(final.records.map(({ item }) => item.kind)).toStrictEqual([
      'metadata',
      'metadata',
      'metadata',
      'metadata',
      'diagnostic',
    ]);
    expect(final.records.at(-1)?.nextCursor).toBeNull();
    const inventory = [...first.records, ...final.records].flatMap(({ item }) =>
      item.kind === 'metadata' ? [item.metadata.path] : [],
    );
    expect(new Set(inventory).size).toBe(260);
  });

  test('refuses coverage beyond the configured record count without returning partial results', async () => {
    await expect(
      executeMoldeaCliCoreInspection({
        command: 'validate',
        repository: createMemoryRepositoryReader([
          {
            path: '/moldea/moldea.yaml',
            type: 'file',
            content: JSON.stringify({
              version: 1,
              context: {
                '/moldea/project.md': {
                  bindings: [
                    { path: '/a.ts', symbol: 'a' },
                    { path: '/b.ts', symbol: 'b' },
                  ],
                },
              },
            }),
          },
          { path: '/moldea/project.md', type: 'file', content: '# Project\n' },
          { path: '/a.ts', type: 'file', content: 'export const a = 1;' },
          { path: '/b.ts', type: 'file', content: 'export const b = 1;' },
        ]),
        resourceLimits: { ...RESOURCE_LIMITS, maxCoverage: 1 },
        packageMetadata: INSTALLED_PACKAGE_METADATA,
      }),
    ).rejects.toMatchObject({ code: 'RESOURCE_LIMIT_EXCEEDED', limit: 'maxCoverage' });
    expect((await execute('validate')).valid).toBe(true);
  });
});

const BLOCK_ASSET =
  '<!-- moldea:start -->\nnode "<repo-root>/{{skill-path}}/scripts/relevance-gate.mjs" --repository "<repo-root>"\n<!-- moldea:end -->\n';
const CURRENT_BLOCK = BLOCK_ASSET.replaceAll('{{skill-path}}', '.agents/skills/moldea');

// one committed fixture entry: a regular file with text, or a link with its stored text
type IParityEntry = readonly [path: string, kind: 'file' | 'link', text: string];

const PARITY_BASE_ENTRIES: readonly IParityEntry[] = [
  ['moldea/moldea.yaml', 'file', 'version: 1\n'],
  ['moldea/project.md', 'file', '# Project\n'],
  ['.agents/skills/moldea/SKILL.md', 'file', '# Skill\n'],
  ['.agents/skills/moldea/scripts/relevance-gate.mjs', 'file', '// Gate\n'],
  ['.agents/skills/moldea/assets/managed-agents-block.md', 'file', BLOCK_ASSET],
  ['docs/AGENTS.md', 'file', CURRENT_BLOCK],
];

/** Reads one fixture Git command's stdout as bytes. */
const readFixtureGit = (repository: IGitRepositoryFixture, gitArguments: readonly string[]) =>
  execFileSync('git', [...gitArguments], {
    cwd: repository.directory,
    env: repository.environment,
    stdio: ['ignore', 'pipe', 'ignore'],
  });

/** Commits regular files to the work tree and links straight into the index, on every host. */
const commitParityFixture = async (
  repository: IGitRepositoryFixture,
  entries: readonly IParityEntry[],
): Promise<void> => {
  for (const [entryPath, kind, text] of entries) {
    if (kind === 'file') {
      await mkdir(path.dirname(path.join(repository.directory, entryPath)), { recursive: true });
      await writeFile(path.join(repository.directory, entryPath), text);
      runFixtureGit(repository, ['add', '--', entryPath]);
      continue;
    }

    const objectId = execFileSync('git', ['hash-object', '-w', '--stdin'], {
      cwd: repository.directory,
      env: repository.environment,
      input: text,
    })
      .toString('utf8')
      .trim();
    runFixtureGit(repository, [
      'update-index',
      '--add',
      '--cacheinfo',
      `120000,${objectId},${entryPath}`,
    ]);
  }

  commitFixtureGitIndex(repository);
};

/** Builds the reader a hosted provider sees: the committed tree, with link blobs as link text. */
const createCommittedReader = (repository: IGitRepositoryFixture): IRepositoryReader => {
  const records = readFixtureGit(repository, ['ls-tree', '-r', '-z', 'HEAD'])
    .toString('utf8')
    .split('\0')
    .filter((record) => record !== '');
  const entries = records.map((record): IMemoryRepositoryEntry => {
    const [metadata = '', entryPath = ''] = record.split('\t');
    const [mode, , objectId = ''] = metadata.split(' ');
    const blob = readFixtureGit(repository, ['cat-file', 'blob', objectId]);

    return mode === '120000'
      ? { path: `/${entryPath}`, target: blob.toString('utf8'), type: 'symlink' }
      : { content: new Uint8Array(blob), path: `/${entryPath}`, type: 'file' };
  });

  return createMemoryRepositoryReader(entries);
};

/** Runs the CLI's working-tree snapshot and Core validation over one checkout. */
const validateCheckout = async (directory: string) => {
  const result = await executeWorkingTreeSnapshot({
    includeInstructions: true,
    operation: (repository, signal, instructions) =>
      executeMoldeaCliCoreInspection({
        command: 'validate',
        ...(instructions === undefined ? {} : { instructions }),
        packageMetadata: INSTALLED_PACKAGE_METADATA,
        repository,
        resourceLimits: RESOURCE_LIMITS,
        ...(signal === undefined ? {} : { signal }),
      }),
    repositoryRoot: directory,
    resourceLimits: RESOURCE_LIMITS,
  });

  if (result.kind !== 'completed') {
    throw new Error(`The working-tree snapshot failed with ${result.errorCode}.`);
  }

  return result.result;
};

/** Projects the integration warnings onto the identity an acceptance would match. */
const toIntegrationIdentities = (result: Awaited<ReturnType<typeof validateCheckout>>) =>
  ('diagnostics' in result ? result.diagnostics : [])
    .filter((diagnostic) => diagnostic.group === 'integration')
    .map((diagnostic) =>
      diagnostic.severity === 'warning'
        ? [diagnostic.code, diagnostic.subject, diagnostic.qualifier]
        : [diagnostic.code],
    );

describe('link parity between hosted and local readers', () => {
  test.each([
    ['a regular AGENTS.md', [['AGENTS.md', 'file', CURRENT_BLOCK]], []],
    ['an inside link', [['AGENTS.md', 'link', 'docs/AGENTS.md']], []],
    [
      'a chained link',
      [
        ['AGENTS.md', 'link', 'shared/AGENTS.md'],
        ['shared/AGENTS.md', 'link', '../docs/AGENTS.md'],
      ],
      [],
    ],
    [
      'an outside link',
      [['AGENTS.md', 'link', '../outside/AGENTS.md']],
      [['MOLDEA_INTEGRATION_LINK_UNRESOLVED', '/AGENTS.md', 'outside']],
    ],
    [
      'a missing target',
      [['AGENTS.md', 'link', 'docs/missing.md']],
      [['MOLDEA_INTEGRATION_LINK_UNRESOLVED', '/AGENTS.md', 'missing']],
    ],
    [
      'a looping chain',
      [
        ['AGENTS.md', 'link', 'docs/loop.md'],
        ['docs/loop.md', 'link', '../AGENTS.md'],
      ],
      [['MOLDEA_INTEGRATION_LINK_UNRESOLVED', '/AGENTS.md', 'loop']],
    ],
    [
      'a .. after a folder',
      [['AGENTS.md', 'link', 'docs/../docs/AGENTS.md']],
      [['MOLDEA_INTEGRATION_LINK_UNRESOLVED', '/AGENTS.md', 'unsupported']],
    ],
  ] satisfies [string, IParityEntry[], (string | null)[][]][])(
    'gives identical results for %s',
    async (_label, entries, expected) => {
      const repository = createGitRepository();

      try {
        await commitParityFixture(repository, [...PARITY_BASE_ENTRIES, ...entries]);
        const realLinks = path.join(repository.testDirectory, 'real-links');
        const materializedLinks = path.join(repository.testDirectory, 'materialized-links');
        runFixtureGit(
          repository,
          [
            'clone',
            '--config',
            'core.symlinks=true',
            '--no-hardlinks',
            repository.directory,
            realLinks,
          ],
          repository.testDirectory,
        );
        runFixtureGit(
          repository,
          [
            'clone',
            '--config',
            'core.symlinks=false',
            '--no-hardlinks',
            repository.directory,
            materializedLinks,
          ],
          repository.testDirectory,
        );

        const committed = toIntegrationIdentities(
          await executeMoldeaCliCoreInspection({
            command: 'validate',
            packageMetadata: INSTALLED_PACKAGE_METADATA,
            repository: createCommittedReader(repository),
            resourceLimits: RESOURCE_LIMITS,
          }),
        );

        expect(committed).toStrictEqual(expected);
        expect(toIntegrationIdentities(await validateCheckout(realLinks))).toStrictEqual(committed);
        expect(toIntegrationIdentities(await validateCheckout(materializedLinks))).toStrictEqual(
          committed,
        );
      } finally {
        repository.remove();
      }
    },
  );
});

describe('working-tree links over committed files', () => {
  test('validates in place when a link replaces a committed skill copy', async () => {
    const repository = createGitRepository();

    try {
      await commitParityFixture(repository, [
        ...PARITY_BASE_ENTRIES,
        ['AGENTS.md', 'file', CURRENT_BLOCK],
        ['.claude/skills/moldea/SKILL.md', 'file', '# Skill\n'],
      ]);
      const linked = path.join(repository.directory, '.claude', 'skills', 'moldea');
      await rm(linked, { recursive: true });

      // the skills installer leaves a junction on Windows and a symlink elsewhere
      if (process.platform === 'win32') {
        await symlink(
          path.join(repository.directory, '.agents', 'skills', 'moldea'),
          linked,
          'junction',
        );
      } else {
        await symlink('../../.agents/skills/moldea', linked, 'dir');
      }

      const result = await validateCheckout(repository.directory);

      expect(result).toMatchObject({ errorCount: 0, valid: true, warningCount: 0 });
      expect('diagnostics' in result ? result.diagnostics : []).toStrictEqual([]);
    } finally {
      repository.remove();
    }
  });
});

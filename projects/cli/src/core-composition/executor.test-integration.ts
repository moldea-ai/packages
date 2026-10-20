// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import type { IRepositoryReader } from '@moldea.ai/repository';
import {
  createMemoryRepositoryReader,
  type IMemoryRepositoryEntry,
} from '@moldea.ai/repository/memory';

import { INSTALLED_PACKAGE_METADATA } from '../composition/composition.test-fixtures.js';
import {
  commitFixtureGitIndex,
  createGitRepository,
  runFixtureGit,
  type IGitRepositoryFixture,
} from '../git-inventory/probe.test-fixtures.js';
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
            runtime: { id: 'openai' },
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

  test('inspect pages include the same coverage, warning totals, and declared runtime assignment', async () => {
    const result = await execute('inspect', undefined, true);
    expect(result).toMatchObject({
      valid: true,
      counts: { coverage: 1, errors: 0, warnings: 0, acceptedWarnings: 1, diagnostics: 1 },
      coverageCounts: { bindings: 1, exportsPassed: 1 },
    });
    if (!('page' in result)) throw new Error('An inspection page was expected.');
    const items = result.page.records.map((record) => record.item);
    expect(items).toContainEqual({
      kind: 'agent',
      agent: { agentId: 'alpha', runtimeId: 'openai' },
    });
    expect(items).toContainEqual(expect.objectContaining({ kind: 'coverage' }));
    expect(items).toContainEqual(expect.objectContaining({ kind: 'diagnostic' }));
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

// @vitest-environment node
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import { parseRepositoryPath } from '@moldea.ai/repository';
import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';
import {
  createFilesystemRepositoryLinkResolver,
  createFilesystemRepositoryReader,
} from '@moldea.ai/repository-fs';

import { INSTALLED_PACKAGE_METADATA } from '../composition/composition.test-fixtures.js';

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

/** Creates real instruction links beside a shared file and returns the instruction source. */
const createLinkedInstructions = async (
  directory: string,
  links: Readonly<Record<string, string>>,
) => {
  const root = path.join(directory, 'repository');
  await mkdir(root, { recursive: true });
  await writeFile(path.join(directory, 'shared.md'), CURRENT_BLOCK);

  for (const [name, target] of Object.entries(links)) {
    await symlink(target, path.join(root, name), process.platform === 'win32' ? 'file' : undefined);
  }

  const reader = await createFilesystemRepositoryReader({
    rootDirectory: root,
    selection: {
      kind: 'paths',
      paths: Object.keys(links).map((name) => parseRepositoryPath(`/${name}`)),
    },
  });

  return { linkResolver: createFilesystemRepositoryLinkResolver(reader), reader };
};

describe('CLI Core composition with a real filesystem link resolver', () => {
  test.each([
    ['an outside AGENTS.md link', { 'AGENTS.md': '../shared.md' }, []],
    [
      'CLAUDE.md and AGENTS.md links to one outside file',
      { 'AGENTS.md': '../shared.md', 'CLAUDE.md': '../shared.md' },
      [],
    ],
    [
      'a broken AGENTS.md link',
      { 'AGENTS.md': '../missing.md' },
      [['MOLDEA_INTEGRATION_UNVERIFIED', '/AGENTS.md']],
    ],
  ] satisfies [string, Record<string, string>, string[][]][])(
    'checks %s through the worker bridge',
    async (_label, links, expected) => {
      const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'moldea-cli-links-')));

      try {
        const result = await executeMoldeaCliCoreInspection({
          command: 'validate',
          instructions: await createLinkedInstructions(directory, links),
          packageMetadata: INSTALLED_PACKAGE_METADATA,
          repository: createMemoryRepositoryReader([
            { path: '/moldea/moldea.yaml', type: 'file', content: 'version: 1\n' },
            { path: '/moldea/project.md', type: 'file', content: '# Project\n' },
            { path: '/.agents/skills/moldea/SKILL.md', type: 'file', content: '# Skill\n' },
            {
              path: '/.agents/skills/moldea/scripts/relevance-gate.mjs',
              type: 'file',
              content: '// Gate\n',
            },
            {
              path: '/.agents/skills/moldea/assets/managed-agents-block.md',
              type: 'file',
              content: BLOCK_ASSET,
            },
          ]),
          resourceLimits: RESOURCE_LIMITS,
        });

        expect('diagnostics' in result ? result.diagnostics : result).toMatchObject(
          expected.map(([code, subject]) => ({ code, subject })),
        );
        expect('diagnostics' in result ? result.diagnostics : result).toHaveLength(expected.length);
      } finally {
        await rm(directory, { force: true, recursive: true });
      }
    },
  );
});

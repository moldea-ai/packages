// @vitest-environment node
import { describe, expect, test } from 'vitest';

import type { IRuntimeAdapterRepository } from '@moldea.ai/core/adapter';
import { parseRepositoryPath, type IRepositoryReader } from '@moldea.ai/repository';
import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';

import { createPackageManifestCandidatePaths, discoverOpenAiAgentsSdkPackage } from './index.js';

const createAdapterRepository = (source: IRepositoryReader): IRuntimeAdapterRepository => ({
  snapshot: source.snapshot,
  getEntry: (path, options) => source.getEntry(path, options),
  limits: {
    maxEntries: 4_096,
    maxFileBytes: 1_048_576,
    maxPageBytes: 65_536,
    maxPageEntries: 256,
    maxTotalBytesRead: 16_777_216,
  },
  listEntriesPage: (options) => source.listEntriesPage(options),
  readFilePage: (path, options) => source.readFilePage(path, options),
});

describe('OpenAI Agents SDK package discovery', () => {
  test('creates nearest-first candidates without enumeration', () => {
    expect(
      createPackageManifestCandidatePaths(parseRepositoryPath('/apps/api/src/agent.ts')),
    ).toStrictEqual([
      '/apps/api/src/package.json',
      '/apps/api/package.json',
      '/apps/package.json',
      '/package.json',
    ]);
  });

  test.each([
    ['0.16.1', 'supported'],
    ['^0.16.1', 'supported'],
    ['0.16.0', 'unsupported'],
    ['0.17.0', 'unsupported'],
    ['>=0.16.0 <0.17.0', 'ambiguous'],
    ['latest', 'ambiguous'],
    ['workspace:^0.16.1', 'ambiguous'],
    ['0.16.1-beta.1', 'unsupported'],
  ] as const)('classifies @openai/agents@%s as %s', async (declaredRange, compatibility) => {
    const repository = createMemoryRepositoryReader([
      {
        content: JSON.stringify({ dependencies: { '@openai/agents': declaredRange } }),
        path: '/package.json',
        type: 'file',
      },
    ]);

    await expect(
      discoverOpenAiAgentsSdkPackage(
        createAdapterRepository(repository),
        parseRepositoryPath('/src/agent.ts'),
      ),
    ).resolves.toStrictEqual({
      kind: 'observed',
      observation: {
        compatibility,
        declarations: [{ declaredRange, dependencyKind: 'dependencies' }],
        path: '/package.json',
      },
    });
  });

  test.each([
    ['invalid JSON', '{'],
    ['non-object dependency field', JSON.stringify({ dependencies: [] })],
    ['empty declaration', JSON.stringify({ dependencies: { '@openai/agents': '' } })],
    ['non-string declaration', JSON.stringify({ dependencies: { '@openai/agents': 2 } })],
  ])('reports an invalid owning manifest for %s', async (_description, content) => {
    const repository = createMemoryRepositoryReader([
      { content, path: '/package.json', type: 'file' },
    ]);

    await expect(
      discoverOpenAiAgentsSdkPackage(
        createAdapterRepository(repository),
        parseRepositoryPath('/src/agent.ts'),
      ),
    ).resolves.toStrictEqual({ kind: 'invalid', path: '/package.json' });
  });
});

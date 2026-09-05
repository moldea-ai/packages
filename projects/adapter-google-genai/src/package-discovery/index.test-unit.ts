// @vitest-environment node
import { describe, expect, test } from 'vitest';

import type { IRuntimeAdapterRepository } from '@moldea.ai/core/adapter';
import { parseRepositoryPath, type IRepositoryReader } from '@moldea.ai/repository';
import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';

import { createPackageManifestCandidatePaths, discoverGoogleGenAiPackage } from './index.js';

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

describe('Google Gen AI package discovery', () => {
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
    ['2.17.1', 'supported'],
    ['^2.17.1', 'supported'],
    ['2.16.0', 'unsupported'],
    ['3.0.0', 'supported'],
    ['>=2.0.0 <3.0.0', 'ambiguous'],
    ['latest', 'ambiguous'],
    ['workspace:^2.17.1', 'ambiguous'],
    ['2.17.1-beta.1', 'unsupported'],
  ] as const)('classifies @google/genai@%s as %s', async (declaredRange, compatibility) => {
    const repository = createMemoryRepositoryReader([
      {
        content: JSON.stringify({ dependencies: { '@google/genai': declaredRange } }),
        path: '/package.json',
        type: 'file',
      },
    ]);

    await expect(
      discoverGoogleGenAiPackage(
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

  test('classifies declarations collectively in deterministic dependency-field order', async () => {
    const repository = createMemoryRepositoryReader([
      {
        content: JSON.stringify({
          dependencies: { '@google/genai': '^2.17.1' },
          devDependencies: { '@google/genai': '2.17.1' },
          optionalDependencies: { '@google/genai': '~2.17.1' },
          peerDependencies: { '@google/genai': '>=2.17.1 <3.0.0' },
        }),
        path: '/package.json',
        type: 'file',
      },
    ]);

    await expect(
      discoverGoogleGenAiPackage(
        createAdapterRepository(repository),
        parseRepositoryPath('/src/agent.ts'),
      ),
    ).resolves.toMatchObject({
      kind: 'observed',
      observation: {
        compatibility: 'supported',
        declarations: [
          { declaredRange: '^2.17.1', dependencyKind: 'dependencies' },
          { declaredRange: '~2.17.1', dependencyKind: 'optionalDependencies' },
          { declaredRange: '>=2.17.1 <3.0.0', dependencyKind: 'peerDependencies' },
          { declaredRange: '2.17.1', dependencyKind: 'devDependencies' },
        ],
      },
    });
  });

  test.each([
    ['invalid JSON', '{'],
    ['non-object dependency field', JSON.stringify({ dependencies: [] })],
    ['empty declaration', JSON.stringify({ dependencies: { '@google/genai': '' } })],
    ['non-string declaration', JSON.stringify({ dependencies: { '@google/genai': 2 } })],
  ])('reports an invalid owning manifest for %s', async (_description, content) => {
    const repository = createMemoryRepositoryReader([
      { content, path: '/package.json', type: 'file' },
    ]);

    await expect(
      discoverGoogleGenAiPackage(
        createAdapterRepository(repository),
        parseRepositoryPath('/src/agent.ts'),
      ),
    ).resolves.toStrictEqual({ kind: 'invalid', path: '/package.json' });
  });

  test('stops at the first existing owning manifest', async () => {
    const repository = createMemoryRepositoryReader([
      {
        content: JSON.stringify({ dependencies: { '@google/genai': '^2.17.1' } }),
        path: '/package.json',
        type: 'file',
      },
      {
        content: JSON.stringify({ dependencies: { typescript: '6.0.3' } }),
        path: '/apps/api/package.json',
        type: 'file',
      },
    ]);

    await expect(
      discoverGoogleGenAiPackage(
        createAdapterRepository(repository),
        parseRepositoryPath('/apps/api/src/agent.ts'),
      ),
    ).resolves.toStrictEqual({ kind: 'absent' });
  });
});

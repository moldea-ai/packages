// @vitest-environment node
import { describe, expect, test } from 'vitest';

import type { IRuntimeAdapterRepository } from '@moldea.ai/core/adapter';
import { parseRepositoryPath, type IRepositoryReader } from '@moldea.ai/repository';
import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';

import { discoverLangChainPackages } from './index.js';

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

const discover = (dependencies: Readonly<Record<string, string>>) =>
  discoverLangChainPackages(
    createAdapterRepository(
      createMemoryRepositoryReader([
        {
          content: JSON.stringify({ dependencies }),
          path: '/package.json',
          type: 'file',
        },
      ]),
    ),
    parseRepositoryPath('/src/agent.ts'),
  );

describe('discoverLangChainPackages', () => {
  test.each([
    ['supported', '~1.5.9', '~1.2.8', 'supported'],
    ['later provider majors', '^2.0.0', '^2.0.0', 'supported'],
    ['incomplete', '~1.5.9', undefined, 'incomplete'],
    ['unsupported primary', '1.4.0', '~1.2.8', 'unsupported'],
    ['unsupported companion', '~1.5.9', '1.1.1', 'unsupported'],
    ['ambiguous primary', 'workspace:*', '~1.2.8', 'ambiguous'],
    ['ambiguous companion', '~1.5.9', 'workspace:*', 'ambiguous'],
    ['absent packages', undefined, undefined, 'absent'],
    ['absent primary', undefined, '~1.2.8', 'absent'],
    ['absent primary with ambiguous companion', undefined, 'workspace:*', 'absent'],
    ['absent primary with unsupported companion', undefined, '1.1.1', 'absent'],
  ] as const)(
    'classifies the %s package pair',
    async (_description, primary, companion, expectedClassification) => {
      const dependencies = {
        ...(companion === undefined ? {} : { '@langchain/core': companion }),
        ...(primary === undefined ? {} : { langchain: primary }),
      };
      const result = await discover(dependencies);

      expect(result).toMatchObject({
        kind: 'observed',
        observation: { targetClassification: expectedClassification },
      });
    },
  );

  test('stops at an owning manifest that omits the primary package', async () => {
    const result = await discoverLangChainPackages(
      createAdapterRepository(
        createMemoryRepositoryReader([
          {
            content: JSON.stringify({ dependencies: { langchain: '~1.5.9' } }),
            path: '/package.json',
            type: 'file',
          },
          {
            content: JSON.stringify({ dependencies: { typescript: '6.0.3' } }),
            path: '/apps/api/package.json',
            type: 'file',
          },
        ]),
      ),
      parseRepositoryPath('/apps/api/src/agent.ts'),
    );

    expect(result).toMatchObject({
      kind: 'observed',
      observation: { path: '/apps/api/package.json', targetClassification: 'absent' },
    });
  });
});

// @vitest-environment node
import { describe, expect, test } from 'vitest';

import type { IRuntimeAdapterRepository } from '@moldea.ai/core/adapter';
import { parseRepositoryPath, type IRepositoryReader } from '@moldea.ai/repository';
import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';

import { discoverLangGraphPackages } from './index.js';

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
  discoverLangGraphPackages(
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

describe('discoverLangGraphPackages', () => {
  test.each([
    ['supported', '~1.4.12', '~1.2.9', 'supported'],
    ['incomplete', '~1.4.12', undefined, 'incomplete'],
    ['unsupported primary', '1.3.0', '~1.2.9', 'unsupported'],
    ['unsupported companion', '~1.4.12', '1.1.1', 'unsupported'],
    ['ambiguous primary', 'workspace:*', '~1.2.9', 'ambiguous'],
    ['ambiguous companion', '~1.4.12', 'workspace:*', 'ambiguous'],
    ['absent packages', undefined, undefined, 'absent'],
    ['absent primary', undefined, '~1.2.9', 'absent'],
    ['absent primary with ambiguous companion', undefined, 'workspace:*', 'absent'],
    ['absent primary with unsupported companion', undefined, '1.1.1', 'absent'],
  ] as const)(
    'classifies the %s package pair',
    async (_description, primary, companion, expectedClassification) => {
      const dependencies = {
        ...(companion === undefined ? {} : { '@langchain/core': companion }),
        ...(primary === undefined ? {} : { '@langchain/langgraph': primary }),
      };
      const result = await discover(dependencies);

      expect(result).toMatchObject({
        kind: 'observed',
        observation: { targetClassification: expectedClassification },
      });
    },
  );

  test('stops at an owning manifest that omits the primary package', async () => {
    const result = await discoverLangGraphPackages(
      createAdapterRepository(
        createMemoryRepositoryReader([
          {
            content: JSON.stringify({
              dependencies: { '@langchain/langgraph': '~1.4.12' },
            }),
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

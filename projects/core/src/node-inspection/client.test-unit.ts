// @vitest-environment node
import { expectToRejectCode } from 'jg-exception/testing';
import { describe, expect, test, vi } from 'vitest';

import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';

import { createNodeProjectInspection } from './client.js';
import type { INodeProjectInspectionInput } from './types.js';

const repository = createMemoryRepositoryReader([]);

describe('Node inspection public input validation', () => {
  test.each([
    0,
    -0,
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
    NaN,
    Infinity,
    -Infinity,
    null,
    '2',
    true,
    {},
    [],
    2n,
  ])('rejects an invalid maximum without reader work (%o)', async (maxConcurrentInspections) => {
    const getEntry = vi.fn(repository.getEntry.bind(repository));
    await expectToRejectCode(
      createNodeProjectInspection({
        repository: {
          snapshot: repository.snapshot,
          compare: repository.compare.bind(repository),
          getEntry,
          listEntriesPage: repository.listEntriesPage.bind(repository),
          readFilePage: repository.readFilePage.bind(repository),
          readLinkText: repository.readLinkText.bind(repository),
        },
        maxConcurrentInspections,
      } as unknown as INodeProjectInspectionInput),
      'INVALID_ARGUMENT',
      'The Core operation received an invalid argument.',
    );
    expect(getEntry).not.toHaveBeenCalled();
  });

  test.each([
    null,
    {},
    { repository: null },
    { repository, deadline: Infinity },
    { repository, signal: {} },
  ])('rejects invalid input before admitting a child (%o)', async (input) => {
    await expect(
      createNodeProjectInspection(input as INodeProjectInspectionInput),
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
  });

  test('preserves pre-existing caller cancellation without reader work', async () => {
    const controller = new AbortController();
    const cause = new Error('caller abort');
    controller.abort(cause);
    await expect(
      createNodeProjectInspection({ repository, signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'ABORTED', cause });
  });
});

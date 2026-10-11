// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';

import { createNodeProjectInspection } from './client.js';
import type { INodeProjectInspectionInput } from './types.js';

const repository = createMemoryRepositoryReader([]);

describe('Node inspection public input validation', () => {
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

// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';

import { createNodeProjectInspection } from './client.js';
import type { INodeProjectInspectionInput } from './types.js';

const repository = createMemoryRepositoryReader([]);
const adapterRegistryUrl = new URL('file:///registry.mjs');

describe('Node inspection public input validation', () => {
  test.each([
    null,
    {},
    { repository: null, adapterRegistryUrl },
    { repository, adapterRegistryUrl: 'file:///registry.mjs' },
    { repository, adapterRegistryUrl: new URL('https://example.com/registry.mjs') },
    { repository, adapterRegistryUrl, deadline: Infinity },
    { repository, adapterRegistryUrl, signal: {} },
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
      createNodeProjectInspection({ repository, adapterRegistryUrl, signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'ABORTED', cause });
  });
});

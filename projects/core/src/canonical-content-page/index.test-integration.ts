// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { parseRepositoryPath } from '@moldea.ai/repository';

import { createCore } from '../core/index.js';
import { createMemoryRepositoryReader } from '../repository.test-fixtures.js';

describe('canonical content pages', () => {
  test('reads Unicode-safe byte ranges without materializing the complete file', async () => {
    const repository = createMemoryRepositoryReader([
      {
        content: 'A😀éZ',
        path: parseRepositoryPath('/moldea/project.md'),
        type: 'file',
      },
    ]);
    const core = createCore();
    const firstPage = await core.readCanonicalContentPage({
      maxBytes: 5,
      offset: 0,
      path: parseRepositoryPath('/moldea/project.md'),
      repository,
    });
    const secondPage = await core.readCanonicalContentPage({
      maxBytes: 5,
      offset: firstPage.nextOffset ?? -1,
      path: parseRepositoryPath('/moldea/project.md'),
      repository,
    });

    expect(firstPage).toMatchObject({
      byteEnd: 5,
      byteStart: 0,
      content: 'A😀',
      isComplete: false,
      nextOffset: 5,
      totalBytes: 8,
    });
    expect(secondPage).toMatchObject({
      byteEnd: 8,
      byteStart: 5,
      content: 'éZ',
      isComplete: true,
      nextOffset: null,
      totalBytes: 8,
    });
    expect(firstPage.source).toStrictEqual(repository.snapshot);
    expect(secondPage.contentIdentity).toBe(firstPage.contentIdentity);
  });

  test('rejects non-canonical paths and continuation-byte offsets', async () => {
    const repository = createMemoryRepositoryReader([
      {
        content: 'A😀Z',
        path: parseRepositoryPath('/moldea/project.md'),
        type: 'file',
      },
      {
        content: 'readme',
        path: parseRepositoryPath('/README.md'),
        type: 'file',
      },
    ]);
    const core = createCore();

    await expect(
      core.readCanonicalContentPage({
        maxBytes: 4,
        offset: 0,
        path: parseRepositoryPath('/README.md'),
        repository,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    await expect(
      core.readCanonicalContentPage({
        maxBytes: 4,
        offset: 2,
        path: parseRepositoryPath('/moldea/project.md'),
        repository,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
  });

  test('rejects invalid UTF-8 and files beyond the configured safety limit', async () => {
    const invalidRepository = createMemoryRepositoryReader([
      {
        content: Uint8Array.from([0xff]),
        path: parseRepositoryPath('/moldea/project.md'),
        type: 'file',
      },
    ]);
    const oversizedRepository = createMemoryRepositoryReader([
      {
        content: '12345',
        path: parseRepositoryPath('/moldea/project.md'),
        type: 'file',
      },
    ]);

    await expect(
      createCore().readCanonicalContentPage({
        maxBytes: 1,
        offset: 0,
        path: parseRepositoryPath('/moldea/project.md'),
        repository: invalidRepository,
      }),
    ).rejects.toMatchObject({ code: 'CONTENT_INVALID' });
    await expect(
      createCore({ limits: { maxFileBytes: 4 } }).readCanonicalContentPage({
        maxBytes: 4,
        offset: 0,
        path: parseRepositoryPath('/moldea/project.md'),
        repository: oversizedRepository,
      }),
    ).rejects.toMatchObject({ code: 'RESOURCE_LIMIT_EXCEEDED', limit: 'maxFileBytes' });
  });
});

// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { parseRepositoryPath } from '@moldea.ai/repository';

import { createCore } from '../core/index.js';
import { CoreOperationException } from '../exceptions/index.js';
import { createMemoryRepositoryReader } from '../repository.test-fixtures.js';

const createValidRepository = (projectContent: string) =>
  createMemoryRepositoryReader([
    {
      content: 'version: 1\n',
      path: parseRepositoryPath('/moldea/moldea.yaml'),
      type: 'file',
    },
    {
      content: projectContent,
      path: parseRepositoryPath('/moldea/project.md'),
      type: 'file',
    },
  ]);

describe('paged project inspection', () => {
  test('returns content-free metadata pages without gaps or duplicates', async () => {
    const core = createCore();
    const repository = createValidRepository('# Project\n');
    const firstPage = await core.inspectProjectPage({
      maxItems: 1,
      repository,
      view: 'metadata',
    });
    const cursor = firstPage.page.nextCursor;

    if (cursor === null) {
      throw new TypeError('The first page must expose a continuation cursor.');
    }

    const secondPage = await core.inspectProjectPage({
      cursor,
      maxItems: 1,
      repository: createValidRepository('# Project\n'),
      view: 'metadata',
    });
    const records = [...firstPage.page.records, ...secondPage.page.records];

    expect(firstPage).toMatchObject({
      counts: { diagnostics: 0, evidence: 0, metadata: 2 },
      page: { isComplete: false, totalItems: 2 },
      valid: true,
      view: 'metadata',
    });
    expect(secondPage.page).toMatchObject({ isComplete: true, nextCursor: null, totalItems: 2 });
    expect(
      records.map(({ item }) => (item.kind === 'metadata' ? item.metadata.path : item.kind)),
    ).toStrictEqual(['/moldea/moldea.yaml', '/moldea/project.md']);
    expect(JSON.stringify([firstPage, secondPage])).not.toContain('Project');
  });

  test('binds cursors to the view and repository snapshot', async () => {
    const core = createCore();
    const repository = createValidRepository('# First project\n');
    const firstPage = await core.inspectProjectPage({
      maxItems: 1,
      repository,
      view: 'metadata',
    });
    const cursor = firstPage.page.nextCursor;

    if (cursor === null) {
      throw new TypeError('The first page must expose a continuation cursor.');
    }

    const viewMismatch = core.inspectProjectPage({
      cursor,
      maxItems: 1,
      repository,
      view: 'all',
    });
    const snapshotMismatch = core.inspectProjectPage({
      cursor,
      maxItems: 1,
      repository: createValidRepository('# Changed project\n'),
      view: 'metadata',
    });

    await expect(viewMismatch).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
      operation: 'inspect-project-page',
    });
    await expect(snapshotMismatch).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
      operation: 'inspect-project-page',
    });
  });

  test('rejects malformed cursor and page limits', async () => {
    const core = createCore();
    const repository = createValidRepository('# Project\n');

    await expect(
      core.inspectProjectPage({
        cursor: 'not-a-core-cursor',
        maxItems: 1,
        repository,
        view: 'metadata',
      }),
    ).rejects.toBeInstanceOf(CoreOperationException);
    await expect(
      core.inspectProjectPage({ maxItems: 0, repository, view: 'metadata' }),
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });

    const firstPage = await core.inspectProjectPage({
      maxItems: 1,
      repository,
      view: 'metadata',
    });
    const cursor = firstPage.page.nextCursor;

    if (cursor === null) {
      throw new TypeError('The first page must expose a continuation cursor.');
    }

    await expect(
      core.inspectProjectPage({
        cursor: `${cursor.slice(0, -1)}${cursor.endsWith('0') ? '1' : '0'}`,
        maxItems: 1,
        repository,
        view: 'metadata',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
  });
});

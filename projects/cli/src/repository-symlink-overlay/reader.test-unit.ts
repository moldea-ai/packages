// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { REPOSITORY_ROOT, parseRepositoryPath } from '@moldea.ai/repository';
import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';

import { createGitSymlinkOverlayRepositoryReader } from './reader.js';

describe('Git symlink overlay', () => {
  test('maps selected regular files to logical symlinks across lookup and listing', async () => {
    const linkPath = parseRepositoryPath('/moldea/link');
    const reader = createGitSymlinkOverlayRepositoryReader(
      createMemoryRepositoryReader([
        { content: '../target', path: linkPath, type: 'file' },
        { content: 'ordinary', path: '/moldea/ordinary.txt', type: 'file' },
      ]),
      [linkPath],
    );

    await expect(reader.getEntry(linkPath)).resolves.toStrictEqual({
      byteLength: null,
      contentIdentity: null,
      path: linkPath,
      type: 'symlink',
    });
    await expect(reader.readFilePage(linkPath, { maxBytes: 16, offset: 0 })).rejects.toMatchObject({
      code: 'ENTRY_NOT_FILE',
      operation: 'read-file-page',
    });
    expect(
      (await reader.listEntriesPage({ maxEntries: 16 })).entries.map(({ path, type }) => ({
        path,
        type,
      })),
    ).toContainEqual({ path: linkPath, type: 'symlink' });
  });

  test('rejects the repository root as an overlay path', () => {
    expect(() =>
      createGitSymlinkOverlayRepositoryReader(createMemoryRepositoryReader([]), [REPOSITORY_ROOT]),
    ).toThrow(expect.objectContaining({ code: 'INVALID_SOURCE_DATA' }));
  });

  test('honors cancellation before exposing overlaid entry bytes', async () => {
    const linkPath = parseRepositoryPath('/moldea/link');
    const reader = createGitSymlinkOverlayRepositoryReader(
      createMemoryRepositoryReader([{ content: '../target', path: linkPath, type: 'file' }]),
      [linkPath],
    );
    const controller = new AbortController();

    controller.abort('test');

    await expect(
      reader.readFilePage(linkPath, { maxBytes: 16, offset: 0, signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'ABORTED', operation: 'read-file-page' });
  });
});

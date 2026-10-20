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

  test('reads a materialized link file as the link text Git stored', async () => {
    const linkPath = parseRepositoryPath('/moldea/link');
    const nativePath = parseRepositoryPath('/moldea/native');
    const atLimitPath = parseRepositoryPath('/moldea/at-limit');
    const overLimitPath = parseRepositoryPath('/moldea/over-limit');
    const invalidPath = parseRepositoryPath('/moldea/invalid');
    const emptyPath = parseRepositoryPath('/moldea/empty');
    const reader = createGitSymlinkOverlayRepositoryReader(
      createMemoryRepositoryReader([
        { content: '../docs/AGENTS.md', path: linkPath, type: 'file' },
        { path: nativePath, target: 'link', type: 'symlink' },
        { content: 'a'.repeat(4096), path: atLimitPath, type: 'file' },
        { content: 'a'.repeat(4097), path: overLimitPath, type: 'file' },
        { content: new Uint8Array([0x61, 0xff]), path: invalidPath, type: 'file' },
        { content: '', path: emptyPath, type: 'file' },
        { content: 'ordinary', path: '/moldea/ordinary.txt', type: 'file' },
      ]),
      [linkPath, atLimitPath, overLimitPath, invalidPath, emptyPath],
    );

    await expect(reader.readLinkText(linkPath)).resolves.toBe('../docs/AGENTS.md');
    await expect(reader.readLinkText(nativePath)).resolves.toBe('link');
    await expect(reader.readLinkText(atLimitPath)).resolves.toBe('a'.repeat(4096));
    await expect(reader.readLinkText(overLimitPath)).resolves.toBeNull();
    await expect(reader.readLinkText(invalidPath)).resolves.toBeNull();
    await expect(reader.readLinkText(emptyPath)).resolves.toBe('');
    await expect(
      reader.readLinkText(parseRepositoryPath('/moldea/ordinary.txt')),
    ).rejects.toMatchObject({ code: 'ENTRY_NOT_LINK', operation: 'read-link-text' });
  });

  test('rejects link text for an overlay path that is no longer a regular file', async () => {
    const linkPath = parseRepositoryPath('/moldea/link');
    const reader = createGitSymlinkOverlayRepositoryReader(
      createMemoryRepositoryReader([{ path: linkPath, type: 'directory' }]),
      [linkPath],
    );

    await expect(reader.readLinkText(linkPath)).rejects.toMatchObject({
      code: 'INVALID_SOURCE_DATA',
      operation: 'read-link-text',
    });
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
    await expect(
      reader.readLinkText(linkPath, { signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'ABORTED', operation: 'read-link-text' });
  });
});

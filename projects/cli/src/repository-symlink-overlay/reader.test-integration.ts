// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { parseRepositoryPath } from '@moldea.ai/repository';
import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';

import { createGitSymlinkOverlayRepositoryReader } from './reader.js';

describe('Git symlink overlay with the memory repository reader', () => {
  test('preserves one coherent logical symlink view without exposing host-file bytes', async () => {
    const linkPath = parseRepositoryPath('/moldea/link');
    const ordinaryPath = parseRepositoryPath('/moldea/ordinary.txt');
    const underlyingReader = createMemoryRepositoryReader([
      { content: '../target', path: linkPath, type: 'file' },
      { content: 'ordinary', path: ordinaryPath, type: 'file' },
    ]);
    const reader = createGitSymlinkOverlayRepositoryReader(underlyingReader, [linkPath]);

    await expect(reader.getEntry(linkPath)).resolves.toStrictEqual({
      byteLength: null,
      contentIdentity: null,
      path: linkPath,
      type: 'symlink',
    });
    await expect(
      reader.readFilePage(linkPath, { maxBytes: 1024, offset: 0 }),
    ).rejects.toMatchObject({
      code: 'ENTRY_NOT_FILE',
      operation: 'read-file-page',
      path: linkPath,
      retryable: false,
    });

    const page = await reader.listEntriesPage({ maxEntries: 16 });

    expect(page.entries.map(({ path, type }) => ({ path, type }))).toStrictEqual([
      { path: parseRepositoryPath('/moldea'), type: 'directory' },
      { path: linkPath, type: 'symlink' },
      { path: ordinaryPath, type: 'file' },
    ]);
    await expect(
      reader.readFilePage(ordinaryPath, { maxBytes: 1024, offset: 0 }),
    ).resolves.toMatchObject({ bytes: new TextEncoder().encode('ordinary'), isComplete: true });
    await expect(
      underlyingReader.readFilePage(linkPath, { maxBytes: 1024, offset: 0 }),
    ).resolves.toMatchObject({ bytes: new TextEncoder().encode('../target'), isComplete: true });
  });
});

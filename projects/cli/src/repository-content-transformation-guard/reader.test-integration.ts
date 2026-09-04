// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { parseRepositoryPath } from '@moldea.ai/repository';
import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';

import { createGitSymlinkOverlayRepositoryReader } from '../repository-symlink-overlay/index.js';

import { createGitContentTransformationGuardRepositoryReader } from './reader.js';

describe('Git content-transformation guard with logical repository overlays', () => {
  test('guards only logical regular files after native and materialized symlink classification', async () => {
    const guardedPath = parseRepositoryPath('/moldea/guarded.txt');
    const materializedLinkPath = parseRepositoryPath('/moldea/materialized-link');
    const nativeLinkPath = parseRepositoryPath('/moldea/native-link');
    const ordinaryPath = parseRepositoryPath('/moldea/ordinary.txt');
    const memoryReader = createMemoryRepositoryReader([
      { content: 'guarded bytes', path: guardedPath, type: 'file' },
      { content: '../target', path: materializedLinkPath, type: 'file' },
      { path: nativeLinkPath, type: 'symlink' },
      { content: 'ordinary bytes', path: ordinaryPath, type: 'file' },
    ]);
    const overlaidReader = createGitSymlinkOverlayRepositoryReader(memoryReader, [
      materializedLinkPath,
    ]);
    const reader = createGitContentTransformationGuardRepositoryReader(overlaidReader, [
      guardedPath,
      materializedLinkPath,
      nativeLinkPath,
    ]);

    const entries = (await reader.listEntriesPage({ maxEntries: 16 })).entries;

    expect(entries.map(({ path, type }) => ({ path, type }))).toEqual(
      expect.arrayContaining([
        { path: guardedPath, type: 'file' },
        { path: materializedLinkPath, type: 'symlink' },
        { path: nativeLinkPath, type: 'symlink' },
      ]),
    );
    await expect(
      reader.readFilePage(guardedPath, { maxBytes: 1024, offset: 0 }),
    ).rejects.toMatchObject({
      code: 'SOURCE_UNAVAILABLE',
      operation: 'read-file-page',
      path: guardedPath,
      retryable: false,
    });
    await expect(
      reader.readFilePage(materializedLinkPath, { maxBytes: 1024, offset: 0 }),
    ).rejects.toMatchObject({
      code: 'ENTRY_NOT_FILE',
      path: materializedLinkPath,
    });
    await expect(
      reader.readFilePage(nativeLinkPath, { maxBytes: 1024, offset: 0 }),
    ).rejects.toMatchObject({
      code: 'ENTRY_NOT_FILE',
      path: nativeLinkPath,
    });
    await expect(
      reader.readFilePage(ordinaryPath, { maxBytes: 1024, offset: 0 }),
    ).resolves.toMatchObject({
      bytes: new TextEncoder().encode('ordinary bytes'),
      isComplete: true,
    });
  });
});

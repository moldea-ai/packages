// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { REPOSITORY_ROOT, parseRepositoryPath } from '@moldea.ai/repository';
import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';

import { createGitContentTransformationGuardRepositoryReader } from './reader.js';

describe('Git content-transformation guard', () => {
  test('blocks bytes only for guarded logical regular files', async () => {
    const guardedPath = parseRepositoryPath('/moldea/guarded.md');
    const ordinaryPath = parseRepositoryPath('/moldea/project.md');
    const reader = createGitContentTransformationGuardRepositoryReader(
      createMemoryRepositoryReader([
        { content: 'guarded', path: guardedPath, type: 'file' },
        { content: 'project', path: ordinaryPath, type: 'file' },
      ]),
      [guardedPath],
    );

    await expect(
      reader.readFilePage(guardedPath, { maxBytes: 16, offset: 0 }),
    ).rejects.toMatchObject({ code: 'SOURCE_UNAVAILABLE', operation: 'read-file-page' });
    await expect(
      reader.readFilePage(ordinaryPath, { maxBytes: 16, offset: 0 }),
    ).resolves.toMatchObject({ bytes: new TextEncoder().encode('project'), isComplete: true });
  });

  test('rejects the repository root as a guarded file path', () => {
    expect(() =>
      createGitContentTransformationGuardRepositoryReader(createMemoryRepositoryReader([]), [
        REPOSITORY_ROOT,
      ]),
    ).toThrow(expect.objectContaining({ code: 'INVALID_SOURCE_DATA' }));
  });

  test('honors cancellation before guarded lookup', async () => {
    const guardedPath = parseRepositoryPath('/moldea/guarded.md');
    const reader = createGitContentTransformationGuardRepositoryReader(
      createMemoryRepositoryReader([{ content: 'guarded', path: guardedPath, type: 'file' }]),
      [guardedPath],
    );
    const controller = new AbortController();

    controller.abort('test');

    await expect(
      reader.readFilePage(guardedPath, {
        maxBytes: 16,
        offset: 0,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: 'ABORTED', operation: 'read-file-page' });
  });
});

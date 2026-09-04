// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';

import { parseRepositoryPath } from '@moldea.ai/repository';

import { createWorkingTreeRepositoryReader } from './factory.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe('working-tree reader composition with repository-fs', () => {
  test('materializes exact selected paths and applies the Git symlink overlay', async () => {
    const repositoryRoot = await mkdtemp(join(tmpdir(), 'moldea-cli-repository-reader-'));

    temporaryDirectories.push(repositoryRoot);
    await mkdir(join(repositoryRoot, 'moldea'));
    await writeFile(join(repositoryRoot, 'moldea', 'link'), '../target');
    await writeFile(join(repositoryRoot, 'moldea', 'guarded.md'), 'guarded context');
    await writeFile(join(repositoryRoot, 'moldea', 'project.md'), 'project context');
    await writeFile(join(repositoryRoot, 'unselected.txt'), 'excluded');

    const linkPath = parseRepositoryPath('/moldea/link');
    const guardedPath = parseRepositoryPath('/moldea/guarded.md');
    const projectPath = parseRepositoryPath('/moldea/project.md');
    const reader = await createWorkingTreeRepositoryReader({
      entries: [
        {
          contentTransformation: {
            filter: 'private',
            ident: 'unspecified',
            isGuarded: true,
            workingTreeEncoding: 'unspecified',
          },
          entryType: 'file',
          indexEntries: [{ mode: '120000', stage: 0 }],
          kind: 'tracked',
          path: linkPath,
          requiresSymlinkOverlay: true,
        },
        {
          contentTransformation: {
            filter: 'private',
            ident: 'unspecified',
            isGuarded: true,
            workingTreeEncoding: 'unspecified',
          },
          entryType: 'file',
          kind: 'untracked',
          path: guardedPath,
          requiresSymlinkOverlay: false,
        },
        {
          contentTransformation: {
            filter: 'unspecified',
            ident: 'unspecified',
            isGuarded: false,
            workingTreeEncoding: 'unspecified',
          },
          entryType: 'file',
          kind: 'untracked',
          path: projectPath,
          requiresSymlinkOverlay: false,
        },
      ],
      repositoryRoot,
      resourceLimits: {
        maxDiagnostics: 16,
        maxEntries: 16,
        maxEvidence: 16,
        maxFileBytes: 1024,
        maxManifestBytes: 1024,
        maxTotalBytes: 2048,
      },
    });

    const entries = (await reader.listEntriesPage({ maxEntries: 16 })).entries;

    expect(entries.map(({ path, type }) => ({ path, type }))).toStrictEqual([
      { path: parseRepositoryPath('/moldea'), type: 'directory' },
      { path: guardedPath, type: 'file' },
      { path: linkPath, type: 'symlink' },
      { path: projectPath, type: 'file' },
    ]);
    await expect(
      reader.readFilePage(linkPath, { maxBytes: 1024, offset: 0 }),
    ).rejects.toMatchObject({
      code: 'ENTRY_NOT_FILE',
      operation: 'read-file-page',
      path: linkPath,
      retryable: false,
    });
    await expect(
      reader.readFilePage(guardedPath, { maxBytes: 1024, offset: 0 }),
    ).rejects.toMatchObject({
      code: 'SOURCE_UNAVAILABLE',
      operation: 'read-file-page',
      path: guardedPath,
      retryable: false,
    });
    await expect(
      reader.readFilePage(projectPath, { maxBytes: 1024, offset: 0 }),
    ).resolves.toMatchObject({
      bytes: new TextEncoder().encode('project context'),
      isComplete: true,
    });
    await expect(reader.getEntry(parseRepositoryPath('/unselected.txt'))).resolves.toBeNull();
  });
});

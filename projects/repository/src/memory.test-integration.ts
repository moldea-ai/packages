// @vitest-environment node
import { describeRepositoryReaderConformance } from '@moldea.ai/repository/testing';

import { RepositoryPathException, RepositorySourceException } from './exceptions.js';
import { createMemoryRepositoryReader, type IMemoryRepositoryEntry } from './memory.js';
import { createValidMemoryEntries } from './memory.test-fixtures.js';
import { REPOSITORY_ROOT, parseRepositoryPath } from './repository-path.js';

const expectedEntries = [
  { path: parseRepositoryPath('/Case.txt'), type: 'file' as const },
  { path: parseRepositoryPath('/README.md'), type: 'file' as const },
  { path: parseRepositoryPath('/case.txt'), type: 'file' as const },
  { path: parseRepositoryPath('/empty.bin'), type: 'file' as const },
  { path: parseRepositoryPath('/link'), type: 'symlink' as const },
  { path: parseRepositoryPath('/nested'), type: 'directory' as const },
  { path: parseRepositoryPath('/nested/deep'), type: 'directory' as const },
  { path: parseRepositoryPath('/nested/deep/data.bin'), type: 'file' as const },
  { path: parseRepositoryPath('/nested/empty'), type: 'directory' as const },
  { path: parseRepositoryPath('/unicode'), type: 'directory' as const },
  { path: parseRepositoryPath('/unicode/café-😀.txt'), type: 'file' as const },
];

describeRepositoryReaderConformance('in-memory', {
  casePaths: { kind: 'distinct', paths: ['/Case.txt', '/case.txt'] },
  createReader: () => createMemoryRepositoryReader(createValidMemoryEntries()),
  createSnapshotMutationFixture: () => {
    const entries = [...createValidMemoryEntries()];
    const fileEntry = entries.find(
      (entry): entry is Extract<IMemoryRepositoryEntry, { readonly type: 'file' }> =>
        entry.path === '/nested/deep/data.bin' && entry.type === 'file',
    );

    if (fileEntry === undefined || typeof fileEntry.content === 'string') {
      throw new Error('The snapshot-mutation fixture file is missing exact byte content.');
    }

    const mutableBytes = fileEntry.content;
    const reader = createMemoryRepositoryReader(entries);

    return {
      behavior: 'preserve-snapshot' as const,
      mutateSource: () => {
        mutableBytes.fill(99);
      },
      reader,
    };
  },
  emptyFilePath: '/empty.bin',
  expectedEntries,
  fileBytes: new Uint8Array([0, 1, 13, 10, 128, 255]),
  filePath: '/nested/deep/data.bin',
  isRepositoryPathException: (cause) => cause instanceof RepositoryPathException,
  isRepositorySourceException: (cause) => cause instanceof RepositorySourceException,
  missingPath: '/missing.txt',
  nestedDirectoryPath: '/nested',
  nestedExpectedPaths: ['/nested/deep', '/nested/deep/data.bin', '/nested/empty'],
  parsePath: parseRepositoryPath,
  rootPath: REPOSITORY_ROOT,
  symlinkPath: '/link',
  unicodePath: '/unicode/café-😀.txt',
});

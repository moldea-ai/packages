// @vitest-environment node
import { mkdir, mkdtemp, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  REPOSITORY_ROOT,
  RepositoryPathException,
  RepositorySourceException,
  parseRepositoryPath,
  type IRepositoryEntry,
  type IRepositoryReader,
} from '@moldea.ai/repository';
import { describeRepositoryReaderConformance } from '@moldea.ai/repository/testing';
import { afterAll, describe, expect, test } from 'vitest';
import { expectToRejectCode } from 'web-utils-kit';

import { createFilesystemRepositoryTestFixtures } from './factory.test-fixtures.js';
import { createFilesystemRepositoryReader } from './filesystem-repository-reader.js';

const fixtures = await createFilesystemRepositoryTestFixtures();

afterAll(async () => {
  await fixtures.cleanup();
});

const collectEntries = async (reader: IRepositoryReader): Promise<IRepositoryEntry[]> => {
  const entries: IRepositoryEntry[] = [];
  let cursor: string | null | undefined;

  while (cursor !== null) {
    const page = await reader.listEntriesPage({
      ...(cursor === undefined ? {} : { cursor }),
      maxEntries: 3,
    });
    entries.push(...page.entries);

    if (page.isComplete) {
      return entries;
    }

    if (page.nextCursor === null) {
      throw new Error('The incomplete filesystem page omitted its continuation cursor.');
    }

    cursor = page.nextCursor;
  }

  return entries;
};

describeRepositoryReaderConformance('filesystem', {
  casePaths: fixtures.primary.casePaths,
  createReader: () =>
    createFilesystemRepositoryReader({
      rootDirectory: fixtures.primary.rootDirectory,
      selection: { kind: 'directory' },
    }),
  createSnapshotMutationFixture: async () => {
    const reader = await createFilesystemRepositoryReader({
      rootDirectory: fixtures.mutation.rootDirectory,
      selection: { kind: 'directory' },
    });

    return {
      behavior: 'report-snapshot-changed',
      mutateSource: () =>
        writeFile(
          path.join(fixtures.mutation.rootDirectory, 'nested', 'deep', 'data.bin'),
          new Uint8Array([99]),
        ),
      reader,
    };
  },
  emptyFilePath: '/empty.bin',
  expectedEntries: fixtures.primary.expectedEntries,
  fileBytes: fixtures.primary.fileBytes,
  filePath: '/nested/deep/data.bin',
  isRepositoryPathException: (cause) => cause instanceof RepositoryPathException,
  isRepositorySourceException: (cause) => cause instanceof RepositorySourceException,
  missingPath: '/missing.txt',
  nestedDirectoryPath: '/nested',
  nestedExpectedPaths: ['/nested/deep', '/nested/deep/data.bin', '/nested/empty'],
  parsePath: parseRepositoryPath,
  rootPath: REPOSITORY_ROOT,
  symlinkPath: '/link',
  unicodePath: fixtures.primary.unicodePath,
});

describe('filesystem repository reader', () => {
  test('keeps stat identities private while serving bounded file pages', async () => {
    const logicalPath = parseRepositoryPath('/nested/deep/data.bin');
    const reader = await createFilesystemRepositoryReader({
      rootDirectory: fixtures.primary.rootDirectory,
      selection: { kind: 'directory' },
    });

    await expect(reader.getEntry(logicalPath)).resolves.toMatchObject({
      contentIdentity: null,
      path: logicalPath,
      type: 'file',
    });
    await expect(
      reader.readFilePage(logicalPath, { maxBytes: 2, offset: 0 }),
    ).resolves.toMatchObject({
      bytes: fixtures.primary.fileBytes.slice(0, 2),
      offset: 0,
    });
  });

  test('does not traverse a descendant symlink during exact lookup', async () => {
    const redirectedPath = parseRepositoryPath('/link/deep/data.bin');
    const reader = await createFilesystemRepositoryReader({
      rootDirectory: fixtures.primary.rootDirectory,
      selection: { kind: 'directory' },
    });

    await expect(reader.getEntry(redirectedPath)).resolves.toBeNull();
    await expectToRejectCode(
      reader.readFilePage(redirectedPath, { maxBytes: 1, offset: 0 }),
      'ENTRY_NOT_FOUND',
    );
  });

  test('rejects a selected root replaced by a symlink before reading outside files', async () => {
    const suiteDirectory = await mkdtemp(path.join(tmpdir(), 'moldea-root-drift-'));
    const rootDirectory = path.join(suiteDirectory, 'root');
    const outsideDirectory = path.join(suiteDirectory, 'outside');
    const secretPath = parseRepositoryPath('/secret.txt');

    try {
      await mkdir(rootDirectory);
      await mkdir(outsideDirectory);
      await writeFile(path.join(outsideDirectory, 'secret.txt'), 'outside content');
      const reader = await createFilesystemRepositoryReader({
        rootDirectory,
        selection: { kind: 'directory' },
      });

      await rename(rootDirectory, path.join(suiteDirectory, 'original'));
      await symlink(outsideDirectory, rootDirectory, 'dir');

      await expectToRejectCode(reader.getEntry(secretPath), 'SNAPSHOT_CHANGED');
      await expectToRejectCode(reader.listEntriesPage({ maxEntries: 4 }), 'SNAPSHOT_CHANGED');
      await expectToRejectCode(
        reader.readFilePage(secretPath, { maxBytes: 32, offset: 0 }),
        'SNAPSHOT_CHANGED',
      );
    } finally {
      await rm(suiteDirectory, { force: true, recursive: true });
    }
  });

  test('rejects a previously read file when its parent becomes a symlink', async () => {
    const suiteDirectory = await mkdtemp(path.join(tmpdir(), 'moldea-parent-drift-'));
    const rootDirectory = path.join(suiteDirectory, 'root');
    const parentDirectory = path.join(rootDirectory, 'nested', 'deep');
    const outsideDirectory = path.join(suiteDirectory, 'outside');
    const logicalPath = parseRepositoryPath('/nested/deep/file.txt');

    try {
      await mkdir(parentDirectory, { recursive: true });
      await mkdir(outsideDirectory);
      await writeFile(path.join(parentDirectory, 'file.txt'), 'selected content');
      await writeFile(path.join(outsideDirectory, 'file.txt'), 'outside content');
      const reader = await createFilesystemRepositoryReader({
        rootDirectory,
        selection: { kind: 'directory' },
      });

      await expect(
        reader.readFilePage(logicalPath, { maxBytes: 32, offset: 0 }),
      ).resolves.toMatchObject({
        bytes: new TextEncoder().encode('selected content'),
      });
      await rename(parentDirectory, path.join(rootDirectory, 'nested', 'original'));
      await symlink(outsideDirectory, parentDirectory, 'dir');

      await expectToRejectCode(
        reader.readFilePage(logicalPath, { maxBytes: 32, offset: 0 }),
        'SNAPSHOT_CHANGED',
      );
    } finally {
      await rm(suiteDirectory, { force: true, recursive: true });
    }
  });

  test('pages only selected paths and their directory parents', async () => {
    const reader = await createFilesystemRepositoryReader({
      rootDirectory: fixtures.primary.rootDirectory,
      selection: {
        kind: 'paths',
        paths: [parseRepositoryPath('/README.md'), parseRepositoryPath('/nested/deep/data.bin')],
      },
    });
    const entries = await collectEntries(reader);

    expect(entries.map((entry) => entry.path)).toStrictEqual([
      '/README.md',
      '/nested',
      '/nested/deep',
      '/nested/deep/data.bin',
    ]);
    await expect(reader.getEntry(parseRepositoryPath('/empty.bin'))).resolves.toBeNull();
  });

  test('binds continuation cursors to their reader and rejects tampering', async () => {
    const reader = await createFilesystemRepositoryReader({
      rootDirectory: fixtures.primary.rootDirectory,
      selection: { kind: 'directory' },
    });
    const page = await reader.listEntriesPage({ maxEntries: 1 });

    expect(page.isComplete).toBe(false);
    expect(page.nextCursor).not.toBeNull();

    if (page.nextCursor === null) {
      throw new Error('The cursor fixture unexpectedly completed in one page.');
    }

    const tamperedCursor = `${page.nextCursor.slice(0, -1)}${page.nextCursor.endsWith('A') ? 'B' : 'A'}`;

    await expectToRejectCode(
      reader.listEntriesPage({ cursor: tamperedCursor, maxEntries: 1 }),
      'INVALID_PAGE_REQUEST',
    );
  });

  test('uses closed versioned keysets for directory and selected-path continuation', async () => {
    const directoryReader = await createFilesystemRepositoryReader({
      rootDirectory: fixtures.primary.rootDirectory,
      selection: { kind: 'directory' },
    });
    const selectedReader = await createFilesystemRepositoryReader({
      rootDirectory: fixtures.primary.rootDirectory,
      selection: {
        kind: 'paths',
        paths: [parseRepositoryPath('/README.md'), parseRepositoryPath('/nested/deep/data.bin')],
      },
    });
    const directoryPage = await directoryReader.listEntriesPage({ maxEntries: 1 });
    const selectedPage = await selectedReader.listEntriesPage({ maxEntries: 1 });

    for (const page of [directoryPage, selectedPage]) {
      if (page.nextCursor === null) {
        throw new TypeError('The cursor contract fixture unexpectedly completed in one page.');
      }

      const encodedPayload = page.nextCursor.slice(0, page.nextCursor.lastIndexOf('.'));
      const payload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8'),
      ) as unknown;

      expect(payload).toMatchObject({ version: 1 });
      expect(JSON.stringify(payload)).not.toContain('"index"');
    }

    const directoryPayload = JSON.parse(
      Buffer.from(
        directoryPage.nextCursor?.slice(0, directoryPage.nextCursor.lastIndexOf('.')) ?? '',
        'base64url',
      ).toString('utf8'),
    ) as { frames?: readonly { lastName?: unknown }[] };
    const selectedPayload = JSON.parse(
      Buffer.from(
        selectedPage.nextCursor?.slice(0, selectedPage.nextCursor.lastIndexOf('.')) ?? '',
        'base64url',
      ).toString('utf8'),
    ) as { lastPath?: unknown };

    expect(directoryPayload.frames?.every((frame) => 'lastName' in frame)).toBe(true);
    expect(typeof selectedPayload.lastPath).toBe('string');
  });

  test('enforces page bounds with named resource metadata', async () => {
    const reader = await createFilesystemRepositoryReader({
      limits: { maxPageEntries: 2, maxReadBytes: 2 },
      rootDirectory: fixtures.primary.rootDirectory,
      selection: { kind: 'directory' },
    });
    const oversizedListing = reader.listEntriesPage({ maxEntries: 3 });
    const oversizedRead = reader.readFilePage(parseRepositoryPath('/README.md'), {
      maxBytes: 3,
      offset: 0,
    });

    await expectToRejectCode(oversizedListing, 'RESOURCE_LIMIT_EXCEEDED');
    await expect(oversizedListing).rejects.toMatchObject({
      resource: { dimension: 'pageEntries', limit: 2, observed: 3 },
    });
    await expectToRejectCode(oversizedRead, 'RESOURCE_LIMIT_EXCEEDED');
    await expect(oversizedRead).rejects.toMatchObject({
      resource: { dimension: 'readBytes', limit: 2, observed: 3 },
    });
  });

  test('bounds concurrent work, cancels queued reads, and releases the active slot', async () => {
    const logicalPath = parseRepositoryPath('/nested/deep/data.bin');
    const reader = await createFilesystemRepositoryReader({
      limits: { maxConcurrentOperations: 1, maxQueuedOperations: 1 },
      rootDirectory: fixtures.primary.rootDirectory,
      selection: { kind: 'directory' },
    });
    const controller = new AbortController();
    const firstRead = reader.readFilePage(logicalPath, { maxBytes: 2, offset: 0 });
    const queuedRead = reader.readFilePage(logicalPath, {
      maxBytes: 2,
      offset: 0,
      signal: controller.signal,
    });
    const overflowRead = reader.readFilePage(logicalPath, { maxBytes: 2, offset: 0 });
    const queuedFailure = expectToRejectCode(queuedRead, 'ABORTED');
    const overflowFailure = expectToRejectCode(overflowRead, 'RESOURCE_LIMIT_EXCEEDED');

    controller.abort();

    await Promise.all([queuedFailure, overflowFailure]);
    await expect(firstRead).resolves.toMatchObject({
      bytes: fixtures.primary.fileBytes.slice(0, 2),
    });
    await expect(
      reader.readFilePage(logicalPath, { maxBytes: 2, offset: 0 }),
    ).resolves.toMatchObject({ bytes: fixtures.primary.fileBytes.slice(0, 2) });
  });

  test('stops streaming a wide directory at the configured entry limit', async () => {
    const reader = await createFilesystemRepositoryReader({
      limits: { maxDirectoryEntries: 1 },
      rootDirectory: fixtures.primary.rootDirectory,
      selection: { kind: 'directory' },
    });
    const listing = reader.listEntriesPage({ maxEntries: 1 });

    await expectToRejectCode(listing, 'RESOURCE_LIMIT_EXCEEDED');
    await expect(listing).rejects.toMatchObject({
      resource: { dimension: 'directoryEntries', limit: 1, observed: 2 },
    });
  });

  test('bypasses undersized caches and still detects later file mutation', async () => {
    const logicalPath = parseRepositoryPath('/nested/deep/data.bin');
    const reader = await createFilesystemRepositoryReader({
      limits: { maxCachedBytes: 1 },
      rootDirectory: fixtures.recovery.rootDirectory,
      selection: { kind: 'paths', paths: [logicalPath] },
    });
    const initial = await reader.readFilePage(logicalPath, { maxBytes: 16, offset: 0 });

    expect(initial.bytes).toStrictEqual(fixtures.recovery.fileBytes);
    await writeFile(
      path.join(fixtures.recovery.rootDirectory, 'nested', 'deep', 'data.bin'),
      new Uint8Array([99]),
    );
    await expectToRejectCode(
      reader.readFilePage(logicalPath, { maxBytes: 16, offset: 0 }),
      'SNAPSHOT_CHANGED',
    );
  });

  test('returns a frozen public reader without materializing the directory tree', async () => {
    const reader = await createFilesystemRepositoryReader({
      limits: { maxEntries: 1 },
      rootDirectory: fixtures.primary.rootDirectory,
      selection: { kind: 'directory' },
    });

    expect(Object.isFrozen(reader)).toBe(true);
    await expectToRejectCode(reader.listEntriesPage({ maxEntries: 2 }), 'RESOURCE_LIMIT_EXCEEDED');
  });
});

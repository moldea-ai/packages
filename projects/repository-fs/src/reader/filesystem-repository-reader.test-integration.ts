// @vitest-environment node
import { mkdir, mkdtemp, rename, rm, symlink, writeFile } from 'node:fs/promises';
import fsPromises from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
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
import { afterAll, describe, expect, test, vi } from 'vitest';
import { expectToRejectCode } from 'jg-exception/testing';

import { createFilesystemRepositoryTestFixtures } from './factory.test-fixtures.js';
import { createFilesystemRepositoryReader } from './filesystem-repository-reader.js';

const fixtures = await createFilesystemRepositoryTestFixtures();
const isWindows = process.platform === 'win32';

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

describeRepositoryReaderConformance({ describe, expect, test }, 'filesystem', {
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
  symlinkText: fixtures.primary.symlinkText,
  unicodePath: fixtures.primary.unicodePath,
  unreadableSymlinkPaths: [],
});

describe('filesystem repository reader', () => {
  const verifyInvalidSiblingLookup = async (
    location: string,
    invalidName: Buffer,
  ): Promise<void> => {
    const rootDirectory = await mkdtemp(path.join(tmpdir(), 'moldea-invalid-sibling-'));
    const parentDirectory =
      location === 'root' ? rootDirectory : path.join(rootDirectory, 'nested');
    const selectedPath = parseRepositoryPath(location === 'root' ? '/z.txt' : '/nested/z.txt');
    const originalOpendir = fsPromises.opendir;
    const spy = vi.spyOn(fsPromises, 'opendir').mockImplementation(async (...args) => {
      const directory = await originalOpendir(...args);
      const iterate = directory[Symbol.asyncIterator].bind(directory);
      directory[Symbol.asyncIterator] = async function* () {
        const entries = [];
        for await (const entry of iterate()) entries.push(entry);
        entries.sort((left, right) =>
          Buffer.compare(Buffer.from(left.name), Buffer.from(right.name)),
        );
        for (const entry of entries) yield entry;
      };
      return directory;
    });
    syncBuiltinESMExports();

    try {
      await mkdir(parentDirectory, { recursive: true });
      await writeFile(
        Buffer.concat([Buffer.from(`${parentDirectory}${path.sep}`), invalidName]),
        'invalid sibling',
      );
      await writeFile(path.join(parentDirectory, 'z.txt'), 'selected');
      const reader = await createFilesystemRepositoryReader({
        rootDirectory,
        selection: { kind: 'paths', paths: [selectedPath] },
      });
      await expect(reader.getEntry(selectedPath)).resolves.toMatchObject({
        path: selectedPath,
        type: 'file',
      });
      await expect(
        reader.readFilePage(selectedPath, { maxBytes: 8, offset: 0 }),
      ).resolves.toMatchObject({
        bytes: new TextEncoder().encode('selected'),
      });
      const entries = await collectEntries(reader);
      expect(entries.map((entry) => entry.path)).toStrictEqual(
        location === 'root' ? [selectedPath] : ['/nested', selectedPath],
      );

      const limitedSelection = createFilesystemRepositoryReader({
        limits: { maxDirectoryEntries: 1 },
        rootDirectory,
        selection: { kind: 'paths', paths: [selectedPath] },
      });
      await expectToRejectCode(limitedSelection, 'RESOURCE_LIMIT_EXCEEDED');
      await expect(limitedSelection).rejects.toMatchObject({
        resource: { dimension: 'directoryEntries', limit: 1, observed: 2 },
      });

      const directoryReader = await createFilesystemRepositoryReader({
        rootDirectory,
        selection: { kind: 'directory' },
      });
      await expectToRejectCode(collectEntries(directoryReader), 'INVALID_SOURCE_DATA');
    } finally {
      spy.mockRestore();
      syncBuiltinESMExports();
      await rm(rootDirectory, { force: true, recursive: true });
    }
  };

  test.skipIf(process.platform === 'win32').each(['root', 'nested'])(
    'reads a selected path beside an invalid logical name at %s',
    async (location) => {
      await verifyInvalidSiblingLookup(location, Buffer.from('a\n.txt'));
    },
  );

  test.skipIf(process.platform !== 'linux').each(['root', 'nested'])(
    'reads a selected path beside an undecodable name at %s',
    async (location) => {
      await verifyInvalidSiblingLookup(location, Buffer.from([97, 255]));
    },
  );

  test.each([
    ['paths', 256],
    ['paths', 1024],
    ['paths', 4096],
    ['directory', 256],
    ['directory', 1024],
    ['directory', 4096],
  ] as const)('bounds real directory scans for %s with %d files', async (kind, fileCount) => {
    const rootDirectory = await mkdtemp(path.join(tmpdir(), 'moldea-scan-growth-'));
    const selectedPaths = Array.from({ length: fileCount }, (_, index) =>
      parseRepositoryPath(`/entry-${index.toString().padStart(4, '0')}.txt`),
    );
    const originalOpendir = fsPromises.opendir;
    let directoryScans = 0;
    let namesScanned = 0;
    const spy = vi.spyOn(fsPromises, 'opendir').mockImplementation(async (...args) => {
      const directory = await originalOpendir(...args);
      const iterate = directory[Symbol.asyncIterator].bind(directory);
      directoryScans += 1;
      directory[Symbol.asyncIterator] = async function* () {
        for await (const entry of iterate()) {
          namesScanned += 1;
          yield entry;
        }
      };
      return directory;
    });
    syncBuiltinESMExports();

    try {
      for (let offset = 0; offset < selectedPaths.length; offset += 32) {
        await Promise.all(
          selectedPaths
            .slice(offset, offset + 32)
            .map((logicalPath) =>
              writeFile(path.join(rootDirectory, logicalPath.slice(1)), 'selected content'),
            ),
        );
      }
      const reader = await createFilesystemRepositoryReader({
        rootDirectory,
        selection: kind === 'paths' ? { kind, paths: selectedPaths } : { kind },
      });
      const entries: IRepositoryEntry[] = [];
      let cursor: string | undefined;

      while (true) {
        const page = await reader.listEntriesPage({
          ...(cursor === undefined ? {} : { cursor }),
          maxEntries: kind === 'paths' ? 64 : 4096,
        });
        entries.push(...page.entries);
        if (page.isComplete) break;
        expect(page.nextCursor).not.toBeNull();
        cursor = page.nextCursor ?? undefined;
      }

      expect(entries.map((entry) => entry.path)).toStrictEqual(selectedPaths);
      expect(entries.every((entry) => entry.type === 'file')).toBe(true);
      expect(directoryScans).toBeGreaterThan(0);
      expect(directoryScans).toBeLessThanOrEqual(kind === 'paths' ? 1 : 2);
      expect(namesScanned).toBeGreaterThanOrEqual(fileCount);
      expect(namesScanned).toBeLessThanOrEqual(fileCount * (kind === 'paths' ? 1 : 2));
      await expect(
        reader.readFilePage(selectedPaths[0]!, { maxBytes: 8, offset: 0 }),
      ).resolves.toMatchObject({
        bytes: new TextEncoder().encode('selected'),
      });
    } finally {
      spy.mockRestore();
      syncBuiltinESMExports();
      await rm(rootDirectory, { force: true, recursive: true });
    }
  });

  test('cancels grouped selection during scanning and closes the real directory', async () => {
    const rootDirectory = await mkdtemp(path.join(tmpdir(), 'moldea-scan-abort-'));
    const controller = new AbortController();
    const originalOpendir = fsPromises.opendir;
    let scannedNames = 0;
    let isDirectoryClosed = false;
    const spy = vi.spyOn(fsPromises, 'opendir').mockImplementation(async (...args) => {
      const directory = await originalOpendir(...args);
      const iterate = directory[Symbol.asyncIterator].bind(directory);
      directory[Symbol.asyncIterator] = async function* () {
        try {
          for await (const entry of iterate()) {
            scannedNames += 1;
            controller.abort();
            yield entry;
          }
        } finally {
          isDirectoryClosed = true;
        }
      };
      return directory;
    });
    syncBuiltinESMExports();

    try {
      await writeFile(path.join(rootDirectory, 'first.txt'), 'first');
      await writeFile(path.join(rootDirectory, 'second.txt'), 'second');
      await expectToRejectCode(
        createFilesystemRepositoryReader({
          rootDirectory,
          selection: {
            kind: 'paths',
            paths: [parseRepositoryPath('/first.txt'), parseRepositoryPath('/second.txt')],
          },
          signal: controller.signal,
        }),
        'ABORTED',
      );
      expect(scannedNames).toBe(1);
      expect(isDirectoryClosed).toBe(true);
    } finally {
      spy.mockRestore();
      syncBuiltinESMExports();
      await rm(rootDirectory, { force: true, recursive: true });
    }
  });

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
    const suiteDirectory = await mkdtemp(path.join(tmpdir(), 'moldea-no-traversal-'));
    const rootDirectory = path.join(suiteDirectory, 'root');
    const outsideDirectory = path.join(suiteDirectory, 'outside');
    const redirectedPath = parseRepositoryPath('/link/deep/data.bin');

    try {
      await mkdir(rootDirectory);
      await mkdir(path.join(outsideDirectory, 'deep'), { recursive: true });
      await writeFile(path.join(outsideDirectory, 'deep', 'data.bin'), 'outside content');
      await symlink(
        outsideDirectory,
        path.join(rootDirectory, 'link'),
        isWindows ? 'junction' : 'dir',
      );
      const reader = await createFilesystemRepositoryReader({
        rootDirectory,
        selection: { kind: 'directory' },
      });

      await expect(reader.getEntry(parseRepositoryPath('/link'))).resolves.toMatchObject({
        type: 'symlink',
      });
      await expect(reader.getEntry(redirectedPath)).resolves.toBeNull();
      await expectToRejectCode(
        reader.readFilePage(redirectedPath, { maxBytes: 1, offset: 0 }),
        'ENTRY_NOT_FOUND',
      );
    } finally {
      await rm(suiteDirectory, { force: true, recursive: true });
    }
  });

  describe('readLinkText', () => {
    const createLinkRoot = async (
      prefix: string,
    ): Promise<{ readonly rootDirectory: string; readonly suiteDirectory: string }> => {
      const suiteDirectory = await mkdtemp(path.join(tmpdir(), prefix));
      const rootDirectory = path.join(suiteDirectory, 'root');
      await mkdir(rootDirectory);

      return { rootDirectory, suiteDirectory };
    };

    test("returns a dangling link's text without observing its target", async () => {
      const { rootDirectory, suiteDirectory } = await createLinkRoot('moldea-link-text-');

      try {
        await symlink(
          'missing/AGENTS.md',
          path.join(rootDirectory, 'AGENTS.md'),
          isWindows ? 'file' : undefined,
        );
        const reader = await createFilesystemRepositoryReader({
          rootDirectory,
          selection: { kind: 'paths', paths: [parseRepositoryPath('/AGENTS.md')] },
        });

        await expect(reader.readLinkText(parseRepositoryPath('/AGENTS.md'))).resolves.toBe(
          'missing/AGENTS.md',
        );
        await expectToRejectCode(
          reader.readLinkText(parseRepositoryPath('/CLAUDE.md')),
          'ENTRY_NOT_FOUND',
        );
      } finally {
        await rm(suiteDirectory, { force: true, recursive: true });
      }
    });

    test('rejects an unselected link and a link replaced after observation', async () => {
      const { rootDirectory, suiteDirectory } = await createLinkRoot('moldea-link-drift-');
      const linkPath = path.join(rootDirectory, 'CLAUDE.md');

      try {
        await writeFile(path.join(rootDirectory, 'AGENTS.md'), '# Agents\n');
        await symlink('AGENTS.md', linkPath, isWindows ? 'file' : undefined);
        const selected = await createFilesystemRepositoryReader({
          rootDirectory,
          selection: { kind: 'paths', paths: [parseRepositoryPath('/AGENTS.md')] },
        });
        const reader = await createFilesystemRepositoryReader({
          rootDirectory,
          selection: { kind: 'directory' },
        });

        await expectToRejectCode(
          selected.readLinkText(parseRepositoryPath('/CLAUDE.md')),
          'ENTRY_NOT_FOUND',
        );
        await expect(reader.readLinkText(parseRepositoryPath('/CLAUDE.md'))).resolves.toBe(
          'AGENTS.md',
        );
        await rm(linkPath);
        await symlink('docs/AGENTS.md', linkPath, isWindows ? 'file' : undefined);
        await expectToRejectCode(
          reader.readLinkText(parseRepositoryPath('/CLAUDE.md')),
          'SNAPSHOT_CHANGED',
        );
      } finally {
        await rm(suiteDirectory, { force: true, recursive: true });
      }
    });

    test.runIf(process.platform === 'linux')(
      'returns null for link text that is not valid UTF-8',
      async () => {
        const { rootDirectory, suiteDirectory } = await createLinkRoot('moldea-link-bytes-');

        try {
          await symlink(Buffer.from([0x61, 0xff, 0x62]), path.join(rootDirectory, 'AGENTS.md'));
          const reader = await createFilesystemRepositoryReader({
            rootDirectory,
            selection: { kind: 'directory' },
          });

          await expect(reader.readLinkText(parseRepositoryPath('/AGENTS.md'))).resolves.toBeNull();
        } finally {
          await rm(suiteDirectory, { force: true, recursive: true });
        }
      },
    );

    test.runIf(isWindows)('converts Windows separators to the stored Git form', async () => {
      const { rootDirectory, suiteDirectory } = await createLinkRoot('moldea-link-windows-');

      try {
        await mkdir(path.join(rootDirectory, 'docs'));
        await writeFile(path.join(rootDirectory, 'docs', 'AGENTS.md'), '# Agents\n');
        await symlink('docs\\AGENTS.md', path.join(rootDirectory, 'AGENTS.md'), 'file');
        const reader = await createFilesystemRepositoryReader({
          rootDirectory,
          selection: { kind: 'directory' },
        });

        await expect(reader.readLinkText(parseRepositoryPath('/AGENTS.md'))).resolves.toBe(
          'docs/AGENTS.md',
        );
      } finally {
        await rm(suiteDirectory, { force: true, recursive: true });
      }
    });
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

  test('reports queue overflow and queued cancellation with their operation context', async () => {
    const logicalPath = parseRepositoryPath('/nested/deep/data.bin');
    const reader = await createFilesystemRepositoryReader({
      limits: { maxConcurrentOperations: 1, maxQueuedOperations: 1 },
      rootDirectory: fixtures.primary.rootDirectory,
      selection: { kind: 'directory' },
    });
    const reason = new Error('cancelled while queued');
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

    controller.abort(reason);

    await Promise.all([queuedFailure, overflowFailure]);
    await expect(overflowRead).rejects.toMatchObject({
      operation: 'read-file-page',
      path: logicalPath,
      resource: { dimension: 'queuedOperations', limit: 1, observed: 2 },
      retryable: true,
    });
    await expect(queuedRead).rejects.toMatchObject({
      cause: reason,
      operation: 'read-file-page',
      path: logicalPath,
      retryable: false,
    });
    await expect(firstRead).resolves.toMatchObject({
      bytes: fixtures.primary.fileBytes.slice(0, 2),
    });
  });

  test('reports a signal aborted before the operation with its reason as the cause', async () => {
    const logicalPath = parseRepositoryPath('/nested/deep/data.bin');
    const reader = await createFilesystemRepositoryReader({
      rootDirectory: fixtures.primary.rootDirectory,
      selection: { kind: 'directory' },
    });
    const reason = new Error('cancelled before reading');
    const read = reader.readFilePage(logicalPath, {
      maxBytes: 2,
      offset: 0,
      signal: AbortSignal.abort(reason),
    });

    await expectToRejectCode(read, 'ABORTED');
    await expect(read).rejects.toMatchObject({
      cause: reason,
      operation: 'read-file-page',
      path: logicalPath,
      retryable: false,
    });
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

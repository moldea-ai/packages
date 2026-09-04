// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { expectToRejectCode, expectToThrowCode } from 'web-utils-kit';

import { RepositoryPathException, RepositorySourceException } from './exceptions.js';
import { createRepositoryComparison } from './comparison.js';
import { createMemoryRepositoryReader } from './memory.js';
import { invalidMemoryDefinitionCases, invalidPathMemoryEntries } from './memory.test-fixtures.js';
import { parseRepositoryPath } from './repository-path.js';
import type { IRepositoryReader } from './contracts.js';

/** Removes optional file identities so comparison must use bounded byte reads. */
const withoutContentIdentities = (
  reader: IRepositoryReader,
  recordBytesRead: (byteLength: number) => void,
): IRepositoryReader => {
  const removeContentIdentity = <T extends { readonly contentIdentity: string | null }>(
    entry: T,
  ): T => ({ ...entry, contentIdentity: null });
  const wrapped: IRepositoryReader = {
    compare: (candidate, options) => createRepositoryComparison(wrapped, candidate, options),
    getEntry: async (path, options) => {
      const entry = await reader.getEntry(path, options);

      return entry === null ? null : removeContentIdentity(entry);
    },
    listEntriesPage: async (options) => {
      const page = await reader.listEntriesPage(options);

      return { ...page, entries: page.entries.map(removeContentIdentity) };
    },
    readFilePage: async (path, options) => {
      const page = await reader.readFilePage(path, options);
      recordBytesRead(page.bytes.byteLength);

      return page;
    },
    snapshot: reader.snapshot,
  };

  return wrapped;
};

/** Overrides source-defined identities to exercise cross-reader comparison semantics. */
const withContentIdentity = (
  reader: IRepositoryReader,
  sourceKind: string,
  contentIdentity: string,
  recordBytesRead: (byteLength: number) => void,
): IRepositoryReader => {
  const replaceContentIdentity = <T extends { readonly contentIdentity: string | null }>(
    entry: T,
  ): T => ({ ...entry, contentIdentity });
  const snapshot = { ...reader.snapshot, sourceKind };
  const wrapped: IRepositoryReader = {
    compare: (candidate, options) => createRepositoryComparison(wrapped, candidate, options),
    getEntry: async (path, options) => {
      const entry = await reader.getEntry(path, options);

      return entry === null ? null : replaceContentIdentity(entry);
    },
    listEntriesPage: async (options) => {
      const page = await reader.listEntriesPage(options);

      return { ...page, entries: page.entries.map(replaceContentIdentity), snapshot };
    },
    readFilePage: async (path, options) => {
      const page = await reader.readFilePage(path, options);
      recordBytesRead(page.bytes.byteLength);

      return { ...page, snapshot };
    },
    snapshot,
  };

  return wrapped;
};

describe('createMemoryRepositoryReader', () => {
  test.each(
    invalidMemoryDefinitionCases.map(
      ({ entries, expectedPath, name }) => [name, entries, expectedPath] as const,
    ),
  )('rejects invalid source definition %s', (_name, entries, expectedPath) => {
    expectToThrowCode(() => createMemoryRepositoryReader(entries), 'INVALID_SOURCE_DATA');

    try {
      createMemoryRepositoryReader(entries);
    } catch (error) {
      expect(error).toBeInstanceOf(RepositorySourceException);
      expect(error).toMatchObject({
        operation: 'create-reader',
        path: parseRepositoryPath(expectedPath),
        retryable: false,
      });
    }
  });

  test('rejects malformed entry paths', () => {
    expectToThrowCode(
      () => createMemoryRepositoryReader(invalidPathMemoryEntries),
      'INVALID_REPOSITORY_PATH',
    );
    expect(() => createMemoryRepositoryReader(invalidPathMemoryEntries)).toThrow(
      RepositoryPathException,
    );
  });

  test('copies caller bytes and returns bounded exact pages', async () => {
    const content = new Uint8Array([1, 2, 3]);
    const entry: { content: Uint8Array; path: string; type: 'file' | 'symlink' } = {
      content,
      path: '/bytes.bin',
      type: 'file',
    };
    const reader = createMemoryRepositoryReader([entry]);
    content[0] = 99;
    entry.path = '/changed.bin';
    entry.type = 'symlink';

    await expect(
      reader.readFilePage(parseRepositoryPath('/bytes.bin'), { maxBytes: 2, offset: 0 }),
    ).resolves.toMatchObject({
      bytes: new Uint8Array([1, 2]),
      isComplete: false,
      nextOffset: 2,
      totalBytes: 3,
    });
    await expect(reader.getEntry(parseRepositoryPath('/changed.bin'))).resolves.toBeNull();
  });

  test('compares snapshots through bounded changed-path pages', async () => {
    const base = createMemoryRepositoryReader([
      { content: 'same', path: '/same.txt', type: 'file' },
      { content: 'old', path: '/changed.txt', type: 'file' },
      { content: 'gone', path: '/deleted.txt', type: 'file' },
    ]);
    const candidate = createMemoryRepositoryReader([
      { content: 'same', path: '/same.txt', type: 'file' },
      { content: 'new', path: '/changed.txt', type: 'file' },
      { content: 'added', path: '/added.txt', type: 'file' },
    ]);
    const comparison = await base.compare(candidate);
    const page = await comparison.listChangesPage({
      maxBytesRead: 2,
      maxChanges: 8,
      maxEntriesVisited: 8,
    });

    expect(page.isComplete).toBe(true);
    expect(page.changes.map(({ kind, path }) => ({ kind, path }))).toStrictEqual([
      { kind: 'added', path: '/added.txt' },
      { kind: 'modified', path: '/changed.txt' },
      { kind: 'deleted', path: '/deleted.txt' },
    ]);
  });

  test('retains an unconsumed comparison lookahead instead of rereading it', async () => {
    const base = createMemoryRepositoryReader(
      ['a', 'b', 'c', 'd'].map((name) => ({
        content: name,
        path: `/${name}.txt`,
        type: 'file' as const,
      })),
    );
    const candidate = createMemoryRepositoryReader([
      { content: 'z', path: '/z.txt', type: 'file' },
    ]);
    let candidateListingCalls = 0;
    const countedCandidate: IRepositoryReader = {
      compare: (reader, options) => candidate.compare(reader, options),
      getEntry: (path, options) => candidate.getEntry(path, options),
      listEntriesPage: (options) => {
        candidateListingCalls += 1;

        return candidate.listEntriesPage(options);
      },
      readFilePage: (path, options) => candidate.readFilePage(path, options),
      snapshot: candidate.snapshot,
    };
    const comparison = await base.compare(countedCandidate);
    const page = await comparison.listChangesPage({
      maxBytesRead: 2,
      maxChanges: 8,
      maxEntriesVisited: 8,
    });

    expect(page.isComplete).toBe(true);
    expect(candidateListingCalls).toBe(1);
  });

  test.each([
    ['abcdefgh', 'abcdefgh', []],
    ['abcdefgh', 'abcdefgz', [{ kind: 'modified', path: '/file.txt' }]],
  ] as const)(
    'compares absent content identities through bounded pages: %s -> %s',
    async (baseContent, candidateContent, expectedChanges) => {
      const requestedBytes: number[] = [];
      const base = withoutContentIdentities(
        createMemoryRepositoryReader([{ content: baseContent, path: '/file.txt', type: 'file' }]),
        (byteLength) => requestedBytes.push(byteLength),
      );
      const candidate = withoutContentIdentities(
        createMemoryRepositoryReader([
          { content: candidateContent, path: '/file.txt', type: 'file' },
        ]),
        (byteLength) => requestedBytes.push(byteLength),
      );
      const comparison = await createRepositoryComparison(base, candidate);
      const changes: { kind: string; path: string }[] = [];
      let cursor: string | undefined;
      let isComplete = false;
      let pageCount = 0;

      while (!isComplete) {
        const page = await comparison.listChangesPage({
          ...(cursor === undefined ? {} : { cursor }),
          maxBytesRead: 4,
          maxChanges: 1,
          maxEntriesVisited: 1,
        });
        expect(page.bytesRead).toBeLessThanOrEqual(4);
        changes.push(...page.changes.map(({ kind, path }) => ({ kind, path })));
        cursor = page.nextCursor ?? undefined;
        isComplete = page.isComplete;
        pageCount += 1;
      }

      expect(pageCount).toBe(4);
      expect(requestedBytes.reduce((total, byteLength) => total + byteLength, 0)).toBe(16);
      expect(changes).toStrictEqual(expectedChanges);
    },
  );

  test('compares equal bytes when same-source identities differ', async () => {
    let bytesRead = 0;
    const base = withContentIdentity(
      createMemoryRepositoryReader([{ content: 'same', path: '/file.txt', type: 'file' }]),
      'fixture',
      'fixture:base',
      (byteLength) => {
        bytesRead += byteLength;
      },
    );
    const candidate = withContentIdentity(
      createMemoryRepositoryReader([{ content: 'same', path: '/file.txt', type: 'file' }]),
      'fixture',
      'fixture:candidate',
      (byteLength) => {
        bytesRead += byteLength;
      },
    );
    const comparison = await base.compare(candidate);
    const page = await comparison.listChangesPage({
      maxBytesRead: 16,
      maxChanges: 1,
      maxEntriesVisited: 1,
    });

    expect(page).toMatchObject({ changes: [], isComplete: true });
    expect(bytesRead).toBe(8);
  });

  test('does not trust equal identities from different source kinds', async () => {
    let bytesRead = 0;
    const base = withContentIdentity(
      createMemoryRepositoryReader([{ content: 'base', path: '/file.txt', type: 'file' }]),
      'fixture-base',
      'fixture:same',
      (byteLength) => {
        bytesRead += byteLength;
      },
    );
    const candidate = withContentIdentity(
      createMemoryRepositoryReader([{ content: 'diff', path: '/file.txt', type: 'file' }]),
      'fixture-candidate',
      'fixture:same',
      (byteLength) => {
        bytesRead += byteLength;
      },
    );
    const comparison = await base.compare(candidate);
    const page = await comparison.listChangesPage({
      maxBytesRead: 16,
      maxChanges: 1,
      maxEntriesVisited: 1,
    });

    expect(page.changes.map(({ kind, path }) => ({ kind, path }))).toStrictEqual([
      { kind: 'modified', path: '/file.txt' },
    ]);
    expect(bytesRead).toBeGreaterThan(0);
  });

  test('continues descendant listings with a stable keyset cursor', async () => {
    const reader = createMemoryRepositoryReader([
      { content: 'c', path: '/outside.txt', type: 'file' },
      { content: 'a', path: '/scope/a.txt', type: 'file' },
      { content: 'b', path: '/scope/nested/b.txt', type: 'file' },
      { content: 'c', path: '/scope/nested/c.txt', type: 'file' },
    ]);
    const scopePath = parseRepositoryPath('/scope');
    const firstPage = await reader.listEntriesPage({ maxEntries: 2, prefix: scopePath });

    expect(firstPage.entries.map(({ path }) => path)).toStrictEqual([
      '/scope/a.txt',
      '/scope/nested',
    ]);
    expect(firstPage.isComplete).toBe(false);
    expect(firstPage.nextCursor).not.toBeNull();

    if (firstPage.nextCursor === null) {
      throw new TypeError('The bounded descendant fixture completed unexpectedly.');
    }

    const secondPage = await reader.listEntriesPage({
      cursor: firstPage.nextCursor,
      maxEntries: 2,
      prefix: scopePath,
    });

    expect(secondPage.entries.map(({ path }) => path)).toStrictEqual([
      '/scope/nested/b.txt',
      '/scope/nested/c.txt',
    ]);
    expect(secondPage.isComplete).toBe(true);
    expect(secondPage.nextCursor).toBeNull();
  });

  test('rejects corrupted listing and comparison cursors', async () => {
    const base = createMemoryRepositoryReader([]);
    const candidate = createMemoryRepositoryReader([
      { content: 'a', path: '/a.txt', type: 'file' },
      { content: 'b', path: '/b.txt', type: 'file' },
    ]);
    const listingPage = await candidate.listEntriesPage({ maxEntries: 1 });
    const comparison = await base.compare(candidate);
    const comparisonPage = await comparison.listChangesPage({
      maxBytesRead: 2,
      maxChanges: 1,
      maxEntriesVisited: 1,
    });
    const corrupt = (cursor: string): string =>
      `${cursor.slice(0, -1)}${cursor.endsWith('A') ? 'B' : 'A'}`;

    if (listingPage.nextCursor === null || comparisonPage.nextCursor === null) {
      throw new TypeError('The bounded cursor fixture completed unexpectedly.');
    }

    await expectToRejectCode(
      candidate.listEntriesPage({
        cursor: corrupt(listingPage.nextCursor),
        maxEntries: 1,
      }),
      'INVALID_PAGE_REQUEST',
    );
    await expectToRejectCode(
      comparison.listChangesPage({
        cursor: corrupt(comparisonPage.nextCursor),
        maxBytesRead: 2,
        maxChanges: 1,
        maxEntriesVisited: 1,
      }),
      'INVALID_PAGE_REQUEST',
    );
  });

  test('rejects invalid range and comparison bounds', async () => {
    const reader = createMemoryRepositoryReader([
      { content: 'value', path: '/file.txt', type: 'file' },
    ]);

    await expectToRejectCode(
      reader.readFilePage(parseRepositoryPath('/file.txt'), { maxBytes: 1, offset: 99 }),
      'INVALID_PAGE_REQUEST',
    );
    const comparison = await reader.compare(reader);
    await expectToRejectCode(
      comparison.listChangesPage({
        maxBytesRead: 0,
        maxChanges: 1,
        maxEntriesVisited: 1,
      }),
      'INVALID_PAGE_REQUEST',
    );
    await expectToRejectCode(
      comparison.listChangesPage({
        maxBytesRead: 2,
        maxChanges: 0,
        maxEntriesVisited: 1,
      }),
      'INVALID_PAGE_REQUEST',
    );
  });
});

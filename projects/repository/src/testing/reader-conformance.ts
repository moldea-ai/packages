import { describe, expect, test } from 'vitest';
import { expectToRejectCode } from 'web-utils-kit';

import type {
  IRepositoryReaderConformanceEntry,
  IRepositoryReaderConformanceFixture,
  IRepositoryReaderConformanceReader,
} from './types.js';

const listAllEntries = async <TPath extends string>(
  reader: IRepositoryReaderConformanceReader<TPath>,
  prefix?: TPath,
): Promise<IRepositoryReaderConformanceEntry<TPath>[]> => {
  const entries: IRepositoryReaderConformanceEntry<TPath>[] = [];
  let cursor: string | null | undefined;

  while (cursor !== null) {
    const page = await reader.listEntriesPage({
      ...(cursor === undefined ? {} : { cursor }),
      maxEntries: 3,
      ...(prefix === undefined ? {} : { prefix }),
    });
    entries.push(...page.entries);

    if (page.isComplete) {
      return entries;
    }

    if (page.nextCursor === null) {
      throw new Error('An incomplete repository page omitted its continuation cursor.');
    }

    cursor = page.nextCursor;
  }

  return entries;
};

const readAllBytes = async <TPath extends string>(
  reader: IRepositoryReaderConformanceReader<TPath>,
  path: TPath,
): Promise<Uint8Array> => {
  const chunks: Uint8Array[] = [];
  let offset: number | null = 0;
  let totalBytes = 0;

  while (offset !== null) {
    const page = await reader.readFilePage(path, { maxBytes: 2, offset });
    chunks.push(page.bytes);
    totalBytes += page.bytes.byteLength;

    if (page.isComplete) {
      const result = new Uint8Array(totalBytes);
      let writeOffset = 0;

      for (const chunk of chunks) {
        result.set(chunk, writeOffset);
        writeOffset += chunk.byteLength;
      }

      return result;
    }

    if (page.nextOffset === null) {
      throw new Error('An incomplete file page omitted its continuation offset.');
    }

    offset = page.nextOffset;
  }

  throw new Error('Repository byte traversal ended without a complete page.');
};

/** Defines the contract checks shared by every official repository reader. */
export const describeRepositoryReaderConformance = <TPath extends string>(
  implementationName: string,
  fixture: IRepositoryReaderConformanceFixture<TPath>,
): void => {
  describe(`${implementationName} repository reader conformance`, () => {
    test('returns detached exact entries with source metadata', async () => {
      const reader = await fixture.createReader();
      const filePath = fixture.parsePath(fixture.filePath);
      const file = await reader.getEntry(filePath);

      expect(reader.snapshot.id.length).toBeGreaterThan(0);
      expect(reader.snapshot.sourceKind.length).toBeGreaterThan(0);
      expect(file).toMatchObject({ path: filePath, type: 'file' });
      expect(file?.byteLength).toBe(fixture.fileBytes.byteLength);
      expect(
        file !== null && (file.contentIdentity === null || file.contentIdentity.length > 0),
      ).toBe(true);
      await expect(reader.getEntry(fixture.rootPath)).resolves.toMatchObject({
        path: fixture.rootPath,
        type: 'directory',
      });
      await expect(reader.getEntry(fixture.parsePath(fixture.missingPath))).resolves.toBeNull();

      if (file !== null) {
        Reflect.set(file, 'type', 'directory');
        await expect(reader.getEntry(filePath)).resolves.toMatchObject({ type: 'file' });
      }
    });

    test('lists deterministic bounded root and nested pages exactly once', async () => {
      const reader = await fixture.createReader();
      const entries = await listAllEntries(reader);
      const nested = await listAllEntries(reader, fixture.parsePath(fixture.nestedDirectoryPath));

      expect(entries.map(({ path, type }) => ({ path, type }))).toStrictEqual(
        fixture.expectedEntries,
      );
      expect(new Set(entries.map((entry) => entry.path)).size).toBe(entries.length);
      expect(entries.some((entry) => entry.path === fixture.rootPath)).toBe(false);
      expect(nested.map((entry) => entry.path)).toStrictEqual(fixture.nestedExpectedPaths);
    });

    test('reads exact content through bounded ranges and returns fresh bytes', async () => {
      const reader = await fixture.createReader();
      const filePath = fixture.parsePath(fixture.filePath);
      const first = await readAllBytes(reader, filePath);
      const second = await readAllBytes(reader, filePath);

      expect(first).toStrictEqual(fixture.fileBytes);
      expect(second).toStrictEqual(fixture.fileBytes);
      expect(first).not.toBe(second);
      first[0] = 99;
      await expect(readAllBytes(reader, filePath)).resolves.toStrictEqual(fixture.fileBytes);
      await expect(
        readAllBytes(reader, fixture.parsePath(fixture.emptyFilePath)),
      ).resolves.toStrictEqual(new Uint8Array());
    });

    test('preserves case and Unicode path semantics', async () => {
      const reader = await fixture.createReader();
      const unicodePath = fixture.parsePath(fixture.unicodePath);

      await expect(reader.getEntry(unicodePath)).resolves.toMatchObject({ type: 'file' });

      if (fixture.casePaths.kind === 'distinct') {
        await expect(
          reader.getEntry(fixture.parsePath(fixture.casePaths.paths[0])),
        ).resolves.toMatchObject({ type: 'file' });
        await expect(
          reader.getEntry(fixture.parsePath(fixture.casePaths.paths[1])),
        ).resolves.toMatchObject({ type: 'file' });
      } else {
        await expect(
          reader.getEntry(fixture.parsePath(fixture.casePaths.existingPath)),
        ).resolves.toMatchObject({ type: 'file' });
        await expect(
          reader.getEntry(fixture.parsePath(fixture.casePaths.missingPath)),
        ).resolves.toBeNull();
      }
    });

    test('rejects wrong types, missing entries, and malformed page requests', async () => {
      const reader = await fixture.createReader();
      const symlinkPath = fixture.parsePath(fixture.symlinkPath);
      const directoryPath = fixture.parsePath(fixture.nestedDirectoryPath);
      const missingPath = fixture.parsePath(fixture.missingPath);

      await expectToRejectCode(
        reader.readFilePage(symlinkPath, { maxBytes: 1, offset: 0 }),
        'ENTRY_NOT_FILE',
      );
      await expectToRejectCode(
        reader.readFilePage(directoryPath, { maxBytes: 1, offset: 0 }),
        'ENTRY_NOT_FILE',
      );
      await expectToRejectCode(
        reader.readFilePage(missingPath, { maxBytes: 1, offset: 0 }),
        'ENTRY_NOT_FOUND',
      );
      await expectToRejectCode(
        reader.listEntriesPage({ maxEntries: 1, prefix: missingPath }),
        'ENTRY_NOT_FOUND',
      );
      await expectToRejectCode(
        reader.listEntriesPage({ maxEntries: 1, prefix: fixture.parsePath(fixture.filePath) }),
        'ENTRY_NOT_DIRECTORY',
      );
      await expectToRejectCode(reader.listEntriesPage({ maxEntries: 0 }), 'INVALID_PAGE_REQUEST');
      await expectToRejectCode(
        reader.readFilePage(fixture.parsePath(fixture.filePath), {
          maxBytes: 0,
          offset: 0,
        }),
        'INVALID_PAGE_REQUEST',
      );
    });

    test('runtime-validates forged paths and honors cancellation', async () => {
      const reader = await fixture.createReader();
      const forgedPath = '../host-secret' as never;
      const aborted = new AbortController();
      aborted.abort(new Error('cancelled by test'));

      const invalid = reader.getEntry(forgedPath);
      await expectToRejectCode(invalid, 'INVALID_REPOSITORY_PATH');
      expect(
        fixture.isRepositoryPathException(await invalid.catch((cause: unknown) => cause)),
      ).toBe(true);
      const cancelled = reader.listEntriesPage({ maxEntries: 1, signal: aborted.signal });
      await expectToRejectCode(cancelled, 'ABORTED');
      expect(
        fixture.isRepositorySourceException(await cancelled.catch((cause: unknown) => cause)),
      ).toBe(true);
    });

    test('preserves or rejects source mutation without mixing snapshots', async () => {
      const scenario = await fixture.createSnapshotMutationFixture();
      const path = fixture.parsePath(fixture.filePath);
      const before = await scenario.reader.readFilePage(path, {
        maxBytes: fixture.fileBytes.byteLength || 1,
        offset: 0,
      });
      await scenario.mutateSource();

      if (scenario.behavior === 'report-snapshot-changed') {
        await expectToRejectCode(
          scenario.reader.readFilePage(path, {
            maxBytes: fixture.fileBytes.byteLength || 1,
            offset: 0,
          }),
          'SNAPSHOT_CHANGED',
        );
      } else {
        await expect(
          scenario.reader.readFilePage(path, {
            maxBytes: fixture.fileBytes.byteLength || 1,
            offset: 0,
          }),
        ).resolves.toStrictEqual(before);
      }
    });
  });
};

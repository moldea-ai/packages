import { createRepositoryComparison } from './comparison.js';
import type {
  IRepositoryComparison,
  IRepositoryEntry,
  IRepositoryEntryPage,
  IRepositoryEntryPageOptions,
  IRepositoryFilePage,
  IRepositoryFilePageOptions,
  IRepositoryOperationOptions,
  IRepositoryReader,
  IRepositorySnapshot,
} from './contracts.js';
import { createRepositoryCursor, decodeRepositoryCursor } from './cursor.js';
import { RepositorySourceException, type IRepositoryOperation } from './exceptions.js';
import { createRepositoryIdentity } from './identity.js';
import { parsePageOffset, parsePositivePageInteger } from './page-validation.js';
import {
  REPOSITORY_ROOT,
  compareRepositoryPaths,
  parseRepositoryPath,
  type IRepositoryPath,
} from './repository-path.js';
import { hasOnlyUnicodeScalarValues } from './unicode.js';

// accepted file, directory, and symlink definitions for an in-memory snapshot
export type IMemoryRepositoryEntry =
  | {
      readonly content: string | Uint8Array;
      readonly path: string;
      readonly type: 'file';
    }
  | {
      readonly path: string;
      readonly type: 'directory';
    }
  | {
      readonly path: string;
      readonly type: 'symlink';
    };

type IStoredRepositoryEntry =
  | {
      readonly content: Uint8Array;
      readonly contentIdentity: string;
      readonly path: IRepositoryPath;
      readonly type: 'file';
    }
  | {
      readonly path: IRepositoryPath;
      readonly type: 'directory' | 'symlink';
    };

const encoder = new TextEncoder();

interface IMemoryEntryCursor {
  readonly lastPath: IRepositoryPath;
  readonly prefix: IRepositoryPath;
  readonly snapshotId: string;
}

const MEMORY_CURSOR_KEYS = new Set(['lastPath', 'prefix', 'snapshotId']);

const invalidSourceData = (path: IRepositoryPath | null): RepositorySourceException => {
  return new RepositorySourceException({
    code: 'INVALID_SOURCE_DATA',
    operation: 'create-reader',
    path,
    retryable: false,
  });
};

const throwIfAborted = (
  signal: AbortSignal | undefined,
  operation: IRepositoryOperation,
  path: IRepositoryPath | null,
): void => {
  if (!signal?.aborted) {
    return;
  }

  throw new RepositorySourceException({
    cause: signal.reason,
    code: 'ABORTED',
    operation,
    path,
    retryable: false,
  });
};

const getParentPath = (path: IRepositoryPath): IRepositoryPath | null => {
  if (path === REPOSITORY_ROOT) {
    return null;
  }

  const lastSeparatorIndex = path.lastIndexOf('/');
  const parent = lastSeparatorIndex === 0 ? REPOSITORY_ROOT : path.slice(0, lastSeparatorIndex);

  return parseRepositoryPath(parent);
};

const cloneEntry = (entry: IStoredRepositoryEntry): IRepositoryEntry => {
  if (entry.type === 'file') {
    return {
      byteLength: entry.content.byteLength,
      contentIdentity: entry.contentIdentity,
      path: entry.path,
      type: entry.type,
    };
  }

  return {
    byteLength: null,
    contentIdentity: null,
    path: entry.path,
    type: entry.type,
  };
};

/** Validates and detaches one untrusted in-memory entry definition. */
const normalizeEntry = (candidate: unknown): IStoredRepositoryEntry => {
  if (typeof candidate !== 'object' || candidate === null) {
    throw invalidSourceData(null);
  }

  const entry = candidate as Readonly<Record<string, unknown>>;
  const path = parseRepositoryPath(entry['path'] as string);

  if (path === REPOSITORY_ROOT) {
    throw invalidSourceData(path);
  }

  if (entry['type'] === 'directory' || entry['type'] === 'symlink') {
    return { path, type: entry['type'] };
  }

  if (entry['type'] !== 'file') {
    throw invalidSourceData(path);
  }

  let content: Uint8Array;

  if (typeof entry['content'] === 'string') {
    if (!hasOnlyUnicodeScalarValues(entry['content'])) {
      throw invalidSourceData(path);
    }

    content = encoder.encode(entry['content']);
  } else if (entry['content'] instanceof Uint8Array) {
    content = new Uint8Array(entry['content']);
  } else {
    throw invalidSourceData(path);
  }

  return {
    content,
    contentIdentity: createRepositoryIdentity([content]),
    path,
    type: 'file',
  };
};

/** Validates cross-entry consistency and synthesizes the directory hierarchy. */
const materializeEntries = (
  entries: unknown,
): ReadonlyMap<IRepositoryPath, IStoredRepositoryEntry> => {
  if (!Array.isArray(entries)) {
    throw invalidSourceData(null);
  }

  const materializedEntries = new Map<IRepositoryPath, IStoredRepositoryEntry>();
  const explicitPaths: IRepositoryPath[] = [];

  for (const candidate of entries as readonly unknown[]) {
    const entry = normalizeEntry(candidate);

    if (materializedEntries.has(entry.path)) {
      throw invalidSourceData(entry.path);
    }

    materializedEntries.set(entry.path, entry);
    explicitPaths.push(entry.path);
  }

  for (const explicitPath of explicitPaths) {
    let parent = getParentPath(explicitPath);

    while (parent !== null && parent !== REPOSITORY_ROOT) {
      const explicitParent = materializedEntries.get(parent);

      if (explicitParent !== undefined && explicitParent.type !== 'directory') {
        throw invalidSourceData(explicitPath);
      }

      parent = getParentPath(parent);
    }
  }

  materializedEntries.set(REPOSITORY_ROOT, { path: REPOSITORY_ROOT, type: 'directory' });

  for (const explicitPath of explicitPaths) {
    let parent = getParentPath(explicitPath);

    while (parent !== null && parent !== REPOSITORY_ROOT) {
      if (!materializedEntries.has(parent)) {
        materializedEntries.set(parent, { path: parent, type: 'directory' });
      }

      parent = getParentPath(parent);
    }
  }

  return materializedEntries;
};

/** Streams snapshot identity parts without retaining encoded metadata for the complete repository. */
const getSnapshotIdentityParts = function* (
  orderedEntries: readonly IStoredRepositoryEntry[],
): Generator<Uint8Array> {
  for (const entry of orderedEntries) {
    yield encoder.encode(`${entry.path}\0${entry.type}\0`);

    if (entry.type === 'file') {
      yield entry.content;
    }
  }
};

const createSnapshot = (orderedEntries: readonly IStoredRepositoryEntry[]): IRepositorySnapshot => {
  return Object.freeze({
    id: createRepositoryIdentity(getSnapshotIdentityParts(orderedEntries)),
    sourceKind: 'memory',
  });
};

const parseEntryCursor = (
  cursor: string | undefined,
  prefix: IRepositoryPath,
  snapshotId: string,
): IRepositoryPath | null => {
  if (cursor === undefined) {
    return null;
  }

  try {
    const parsed = decodeRepositoryCursor(cursor) as Partial<IMemoryEntryCursor>;
    const lastPath = parseRepositoryPath(parsed.lastPath as string);
    const descendantPrefix = prefix === REPOSITORY_ROOT ? REPOSITORY_ROOT : `${prefix}/`;

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Reflect.ownKeys(parsed).some(
        (key) => typeof key !== 'string' || !MEMORY_CURSOR_KEYS.has(key),
      ) ||
      parsed.prefix !== prefix ||
      parsed.snapshotId !== snapshotId ||
      lastPath === prefix ||
      !lastPath.startsWith(descendantPrefix)
    ) {
      throw new Error('invalid cursor');
    }

    return lastPath;
  } catch (cause) {
    throw new RepositorySourceException({
      cause,
      code: 'INVALID_PAGE_REQUEST',
      operation: 'list-entries-page',
      path: prefix,
      retryable: false,
    });
  }
};

const createEntryCursor = (
  lastPath: IRepositoryPath,
  prefix: IRepositoryPath,
  snapshotId: string,
): string => createRepositoryCursor({ lastPath, prefix, snapshotId } satisfies IMemoryEntryCursor);

/** Locates the first ordered entry strictly after one path without scanning prior entries. */
const findFirstEntryAfter = (
  entries: readonly IStoredRepositoryEntry[],
  path: IRepositoryPath,
): number => {
  let lowerIndex = 0;
  let upperIndex = entries.length;

  while (lowerIndex < upperIndex) {
    const middleIndex = lowerIndex + Math.floor((upperIndex - lowerIndex) / 2);
    const middleEntry = entries[middleIndex];

    if (middleEntry !== undefined && compareRepositoryPaths(middleEntry.path, path) <= 0) {
      lowerIndex = middleIndex + 1;
    } else {
      upperIndex = middleIndex;
    }
  }

  return lowerIndex;
};

class MemoryRepositoryReader implements IRepositoryReader {
  public readonly snapshot: IRepositorySnapshot;

  readonly #entries: ReadonlyMap<IRepositoryPath, IStoredRepositoryEntry>;

  readonly #orderedEntries: readonly IStoredRepositoryEntry[];

  public constructor(entries: readonly IMemoryRepositoryEntry[]) {
    this.#entries = materializeEntries(entries);
    this.#orderedEntries = [...this.#entries.values()].sort((left, right) =>
      compareRepositoryPaths(left.path, right.path),
    );
    this.snapshot = createSnapshot(this.#orderedEntries);
  }

  public async compare(
    candidate: IRepositoryReader,
    options?: IRepositoryOperationOptions,
  ): Promise<IRepositoryComparison> {
    return createRepositoryComparison(this, candidate, options);
  }

  public async getEntry(
    path: IRepositoryPath,
    options?: IRepositoryOperationOptions,
  ): Promise<IRepositoryEntry | null> {
    const parsedPath = parseRepositoryPath(path);
    await Promise.resolve();
    throwIfAborted(options?.signal, 'get-entry', parsedPath);
    const entry = this.#entries.get(parsedPath);

    return entry === undefined ? null : cloneEntry(entry);
  }

  public async listEntriesPage(
    options: IRepositoryEntryPageOptions,
  ): Promise<IRepositoryEntryPage> {
    const prefix =
      options.prefix === undefined ? REPOSITORY_ROOT : parseRepositoryPath(options.prefix);
    const maxEntries = parsePositivePageInteger(options.maxEntries, 'list-entries-page', prefix);
    const lastPath = parseEntryCursor(options.cursor, prefix, this.snapshot.id);
    await Promise.resolve();
    throwIfAborted(options.signal, 'list-entries-page', prefix);
    const prefixEntry = this.#entries.get(prefix);

    if (prefixEntry === undefined) {
      throw new RepositorySourceException({
        code: 'ENTRY_NOT_FOUND',
        operation: 'list-entries-page',
        path: prefix,
        retryable: false,
      });
    }

    if (prefixEntry.type !== 'directory') {
      throw new RepositorySourceException({
        code: 'ENTRY_NOT_DIRECTORY',
        operation: 'list-entries-page',
        path: prefix,
        retryable: false,
      });
    }

    if (lastPath !== null && !this.#entries.has(lastPath)) {
      throw new RepositorySourceException({
        code: 'INVALID_PAGE_REQUEST',
        operation: 'list-entries-page',
        path: prefix,
        retryable: false,
      });
    }

    const descendantPrefix = prefix === REPOSITORY_ROOT ? REPOSITORY_ROOT : `${prefix}/`;
    let entryIndex = findFirstEntryAfter(this.#orderedEntries, lastPath ?? prefix);
    const entries: IRepositoryEntry[] = [];

    while (entries.length < maxEntries) {
      const entry = this.#orderedEntries[entryIndex];

      if (entry === undefined || !entry.path.startsWith(descendantPrefix)) {
        break;
      }

      entries.push(cloneEntry(entry));
      entryIndex += 1;
    }

    const nextEntry = this.#orderedEntries[entryIndex];
    const isComplete = nextEntry === undefined || !nextEntry.path.startsWith(descendantPrefix);
    const finalEntry = entries.at(-1);

    return {
      entries,
      isComplete,
      nextCursor:
        isComplete || finalEntry === undefined
          ? null
          : createEntryCursor(finalEntry.path, prefix, this.snapshot.id),
      snapshot: this.snapshot,
    };
  }

  public async readFilePage(
    path: IRepositoryPath,
    options: IRepositoryFilePageOptions,
  ): Promise<IRepositoryFilePage> {
    const parsedPath = parseRepositoryPath(path);
    const offset = parsePageOffset(options.offset, 'read-file-page', parsedPath);
    const maxBytes = parsePositivePageInteger(options.maxBytes, 'read-file-page', parsedPath);
    await Promise.resolve();
    throwIfAborted(options.signal, 'read-file-page', parsedPath);
    const entry = this.#entries.get(parsedPath);

    if (entry === undefined) {
      throw new RepositorySourceException({
        code: 'ENTRY_NOT_FOUND',
        operation: 'read-file-page',
        path: parsedPath,
        retryable: false,
      });
    }

    if (entry.type !== 'file') {
      throw new RepositorySourceException({
        code: 'ENTRY_NOT_FILE',
        operation: 'read-file-page',
        path: parsedPath,
        retryable: false,
      });
    }

    if (offset > entry.content.byteLength) {
      throw new RepositorySourceException({
        code: 'INVALID_PAGE_REQUEST',
        operation: 'read-file-page',
        path: parsedPath,
        retryable: false,
      });
    }

    const endOffset = Math.min(offset + maxBytes, entry.content.byteLength);
    const bytes = entry.content.slice(offset, endOffset);
    const isComplete = endOffset === entry.content.byteLength;
    throwIfAborted(options.signal, 'read-file-page', parsedPath);

    return {
      bytes,
      isComplete,
      nextOffset: isComplete ? null : endOffset,
      offset,
      snapshot: this.snapshot,
      totalBytes: entry.content.byteLength,
    };
  }
}

/** Creates an immutable in-memory repository reader from detached entry definitions. */
export const createMemoryRepositoryReader = (
  entries: readonly IMemoryRepositoryEntry[],
): IRepositoryReader => new MemoryRepositoryReader(entries);

import type {
  IRepositoryChange,
  IRepositoryChangePage,
  IRepositoryChangePageOptions,
  IRepositoryComparison,
  IRepositoryEntry,
  IRepositoryFilePage,
  IRepositoryOperationOptions,
  IRepositoryReader,
} from './contracts.js';
import { createRepositoryCursor, decodeRepositoryCursor } from './cursor.js';
import { RepositorySourceException } from './exceptions.js';
import { parsePositivePageInteger } from './page-validation.js';
import { REPOSITORY_ROOT, compareRepositoryPaths } from './repository-path.js';

interface IRepositoryComparisonCursor {
  readonly baseCursor: string | null;
  readonly baseSnapshotId: string;
  readonly candidateCursor: string | null;
  readonly candidateSnapshotId: string;
  readonly pendingFile: IPendingFileComparison | null;
}

interface IPendingFileComparison {
  readonly offset: number;
  readonly path: string;
}

const COMPARISON_CURSOR_KEYS = new Set([
  'baseCursor',
  'baseSnapshotId',
  'candidateCursor',
  'candidateSnapshotId',
  'pendingFile',
]);
const PENDING_FILE_CURSOR_KEYS = new Set(['offset', 'path']);

interface INextRepositoryEntry {
  readonly cursorAfter: string;
  readonly entry: IRepositoryEntry;
}

const throwIfAborted = (signal: AbortSignal | undefined): void => {
  if (signal?.aborted) {
    throw new RepositorySourceException({
      cause: signal.reason,
      code: 'ABORTED',
      operation: 'list-changes-page',
      path: null,
      retryable: false,
    });
  }
};

const invalidComparisonCursor = (cause?: unknown): RepositorySourceException => {
  return new RepositorySourceException({
    cause,
    code: 'INVALID_PAGE_REQUEST',
    operation: 'list-changes-page',
    path: null,
    retryable: false,
  });
};

const parseComparisonCursor = (
  cursor: string | undefined,
  baseSnapshotId: string,
  candidateSnapshotId: string,
): IRepositoryComparisonCursor => {
  if (cursor === undefined) {
    return {
      baseCursor: null,
      baseSnapshotId,
      candidateCursor: null,
      candidateSnapshotId,
      pendingFile: null,
    };
  }

  try {
    const parsed = decodeRepositoryCursor(cursor) as Partial<IRepositoryComparisonCursor>;

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Reflect.ownKeys(parsed).some(
        (key) => typeof key !== 'string' || !COMPARISON_CURSOR_KEYS.has(key),
      ) ||
      parsed.baseSnapshotId !== baseSnapshotId ||
      parsed.candidateSnapshotId !== candidateSnapshotId ||
      (typeof parsed.baseCursor !== 'string' && parsed.baseCursor !== null) ||
      (typeof parsed.candidateCursor !== 'string' && parsed.candidateCursor !== null) ||
      (parsed.pendingFile !== null &&
        (typeof parsed.pendingFile !== 'object' ||
          Reflect.ownKeys(parsed.pendingFile).some(
            (key) => typeof key !== 'string' || !PENDING_FILE_CURSOR_KEYS.has(key),
          ) ||
          typeof parsed.pendingFile.path !== 'string' ||
          !Number.isSafeInteger(parsed.pendingFile.offset) ||
          parsed.pendingFile.offset < 0))
    ) {
      throw new Error('invalid comparison cursor');
    }

    return parsed as IRepositoryComparisonCursor;
  } catch (cause) {
    throw invalidComparisonCursor(cause);
  }
};

const invalidSourceData = (path: IRepositoryEntry['path'], cause?: unknown): never => {
  throw new RepositorySourceException({
    cause,
    code: 'INVALID_SOURCE_DATA',
    operation: 'list-changes-page',
    path,
    retryable: false,
  });
};

const getNextEntry = async (
  reader: IRepositoryReader,
  cursor: string | null,
  signal: AbortSignal | undefined,
): Promise<INextRepositoryEntry | null> => {
  if (cursor === '') {
    return null;
  }

  const page = await reader.listEntriesPage({
    ...(cursor === null ? {} : { cursor }),
    maxEntries: 1,
    prefix: REPOSITORY_ROOT,
    ...(signal === undefined ? {} : { signal }),
  });

  if (page.snapshot.id !== reader.snapshot.id || page.entries.length > 1) {
    throw invalidComparisonCursor();
  }

  const entry = page.entries[0];

  if (entry === undefined) {
    if (!page.isComplete || page.nextCursor !== null) {
      throw invalidComparisonCursor();
    }

    return null;
  }

  if (!page.isComplete && page.nextCursor === null) {
    throw invalidComparisonCursor();
  }

  return { cursorAfter: page.nextCursor ?? '', entry };
};

/** Classifies a shared entry without reading bytes, or defers when content must be compared. */
const classifySharedEntryMetadata = (
  baseEntry: IRepositoryEntry,
  candidateEntry: IRepositoryEntry,
  canCompareContentIdentities: boolean,
): IRepositoryChange | null | undefined => {
  if (baseEntry.type !== candidateEntry.type) {
    return { baseEntry, candidateEntry, kind: 'type-changed', path: baseEntry.path };
  }

  if (baseEntry.type !== 'file') {
    return null;
  }

  if (
    baseEntry.byteLength !== null &&
    candidateEntry.byteLength !== null &&
    baseEntry.byteLength !== candidateEntry.byteLength
  ) {
    return { baseEntry, candidateEntry, kind: 'modified', path: baseEntry.path };
  }

  if (
    canCompareContentIdentities &&
    baseEntry.contentIdentity !== null &&
    candidateEntry.contentIdentity !== null &&
    baseEntry.contentIdentity === candidateEntry.contentIdentity
  ) {
    return null;
  }

  if (baseEntry.byteLength === 0 && candidateEntry.byteLength === 0) {
    return null;
  }

  return undefined;
};

/** Validates a reader-provided file page before its bytes influence comparison state. */
const validateFilePage = (
  page: IRepositoryFilePage,
  entry: IRepositoryEntry,
  expectedSnapshotId: string,
  expectedOffset: number,
  maxBytes: number,
): void => {
  const nextOffset = expectedOffset + page.bytes.byteLength;

  if (
    !(page.bytes instanceof Uint8Array) ||
    page.bytes.byteLength > maxBytes ||
    page.offset !== expectedOffset ||
    page.snapshot.id !== expectedSnapshotId ||
    !Number.isSafeInteger(page.totalBytes) ||
    page.totalBytes < expectedOffset ||
    nextOffset > page.totalBytes ||
    (entry.byteLength !== null && page.totalBytes !== entry.byteLength) ||
    page.isComplete !== (nextOffset === page.totalBytes) ||
    page.nextOffset !== (page.isComplete ? null : nextOffset) ||
    (!page.isComplete && page.bytes.byteLength === 0)
  ) {
    invalidSourceData(entry.path);
  }
};

interface IFileComparisonResult {
  readonly bytesRead: number;
  readonly isComplete: boolean;
  readonly isEqual: boolean;
  readonly nextOffset: number;
}

/** Compares one bounded aligned byte range without retaining content in continuation cursors. */
const compareFileRange = async (
  base: IRepositoryReader,
  candidate: IRepositoryReader,
  baseEntry: IRepositoryEntry,
  candidateEntry: IRepositoryEntry,
  offset: number,
  maxBytesRead: number,
  signal: AbortSignal | undefined,
): Promise<IFileComparisonResult> => {
  const maxBaseBytes = Math.floor(maxBytesRead / 2);

  if (maxBaseBytes < 1) {
    return { bytesRead: 0, isComplete: false, isEqual: true, nextOffset: offset };
  }

  const basePage = await base.readFilePage(baseEntry.path, {
    maxBytes: maxBaseBytes,
    offset,
    ...(signal === undefined ? {} : { signal }),
  });
  validateFilePage(basePage, baseEntry, base.snapshot.id, offset, maxBaseBytes);

  let bytesRead = basePage.bytes.byteLength;
  let candidateOffset = offset;
  let comparedBytes = 0;
  let candidateTotalBytes: number | null = null;
  const candidateTargetBytes = Math.max(basePage.bytes.byteLength, 1);

  while (comparedBytes < candidateTargetBytes) {
    const remainingTargetBytes = candidateTargetBytes - comparedBytes;
    const candidatePage = await candidate.readFilePage(candidateEntry.path, {
      maxBytes: remainingTargetBytes,
      offset: candidateOffset,
      ...(signal === undefined ? {} : { signal }),
    });
    validateFilePage(
      candidatePage,
      candidateEntry,
      candidate.snapshot.id,
      candidateOffset,
      remainingTargetBytes,
    );
    candidateTotalBytes = candidatePage.totalBytes;
    bytesRead += candidatePage.bytes.byteLength;

    if (basePage.totalBytes !== candidatePage.totalBytes) {
      return { bytesRead, isComplete: true, isEqual: false, nextOffset: offset };
    }

    for (let index = 0; index < candidatePage.bytes.byteLength; index += 1) {
      if (basePage.bytes[comparedBytes + index] !== candidatePage.bytes[index]) {
        return { bytesRead, isComplete: true, isEqual: false, nextOffset: offset };
      }
    }

    comparedBytes += candidatePage.bytes.byteLength;
    candidateOffset += candidatePage.bytes.byteLength;

    if (candidatePage.isComplete) {
      break;
    }
  }

  if (candidateTotalBytes === null) {
    invalidSourceData(candidateEntry.path);
  }

  const nextOffset = offset + basePage.bytes.byteLength;
  const isComplete = nextOffset === basePage.totalBytes && nextOffset === candidateTotalBytes;

  return { bytesRead, isComplete, isEqual: true, nextOffset };
};

class RepositoryComparison implements IRepositoryComparison {
  public readonly baseSnapshot;

  public readonly candidateSnapshot;

  readonly #base: IRepositoryReader;

  readonly #candidate: IRepositoryReader;

  public constructor(base: IRepositoryReader, candidate: IRepositoryReader) {
    this.#base = base;
    this.#candidate = candidate;
    this.baseSnapshot = base.snapshot;
    this.candidateSnapshot = candidate.snapshot;
  }

  public async listChangesPage(
    options: IRepositoryChangePageOptions,
  ): Promise<IRepositoryChangePage> {
    const maxChanges = parsePositivePageInteger(options.maxChanges, 'list-changes-page', null);
    const maxEntriesVisited = parsePositivePageInteger(
      options.maxEntriesVisited,
      'list-changes-page',
      null,
    );
    const maxBytesRead = parsePositivePageInteger(options.maxBytesRead, 'list-changes-page', null);

    if (maxBytesRead < 2) {
      throw invalidComparisonCursor();
    }
    throwIfAborted(options.signal);
    const cursor = parseComparisonCursor(
      options.cursor,
      this.baseSnapshot.id,
      this.candidateSnapshot.id,
    );
    let baseCursor = cursor.baseCursor;
    let candidateCursor = cursor.candidateCursor;
    let pendingFile = cursor.pendingFile;
    const changes: IRepositoryChange[] = [];
    let bytesRead = 0;
    let entriesVisited = 0;
    let baseNext: INextRepositoryEntry | null | undefined;
    let candidateNext: INextRepositoryEntry | null | undefined;

    while (entriesVisited < maxEntriesVisited && changes.length < maxChanges) {
      throwIfAborted(options.signal);
      [baseNext, candidateNext] = await Promise.all([
        baseNext === undefined
          ? getNextEntry(this.#base, baseCursor, options.signal)
          : Promise.resolve(baseNext),
        candidateNext === undefined
          ? getNextEntry(this.#candidate, candidateCursor, options.signal)
          : Promise.resolve(candidateNext),
      ]);

      if (baseNext === null) {
        baseCursor = '';
      }

      if (candidateNext === null) {
        candidateCursor = '';
      }

      if (baseNext === null && candidateNext === null) {
        break;
      }

      const baseEntry = baseNext?.entry;
      const candidateEntry = candidateNext?.entry;

      if (
        pendingFile !== null &&
        (baseEntry?.path !== pendingFile.path || candidateEntry?.path !== pendingFile.path)
      ) {
        throw invalidComparisonCursor();
      }

      if (
        candidateEntry === undefined ||
        (baseEntry !== undefined && compareRepositoryPaths(baseEntry.path, candidateEntry.path) < 0)
      ) {
        changes.push({
          baseEntry: baseEntry ?? null,
          candidateEntry: null,
          kind: 'deleted',
          path: baseEntry?.path ?? REPOSITORY_ROOT,
        });
        baseCursor = baseNext?.cursorAfter ?? '';
        baseNext = undefined;
      } else if (
        baseEntry === undefined ||
        compareRepositoryPaths(candidateEntry.path, baseEntry.path) < 0
      ) {
        changes.push({
          baseEntry: null,
          candidateEntry,
          kind: 'added',
          path: candidateEntry.path,
        });
        candidateCursor = candidateNext?.cursorAfter ?? '';
        candidateNext = undefined;
      } else {
        const change = classifySharedEntryMetadata(
          baseEntry,
          candidateEntry,
          this.baseSnapshot.sourceKind === this.candidateSnapshot.sourceKind,
        );

        if (change !== undefined) {
          if (change !== null) {
            changes.push(change);
          }

          baseCursor = baseNext?.cursorAfter ?? '';
          candidateCursor = candidateNext?.cursorAfter ?? '';
          baseNext = undefined;
          candidateNext = undefined;
          pendingFile = null;
        } else if (maxBytesRead - bytesRead < 2) {
          break;
        } else {
          const comparison = await compareFileRange(
            this.#base,
            this.#candidate,
            baseEntry,
            candidateEntry,
            pendingFile?.offset ?? 0,
            maxBytesRead - bytesRead,
            options.signal,
          );
          bytesRead += comparison.bytesRead;

          if (!comparison.isEqual) {
            changes.push({
              baseEntry,
              candidateEntry,
              kind: 'modified',
              path: baseEntry.path,
            });
          }

          if (comparison.isComplete) {
            baseCursor = baseNext?.cursorAfter ?? '';
            candidateCursor = candidateNext?.cursorAfter ?? '';
            baseNext = undefined;
            candidateNext = undefined;
            pendingFile = null;
          } else {
            pendingFile = { offset: comparison.nextOffset, path: baseEntry.path };
          }
        }
      }

      entriesVisited += 1;

      if (pendingFile !== null) {
        break;
      }
    }

    const isComplete = baseCursor === '' && candidateCursor === '' && pendingFile === null;
    const nextCursor = isComplete
      ? null
      : createRepositoryCursor({
          baseCursor,
          baseSnapshotId: this.baseSnapshot.id,
          candidateCursor,
          candidateSnapshotId: this.candidateSnapshot.id,
          pendingFile,
        } satisfies IRepositoryComparisonCursor);

    return {
      baseSnapshot: this.baseSnapshot,
      bytesRead,
      candidateSnapshot: this.candidateSnapshot,
      changes,
      entriesVisited,
      isComplete,
      nextCursor,
    };
  }
}

/** Creates the deterministic source-neutral comparison used by readers without a specialized walker. */
export const createRepositoryComparison = async (
  base: IRepositoryReader,
  candidate: IRepositoryReader,
  options?: IRepositoryOperationOptions,
): Promise<IRepositoryComparison> => {
  if (options?.signal?.aborted) {
    throw new RepositorySourceException({
      cause: options.signal.reason,
      code: 'ABORTED',
      operation: 'create-comparison',
      path: null,
      retryable: false,
    });
  }

  await Promise.resolve();

  return new RepositoryComparison(base, candidate);
};

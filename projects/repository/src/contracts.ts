import type { IRepositoryPath } from './repository-path.js';

// repository entry contracts exposed by every reader implementation
export type IRepositoryEntryType = 'file' | 'directory' | 'symlink';

export interface IRepositoryEntry {
  readonly byteLength: number | null;
  readonly contentIdentity: string | null;
  readonly path: IRepositoryPath;
  readonly type: IRepositoryEntryType;
}

// immutable source identity shared by every result from one reader
export interface IRepositorySnapshot {
  readonly id: string;
  readonly sourceKind: string;
}

// cancellation controls shared by repository operations
export interface IRepositoryOperationOptions {
  readonly signal?: AbortSignal;
}

// one bounded deterministic descendant-listing request
export interface IRepositoryEntryPageOptions extends IRepositoryOperationOptions {
  readonly cursor?: string;
  readonly maxEntries: number;
  readonly prefix?: IRepositoryPath;
}

// one bounded deterministic descendant-listing result
export interface IRepositoryEntryPage {
  readonly entries: readonly IRepositoryEntry[];
  readonly isComplete: boolean;
  readonly nextCursor: string | null;
  readonly snapshot: IRepositorySnapshot;
}

// one bounded regular-file byte-range request
export interface IRepositoryFilePageOptions extends IRepositoryOperationOptions {
  readonly maxBytes: number;
  readonly offset: number;
}

// one bounded regular-file byte-range result
export interface IRepositoryFilePage {
  readonly bytes: Uint8Array;
  readonly isComplete: boolean;
  readonly nextOffset: number | null;
  readonly offset: number;
  readonly snapshot: IRepositorySnapshot;
  readonly totalBytes: number;
}

// deterministic repository comparison records
export type IRepositoryChangeKind = 'added' | 'deleted' | 'modified' | 'type-changed';

export interface IRepositoryChange {
  readonly baseEntry: IRepositoryEntry | null;
  readonly candidateEntry: IRepositoryEntry | null;
  readonly kind: IRepositoryChangeKind;
  readonly path: IRepositoryPath;
}

// independent work and output bounds for one comparison page; byte reads require at least two
export interface IRepositoryChangePageOptions extends IRepositoryOperationOptions {
  readonly cursor?: string;
  readonly maxBytesRead: number;
  readonly maxChanges: number;
  readonly maxEntriesVisited: number;
}

// one comparison page with explicit progress and resource use
export interface IRepositoryChangePage {
  readonly baseSnapshot: IRepositorySnapshot;
  readonly bytesRead: number;
  readonly candidateSnapshot: IRepositorySnapshot;
  readonly changes: readonly IRepositoryChange[];
  readonly entriesVisited: number;
  readonly isComplete: boolean;
  readonly nextCursor: string | null;
}

// source-neutral comparison over two immutable reader snapshots
export interface IRepositoryComparison {
  readonly baseSnapshot: IRepositorySnapshot;
  readonly candidateSnapshot: IRepositorySnapshot;

  /**
   * Returns one deterministic bounded page of changed paths.
   * @param options The keyset cursor, independent work limits, and cancellation controls.
   * @returns One source-bound page of changes and measured resource use.
   * @throws
   * - INVALID_PAGE_REQUEST: The repository page request is invalid.
   * - ACCESS_DENIED: Access to the repository source was denied.
   * - SOURCE_UNAVAILABLE: The repository source is unavailable.
   * - SNAPSHOT_CHANGED: The repository snapshot changed during the operation.
   * - PROVIDER_INCOMPLETE: The repository provider cannot expose a complete result.
   * - INVALID_SOURCE_DATA: The repository source returned invalid data.
   * - RESOURCE_LIMIT_EXCEEDED: A named repository resource limit was exceeded.
   * - ABORTED: The repository operation was aborted.
   */
  listChangesPage(options: IRepositoryChangePageOptions): Promise<IRepositoryChangePage>;
}

// source-neutral access to one coherent, read-only repository snapshot
export interface IRepositoryReader {
  readonly snapshot: IRepositorySnapshot;

  /**
   * Looks up one exact logical path without following symlinks.
   * @param path The validated repository-logical path.
   * @param options Optional cancellation controls.
   * @returns The detached entry or `null` when it is absent.
   * @throws
   * - INVALID_REPOSITORY_PATH: The repository path is invalid.
   * - ACCESS_DENIED: Access to the repository source was denied.
   * - SOURCE_UNAVAILABLE: The repository source is unavailable.
   * - SNAPSHOT_CHANGED: The repository snapshot changed during the operation.
   * - PROVIDER_INCOMPLETE: The repository provider cannot expose a complete result.
   * - INVALID_SOURCE_DATA: The repository source returned invalid data.
   * - RESOURCE_LIMIT_EXCEEDED: A named repository resource limit was exceeded.
   * - ABORTED: The repository operation was aborted.
   */
  getEntry(
    path: IRepositoryPath,
    options?: IRepositoryOperationOptions,
  ): Promise<IRepositoryEntry | null>;

  /**
   * Returns one deterministic bounded page of recursive descendants.
   * @param options The prefix, keyset cursor, page bound, and cancellation controls.
   * @returns One immutable source-bound page and continuation state.
   * @throws
   * - INVALID_REPOSITORY_PATH: The repository path is invalid.
   * - ENTRY_NOT_FOUND: The requested repository entry was not found.
   * - ENTRY_NOT_DIRECTORY: The requested repository entry is not a directory.
   * - INVALID_PAGE_REQUEST: The repository page request is invalid.
   * - ACCESS_DENIED: Access to the repository source was denied.
   * - SOURCE_UNAVAILABLE: The repository source is unavailable.
   * - SNAPSHOT_CHANGED: The repository snapshot changed during the operation.
   * - PROVIDER_INCOMPLETE: The repository provider cannot expose a complete result.
   * - INVALID_SOURCE_DATA: The repository source returned invalid data.
   * - RESOURCE_LIMIT_EXCEEDED: A named repository resource limit was exceeded.
   * - ABORTED: The repository operation was aborted.
   */
  listEntriesPage(options: IRepositoryEntryPageOptions): Promise<IRepositoryEntryPage>;

  /**
   * Reads one bounded byte range from a regular file without following symlinks.
   * @param path The validated repository-logical file path.
   * @param options The offset, byte bound, and cancellation controls.
   * @returns One detached source-bound byte page and continuation offset.
   * @throws
   * - INVALID_REPOSITORY_PATH: The repository path is invalid.
   * - ENTRY_NOT_FOUND: The requested repository entry was not found.
   * - ENTRY_NOT_FILE: The requested repository entry is not a file.
   * - INVALID_PAGE_REQUEST: The repository page request is invalid.
   * - ACCESS_DENIED: Access to the repository source was denied.
   * - SOURCE_UNAVAILABLE: The repository source is unavailable.
   * - SNAPSHOT_CHANGED: The repository snapshot changed during the operation.
   * - PROVIDER_INCOMPLETE: The repository provider cannot expose a complete result.
   * - INVALID_SOURCE_DATA: The repository source returned invalid data.
   * - RESOURCE_LIMIT_EXCEEDED: A named repository resource limit was exceeded.
   * - ABORTED: The repository operation was aborted.
   */
  readFilePage(
    path: IRepositoryPath,
    options: IRepositoryFilePageOptions,
  ): Promise<IRepositoryFilePage>;

  /**
   * Creates a bounded comparison against another immutable reader snapshot.
   * @param candidate The candidate repository snapshot to compare.
   * @param options Optional cancellation controls.
   * @returns A source-neutral comparison with independently bounded pages.
   * @throws
   * - ACCESS_DENIED: Access to the repository source was denied.
   * - SOURCE_UNAVAILABLE: The repository source is unavailable.
   * - SNAPSHOT_CHANGED: The repository snapshot changed during the operation.
   * - PROVIDER_INCOMPLETE: The repository provider cannot expose a complete result.
   * - INVALID_SOURCE_DATA: The repository source returned invalid data.
   * - RESOURCE_LIMIT_EXCEEDED: A named repository resource limit was exceeded.
   * - ABORTED: The repository operation was aborted.
   */
  compare(
    candidate: IRepositoryReader,
    options?: IRepositoryOperationOptions,
  ): Promise<IRepositoryComparison>;
}

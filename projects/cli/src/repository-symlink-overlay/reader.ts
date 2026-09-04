import {
  REPOSITORY_ROOT,
  RepositorySourceException,
  createRepositoryComparison,
  parseRepositoryPath,
  type IRepositoryComparison,
  type IRepositoryEntry,
  type IRepositoryEntryPage,
  type IRepositoryEntryPageOptions,
  type IRepositoryFilePage,
  type IRepositoryFilePageOptions,
  type IRepositoryOperation,
  type IRepositoryOperationOptions,
  type IRepositoryPath,
  type IRepositoryReader,
  type IRepositorySnapshot,
} from '@moldea.ai/repository';

/** Throws the common cancellation contract for wrapper-owned operations. */
const throwIfAborted = (
  signal: AbortSignal | undefined,
  operation: IRepositoryOperation,
  path: IRepositoryPath,
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

/** Creates the common failure for an overlay that contradicts its underlying snapshot. */
const createInvalidOverlayException = (
  operation: IRepositoryOperation,
  path: IRepositoryPath,
): RepositorySourceException =>
  new RepositorySourceException({
    code: 'INVALID_SOURCE_DATA',
    operation,
    path,
    retryable: false,
  });

/** Confirms that one overlay path remains a regular file in the underlying snapshot. */
const validateOverlayEntry = (
  entry: IRepositoryEntry | null,
  operation: Exclude<IRepositoryOperation, 'create-reader'>,
  path: IRepositoryPath,
): void => {
  if (entry?.type !== 'file' || entry.path !== path) {
    throw createInvalidOverlayException(operation, path);
  }
};

/** Maps one expected underlying regular file to an immutable logical symlink entry. */
const overlayEntry = (
  entry: IRepositoryEntry | null,
  operation: 'get-entry' | 'list-entries-page',
  path: IRepositoryPath,
): IRepositoryEntry => {
  validateOverlayEntry(entry, operation, path);

  return Object.freeze({ byteLength: null, contentIdentity: null, path, type: 'symlink' });
};

// immutable logical symlink view over one coherent repository reader
class GitSymlinkOverlayRepositoryReader implements IRepositoryReader {
  public readonly snapshot: IRepositorySnapshot;

  readonly #overlayPaths: ReadonlySet<IRepositoryPath>;

  readonly #reader: IRepositoryReader;

  public constructor(reader: IRepositoryReader, overlayPaths: ReadonlySet<IRepositoryPath>) {
    this.#reader = reader;
    this.#overlayPaths = overlayPaths;
    this.snapshot = reader.snapshot;
  }

  /** Creates a bounded comparison from this logical overlay snapshot. */
  public compare(
    candidate: IRepositoryReader,
    options?: IRepositoryOperationOptions,
  ): Promise<IRepositoryComparison> {
    return createRepositoryComparison(this, candidate, options);
  }

  /**
   * Looks up an entry while replacing configured host files with logical symlinks.
   * @param path The validated repository path to inspect.
   * @param options Optional cancellation controls.
   * @returns A promise resolving to the detached logical entry or confirmed absence.
   * @throws
   * - INVALID_REPOSITORY_PATH: The repository path is invalid.
   * - ACCESS_DENIED: Access to the repository source was denied.
   * - SOURCE_UNAVAILABLE: The repository source is unavailable.
   * - SNAPSHOT_CHANGED: The repository snapshot changed during the operation.
   * - INVALID_SOURCE_DATA: The repository source returned invalid data.
   * - RESOURCE_LIMIT_EXCEEDED: A repository reading resource limit was exceeded.
   * - ABORTED: The repository operation was aborted.
   */
  public async getEntry(
    path: IRepositoryPath,
    options?: IRepositoryOperationOptions,
  ): Promise<IRepositoryEntry | null> {
    const entry = await this.#reader.getEntry(path, options);

    if (!this.#overlayPaths.has(path)) {
      return entry;
    }

    return overlayEntry(entry, 'get-entry', path);
  }

  /**
   * Reads ordinary files while refusing access to configured logical symlink bytes.
   * @param path The validated repository file path to read.
   * @param options Optional cancellation controls.
   * @returns A promise resolving to fresh bytes for a non-overlaid regular file.
   * @throws
   * - INVALID_REPOSITORY_PATH: The repository path is invalid.
   * - ENTRY_NOT_FOUND: The requested repository entry was not found.
   * - ENTRY_NOT_FILE: The requested repository entry is not a file.
   * - ACCESS_DENIED: Access to the repository source was denied.
   * - SOURCE_UNAVAILABLE: The repository source is unavailable.
   * - SNAPSHOT_CHANGED: The repository snapshot changed during the operation.
   * - INVALID_SOURCE_DATA: The repository source returned invalid data.
   * - RESOURCE_LIMIT_EXCEEDED: A repository reading resource limit was exceeded.
   * - ABORTED: The repository operation was aborted.
   */
  public async readFilePage(
    path: IRepositoryPath,
    options: IRepositoryFilePageOptions,
  ): Promise<IRepositoryFilePage> {
    const parsedPath = parseRepositoryPath(path);

    if (!this.#overlayPaths.has(parsedPath)) {
      return this.#reader.readFilePage(parsedPath, options);
    }

    throwIfAborted(options.signal, 'read-file-page', parsedPath);

    const entry = await this.#reader.getEntry(parsedPath, options);

    validateOverlayEntry(entry, 'read-file-page', parsedPath);
    throwIfAborted(options.signal, 'read-file-page', parsedPath);

    throw new RepositorySourceException({
      code: 'ENTRY_NOT_FILE',
      operation: 'read-file-page',
      path: parsedPath,
      retryable: false,
    });
  }

  /**
   * Recursively lists descendants while replacing configured host files with logical symlinks.
   * @param options Optional prefix and cancellation controls.
   * @returns An async iterable of detached logical entries.
   * @throws
   * - INVALID_REPOSITORY_PATH: The repository path is invalid.
   * - ENTRY_NOT_FOUND: The requested repository entry was not found.
   * - ENTRY_NOT_DIRECTORY: The requested repository entry is not a directory.
   * - ACCESS_DENIED: Access to the repository source was denied.
   * - SOURCE_UNAVAILABLE: The repository source is unavailable.
   * - SNAPSHOT_CHANGED: The repository snapshot changed during the operation.
   * - INVALID_SOURCE_DATA: The repository source returned invalid data.
   * - RESOURCE_LIMIT_EXCEEDED: A repository reading resource limit was exceeded.
   * - ABORTED: The repository operation was aborted.
   */
  public async listEntriesPage(
    options: IRepositoryEntryPageOptions,
  ): Promise<IRepositoryEntryPage> {
    const prefix =
      options.prefix === undefined ? REPOSITORY_ROOT : parseRepositoryPath(options.prefix);

    if (this.#overlayPaths.has(prefix)) {
      throwIfAborted(options.signal, 'list-entries-page', prefix);

      const operationOptions =
        options.signal === undefined ? undefined : { signal: options.signal };
      const entry = await this.#reader.getEntry(prefix, operationOptions);

      validateOverlayEntry(entry, 'list-entries-page', prefix);
      throwIfAborted(options.signal, 'list-entries-page', prefix);
      throw new RepositorySourceException({
        code: 'ENTRY_NOT_DIRECTORY',
        operation: 'list-entries-page',
        path: prefix,
        retryable: false,
      });
    }

    const page = await this.#reader.listEntriesPage(options);
    const entries = page.entries.map((entry) =>
      this.#overlayPaths.has(entry.path)
        ? overlayEntry(entry, 'list-entries-page', entry.path)
        : entry,
    );

    return Object.freeze({
      entries: Object.freeze(entries),
      isComplete: page.isComplete,
      nextCursor: page.nextCursor,
      snapshot: this.snapshot,
    });
  }
}

/**
 * Creates an immutable reader overlay for Git symlinks materialized as host files.
 * @param reader The coherent underlying repository reader.
 * @param symlinkPaths The logical paths whose host files represent Git symlinks.
 * @returns A reader that exposes the configured paths only as logical symlinks.
 * @throws
 * - INVALID_REPOSITORY_PATH: The repository path is invalid.
 * - INVALID_SOURCE_DATA: The repository source returned invalid data.
 */
export const createGitSymlinkOverlayRepositoryReader = (
  reader: IRepositoryReader,
  symlinkPaths: readonly IRepositoryPath[],
): IRepositoryReader => {
  const overlayPaths = new Set<IRepositoryPath>();

  for (const symlinkPath of symlinkPaths) {
    const parsedPath = parseRepositoryPath(symlinkPath);

    if (parsedPath === REPOSITORY_ROOT) {
      throw new RepositorySourceException({
        code: 'INVALID_SOURCE_DATA',
        operation: 'create-reader',
        path: parsedPath,
        retryable: false,
      });
    }

    overlayPaths.add(parsedPath);
  }

  return Object.freeze(new GitSymlinkOverlayRepositoryReader(reader, overlayPaths));
};

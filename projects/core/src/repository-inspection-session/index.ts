import {
  REPOSITORY_ROOT,
  RepositorySourceException,
  compareRepositoryPaths,
  isRepositoryPath,
  parseRepositoryPath,
  type IRepositoryEntry,
  type IRepositoryFilePage,
  type IRepositoryFilePageOptions,
  type IRepositoryLinkResolution,
  type IRepositoryOperation,
  type IRepositoryOperationOptions,
  type IRepositoryPath,
  type IRepositoryReader,
} from '@moldea.ai/repository';

import type { ICoreResourceLimits, IProjectInstructionSource } from '../contracts/index.js';
import { registerRetainedMemory, type IRetainedSource } from '../retained-memory/index.js';
import { CoreOperationException } from '../exceptions/index.js';

const MANIFEST_PATH = parseRepositoryPath('/moldea/moldea.yaml');
// the only paths an instruction source may supply; every other read uses the repository
const INSTRUCTION_PATHS: ReadonlySet<IRepositoryPath> = new Set(
  ['/AGENTS.md', '/CLAUDE.md', '/.claude/CLAUDE.md', '/CLAUDE.local.md'].map((path) =>
    parseRepositoryPath(path),
  ),
);
const SOURCE_PAGE_ENTRIES = 256;
const SOURCE_PAGE_BYTES = 65_536;
const CANONICAL_BYTE_RETENTION_MULTIPLIER = 4;
const RETAINED_PATH_FIXED_BYTES = 64;
const RETAINED_PATH_BYTE_MULTIPLIER = 2;
const encoder = new TextEncoder();

type IInspectionFileByteLimit = 'maxFileBytes' | 'maxManifestBytes';

export interface IRepositoryInspectionListOptions extends IRepositoryOperationOptions {
  readonly prefix?: IRepositoryPath;
}

// private complete-content view used only while validating canonical documents
export interface IRepositoryInspectionReader {
  getEntry(
    path: IRepositoryPath,
    options?: IRepositoryOperationOptions,
  ): Promise<IRepositoryEntry | null>;
  iterateEntries(options?: IRepositoryInspectionListOptions): AsyncIterable<IRepositoryEntry>;
  readCompleteFile(
    path: IRepositoryPath,
    options?: IRepositoryOperationOptions,
  ): Promise<Uint8Array>;
}

/*
 * Private view of the coding-agent instruction paths, used only by the integration check. It reads
 * the instruction source when one was supplied and the repository otherwise; `resolveLink` returns
 * `null` when no link resolver is available, so callers report "cannot verify".
 */
export interface IRepositoryInstructionView {
  getEntry(path: IRepositoryPath): Promise<IRepositoryEntry | null>;
  readLinkedSourceFile(path: IRepositoryPath): Promise<IRetainedSource>;
  readSourceFile(path: IRepositoryPath): Promise<IRetainedSource>;
  resolveLink(path: IRepositoryPath): Promise<IRepositoryLinkResolution | null>;
}

// private resource state shared by every reader consumer during one validation
export interface IRepositoryInspectionSession {
  readonly instructions: IRepositoryInstructionView;
  readonly reader: IRepositoryInspectionReader;

  /** Returns deterministic logical resource usage for the current validation state. */
  getResourceUsage(): IRepositoryInspectionResourceUsage;

  /**
   * Stops work at an inspection boundary when cancellation was requested.
   * @throws
   * - ABORTED: The Core operation was aborted.
   */
  throwIfAborted(): void;
}

// private logical usage carried into prepared project inspection
export interface IRepositoryInspectionResourceUsage {
  readonly canonicalBytes: number;
  readonly peakRetainedBytes: number;
  readonly retainedBytes: number;
  readonly totalBytesRead: number;
}

const invalidSourceData = (
  operation: IRepositoryOperation,
  path: IRepositoryPath | null,
): never => {
  throw new RepositorySourceException({
    code: 'INVALID_SOURCE_DATA',
    operation,
    path,
    retryable: false,
  });
};

const copyReaderEntry = (
  candidate: unknown,
  operation: 'get-entry' | 'list-entries-page',
  fallbackPath: IRepositoryPath,
  expectedPath?: IRepositoryPath,
): IRepositoryEntry => {
  if (typeof candidate !== 'object' || candidate === null) {
    return invalidSourceData(operation, fallbackPath);
  }

  const record = candidate as Readonly<Record<string, unknown>>;
  const pathCandidate = record['path'];
  const typeCandidate = record['type'];
  const byteLength = record['byteLength'];
  const contentIdentity = record['contentIdentity'];

  if (typeof pathCandidate !== 'string' || !isRepositoryPath(pathCandidate)) {
    return invalidSourceData(operation, fallbackPath);
  }

  const path = parseRepositoryPath(pathCandidate);

  if (expectedPath !== undefined && path !== expectedPath) {
    return invalidSourceData(operation, path);
  }

  if (typeCandidate !== 'file' && typeCandidate !== 'directory' && typeCandidate !== 'symlink') {
    return invalidSourceData(operation, path);
  }

  if (
    typeCandidate === 'file'
      ? !Number.isSafeInteger(byteLength) ||
        (byteLength as number) < 0 ||
        (contentIdentity !== null && typeof contentIdentity !== 'string')
      : byteLength !== null || contentIdentity !== null
  ) {
    return invalidSourceData(operation, path);
  }

  return {
    byteLength: byteLength as number | null,
    contentIdentity: contentIdentity as string | null,
    path,
    type: typeCandidate,
  };
};

// bounded page reads from one snapshot-bound source
interface IFilePageSource {
  readonly readPage: (
    path: IRepositoryPath,
    options: IRepositoryFilePageOptions,
  ) => Promise<IRepositoryFilePage>;
  readonly snapshotId: string;
}

const REFUSED_LINK_STATES = ['broken', 'denied', 'loop', 'unsafe'] as const;
const LINK_TARGET_TYPES = ['directory', 'file', 'other'] as const;

/** Copies one untrusted link resolution, rejecting any shape outside the closed contract. */
const copyLinkResolution = (
  candidate: unknown,
  path: IRepositoryPath,
): IRepositoryLinkResolution => {
  if (typeof candidate !== 'object' || candidate === null) {
    return invalidSourceData('get-entry', path);
  }

  const record = candidate as Readonly<Record<string, unknown>>;
  const keys = Object.keys(record).sort().join();
  const refusedState = REFUSED_LINK_STATES.find((state) => state === record['state']);

  if (Reflect.ownKeys(record).length !== Object.keys(record).length) {
    return invalidSourceData('get-entry', path);
  }

  if (record['state'] === 'not-link' || refusedState !== undefined) {
    return keys === 'state'
      ? { state: refusedState ?? 'not-link' }
      : invalidSourceData('get-entry', path);
  }

  const targetIdentity = record['targetIdentity'];
  const targetType = LINK_TARGET_TYPES.find((type) => type === record['targetType']);

  if (
    typeof targetIdentity !== 'string' ||
    targetIdentity.length === 0 ||
    targetType === undefined
  ) {
    return invalidSourceData('get-entry', path);
  }

  if (record['state'] === 'outside' && keys === 'state,targetIdentity,targetType') {
    return { state: 'outside', targetIdentity, targetType };
  }

  const targetPath = record['targetPath'];

  return record['state'] === 'inside' &&
    keys === 'state,targetIdentity,targetPath,targetType' &&
    typeof targetPath === 'string' &&
    isRepositoryPath(targetPath)
    ? { state: 'inside', targetIdentity, targetPath: parseRepositoryPath(targetPath), targetType }
    : invalidSourceData('get-entry', path);
};

const isStrictDescendant = (path: IRepositoryPath, prefix: IRepositoryPath): boolean => {
  if (path === prefix) {
    return false;
  }

  const descendantPrefix = prefix === REPOSITORY_ROOT ? REPOSITORY_ROOT : `${prefix}/`;
  return path.startsWith(descendantPrefix);
};

const throwResourceLimitExceeded = (
  limit: keyof ICoreResourceLimits,
  limitMaximum: number,
  observedUsage: number,
): never => {
  throw new CoreOperationException({
    code: 'RESOURCE_LIMIT_EXCEEDED',
    limit,
    limitMaximum,
    nextAction: 'reduce-input-or-increase-limit',
    observedUsage,
    operation: 'validate-project',
  });
};

const createSourceOptions = (
  sessionSignal: AbortSignal | undefined,
  operationSignal: AbortSignal | undefined,
): IRepositoryOperationOptions | undefined => {
  const signal =
    sessionSignal === undefined
      ? operationSignal
      : operationSignal === undefined || operationSignal === sessionSignal
        ? sessionSignal
        : AbortSignal.any([sessionSignal, operationSignal]);
  return signal === undefined ? undefined : { signal };
};

/**
 * Creates the isolated reader state for one repository inspection.
 * @param repository The source-neutral reader bound to one coherent snapshot.
 * @param limits The immutable resource limits for the inspection.
 * @param signal Optional cancellation shared by every inspection operation.
 * @param instructions Optional instruction source read only through the instruction view.
 * @returns A session that pages source metadata and range-reads bounded canonical files.
 * @throws
 * - ABORTED: The Core operation was aborted.
 */
export const createRepositoryInspectionSession = (
  repository: IRepositoryReader,
  limits: ICoreResourceLimits,
  signal?: AbortSignal,
  instructions?: IProjectInstructionSource,
): IRepositoryInspectionSession => {
  const seenPaths = new Set<IRepositoryPath>();
  let canonicalBytes = 0;
  let peakRetainedBytes = 0;
  let retainedBytes = 0;
  let totalBytesRead = 0;
  const createAbortedException = (abortedSignal: AbortSignal): CoreOperationException => {
    return new CoreOperationException({
      cause: abortedSignal.reason,
      code: 'ABORTED',
      operation: 'validate-project',
    });
  };

  const reserveRetainedBytes = (byteLength: number): void => {
    if (
      !Number.isSafeInteger(byteLength) ||
      byteLength < 0 ||
      byteLength > limits.maxRetainedBytes - retainedBytes
    ) {
      return throwResourceLimitExceeded(
        'maxRetainedBytes',
        limits.maxRetainedBytes,
        retainedBytes + byteLength,
      );
    }

    retainedBytes += byteLength;
    peakRetainedBytes = Math.max(peakRetainedBytes, retainedBytes);
  };

  const observeTransientBytes = (byteLength: number): void => {
    if (
      !Number.isSafeInteger(byteLength) ||
      byteLength < 0 ||
      byteLength > limits.maxRetainedBytes - retainedBytes
    ) {
      return throwResourceLimitExceeded(
        'maxRetainedBytes',
        limits.maxRetainedBytes,
        retainedBytes + byteLength,
      );
    }

    peakRetainedBytes = Math.max(peakRetainedBytes, retainedBytes + byteLength);
  };

  const registerPath = (path: IRepositoryPath): void => {
    if (path === REPOSITORY_ROOT || seenPaths.has(path)) {
      return;
    }

    if (seenPaths.size >= limits.maxEntries) {
      return throwResourceLimitExceeded('maxEntries', limits.maxEntries, seenPaths.size + 1);
    }

    reserveRetainedBytes(
      RETAINED_PATH_FIXED_BYTES + encoder.encode(path).byteLength * RETAINED_PATH_BYTE_MULTIPLIER,
    );
    seenPaths.add(path);
  };

  const throwIfSignalAborted = (operationSignal?: AbortSignal): void => {
    const abortedSignal = signal?.aborted
      ? signal
      : operationSignal?.aborted
        ? operationSignal
        : null;

    if (abortedSignal !== null) {
      throw createAbortedException(abortedSignal);
    }
  };

  throwIfSignalAborted();

  const reserveReadBytes = (byteLength: number): void => {
    if (byteLength > limits.maxTotalBytesRead - totalBytesRead) {
      return throwResourceLimitExceeded(
        'maxTotalBytesRead',
        limits.maxTotalBytesRead,
        totalBytesRead + byteLength,
      );
    }

    totalBytesRead += byteLength;
  };

  const repositoryPages: IFilePageSource = {
    readPage: (path, options) => repository.readFilePage(path, options),
    snapshotId: repository.snapshot.id,
  };

  const getEntryFrom = async (
    source: IRepositoryReader,
    path: IRepositoryPath,
    options?: IRepositoryOperationOptions,
  ): Promise<IRepositoryEntry | null> => {
    const parsedPath = parseRepositoryPath(path);
    throwIfSignalAborted(options?.signal);
    registerPath(parsedPath);
    const candidate = await source.getEntry(
      parsedPath,
      createSourceOptions(signal, options?.signal),
    );
    throwIfSignalAborted(options?.signal);

    return candidate === null
      ? null
      : copyReaderEntry(candidate, 'get-entry', parsedPath, parsedPath);
  };

  const getEntry = (
    path: IRepositoryPath,
    options?: IRepositoryOperationOptions,
  ): Promise<IRepositoryEntry | null> => getEntryFrom(repository, path, options);

  const iterateEntries = (
    options?: IRepositoryInspectionListOptions,
  ): AsyncIterable<IRepositoryEntry> => {
    const prefix =
      options?.prefix === undefined ? REPOSITORY_ROOT : parseRepositoryPath(options.prefix);

    return {
      async *[Symbol.asyncIterator](): AsyncIterator<IRepositoryEntry> {
        registerPath(prefix);
        const yieldedPaths = new Set<IRepositoryPath>();
        let cursor: string | undefined;
        let previousPath: IRepositoryPath | null = null;

        do {
          throwIfSignalAborted(options?.signal);
          const page = await repository.listEntriesPage({
            ...(cursor === undefined ? {} : { cursor }),
            maxEntries: Math.min(SOURCE_PAGE_ENTRIES, limits.maxEntries),
            prefix,
            ...(createSourceOptions(signal, options?.signal) ?? {}),
          });

          if (
            page.snapshot.id !== repository.snapshot.id ||
            (page.entries.length === 0 && !page.isComplete)
          ) {
            return invalidSourceData('list-entries-page', prefix);
          }

          for (const candidate of page.entries) {
            throwIfSignalAborted(options?.signal);
            const entry = copyReaderEntry(candidate, 'list-entries-page', prefix);

            if (
              !isStrictDescendant(entry.path, prefix) ||
              yieldedPaths.has(entry.path) ||
              (previousPath !== null && compareRepositoryPaths(previousPath, entry.path) >= 0)
            ) {
              return invalidSourceData('list-entries-page', entry.path);
            }

            yieldedPaths.add(entry.path);
            previousPath = entry.path;
            registerPath(entry.path);
            yield entry;
          }

          if (page.isComplete) {
            if (page.nextCursor !== null) {
              return invalidSourceData('list-entries-page', prefix);
            }

            return;
          }

          if (page.nextCursor === null || page.nextCursor === cursor) {
            return invalidSourceData('list-entries-page', prefix);
          }

          cursor = page.nextCursor;
        } while (true);
      },
    };
  };

  const loadFile = async (
    path: IRepositoryPath,
    operationSignal?: AbortSignal,
    isSource = false,
    pages: IFilePageSource = repositoryPages,
  ): Promise<Uint8Array> => {
    const multiplier = isSource ? 1 : CANONICAL_BYTE_RETENTION_MULTIPLIER;
    const fileLimit: IInspectionFileByteLimit =
      path === MANIFEST_PATH ? 'maxManifestBytes' : 'maxFileBytes';
    const availableRetainedBytes = limits.maxRetainedBytes - retainedBytes;

    if (availableRetainedBytes < 1) {
      return throwResourceLimitExceeded(
        'maxRetainedBytes',
        limits.maxRetainedBytes,
        retainedBytes + 1,
      );
    }

    const firstPageMaximumBytes = Math.min(
      SOURCE_PAGE_BYTES,
      Math.max(1, limits[fileLimit]),
      availableRetainedBytes,
    );
    observeTransientBytes(firstPageMaximumBytes);
    const firstPage = await pages.readPage(path, {
      maxBytes: firstPageMaximumBytes,
      offset: 0,
      ...(createSourceOptions(signal, operationSignal) ?? {}),
    });
    throwIfSignalAborted(operationSignal);

    if (
      firstPage.snapshot.id !== pages.snapshotId ||
      firstPage.offset !== 0 ||
      !(firstPage.bytes instanceof Uint8Array) ||
      !Number.isSafeInteger(firstPage.totalBytes) ||
      firstPage.totalBytes < 0 ||
      firstPage.bytes.byteLength > SOURCE_PAGE_BYTES ||
      firstPage.bytes.byteLength > firstPage.totalBytes ||
      (firstPage.bytes.byteLength === 0 && !firstPage.isComplete)
    ) {
      return invalidSourceData('read-file-page', path);
    }

    if (firstPage.totalBytes > limits[fileLimit]) {
      return throwResourceLimitExceeded(fileLimit, limits[fileLimit], firstPage.totalBytes);
    }

    const firstPageBytes = firstPage.bytes.byteLength;
    const retainedBytesAvailableForCanonicalContent =
      limits.maxRetainedBytes - retainedBytes - firstPageBytes;

    if (
      retainedBytesAvailableForCanonicalContent < 0 ||
      firstPage.totalBytes > Math.floor(retainedBytesAvailableForCanonicalContent / multiplier)
    ) {
      const projectedUsage = retainedBytes + firstPageBytes + firstPage.totalBytes * multiplier;

      return throwResourceLimitExceeded(
        'maxRetainedBytes',
        limits.maxRetainedBytes,
        Number.isSafeInteger(projectedUsage) ? projectedUsage : Number.MAX_SAFE_INTEGER,
      );
    }

    reserveReadBytes(firstPage.totalBytes);
    const canonicalRetainedBytes = firstPage.totalBytes * multiplier;
    observeTransientBytes(canonicalRetainedBytes + firstPageBytes);
    reserveRetainedBytes(canonicalRetainedBytes);
    if (!isSource) canonicalBytes += firstPage.totalBytes;

    const content = new Uint8Array(firstPage.totalBytes);
    let offset = 0;
    let page = firstPage;
    let isFirstPage = true;

    while (isFirstPage || offset < content.byteLength) {
      isFirstPage = false;
      if (
        page.snapshot.id !== pages.snapshotId ||
        page.offset !== offset ||
        page.totalBytes !== content.byteLength ||
        !(page.bytes instanceof Uint8Array) ||
        page.bytes.byteLength > SOURCE_PAGE_BYTES ||
        page.bytes.byteLength > content.byteLength - offset ||
        (page.bytes.byteLength === 0 && !page.isComplete)
      ) {
        return invalidSourceData('read-file-page', path);
      }

      content.set(page.bytes, offset);
      offset += page.bytes.byteLength;

      if (page.isComplete) {
        if (page.nextOffset !== null || offset !== content.byteLength) {
          return invalidSourceData('read-file-page', path);
        }

        break;
      }

      if (page.nextOffset !== offset) {
        return invalidSourceData('read-file-page', path);
      }

      page = await pages.readPage(path, {
        maxBytes: Math.min(SOURCE_PAGE_BYTES, Math.max(1, content.byteLength - offset)),
        offset,
        ...(createSourceOptions(signal, operationSignal) ?? {}),
      });
      throwIfSignalAborted(operationSignal);
    }

    return content;
  };

  const awaitWithCancellation = async <T>(
    promise: Promise<T>,
    operationSignal?: AbortSignal,
  ): Promise<T> => {
    const callerSignal = createSourceOptions(signal, operationSignal)?.signal;

    if (callerSignal === undefined) {
      return promise;
    }

    return new Promise<T>((resolve, reject) => {
      const cleanup = (): void => callerSignal.removeEventListener('abort', abort);
      const abort = (): void => {
        cleanup();
        reject(createAbortedException(callerSignal));
      };

      if (callerSignal.aborted) abort();
      else callerSignal.addEventListener('abort', abort, { once: true });
      void promise.then(
        (result) => {
          cleanup();
          resolve(result);
        },
        (error: unknown) => {
          cleanup();
          reject(
            error instanceof Error
              ? error
              : new RepositorySourceException({
                  cause: error,
                  code: 'INVALID_SOURCE_DATA',
                  operation: 'read-file-page',
                  path: null,
                  retryable: false,
                }),
          );
        },
      );
    });
  };

  const readCompleteFile = async (
    path: IRepositoryPath,
    options?: IRepositoryOperationOptions,
  ): Promise<Uint8Array> => {
    const parsedPath = parseRepositoryPath(path);
    throwIfSignalAborted(options?.signal);
    registerPath(parsedPath);
    const content = await awaitWithCancellation(
      loadFile(parsedPath, options?.signal),
      options?.signal,
    );
    throwIfSignalAborted(options?.signal);

    return content.slice();
  };

  /** Loads one complete temporary source buffer whose reservation the caller releases. */
  const readRetainedSource = async (
    path: IRepositoryPath,
    pages: IFilePageSource,
  ): Promise<IRetainedSource> => {
    throwIfSignalAborted();
    registerPath(path);
    const bytes = await awaitWithCancellation(loadFile(path, undefined, true, pages));
    throwIfSignalAborted();
    let isReleased = false;
    return {
      bytes,
      release: (): void => {
        if (!isReleased) retainedBytes -= bytes.byteLength;
        isReleased = true;
      },
    };
  };

  const instructionReader = instructions?.reader ?? repository;
  const instructionPages: IFilePageSource =
    instructions === undefined
      ? repositoryPages
      : {
          readPage: (path, options) => instructions.reader.readFilePage(path, options),
          snapshotId: instructions.reader.snapshot.id,
        };
  const linkResolver = instructions?.linkResolver;
  const linkPages: IFilePageSource | undefined =
    linkResolver === undefined
      ? undefined
      : {
          readPage: (path, options) => linkResolver.readLinkTargetPage(path, options),
          snapshotId: linkResolver.snapshot.id,
        };
  const requireInstructionPath = (path: IRepositoryPath): IRepositoryPath => {
    const parsedPath = parseRepositoryPath(path);
    if (!INSTRUCTION_PATHS.has(parsedPath))
      throw new TypeError('The instruction view reads only coding-agent instruction paths.');
    return parsedPath;
  };
  const instructionView: IRepositoryInstructionView = Object.freeze({
    getEntry: (path: IRepositoryPath) =>
      getEntryFrom(instructionReader, requireInstructionPath(path)),
    readLinkedSourceFile: (path: IRepositoryPath) => {
      if (linkPages === undefined)
        throw new TypeError('The instruction view has no link resolver to read through.');
      return readRetainedSource(requireInstructionPath(path), linkPages);
    },
    readSourceFile: (path: IRepositoryPath) =>
      readRetainedSource(requireInstructionPath(path), instructionPages),
    resolveLink: async (path: IRepositoryPath) => {
      const parsedPath = requireInstructionPath(path);
      if (linkResolver === undefined) return null;
      throwIfSignalAborted();
      registerPath(parsedPath);
      const candidate = await awaitWithCancellation(
        linkResolver.resolveLink(parsedPath, createSourceOptions(signal, undefined)),
      );
      throwIfSignalAborted();
      return copyLinkResolution(candidate, parsedPath);
    },
  });

  const reader = Object.freeze({ getEntry, iterateEntries, readCompleteFile });
  registerRetainedMemory(reader, {
    reserve: reserveRetainedBytes,
    tryReserve: (bytes): boolean => {
      if (
        !Number.isSafeInteger(bytes) ||
        bytes < 0 ||
        bytes > limits.maxRetainedBytes - retainedBytes
      )
        return false;
      reserveRetainedBytes(bytes);
      return true;
    },
    release: (bytes): void => {
      if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > retainedBytes)
        throw new TypeError('The retained-memory release is invalid.');
      retainedBytes -= bytes;
    },
    readSourceFile: (path) => readRetainedSource(path, repositoryPages),
  });
  return Object.freeze({
    getResourceUsage: () =>
      Object.freeze({ canonicalBytes, peakRetainedBytes, retainedBytes, totalBytesRead }),
    instructions: instructionView,
    reader,
    throwIfAborted: throwIfSignalAborted,
  });
};

import {
  REPOSITORY_ROOT,
  RepositorySourceException,
  compareRepositoryPaths,
  isRepositoryPath,
  parseRepositoryPath,
  type IRepositoryEntry,
  type IRepositoryOperation,
  type IRepositoryOperationOptions,
  type IRepositoryPath,
  type IRepositoryReader,
} from '@moldea.ai/repository';

import type { ICoreResourceLimits } from '../contracts/index.js';
import type { IRuntimeAdapterRepository } from '../adapter/index.js';
import { CoreOperationException } from '../exceptions/index.js';

const MANIFEST_PATH = parseRepositoryPath('/moldea/moldea.yaml');
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

// private resource state shared by every reader consumer during one validation
export interface IRepositoryInspectionSession {
  readonly adapterRepository: IRuntimeAdapterRepository;
  readonly reader: IRepositoryInspectionReader;

  /** Returns deterministic logical resource usage for the current validation state. */
  getResourceUsage(): IRepositoryInspectionResourceUsage;

  /**
   * Stops work at an inspection boundary when cancellation was requested.
   * @throws
   * - ABORTED: Repository inspection was aborted.
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
 * @returns A session that pages source metadata and range-reads bounded canonical files.
 * @throws
 * - ABORTED: Repository inspection was aborted before the session was created.
 */
export const createRepositoryInspectionSession = (
  repository: IRepositoryReader,
  limits: ICoreResourceLimits,
  signal?: AbortSignal,
): IRepositoryInspectionSession => {
  const seenPaths = new Set<IRepositoryPath>();
  let canonicalBytes = 0;
  let peakRetainedBytes = 0;
  let retainedBytes = 0;
  let totalBytesRead = 0;
  const adapterLimits = Object.freeze({
    maxEntries: limits.maxEntries,
    maxFileBytes: limits.maxFileBytes,
    maxPageBytes: Math.min(SOURCE_PAGE_BYTES, limits.maxFileBytes),
    maxPageEntries: Math.min(SOURCE_PAGE_ENTRIES, limits.maxEntries),
    maxTotalBytesRead: limits.maxTotalBytesRead,
  });

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

  const getEntry = async (
    path: IRepositoryPath,
    options?: IRepositoryOperationOptions,
  ): Promise<IRepositoryEntry | null> => {
    const parsedPath = parseRepositoryPath(path);
    throwIfSignalAborted(options?.signal);
    registerPath(parsedPath);
    const candidate = await repository.getEntry(
      parsedPath,
      createSourceOptions(signal, options?.signal),
    );
    throwIfSignalAborted(options?.signal);

    return candidate === null
      ? null
      : copyReaderEntry(candidate, 'get-entry', parsedPath, parsedPath);
  };

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
  ): Promise<Uint8Array> => {
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
    const firstPage = await repository.readFilePage(path, {
      maxBytes: firstPageMaximumBytes,
      offset: 0,
      ...(createSourceOptions(signal, operationSignal) ?? {}),
    });
    throwIfSignalAborted(operationSignal);

    if (
      firstPage.snapshot.id !== repository.snapshot.id ||
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
      firstPage.totalBytes >
        Math.floor(retainedBytesAvailableForCanonicalContent / CANONICAL_BYTE_RETENTION_MULTIPLIER)
    ) {
      const projectedUsage =
        retainedBytes + firstPageBytes + firstPage.totalBytes * CANONICAL_BYTE_RETENTION_MULTIPLIER;

      return throwResourceLimitExceeded(
        'maxRetainedBytes',
        limits.maxRetainedBytes,
        Number.isSafeInteger(projectedUsage) ? projectedUsage : Number.MAX_SAFE_INTEGER,
      );
    }

    reserveReadBytes(firstPage.totalBytes);
    const canonicalRetainedBytes = firstPage.totalBytes * CANONICAL_BYTE_RETENTION_MULTIPLIER;
    observeTransientBytes(canonicalRetainedBytes + firstPageBytes);
    reserveRetainedBytes(canonicalRetainedBytes);
    canonicalBytes += firstPage.totalBytes;

    const content = new Uint8Array(firstPage.totalBytes);
    let offset = 0;
    let page = firstPage;
    let isFirstPage = true;

    while (isFirstPage || offset < content.byteLength) {
      isFirstPage = false;
      if (
        page.snapshot.id !== repository.snapshot.id ||
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

      page = await repository.readFilePage(path, {
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

    if (callerSignal.aborted) {
      throw createAbortedException(callerSignal);
    }

    return new Promise<T>((resolve, reject) => {
      const cleanup = (): void => callerSignal.removeEventListener('abort', abort);
      const abort = (): void => {
        cleanup();
        reject(createAbortedException(callerSignal));
      };

      callerSignal.addEventListener('abort', abort, { once: true });
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

  const listAdapterEntriesPage: IRuntimeAdapterRepository['listEntriesPage'] = async (options) => {
    const prefix =
      options.prefix === undefined ? REPOSITORY_ROOT : parseRepositoryPath(options.prefix);
    registerPath(prefix);

    if (
      !Number.isSafeInteger(options.maxEntries) ||
      options.maxEntries < 1 ||
      options.maxEntries > adapterLimits.maxPageEntries
    ) {
      return throwResourceLimitExceeded(
        'maxEntries',
        adapterLimits.maxPageEntries,
        options.maxEntries,
      );
    }

    throwIfSignalAborted(options.signal);
    const page = await repository.listEntriesPage({
      ...(options.cursor === undefined ? {} : { cursor: options.cursor }),
      maxEntries: options.maxEntries,
      prefix,
      ...(createSourceOptions(signal, options.signal) ?? {}),
    });
    throwIfSignalAborted(options.signal);

    if (
      page.snapshot.id !== repository.snapshot.id ||
      page.entries.length > options.maxEntries ||
      (page.entries.length === 0 && !page.isComplete) ||
      (page.isComplete ? page.nextCursor !== null : page.nextCursor === null)
    ) {
      return invalidSourceData('list-entries-page', prefix);
    }

    let previousPath: IRepositoryPath | null = null;
    const entries = page.entries.map((candidate) => {
      const entry = copyReaderEntry(candidate, 'list-entries-page', prefix);

      if (
        !isStrictDescendant(entry.path, prefix) ||
        (previousPath !== null && compareRepositoryPaths(previousPath, entry.path) >= 0)
      ) {
        return invalidSourceData('list-entries-page', entry.path);
      }

      previousPath = entry.path;
      registerPath(entry.path);
      return entry;
    });

    return Object.freeze({
      entries: Object.freeze(entries),
      isComplete: page.isComplete,
      nextCursor: page.nextCursor,
      snapshot: repository.snapshot,
    });
  };

  const readAdapterFilePage: IRuntimeAdapterRepository['readFilePage'] = async (path, options) => {
    const parsedPath = parseRepositoryPath(path);

    if (
      !Number.isSafeInteger(options.offset) ||
      options.offset < 0 ||
      !Number.isSafeInteger(options.maxBytes) ||
      options.maxBytes < 1 ||
      options.maxBytes > adapterLimits.maxPageBytes
    ) {
      return invalidSourceData('read-file-page', parsedPath);
    }

    throwIfSignalAborted(options.signal);
    registerPath(parsedPath);
    const reservedBytes = Math.min(options.maxBytes, limits.maxTotalBytesRead - totalBytesRead);

    if (reservedBytes < 1) {
      return throwResourceLimitExceeded(
        'maxTotalBytesRead',
        limits.maxTotalBytesRead,
        totalBytesRead + 1,
      );
    }

    observeTransientBytes(reservedBytes);
    reserveReadBytes(reservedBytes);
    let page;

    try {
      page = await repository.readFilePage(parsedPath, {
        maxBytes: reservedBytes,
        offset: options.offset,
        ...(createSourceOptions(signal, options.signal) ?? {}),
      });
    } catch (error: unknown) {
      totalBytesRead -= reservedBytes;
      throw error;
    }

    throwIfSignalAborted(options.signal);

    if (
      page.snapshot.id !== repository.snapshot.id ||
      page.offset !== options.offset ||
      !(page.bytes instanceof Uint8Array) ||
      !Number.isSafeInteger(page.totalBytes) ||
      page.totalBytes < 0 ||
      page.totalBytes > limits.maxFileBytes ||
      page.bytes.byteLength > reservedBytes ||
      page.bytes.byteLength > page.totalBytes - page.offset ||
      (page.bytes.byteLength === 0 && !page.isComplete) ||
      (page.isComplete
        ? page.nextOffset !== null || page.offset + page.bytes.byteLength !== page.totalBytes
        : page.nextOffset !== page.offset + page.bytes.byteLength)
    ) {
      totalBytesRead -= reservedBytes;
      return invalidSourceData('read-file-page', parsedPath);
    }

    totalBytesRead -= reservedBytes - page.bytes.byteLength;

    return Object.freeze({
      bytes: page.bytes.slice(),
      isComplete: page.isComplete,
      nextOffset: page.nextOffset,
      offset: page.offset,
      snapshot: repository.snapshot,
      totalBytes: page.totalBytes,
    });
  };

  const adapterRepository: IRuntimeAdapterRepository = Object.freeze({
    getEntry,
    limits: adapterLimits,
    listEntriesPage: listAdapterEntriesPage,
    readFilePage: readAdapterFilePage,
    snapshot: repository.snapshot,
  });

  return Object.freeze({
    adapterRepository,
    getResourceUsage: () =>
      Object.freeze({ canonicalBytes, peakRetainedBytes, retainedBytes, totalBytesRead }),
    reader: Object.freeze({ getEntry, iterateEntries, readCompleteFile }),
    throwIfAborted: throwIfSignalAborted,
  });
};

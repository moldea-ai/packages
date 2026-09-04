import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { constants } from 'node:fs';
import type { BigIntStats } from 'node:fs';
import { lstat, open, opendir, realpath } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import path from 'node:path';
import { TextDecoder } from 'node:util';

import {
  REPOSITORY_ROOT,
  RepositorySourceException,
  compareRepositoryPaths,
  createRepositoryComparison,
  parseRepositoryPath,
  type IRepositoryComparison,
  type IRepositoryEntry,
  type IRepositoryEntryPage,
  type IRepositoryEntryPageOptions,
  type IRepositoryEntryType,
  type IRepositoryFilePage,
  type IRepositoryFilePageOptions,
  type IRepositoryOperation,
  type IRepositoryOperationOptions,
  type IRepositoryPath,
  type IRepositoryReader,
  type IRepositorySnapshot,
  type IRepositorySourceErrorCode,
} from '@moldea.ai/repository';

import type {
  IFilesystemRepositoryReaderOptions,
  IFilesystemRepositoryResourceLimits,
  IFilesystemRepositorySelection,
} from '../contracts/index.js';
import {
  normalizeFilesystemRepositoryOptions,
  type INormalizedFilesystemRepositoryReaderOptions,
} from '../options/index.js';

interface ICursorFrame {
  readonly lastName: string | null;
  readonly namesIdentity: string;
  readonly path: IRepositoryPath;
  readonly pathIdentity: string;
}

interface IDirectoryCursor {
  readonly frames: readonly ICursorFrame[];
  readonly kind: 'directory';
  readonly prefix: IRepositoryPath;
  readonly snapshotId: string;
  readonly version: 1;
}

interface IPathCursor {
  readonly kind: 'paths';
  readonly lastPath: IRepositoryPath;
  readonly prefix: IRepositoryPath;
  readonly snapshotId: string;
  readonly version: 1;
}

type IFilesystemCursor = IDirectoryCursor | IPathCursor;

interface IRuntimeCursorFrame extends ICursorFrame {
  readonly names: readonly string[];
  readonly nextIndex: number;
}

interface ICachedFilePage {
  readonly bytes: Uint8Array;
  readonly entryIdentity: string;
}

const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const MAX_CURSOR_BYTES = 65_536;
const DIRECTORY_CURSOR_KEYS = new Set(['frames', 'kind', 'prefix', 'snapshotId', 'version']);
const CURSOR_FRAME_KEYS = new Set(['lastName', 'namesIdentity', 'path', 'pathIdentity']);
const PATH_CURSOR_KEYS = new Set(['kind', 'lastPath', 'prefix', 'snapshotId', 'version']);

const isRecord = (candidate: unknown): candidate is Readonly<Record<string, unknown>> =>
  typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate);

const hasOnlyKeys = (
  record: Readonly<Record<string, unknown>>,
  keys: ReadonlySet<string>,
): boolean => Reflect.ownKeys(record).every((key) => typeof key === 'string' && keys.has(key));

const hashParts = (parts: readonly (string | Uint8Array)[]): string => {
  const hash = createHash('sha256');

  for (const part of parts) {
    hash.update(part);
    hash.update('\0');
  }

  return `sha256:${hash.digest('hex')}`;
};

const getErrorCode = (cause: unknown): string | undefined => {
  if (typeof cause !== 'object' || cause === null || !('code' in cause)) {
    return undefined;
  }

  const code: unknown = cause.code;

  return typeof code === 'string' ? code : undefined;
};

const throwSource = (
  code: IRepositorySourceErrorCode,
  operation: IRepositoryOperation,
  logicalPath: IRepositoryPath | null,
  retryable: boolean,
  cause?: unknown,
  resource?: { readonly dimension: string; readonly limit: number; readonly observed: number },
): never => {
  throw new RepositorySourceException({
    cause,
    code,
    operation,
    path: logicalPath,
    ...(resource === undefined ? {} : { resource }),
    retryable,
  });
};

const throwMappedHostError = (
  cause: unknown,
  operation: IRepositoryOperation,
  logicalPath: IRepositoryPath | null,
): never => {
  const code = getErrorCode(cause);

  if (code === 'EACCES' || code === 'EPERM') {
    return throwSource('ACCESS_DENIED', operation, logicalPath, true, cause);
  }

  if (
    operation !== 'create-reader' &&
    (code === 'ENOENT' || code === 'ENOTDIR' || code === 'ELOOP')
  ) {
    return throwSource('SNAPSHOT_CHANGED', operation, logicalPath, true, cause);
  }

  if (operation === 'create-reader' && (code === 'ENOENT' || code === 'ENOTDIR')) {
    return throwSource('ENTRY_NOT_FOUND', operation, logicalPath, true, cause);
  }

  return throwSource('SOURCE_UNAVAILABLE', operation, logicalPath, true, cause);
};

const throwIfAborted = (
  signal: AbortSignal | undefined,
  operation: IRepositoryOperation,
  logicalPath: IRepositoryPath | null,
): void => {
  if (signal?.aborted) {
    throwSource('ABORTED', operation, logicalPath, false, signal.reason);
  }
};

const getStatisticsIdentity = (statistics: BigIntStats, type: IRepositoryEntryType): string => {
  return hashParts([
    type,
    statistics.dev.toString(),
    statistics.ino.toString(),
    statistics.mode.toString(),
    statistics.size.toString(),
    statistics.mtimeNs.toString(),
    statistics.ctimeNs.toString(),
  ]);
};

const classifyStatistics = (
  statistics: BigIntStats,
  operation: IRepositoryOperation,
  logicalPath: IRepositoryPath,
): IRepositoryEntryType => {
  if (statistics.isFile()) {
    return 'file';
  }

  if (statistics.isDirectory()) {
    return 'directory';
  }

  if (statistics.isSymbolicLink()) {
    return 'symlink';
  }

  return throwSource('INVALID_SOURCE_DATA', operation, logicalPath, false);
};

const decodeName = (
  encodedName: Uint8Array,
  operation: IRepositoryOperation,
  parentPath: IRepositoryPath,
): string => {
  try {
    const name = decoder.decode(encodedName);
    parseRepositoryPath(parentPath === REPOSITORY_ROOT ? `/${name}` : `${parentPath}/${name}`);

    return name;
  } catch (cause) {
    return throwSource('INVALID_SOURCE_DATA', operation, parentPath, false, cause);
  }
};

/** Opens a bounded directory stream while preserving raw filename bytes for UTF-8 validation. */
const openBufferDirectory = async (
  hostPath: string,
): Promise<AsyncIterable<{ readonly name: Uint8Array }>> => {
  const directory = await opendir(hostPath, { encoding: 'buffer' as BufferEncoding });

  return directory as unknown as AsyncIterable<{ readonly name: Uint8Array }>;
};

const getParentPaths = (logicalPath: IRepositoryPath): IRepositoryPath[] => {
  const segments = logicalPath.slice(1).split('/');
  const parents: IRepositoryPath[] = [REPOSITORY_ROOT];

  for (let index = 1; index < segments.length; index += 1) {
    parents.push(parseRepositoryPath(`/${segments.slice(0, index).join('/')}`));
  }

  return parents;
};

/** Locates the first sorted repository path strictly after one path. */
const findFirstPathAfter = (
  paths: readonly IRepositoryPath[],
  logicalPath: IRepositoryPath,
): number => {
  let lowerIndex = 0;
  let upperIndex = paths.length;

  while (lowerIndex < upperIndex) {
    const middleIndex = lowerIndex + Math.floor((upperIndex - lowerIndex) / 2);
    const middlePath = paths[middleIndex];

    if (middlePath !== undefined && compareRepositoryPaths(middlePath, logicalPath) <= 0) {
      lowerIndex = middleIndex + 1;
    } else {
      upperIndex = middleIndex;
    }
  }

  return lowerIndex;
};

/** Locates one exact name in a deterministically sorted directory listing. */
const findSortedName = (names: readonly string[], target: string): number => {
  let lowerIndex = 0;
  let upperIndex = names.length;

  while (lowerIndex < upperIndex) {
    const middleIndex = lowerIndex + Math.floor((upperIndex - lowerIndex) / 2);
    const middleName = names[middleIndex];

    if (middleName !== undefined && middleName < target) {
      lowerIndex = middleIndex + 1;
    } else {
      upperIndex = middleIndex;
    }
  }

  return names[lowerIndex] === target ? lowerIndex : -1;
};

class OperationGate {
  readonly #limits: IFilesystemRepositoryResourceLimits;

  #active = 0;

  readonly #waiters: (() => void)[] = [];

  public constructor(limits: IFilesystemRepositoryResourceLimits) {
    this.#limits = limits;
  }

  /** Runs one operation while enforcing fixed active and queued work bounds. */
  public async run<T>(
    operation: IRepositoryOperation,
    logicalPath: IRepositoryPath,
    signal: AbortSignal | undefined,
    callback: () => Promise<T>,
  ): Promise<T> {
    await this.#acquire(operation, logicalPath, signal);

    try {
      throwIfAborted(signal, operation, logicalPath);

      return await callback();
    } finally {
      this.#active -= 1;
      this.#waiters.shift()?.();
    }
  }

  async #acquire(
    operation: IRepositoryOperation,
    logicalPath: IRepositoryPath,
    signal: AbortSignal | undefined,
  ): Promise<void> {
    throwIfAborted(signal, operation, logicalPath);

    if (this.#active < this.#limits.maxConcurrentOperations) {
      this.#active += 1;
      return;
    }

    if (this.#waiters.length >= this.#limits.maxQueuedOperations) {
      throwSource('RESOURCE_LIMIT_EXCEEDED', operation, logicalPath, true, undefined, {
        dimension: 'queuedOperations',
        limit: this.#limits.maxQueuedOperations,
        observed: this.#waiters.length + 1,
      });
    }

    await new Promise<void>((resolve, reject) => {
      let isSettled = false;
      const resume = (): void => {
        if (isSettled) {
          return;
        }

        isSettled = true;
        signal?.removeEventListener('abort', abort);
        this.#active += 1;
        resolve();
      };
      const abort = (): void => {
        if (isSettled) {
          return;
        }

        isSettled = true;
        const index = this.#waiters.indexOf(resume);

        if (index >= 0) {
          this.#waiters.splice(index, 1);
        }

        reject(
          new RepositorySourceException({
            cause: signal?.reason,
            code: 'ABORTED',
            operation,
            path: logicalPath,
            retryable: false,
          }),
        );
      };

      this.#waiters.push(resume);
      signal?.addEventListener('abort', abort, { once: true });
    });
  }
}

class FilesystemRepositoryReader implements IRepositoryReader {
  public readonly snapshot: IRepositorySnapshot;

  readonly #cache = new Map<string, ICachedFilePage>();

  #cachedBytes = 0;

  readonly #cursorKey = randomBytes(32);

  readonly #gate: OperationGate;

  readonly #limits: IFilesystemRepositoryResourceLimits;

  readonly #observations = new Map<IRepositoryPath, string>();

  readonly #rootDirectory: string;

  readonly #selection: IFilesystemRepositorySelection;

  readonly #selectedPaths: readonly IRepositoryPath[];

  public constructor(
    options: INormalizedFilesystemRepositoryReaderOptions,
    rootDirectory: string,
    rootIdentity: string,
  ) {
    this.#limits = options.limits;
    this.#rootDirectory = rootDirectory;
    this.#selection = options.selection;
    this.#gate = new OperationGate(options.limits);
    this.snapshot = Object.freeze({
      id: hashParts([rootIdentity, randomBytes(32)]),
      sourceKind: 'filesystem',
    });
    this.#observations.set(REPOSITORY_ROOT, rootIdentity);
    this.#selectedPaths =
      options.selection.kind === 'paths'
        ? this.#createVisibleSelectedPaths(options.selection.paths)
        : [];
  }

  /** Completes bounded initialization for exact-path selections. */
  public async initialize(signal: AbortSignal | undefined): Promise<void> {
    if (this.#selection.kind !== 'paths') {
      return;
    }

    for (const logicalPath of this.#selectedPaths) {
      throwIfAborted(signal, 'create-reader', logicalPath);
      const entry = await this.#observeEntry(logicalPath, 'create-reader');

      if (entry === null) {
        return throwSource('ENTRY_NOT_FOUND', 'create-reader', logicalPath, true);
      }

      if (
        logicalPath !== REPOSITORY_ROOT &&
        !this.#selection.paths.includes(logicalPath) &&
        entry.type !== 'directory'
      ) {
        throwSource('ENTRY_NOT_DIRECTORY', 'create-reader', logicalPath, false);
      }
    }
  }

  public async compare(
    candidate: IRepositoryReader,
    options?: IRepositoryOperationOptions,
  ): Promise<IRepositoryComparison> {
    return createRepositoryComparison(this, candidate, options);
  }

  public async getEntry(
    logicalPath: IRepositoryPath,
    options?: IRepositoryOperationOptions,
  ): Promise<IRepositoryEntry | null> {
    const parsedPath = parseRepositoryPath(logicalPath);

    if (!this.#isVisible(parsedPath)) {
      return null;
    }

    return this.#gate.run('get-entry', parsedPath, options?.signal, () =>
      this.#observeEntry(parsedPath, 'get-entry'),
    );
  }

  public async listEntriesPage(
    options: IRepositoryEntryPageOptions,
  ): Promise<IRepositoryEntryPage> {
    const prefix =
      options.prefix === undefined ? REPOSITORY_ROOT : parseRepositoryPath(options.prefix);

    return this.#gate.run('list-entries-page', prefix, options.signal, async () => {
      const maxEntries = this.#parseBoundedPositiveInteger(
        options.maxEntries,
        this.#limits.maxPageEntries,
        'pageEntries',
        'list-entries-page',
        prefix,
      );
      const prefixEntry = await this.#observeEntry(prefix, 'list-entries-page');

      if (prefixEntry === null || !this.#isVisible(prefix)) {
        return throwSource('ENTRY_NOT_FOUND', 'list-entries-page', prefix, false);
      }

      if (prefixEntry.type !== 'directory') {
        throwSource('ENTRY_NOT_DIRECTORY', 'list-entries-page', prefix, false);
      }

      return this.#selection.kind === 'paths'
        ? this.#listSelectedEntries(prefix, maxEntries, options.cursor)
        : this.#listDirectoryEntries(prefix, maxEntries, options.cursor, options.signal);
    });
  }

  public async readFilePage(
    logicalPath: IRepositoryPath,
    options: IRepositoryFilePageOptions,
  ): Promise<IRepositoryFilePage> {
    const parsedPath = parseRepositoryPath(logicalPath);

    return this.#gate.run('read-file-page', parsedPath, options.signal, async () => {
      const offset = this.#parseOffset(options.offset, parsedPath);
      const maxBytes = this.#parseBoundedPositiveInteger(
        options.maxBytes,
        this.#limits.maxReadBytes,
        'readBytes',
        'read-file-page',
        parsedPath,
      );

      if (!this.#isVisible(parsedPath)) {
        throwSource('ENTRY_NOT_FOUND', 'read-file-page', parsedPath, false);
      }

      const entry = await this.#observeEntry(parsedPath, 'read-file-page');

      if (entry === null) {
        return throwSource('ENTRY_NOT_FOUND', 'read-file-page', parsedPath, false);
      }

      if (entry.type !== 'file' || entry.byteLength === null) {
        return throwSource('ENTRY_NOT_FILE', 'read-file-page', parsedPath, false);
      }

      const entryIdentity = this.#observations.get(parsedPath);

      if (entryIdentity === undefined) {
        return throwSource('INVALID_SOURCE_DATA', 'read-file-page', parsedPath, false);
      }

      if (offset > entry.byteLength) {
        throwSource('INVALID_PAGE_REQUEST', 'read-file-page', parsedPath, false);
      }

      const bytesToRead = Math.min(maxBytes, entry.byteLength - offset);
      const cacheKey = `${parsedPath}\0${offset}\0${bytesToRead}`;
      const cached = this.#cache.get(cacheKey);

      if (cached !== undefined && cached.entryIdentity === entryIdentity) {
        this.#cache.delete(cacheKey);
        this.#cache.set(cacheKey, cached);

        return this.#createFilePage(cached.bytes.slice(), entry.byteLength, offset);
      }

      const bytes = await this.#readExactRange(
        parsedPath,
        entryIdentity,
        offset,
        bytesToRead,
        options.signal,
      );
      this.#cachePage(cacheKey, bytes, entryIdentity);

      return this.#createFilePage(bytes.slice(), entry.byteLength, offset);
    });
  }

  #cachePage(cacheKey: string, bytes: Uint8Array, entryIdentity: string): void {
    if (bytes.byteLength > this.#limits.maxCachedBytes) {
      return;
    }

    while (this.#cachedBytes + bytes.byteLength > this.#limits.maxCachedBytes) {
      const oldestKey = this.#cache.keys().next().value;

      if (oldestKey === undefined) {
        break;
      }

      const oldest = this.#cache.get(oldestKey);
      this.#cache.delete(oldestKey);
      this.#cachedBytes -= oldest?.bytes.byteLength ?? 0;
    }

    this.#cache.set(cacheKey, { bytes: bytes.slice(), entryIdentity });
    this.#cachedBytes += bytes.byteLength;
  }

  #createFilePage(bytes: Uint8Array, totalBytes: number, offset: number): IRepositoryFilePage {
    const nextOffset = offset + bytes.byteLength;
    const isComplete = nextOffset === totalBytes;

    return {
      bytes,
      isComplete,
      nextOffset: isComplete ? null : nextOffset,
      offset,
      snapshot: this.snapshot,
      totalBytes,
    };
  }

  #createVisibleSelectedPaths(
    selectedPaths: readonly IRepositoryPath[],
  ): readonly IRepositoryPath[] {
    const visiblePaths = new Set<IRepositoryPath>([REPOSITORY_ROOT]);

    for (const selectedPath of selectedPaths) {
      visiblePaths.add(selectedPath);

      for (const parentPath of getParentPaths(selectedPath)) {
        visiblePaths.add(parentPath);
      }
    }

    if (visiblePaths.size - 1 > this.#limits.maxEntries) {
      throwSource('RESOURCE_LIMIT_EXCEEDED', 'create-reader', null, false, undefined, {
        dimension: 'selectedEntries',
        limit: this.#limits.maxEntries,
        observed: visiblePaths.size - 1,
      });
    }

    return Object.freeze([...visiblePaths].sort(compareRepositoryPaths));
  }

  #decodeCursor(cursor: string, prefix: IRepositoryPath): IFilesystemCursor {
    try {
      if (Buffer.byteLength(cursor, 'utf8') > MAX_CURSOR_BYTES) {
        throw new Error('cursor exceeds the encoded limit');
      }

      const separatorIndex = cursor.lastIndexOf('.');

      if (separatorIndex <= 0) {
        throw new Error('cursor signature is missing');
      }

      const encodedPayload = cursor.slice(0, separatorIndex);
      const encodedSignature = cursor.slice(separatorIndex + 1);
      const suppliedSignature = Buffer.from(encodedSignature, 'base64url');
      const expectedSignature = createHmac('sha256', this.#cursorKey)
        .update(encodedPayload)
        .digest();

      if (
        suppliedSignature.toString('base64url') !== encodedSignature ||
        suppliedSignature.byteLength !== expectedSignature.byteLength ||
        !timingSafeEqual(suppliedSignature, expectedSignature)
      ) {
        throw new Error('cursor signature does not match');
      }

      const parsed: unknown = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));

      if (
        !isRecord(parsed) ||
        parsed['version'] !== 1 ||
        parsed['snapshotId'] !== this.snapshot.id ||
        parsed['prefix'] !== prefix
      ) {
        throw new Error('cursor belongs to another snapshot or prefix');
      }

      if (parsed['kind'] === 'paths' && hasOnlyKeys(parsed, PATH_CURSOR_KEYS)) {
        const lastPath = parseRepositoryPath(parsed['lastPath'] as string);
        const descendantPrefix = prefix === REPOSITORY_ROOT ? REPOSITORY_ROOT : `${prefix}/`;

        if (lastPath === prefix || !lastPath.startsWith(descendantPrefix)) {
          throw new Error('cursor path is outside the requested prefix');
        }

        return {
          kind: 'paths',
          lastPath,
          prefix,
          snapshotId: this.snapshot.id,
          version: 1,
        };
      }

      if (
        parsed['kind'] === 'directory' &&
        hasOnlyKeys(parsed, DIRECTORY_CURSOR_KEYS) &&
        Array.isArray(parsed['frames'])
      ) {
        const frames = parsed['frames'].map((candidate): ICursorFrame => {
          if (
            !isRecord(candidate) ||
            !hasOnlyKeys(candidate, CURSOR_FRAME_KEYS) ||
            (typeof candidate['lastName'] !== 'string' && candidate['lastName'] !== null) ||
            typeof candidate['namesIdentity'] !== 'string' ||
            typeof candidate['path'] !== 'string' ||
            typeof candidate['pathIdentity'] !== 'string'
          ) {
            throw new Error('cursor frame is invalid');
          }

          return {
            lastName: candidate['lastName'],
            namesIdentity: candidate['namesIdentity'],
            path: parseRepositoryPath(candidate['path']),
            pathIdentity: candidate['pathIdentity'],
          };
        });

        return {
          frames,
          kind: 'directory',
          prefix,
          snapshotId: this.snapshot.id,
          version: 1,
        };
      }

      throw new Error('cursor payload is invalid');
    } catch (cause) {
      return throwSource('INVALID_PAGE_REQUEST', 'list-entries-page', prefix, false, cause);
    }
  }

  #encodeCursor(cursor: IFilesystemCursor): string {
    const encodedPayload = Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
    const signature = createHmac('sha256', this.#cursorKey)
      .update(encodedPayload)
      .digest('base64url');
    const encodedCursor = `${encodedPayload}.${signature}`;

    if (Buffer.byteLength(encodedCursor, 'utf8') > MAX_CURSOR_BYTES) {
      throwSource('RESOURCE_LIMIT_EXCEEDED', 'list-entries-page', cursor.prefix, false, undefined, {
        dimension: 'cursorBytes',
        limit: MAX_CURSOR_BYTES,
        observed: Buffer.byteLength(encodedCursor, 'utf8'),
      });
    }

    return encodedCursor;
  }

  #getHostPath(logicalPath: IRepositoryPath): string {
    if (logicalPath === REPOSITORY_ROOT) {
      return this.#rootDirectory;
    }

    const hostPath = path.resolve(this.#rootDirectory, ...logicalPath.slice(1).split('/'));
    const relativePath = path.relative(this.#rootDirectory, hostPath);

    if (
      relativePath === '' ||
      relativePath === '..' ||
      relativePath.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativePath)
    ) {
      throwSource('INVALID_SOURCE_DATA', 'get-entry', logicalPath, false);
    }

    return hostPath;
  }

  #isVisible(logicalPath: IRepositoryPath): boolean {
    return this.#selection.kind === 'directory' || this.#selectedPaths.includes(logicalPath);
  }

  async #listDirectoryEntries(
    prefix: IRepositoryPath,
    maxEntries: number,
    encodedCursor: string | undefined,
    signal: AbortSignal | undefined,
  ): Promise<IRepositoryEntryPage> {
    let frames: IRuntimeCursorFrame[];

    if (encodedCursor === undefined) {
      frames = [await this.#createDirectoryFrame(prefix, null, 'list-entries-page')];
    } else {
      const cursor = this.#decodeCursor(encodedCursor, prefix);

      if (cursor.kind !== 'directory' || cursor.frames.length === 0) {
        return throwSource('INVALID_PAGE_REQUEST', 'list-entries-page', prefix, false);
      }

      frames = [];

      for (const frame of cursor.frames) {
        frames.push(await this.#restoreDirectoryFrame(frame));
      }
    }

    const entries: IRepositoryEntry[] = [];

    while (frames.length > 0 && entries.length < maxEntries) {
      throwIfAborted(signal, 'list-entries-page', prefix);
      const frame = frames.at(-1);

      if (frame === undefined) {
        break;
      }

      if (frame.nextIndex >= frame.names.length) {
        frames.pop();
        continue;
      }

      const name = frame.names[frame.nextIndex];

      if (name === undefined) {
        return throwSource('INVALID_SOURCE_DATA', 'list-entries-page', frame.path, false);
      }

      frames[frames.length - 1] = {
        ...frame,
        lastName: name,
        nextIndex: frame.nextIndex + 1,
      };
      const childPath = parseRepositoryPath(
        frame.path === REPOSITORY_ROOT ? `/${name}` : `${frame.path}/${name}`,
      );
      const entry = await this.#observeEntry(childPath, 'list-entries-page');

      if (entry === null) {
        return throwSource('SNAPSHOT_CHANGED', 'list-entries-page', childPath, true);
      }

      entries.push(entry);

      if (entry.type === 'directory') {
        frames.push(await this.#createDirectoryFrame(childPath, null, 'list-entries-page'));
      }
    }

    const isComplete = frames.length === 0;

    return {
      entries,
      isComplete,
      nextCursor: isComplete
        ? null
        : this.#encodeCursor({
            frames: frames.map(({ lastName, namesIdentity, path: framePath, pathIdentity }) => ({
              lastName,
              namesIdentity,
              path: framePath,
              pathIdentity,
            })),
            kind: 'directory',
            prefix,
            snapshotId: this.snapshot.id,
            version: 1,
          }),
      snapshot: this.snapshot,
    };
  }

  async #listSelectedEntries(
    prefix: IRepositoryPath,
    maxEntries: number,
    encodedCursor: string | undefined,
  ): Promise<IRepositoryEntryPage> {
    let lastPath: IRepositoryPath | null = null;

    if (encodedCursor !== undefined) {
      const cursor = this.#decodeCursor(encodedCursor, prefix);

      if (cursor.kind !== 'paths' || !this.#selectedPaths.includes(cursor.lastPath)) {
        return throwSource('INVALID_PAGE_REQUEST', 'list-entries-page', prefix, false);
      }

      lastPath = cursor.lastPath;
    }

    const descendantPrefix = prefix === REPOSITORY_ROOT ? REPOSITORY_ROOT : `${prefix}/`;
    let pathIndex = findFirstPathAfter(this.#selectedPaths, lastPath ?? prefix);
    const entries: IRepositoryEntry[] = [];

    while (entries.length < maxEntries) {
      const logicalPath = this.#selectedPaths[pathIndex];

      if (logicalPath === undefined || !logicalPath.startsWith(descendantPrefix)) {
        break;
      }

      const entry = await this.#observeEntry(logicalPath, 'list-entries-page');

      if (entry === null) {
        return throwSource('SNAPSHOT_CHANGED', 'list-entries-page', logicalPath, true);
      }

      entries.push(entry);
      pathIndex += 1;
    }

    const nextPath = this.#selectedPaths[pathIndex];
    const isComplete = nextPath === undefined || !nextPath.startsWith(descendantPrefix);
    const finalEntry = entries.at(-1);

    if (!isComplete && finalEntry === undefined) {
      return throwSource('INVALID_SOURCE_DATA', 'list-entries-page', prefix, false);
    }

    return {
      entries,
      isComplete,
      nextCursor: isComplete
        ? null
        : this.#encodeCursor({
            kind: 'paths',
            lastPath: finalEntry?.path ?? prefix,
            prefix,
            snapshotId: this.snapshot.id,
            version: 1,
          }),
      snapshot: this.snapshot,
    };
  }

  #parseBoundedPositiveInteger(
    candidate: number,
    limit: number,
    dimension: string,
    operation: IRepositoryOperation,
    logicalPath: IRepositoryPath,
  ): number {
    if (!Number.isSafeInteger(candidate) || candidate <= 0) {
      throwSource('INVALID_PAGE_REQUEST', operation, logicalPath, false);
    }

    if (candidate > limit) {
      throwSource('RESOURCE_LIMIT_EXCEEDED', operation, logicalPath, false, undefined, {
        dimension,
        limit,
        observed: candidate,
      });
    }

    return candidate;
  }

  #parseOffset(candidate: number, logicalPath: IRepositoryPath): number {
    if (!Number.isSafeInteger(candidate) || candidate < 0) {
      throwSource('INVALID_PAGE_REQUEST', 'read-file-page', logicalPath, false);
    }

    return candidate;
  }

  async #createDirectoryFrame(
    logicalPath: IRepositoryPath,
    lastName: string | null,
    operation: IRepositoryOperation,
  ): Promise<IRuntimeCursorFrame> {
    const entry = await this.#observeEntry(logicalPath, operation);

    if (entry === null || entry.type !== 'directory') {
      throwSource('SNAPSHOT_CHANGED', operation, logicalPath, true);
    }

    const names = await this.#readDirectoryNames(logicalPath, operation);
    const nextIndex = lastName === null ? 0 : findSortedName(names, lastName) + 1;

    if (nextIndex === 0 && lastName !== null) {
      throwSource('SNAPSHOT_CHANGED', operation, logicalPath, true);
    }

    return {
      lastName,
      names,
      namesIdentity: hashParts(names),
      nextIndex,
      path: logicalPath,
      pathIdentity: this.#observations.get(logicalPath) ?? '',
    };
  }

  async #restoreDirectoryFrame(frame: ICursorFrame): Promise<IRuntimeCursorFrame> {
    const restored = await this.#createDirectoryFrame(
      parseRepositoryPath(frame.path),
      frame.lastName,
      'list-entries-page',
    );

    if (
      restored.pathIdentity !== frame.pathIdentity ||
      restored.namesIdentity !== frame.namesIdentity
    ) {
      throwSource('SNAPSHOT_CHANGED', 'list-entries-page', frame.path, true);
    }

    return restored;
  }

  async #readDirectoryNames(
    logicalPath: IRepositoryPath,
    operation: IRepositoryOperation,
  ): Promise<readonly string[]> {
    try {
      const directory = await openBufferDirectory(this.#getHostPath(logicalPath));
      const names: string[] = [];
      let observedEntries = 0;

      for await (const directoryEntry of directory) {
        observedEntries += 1;

        if (observedEntries > this.#limits.maxDirectoryEntries) {
          throwSource('RESOURCE_LIMIT_EXCEEDED', operation, logicalPath, false, undefined, {
            dimension: 'directoryEntries',
            limit: this.#limits.maxDirectoryEntries,
            observed: observedEntries,
          });
        }

        const name = decodeName(directoryEntry.name, operation, logicalPath);

        if (name !== '.git') {
          names.push(name);
        }
      }

      return names.sort();
    } catch (cause) {
      if (cause instanceof RepositorySourceException) {
        throw cause;
      }

      return throwMappedHostError(cause, operation, logicalPath);
    }
  }

  async #observeEntry(
    logicalPath: IRepositoryPath,
    operation: IRepositoryOperation,
  ): Promise<IRepositoryEntry | null> {
    let statistics: BigIntStats;

    try {
      statistics = await lstat(this.#getHostPath(logicalPath), { bigint: true });
    } catch (cause) {
      const errorCode = getErrorCode(cause);

      if (
        !this.#observations.has(logicalPath) &&
        (errorCode === 'ENOENT' || errorCode === 'ENOTDIR')
      ) {
        return null;
      }

      return throwMappedHostError(cause, operation, logicalPath);
    }

    const type = classifyStatistics(statistics, operation, logicalPath);
    const identity = getStatisticsIdentity(statistics, type);
    const previousIdentity = this.#observations.get(logicalPath);

    if (previousIdentity !== undefined && previousIdentity !== identity) {
      throwSource('SNAPSHOT_CHANGED', operation, logicalPath, true);
    }

    if (previousIdentity === undefined) {
      if (this.#observations.size - 1 >= this.#limits.maxEntries) {
        throwSource('RESOURCE_LIMIT_EXCEEDED', operation, logicalPath, false, undefined, {
          dimension: 'observedEntries',
          limit: this.#limits.maxEntries,
          observed: this.#observations.size,
        });
      }

      this.#observations.set(logicalPath, identity);
    }

    return {
      byteLength: type === 'file' ? Number(statistics.size) : null,
      contentIdentity: null,
      path: logicalPath,
      type,
    };
  }

  async #readExactRange(
    logicalPath: IRepositoryPath,
    entryIdentity: string,
    offset: number,
    bytesToRead: number,
    signal: AbortSignal | undefined,
  ): Promise<Uint8Array> {
    let handle: FileHandle | undefined;

    try {
      const noFollow = 'O_NOFOLLOW' in constants ? constants.O_NOFOLLOW : 0;
      handle = await open(this.#getHostPath(logicalPath), constants.O_RDONLY | noFollow);
      const before = await handle.stat({ bigint: true });

      if (
        getStatisticsIdentity(before, classifyStatistics(before, 'read-file-page', logicalPath)) !==
        entryIdentity
      ) {
        throwSource('SNAPSHOT_CHANGED', 'read-file-page', logicalPath, true);
      }

      const bytes = new Uint8Array(bytesToRead);
      let totalRead = 0;

      while (totalRead < bytesToRead) {
        throwIfAborted(signal, 'read-file-page', logicalPath);
        const result = await handle.read(
          bytes,
          totalRead,
          bytesToRead - totalRead,
          offset + totalRead,
        );

        if (result.bytesRead === 0) {
          throwSource('SNAPSHOT_CHANGED', 'read-file-page', logicalPath, true);
        }

        totalRead += result.bytesRead;
      }

      const after = await handle.stat({ bigint: true });

      if (
        getStatisticsIdentity(after, classifyStatistics(after, 'read-file-page', logicalPath)) !==
        entryIdentity
      ) {
        throwSource('SNAPSHOT_CHANGED', 'read-file-page', logicalPath, true);
      }

      await this.#observeEntry(logicalPath, 'read-file-page');

      return bytes;
    } catch (cause) {
      if (cause instanceof RepositorySourceException) {
        throw cause;
      }

      return throwMappedHostError(cause, 'read-file-page', logicalPath);
    } finally {
      await handle?.close().catch(() => undefined);
    }
  }
}

const prepareRoot = async (
  options: INormalizedFilesystemRepositoryReaderOptions,
): Promise<{ readonly identity: string; readonly rootDirectory: string }> => {
  throwIfAborted(options.signal, 'create-reader', null);

  try {
    const rootDirectory = await realpath(options.rootDirectory);
    const statistics = await lstat(rootDirectory, { bigint: true });

    if (!statistics.isDirectory()) {
      throwSource('ENTRY_NOT_DIRECTORY', 'create-reader', null, false);
    }

    return {
      identity: getStatisticsIdentity(statistics, 'directory'),
      rootDirectory,
    };
  } catch (cause) {
    if (cause instanceof RepositorySourceException) {
      throw cause;
    }

    return throwMappedHostError(cause, 'create-reader', null);
  }
};

/**
 * Creates a bounded read-only filesystem reader over one explicit host root.
 * @param rawOptions The untrusted root, selection, limits, and creation signal.
 * @returns A reader that exposes deterministic pages and bounded file ranges.
 * @throws
 * - ABORTED: The repository operation was aborted.
 * - ACCESS_DENIED: Access to the repository source was denied.
 * - ENTRY_NOT_DIRECTORY: The requested repository entry is not a directory.
 * - ENTRY_NOT_FOUND: The requested repository entry was not found.
 * - INVALID_REPOSITORY_PATH: The repository path is invalid.
 * - INVALID_SOURCE_DATA: The repository source returned invalid data.
 * - RESOURCE_LIMIT_EXCEEDED: A named repository resource limit was exceeded.
 * - SNAPSHOT_CHANGED: The repository snapshot changed during the operation.
 * - SOURCE_UNAVAILABLE: The repository source is unavailable.
 */
export const createFilesystemRepositoryReader = async (
  rawOptions: IFilesystemRepositoryReaderOptions,
): Promise<IRepositoryReader> => {
  const options = normalizeFilesystemRepositoryOptions(rawOptions);
  const root = await prepareRoot(options);
  const reader = new FilesystemRepositoryReader(options, root.rootDirectory, root.identity);

  await reader.initialize(options.signal);
  throwIfAborted(options.signal, 'create-reader', null);

  return Object.freeze(reader);
};

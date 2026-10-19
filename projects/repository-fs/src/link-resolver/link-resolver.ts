import { createHmac, randomBytes } from 'node:crypto';
import { constants } from 'node:fs';
import type { BigIntStats } from 'node:fs';
import { lstat, open, readlink } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import path from 'node:path';
import { TextDecoder } from 'node:util';

import {
  RepositorySourceException,
  parseRepositoryPath,
  type IRepositoryFilePage,
  type IRepositoryFilePageOptions,
  type IRepositoryLinkResolution,
  type IRepositoryLinkResolver,
  type IRepositoryLinkTargetType,
  type IRepositoryOperation,
  type IRepositoryOperationOptions,
  type IRepositoryPath,
  type IRepositoryReader,
  type IRepositorySnapshot,
  type IRepositorySourceErrorCode,
} from '@moldea.ai/repository';

import { getFilesystemLinkHost, type IFilesystemLinkHost } from '../reader/index.js';

import { MAX_LINK_HOPS } from './constants.js';
import type { ILinkRefusedState, ILinkWalkOutcome } from './types.js';
import {
  getContainedLogicalPath,
  getLexicalLinkCandidate,
  getLinkWalkStart,
  isRefusedLinkPath,
  stripLocalLongPathPrefix,
} from './utilities.js';

const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

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
): never => {
  throw new RepositorySourceException({ cause, code, operation, path: logicalPath, retryable });
};

const throwIfAborted = (
  signal: AbortSignal | undefined,
  operation: IRepositoryOperation,
  logicalPath: IRepositoryPath,
): void => {
  if (signal?.aborted) {
    throwSource('ABORTED', operation, logicalPath, false, signal.reason);
  }
};

const refuse = (state: ILinkRefusedState): ILinkWalkOutcome => ({ kind: 'refused', state });

// filesystem failures that classify a chain rather than failing the operation
const getRefusedState = (cause: unknown): ILinkRefusedState | undefined => {
  switch (getErrorCode(cause)) {
    case 'ENOENT':
    case 'ENOTDIR':
      return 'broken';
    case 'EACCES':
    case 'EPERM':
      return 'denied';
    case 'ELOOP':
      return 'loop';
    case 'ENAMETOOLONG':
      return 'unsafe';
    default:
      return undefined;
  }
};

const getTargetType = (statistics: BigIntStats): IRepositoryLinkTargetType => {
  if (statistics.isFile()) {
    return 'file';
  }

  return statistics.isDirectory() ? 'directory' : 'other';
};

class FilesystemRepositoryLinkResolver implements IRepositoryLinkResolver {
  public readonly snapshot: IRepositorySnapshot;

  readonly #host: IFilesystemLinkHost;

  readonly #identityKey = randomBytes(32);

  readonly #recordedOutcomes = new Map<IRepositoryPath, string>();

  public constructor(host: IFilesystemLinkHost) {
    this.#host = host;
    this.snapshot = host.snapshot;
  }

  public async resolveLink(
    logicalPath: IRepositoryPath,
    options?: IRepositoryOperationOptions,
  ): Promise<IRepositoryLinkResolution> {
    const parsedPath = parseRepositoryPath(logicalPath);

    return this.#host.run('get-entry', parsedPath, options?.signal, async () => {
      const outcome = await this.#resolve(parsedPath, 'get-entry', options?.signal);

      return outcome === null ? { state: 'not-link' } : this.#toResolution(outcome);
    });
  }

  public async readLinkTargetPage(
    logicalPath: IRepositoryPath,
    options: IRepositoryFilePageOptions,
  ): Promise<IRepositoryFilePage> {
    const parsedPath = parseRepositoryPath(logicalPath);

    return this.#host.run('read-file-page', parsedPath, options.signal, async () => {
      const { maxBytes, offset } = this.#host.parseFilePageOptions(options, parsedPath);
      const outcome = await this.#resolve(parsedPath, 'read-file-page', options.signal);

      if (
        outcome?.kind !== 'target' ||
        !outcome.statistics.isFile() ||
        this.#toResolution(outcome).state === 'unsafe'
      ) {
        return throwSource('ENTRY_NOT_FILE', 'read-file-page', parsedPath, false);
      }

      const totalBytes = Number(outcome.statistics.size);

      if (offset > totalBytes) {
        throwSource('INVALID_PAGE_REQUEST', 'read-file-page', parsedPath, false);
      }

      const bytes = await this.#readTargetRange(
        outcome.hostPath,
        this.#host.identifyStatistics(outcome.statistics, 'file'),
        offset,
        Math.min(maxBytes, totalBytes - offset),
        parsedPath,
        options.signal,
      );

      // a second resolution proves the link still reaches the target that was read
      await this.#resolve(parsedPath, 'read-file-page', options.signal);
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
    });
  }

  /** Observes one named entry and walks its chain, or returns `null` for a non-link entry. */
  async #resolve(
    logicalPath: IRepositoryPath,
    operation: IRepositoryOperation,
    signal: AbortSignal | undefined,
  ): Promise<ILinkWalkOutcome | null> {
    const entry = await this.#host.observeEntry(logicalPath, operation, signal);

    if (entry === null) {
      return throwSource('ENTRY_NOT_FOUND', operation, logicalPath, false);
    }

    if (entry.type !== 'symlink') {
      return null;
    }

    const outcome = await this.#walk(
      this.#host.getHostPath(logicalPath),
      operation,
      logicalPath,
      signal,
    );

    await this.#host.assertRootUnchanged(operation, logicalPath);
    await this.#host.observeEntry(logicalPath, operation, signal);
    this.#record(logicalPath, outcome, operation);

    return outcome;
  }

  /** Fails when a chain resolves differently from its earlier observation in this snapshot. */
  #record(
    logicalPath: IRepositoryPath,
    outcome: ILinkWalkOutcome,
    operation: IRepositoryOperation,
  ): void {
    const fingerprint =
      outcome.kind === 'refused'
        ? outcome.state
        : this.#host.identifyStatistics(outcome.statistics, getTargetType(outcome.statistics));
    const previous = this.#recordedOutcomes.get(logicalPath);

    if (previous !== undefined && previous !== fingerprint) {
      throwSource('SNAPSHOT_CHANGED', operation, logicalPath, true);
    }

    this.#recordedOutcomes.set(logicalPath, fingerprint);
  }

  #toResolution(outcome: ILinkWalkOutcome): IRepositoryLinkResolution {
    if (outcome.kind === 'refused') {
      return { state: outcome.state };
    }

    const targetType = getTargetType(outcome.statistics);
    const targetIdentity = createHmac('sha256', this.#identityKey)
      .update(`${outcome.statistics.dev}:${outcome.statistics.ino}`)
      .digest('hex');
    const containedPath = getContainedLogicalPath(path, this.#host.rootDirectory, outcome.hostPath);

    if (containedPath === null) {
      return { state: 'outside', targetIdentity, targetType };
    }

    try {
      return {
        state: 'inside',
        targetIdentity,
        targetPath: parseRepositoryPath(containedPath),
        targetType,
      };
    } catch {
      return { state: 'unsafe' };
    }
  }

  /**
   * Follows one chain a component at a time with the host's own `..` semantics, classifying the
   * raw text, the lexical candidate, and every reached path before any filesystem call on it.
   */
  async #walk(
    linkHostPath: string,
    operation: IRepositoryOperation,
    logicalPath: IRepositoryPath,
    signal: AbortSignal | undefined,
  ): Promise<ILinkWalkOutcome> {
    let current = path.dirname(linkHostPath);
    let pending: string[] = [];
    let nextLink: string | null = linkHostPath;
    let hops = 0;

    for (;;) {
      throwIfAborted(signal, operation, logicalPath);

      if (nextLink !== null) {
        hops += 1;

        if (hops > MAX_LINK_HOPS) {
          return refuse('loop');
        }

        const text = await this.#readLinkText(nextLink, operation, logicalPath);

        if (text.kind === 'refused') {
          return text;
        }

        const linkText = stripLocalLongPathPrefix(text.value);

        if (
          isRefusedLinkPath(text.value) ||
          isRefusedLinkPath(getLexicalLinkCandidate(path, current, linkText))
        ) {
          return refuse('unsafe');
        }

        const start = getLinkWalkStart(path, current, linkText);
        current = start.directory;
        pending = [...start.components, ...pending];
        nextLink = null;
        continue;
      }

      const component = pending.shift();

      if (component === undefined) {
        break;
      }

      if (component === '' || component === '.') {
        continue;
      }

      if (component === '..') {
        current = path.dirname(current);
        continue;
      }

      const candidate = path.join(current, component);

      if (isRefusedLinkPath(candidate)) {
        return refuse('unsafe');
      }

      const statistics = await this.#lstat(candidate, operation, logicalPath);

      if (statistics.kind === 'refused') {
        return statistics;
      }

      if (statistics.value.isSymbolicLink()) {
        nextLink = candidate;
        continue;
      }

      if (pending.length > 0 && !statistics.value.isDirectory()) {
        return refuse('broken');
      }

      current = candidate;
    }

    if (isRefusedLinkPath(current)) {
      return refuse('unsafe');
    }

    const target = await this.#lstat(current, operation, logicalPath);

    if (target.kind === 'refused') {
      return target;
    }

    if (target.value.isSymbolicLink()) {
      return throwSource('SNAPSHOT_CHANGED', operation, logicalPath, true);
    }

    return { hostPath: current, kind: 'target', statistics: target.value };
  }

  async #lstat(
    hostPath: string,
    operation: IRepositoryOperation,
    logicalPath: IRepositoryPath,
  ): Promise<
    | { readonly kind: 'observed'; readonly value: BigIntStats }
    | Extract<ILinkWalkOutcome, { kind: 'refused' }>
  > {
    try {
      return { kind: 'observed', value: await lstat(hostPath, { bigint: true }) };
    } catch (cause) {
      const state = getRefusedState(cause);

      return state === undefined
        ? throwSource('SOURCE_UNAVAILABLE', operation, logicalPath, true, cause)
        : { kind: 'refused', state };
    }
  }

  async #readLinkText(
    hostPath: string,
    operation: IRepositoryOperation,
    logicalPath: IRepositoryPath,
  ): Promise<
    | { readonly kind: 'text'; readonly value: string }
    | Extract<ILinkWalkOutcome, { kind: 'refused' }>
  > {
    let bytes: Buffer;

    try {
      bytes = await readlink(hostPath, { encoding: 'buffer' });
    } catch (cause) {
      const code = getErrorCode(cause);

      if (code === 'EACCES' || code === 'EPERM') {
        return { kind: 'refused', state: 'denied' };
      }

      if (code === 'ENAMETOOLONG') {
        return { kind: 'refused', state: 'unsafe' };
      }

      return code === 'ENOENT' || code === 'ENOTDIR' || code === 'EINVAL'
        ? throwSource('SNAPSHOT_CHANGED', operation, logicalPath, true, cause)
        : throwSource('SOURCE_UNAVAILABLE', operation, logicalPath, true, cause);
    }

    if (bytes.byteLength === 0) {
      return { kind: 'refused', state: 'broken' };
    }

    try {
      return { kind: 'text', value: decoder.decode(bytes) };
    } catch {
      return { kind: 'refused', state: 'unsafe' };
    }
  }

  /** Reads one range from the final target, proving the opened handle is the recorded target. */
  async #readTargetRange(
    hostPath: string,
    targetIdentity: string,
    offset: number,
    bytesToRead: number,
    logicalPath: IRepositoryPath,
    signal: AbortSignal | undefined,
  ): Promise<Uint8Array> {
    let handle: FileHandle | undefined;

    try {
      const noFollow = 'O_NOFOLLOW' in constants ? constants.O_NOFOLLOW : 0;
      handle = await open(hostPath, constants.O_RDONLY | noFollow);
      const before = await handle.stat({ bigint: true });

      if (!before.isFile() || this.#host.identifyStatistics(before, 'file') !== targetIdentity) {
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

      if (!after.isFile() || this.#host.identifyStatistics(after, 'file') !== targetIdentity) {
        throwSource('SNAPSHOT_CHANGED', 'read-file-page', logicalPath, true);
      }

      return bytes;
    } catch (cause) {
      if (cause instanceof RepositorySourceException) {
        throw cause;
      }

      const code = getErrorCode(cause);

      if (code === 'EACCES' || code === 'EPERM') {
        return throwSource('ACCESS_DENIED', 'read-file-page', logicalPath, true, cause);
      }

      return code === 'ENOENT' || code === 'ENOTDIR' || code === 'ELOOP'
        ? throwSource('SNAPSHOT_CHANGED', 'read-file-page', logicalPath, true, cause)
        : throwSource('SOURCE_UNAVAILABLE', 'read-file-page', logicalPath, true, cause);
    } finally {
      await handle?.close().catch(() => undefined);
    }
  }
}

/**
 * Creates the bounded, content-free link resolver for a reader this package created. It follows
 * only symlink entries a caller names, refuses network and device targets before any access, and
 * never exposes host paths or link text.
 * @param reader A reader returned by `createFilesystemRepositoryReader`.
 * @returns A frozen resolver that shares the reader's snapshot, gate, and limits.
 * @throws
 * - INVALID_SOURCE_DATA: The repository source returned invalid data.
 */
export const createFilesystemRepositoryLinkResolver = (
  reader: IRepositoryReader,
): IRepositoryLinkResolver => {
  const host = getFilesystemLinkHost(reader);

  if (host === undefined) {
    return throwSource('INVALID_SOURCE_DATA', 'create-reader', null, false);
  }

  return Object.freeze(new FilesystemRepositoryLinkResolver(host));
};

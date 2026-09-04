// @vitest-environment node
import { describe, expect, test } from 'vitest';

import {
  RepositorySourceException,
  parseRepositoryPath,
  type IRepositoryEntry,
  type IRepositoryEntryPage,
  type IRepositoryEntryPageOptions,
  type IRepositoryFilePage,
  type IRepositoryFilePageOptions,
  type IRepositoryOperationOptions,
  type IRepositoryPath,
  type IRepositoryReader,
} from '@moldea.ai/repository';
import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';

import { DEFAULT_CORE_RESOURCE_LIMITS } from '../constants/index.js';
import { CoreOperationException } from '../exceptions/index.js';

import { createRepositoryInspectionSession } from './index.js';

const MANIFEST_PATH = parseRepositoryPath('/moldea/moldea.yaml');
const PROJECT_PATH = parseRepositoryPath('/moldea/project.md');
const CONTEXT_PATH = parseRepositoryPath('/moldea/context/shared.md');
const OTHER_PATH = parseRepositoryPath('/moldea/context/other.md');

const createEntry = (
  path: IRepositoryPath,
  type: IRepositoryEntry['type'] = 'file',
): IRepositoryEntry => ({
  byteLength: type === 'file' ? 0 : null,
  contentIdentity: null,
  path,
  type,
});

interface IDeferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (result: T) => void;
}

const createDeferred = <T>(): IDeferred<T> => {
  let resolvePromise!: (result: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });

  return { promise, resolve: resolvePromise };
};

const createEntryIterable = (
  entries: readonly IRepositoryEntry[],
): AsyncIterable<IRepositoryEntry> => ({
  [Symbol.asyncIterator]: () => {
    let index = 0;

    return {
      next: () => {
        const entry = entries[index];

        if (entry === undefined) {
          return Promise.resolve({ done: true, value: undefined });
        }

        index += 1;
        return Promise.resolve({ done: false, value: entry });
      },
    };
  },
});

interface IReaderOverrides {
  readonly getEntry?: IRepositoryReader['getEntry'];
  readonly iterateEntries?: (
    options?: IRepositoryOperationOptions & { readonly prefix?: IRepositoryPath },
  ) => AsyncIterable<IRepositoryEntry>;
  readonly readCompleteFile?: (
    path: IRepositoryPath,
    options?: IRepositoryOperationOptions,
  ) => Promise<Uint8Array>;
}

const createReader = (overrides: IReaderOverrides = {}): IRepositoryReader => {
  const base = createMemoryRepositoryReader([]);
  const iterateEntries = overrides.iterateEntries ?? (() => createEntryIterable([]));
  const readCompleteFile = overrides.readCompleteFile ?? (() => Promise.resolve(new Uint8Array()));

  return Object.freeze({
    snapshot: base.snapshot,
    compare: (candidate: IRepositoryReader, options?: IRepositoryOperationOptions) =>
      base.compare(candidate, options),
    getEntry: overrides.getEntry ?? (() => Promise.resolve(null)),
    listEntriesPage: async (
      options: IRepositoryEntryPageOptions,
    ): Promise<IRepositoryEntryPage> => {
      const entries: IRepositoryEntry[] = [];

      for await (const entry of iterateEntries(options)) {
        entries.push(entry);
      }

      const offset = options.cursor === undefined ? 0 : Number(options.cursor);
      const pageEntries = entries.slice(offset, offset + options.maxEntries);
      const nextOffset = offset + pageEntries.length;
      const isComplete = nextOffset >= entries.length;

      return {
        entries: pageEntries,
        isComplete,
        nextCursor: isComplete ? null : String(nextOffset),
        snapshot: base.snapshot,
      };
    },
    readFilePage: async (
      path: IRepositoryPath,
      options: IRepositoryFilePageOptions,
    ): Promise<IRepositoryFilePage> => {
      const content = await readCompleteFile(path, options);

      if (!(content instanceof Uint8Array)) {
        return {
          bytes: content,
          isComplete: true,
          nextOffset: null,
          offset: options.offset,
          snapshot: base.snapshot,
          totalBytes: 0,
        };
      }

      const bytes = content.subarray(options.offset, options.offset + options.maxBytes);
      const nextOffset = options.offset + bytes.byteLength;
      const isComplete = nextOffset >= content.byteLength;

      return {
        bytes,
        isComplete,
        nextOffset: isComplete ? null : nextOffset,
        offset: options.offset,
        snapshot: base.snapshot,
        totalBytes: content.byteLength,
      };
    },
  });
};

const collectEntries = async (
  entries: AsyncIterable<IRepositoryEntry>,
): Promise<IRepositoryEntry[]> => {
  const collected: IRepositoryEntry[] = [];

  for await (const entry of entries) {
    collected.push(entry);
  }

  return collected;
};

describe('repository inspection session', () => {
  test('rejects an already-aborted inspection before accessing the repository', () => {
    const cancellation = new Error('inspection cancelled');
    const controller = new AbortController();
    controller.abort(cancellation);
    let operationCount = 0;
    const repository = createReader({
      getEntry: () => {
        operationCount += 1;
        return Promise.resolve(null);
      },
    });

    let thrownError: unknown;

    try {
      createRepositoryInspectionSession(
        repository,
        DEFAULT_CORE_RESOURCE_LIMITS,
        controller.signal,
      );
    } catch (error: unknown) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(CoreOperationException);
    expect(thrownError).toMatchObject({
      cause: cancellation,
      code: 'ABORTED',
      operation: 'validate-project',
      retryable: true,
    });
    expect(operationCount).toBe(0);
  });

  test('counts distinct paths once across exact lookups, prefixes, and repeated listings', async () => {
    const listedEntry = createEntry(PROJECT_PATH);
    const repository = createReader({
      getEntry: (path) => Promise.resolve(path === PROJECT_PATH ? listedEntry : null),
      iterateEntries: () => createEntryIterable([listedEntry]),
    });
    const session = createRepositoryInspectionSession(repository, {
      ...DEFAULT_CORE_RESOURCE_LIMITS,
      maxEntries: 2,
    });

    await expect(session.reader.getEntry(PROJECT_PATH)).resolves.toStrictEqual(listedEntry);
    await expect(collectEntries(session.reader.iterateEntries())).resolves.toStrictEqual([
      listedEntry,
    ]);
    await expect(collectEntries(session.reader.iterateEntries())).resolves.toStrictEqual([
      listedEntry,
    ]);
    await expect(session.reader.getEntry(parseRepositoryPath('/missing'))).resolves.toBeNull();
    await expect(
      collectEntries(session.reader.iterateEntries({ prefix: parseRepositoryPath('/moldea') })),
    ).rejects.toMatchObject({
      code: 'RESOURCE_LIMIT_EXCEEDED',
      limit: 'maxEntries',
      operation: 'validate-project',
      retryable: false,
    });
  });

  test('returns detached exact entries and rejects mismatched reader paths', async () => {
    const sourceEntry: {
      byteLength: number | null;
      contentIdentity: string | null;
      path: IRepositoryPath;
      type: IRepositoryEntry['type'];
    } = createEntry(PROJECT_PATH);
    const repository = createReader({
      getEntry: () => Promise.resolve(sourceEntry),
    });
    const session = createRepositoryInspectionSession(repository, DEFAULT_CORE_RESOURCE_LIMITS);
    const result = await session.reader.getEntry(PROJECT_PATH);

    expect(result).toStrictEqual(createEntry(PROJECT_PATH));
    expect(result).not.toBe(sourceEntry);
    sourceEntry.type = 'directory';
    expect(result).toStrictEqual(createEntry(PROJECT_PATH));

    await expect(session.reader.getEntry(CONTEXT_PATH)).rejects.toMatchObject({
      code: 'INVALID_SOURCE_DATA',
      operation: 'get-entry',
      path: PROJECT_PATH,
      retryable: false,
    });
  });

  test.each([
    [
      'an entry outside the requested prefix',
      [createEntry(CONTEXT_PATH), createEntry(PROJECT_PATH)],
      PROJECT_PATH,
    ],
    ['a duplicate entry', [createEntry(CONTEXT_PATH), createEntry(CONTEXT_PATH)], CONTEXT_PATH],
  ] as const)('rejects %s returned by listing', async (_description, candidates, invalidPath) => {
    const repository = createReader({
      iterateEntries: () => createEntryIterable(candidates),
    });
    const session = createRepositoryInspectionSession(repository, DEFAULT_CORE_RESOURCE_LIMITS);

    await expect(
      collectEntries(
        session.reader.iterateEntries({ prefix: parseRepositoryPath('/moldea/context') }),
      ),
    ).rejects.toMatchObject({
      code: 'INVALID_SOURCE_DATA',
      operation: 'list-entries-page',
      path: invalidPath,
      retryable: false,
    });
  });

  test('keeps complete reads uncached and returns a fresh byte array to every caller', async () => {
    const sourceRead = createDeferred<Uint8Array>();
    let readCount = 0;
    const repository = createReader({
      readCompleteFile: () => {
        readCount += 1;
        return sourceRead.promise;
      },
    });
    const session = createRepositoryInspectionSession(repository, {
      ...DEFAULT_CORE_RESOURCE_LIMITS,
      maxEntries: 1,
    });
    const firstRead = session.reader.readCompleteFile(PROJECT_PATH);
    const secondRead = session.reader.readCompleteFile(PROJECT_PATH);

    expect(readCount).toBe(2);
    sourceRead.resolve(Uint8Array.from([1, 2, 3, 4]));

    const [first, second] = await Promise.all([firstRead, secondRead]);
    expect(first).toStrictEqual(Uint8Array.from([1, 2, 3, 4]));
    expect(second).toStrictEqual(Uint8Array.from([1, 2, 3, 4]));
    expect(first).not.toBe(second);

    first[0] = 9;
    const third = await session.reader.readCompleteFile(PROJECT_PATH);

    expect(third).toStrictEqual(Uint8Array.from([1, 2, 3, 4]));
    expect(third).not.toBe(second);
    expect(readCount).toBe(3);
    await expect(session.reader.getEntry(OTHER_PATH)).rejects.toMatchObject({
      code: 'RESOURCE_LIMIT_EXCEEDED',
      limit: 'maxEntries',
    });
  });

  test('isolates caller cancellation between independent in-flight reads', async () => {
    const sourceRead = createDeferred<Uint8Array>();
    const inspectionController = new AbortController();
    const firstController = new AbortController();
    const secondController = new AbortController();
    const cancellation = new Error('first caller stopped');
    let readCount = 0;
    const repository = createReader({
      readCompleteFile: () => {
        readCount += 1;
        return sourceRead.promise;
      },
    });
    const session = createRepositoryInspectionSession(
      repository,
      DEFAULT_CORE_RESOURCE_LIMITS,
      inspectionController.signal,
    );
    const firstRead = session.reader.readCompleteFile(PROJECT_PATH, {
      signal: firstController.signal,
    });
    const secondRead = session.reader.readCompleteFile(PROJECT_PATH, {
      signal: secondController.signal,
    });

    firstController.abort(cancellation);

    await expect(firstRead).rejects.toMatchObject({
      cause: cancellation,
      code: 'ABORTED',
      operation: 'validate-project',
      retryable: true,
    });
    expect(readCount).toBe(2);

    sourceRead.resolve(Uint8Array.from([1, 2]));

    await expect(secondRead).resolves.toStrictEqual(Uint8Array.from([1, 2]));
    await expect(session.reader.readCompleteFile(PROJECT_PATH)).resolves.toStrictEqual(
      Uint8Array.from([1, 2]),
    );
    expect(readCount).toBe(3);
  });

  test('applies the manifest and ordinary file limits before caching source bytes', async () => {
    const sourceBytes = new Uint8Array(3);
    Object.defineProperty(sourceBytes, 'slice', {
      value: () => {
        throw new TypeError('Source bytes were copied before enforcing their file limit.');
      },
    });
    const repository = createReader({ readCompleteFile: () => Promise.resolve(sourceBytes) });
    const limits = {
      ...DEFAULT_CORE_RESOURCE_LIMITS,
      maxFileBytes: 2,
      maxManifestBytes: 2,
    };

    await expect(
      createRepositoryInspectionSession(repository, limits).reader.readCompleteFile(MANIFEST_PATH),
    ).rejects.toMatchObject({
      code: 'RESOURCE_LIMIT_EXCEEDED',
      limit: 'maxManifestBytes',
      operation: 'validate-project',
    });
    await expect(
      createRepositoryInspectionSession(repository, limits).reader.readCompleteFile(PROJECT_PATH),
    ).rejects.toMatchObject({
      code: 'RESOURCE_LIMIT_EXCEEDED',
      limit: 'maxFileBytes',
      operation: 'validate-project',
    });

    const inclusiveRepository = createReader({
      readCompleteFile: () => Promise.resolve(new Uint8Array(2)),
    });
    const inclusiveSession = createRepositoryInspectionSession(inclusiveRepository, limits);

    await expect(inclusiveSession.reader.readCompleteFile(MANIFEST_PATH)).resolves.toHaveLength(2);
    await expect(inclusiveSession.reader.readCompleteFile(PROJECT_PATH)).resolves.toHaveLength(2);
  });

  test('charges every complete file read against the total-byte limit', async () => {
    const contents = new Map<IRepositoryPath, Uint8Array>([
      [PROJECT_PATH, new Uint8Array(2)],
      [CONTEXT_PATH, new Uint8Array(2)],
      [OTHER_PATH, new Uint8Array(1)],
    ]);
    const readCounts = new Map<IRepositoryPath, number>();
    const repository = createReader({
      readCompleteFile: (path) => {
        readCounts.set(path, (readCounts.get(path) ?? 0) + 1);
        return Promise.resolve(contents.get(path) ?? new Uint8Array());
      },
    });
    const session = createRepositoryInspectionSession(repository, {
      ...DEFAULT_CORE_RESOURCE_LIMITS,
      maxFileBytes: 4,
      maxTotalBytesRead: 4,
    });

    await session.reader.readCompleteFile(PROJECT_PATH);
    await session.reader.readCompleteFile(PROJECT_PATH);
    await expect(session.reader.readCompleteFile(CONTEXT_PATH)).rejects.toMatchObject({
      code: 'RESOURCE_LIMIT_EXCEEDED',
      limit: 'maxTotalBytesRead',
      operation: 'validate-project',
      retryable: false,
    });
    expect(readCounts).toStrictEqual(
      new Map<IRepositoryPath, number>([
        [PROJECT_PATH, 2],
        [CONTEXT_PATH, 1],
      ]),
    );
  });

  test('preserves repository source exceptions across independent reads', async () => {
    const sourceFailure = new RepositorySourceException({
      code: 'SOURCE_UNAVAILABLE',
      operation: 'read-file-page',
      path: PROJECT_PATH,
      retryable: true,
    });
    let readCount = 0;
    const repository = createReader({
      readCompleteFile: () => {
        readCount += 1;
        return Promise.reject(sourceFailure);
      },
    });
    const session = createRepositoryInspectionSession(repository, DEFAULT_CORE_RESOURCE_LIMITS);

    await expect(session.reader.readCompleteFile(PROJECT_PATH)).rejects.toBe(sourceFailure);
    await expect(session.reader.readCompleteFile(PROJECT_PATH)).rejects.toBe(sourceFailure);
    expect(readCount).toBe(2);
  });

  test('rejects malformed file content with a repository source exception', async () => {
    const repository = createReader({
      readCompleteFile: () => Promise.resolve('not bytes' as never),
    });
    const session = createRepositoryInspectionSession(repository, DEFAULT_CORE_RESOURCE_LIMITS);

    await expect(session.reader.readCompleteFile(PROJECT_PATH)).rejects.toMatchObject({
      code: 'INVALID_SOURCE_DATA',
      operation: 'read-file-page',
      path: PROJECT_PATH,
      retryable: false,
    });
  });

  test('observes cancellation after an in-flight source read completes', async () => {
    const sourceRead = createDeferred<Uint8Array>();
    const cancellation = new Error('inspection cancelled');
    const controller = new AbortController();
    let forwardedSignal: AbortSignal | undefined;
    const repository = createReader({
      readCompleteFile: (_path, options) => {
        forwardedSignal = options?.signal;
        return sourceRead.promise;
      },
    });
    const session = createRepositoryInspectionSession(
      repository,
      DEFAULT_CORE_RESOURCE_LIMITS,
      controller.signal,
    );
    const result = session.reader.readCompleteFile(PROJECT_PATH);

    expect(forwardedSignal).toBe(controller.signal);
    controller.abort(cancellation);
    sourceRead.resolve(new Uint8Array(2));

    await expect(result).rejects.toMatchObject({
      cause: cancellation,
      code: 'ABORTED',
      operation: 'validate-project',
      retryable: true,
    });
  });

  test('forwards the inspection signal to every source operation', async () => {
    const controller = new AbortController();
    const consumerController = new AbortController();
    const forwardedSignals: (AbortSignal | undefined)[] = [];
    const repository = createReader({
      getEntry: (path, options) => {
        expect(path).toBe(PROJECT_PATH);
        forwardedSignals.push(options?.signal);
        return Promise.resolve(null);
      },
      iterateEntries: (options) => {
        forwardedSignals.push(options?.signal);
        return createEntryIterable([]);
      },
      readCompleteFile: (path, options) => {
        expect(path).toBe(PROJECT_PATH);
        forwardedSignals.push(options?.signal);
        return Promise.resolve(new Uint8Array());
      },
    });
    const session = createRepositoryInspectionSession(
      repository,
      DEFAULT_CORE_RESOURCE_LIMITS,
      controller.signal,
    );

    await session.reader.getEntry(PROJECT_PATH, { signal: consumerController.signal });
    await collectEntries(session.reader.iterateEntries({ signal: consumerController.signal }));
    await session.reader.readCompleteFile(PROJECT_PATH, { signal: consumerController.signal });

    expect(forwardedSignals).toHaveLength(3);
    expect(forwardedSignals[0]).not.toBe(controller.signal);
    expect(forwardedSignals[1]).not.toBe(controller.signal);
    expect(forwardedSignals[2]).not.toBe(controller.signal);
    expect(forwardedSignals.every((forwardedSignal) => forwardedSignal?.aborted === false)).toBe(
      true,
    );

    consumerController.abort();

    expect(forwardedSignals[0]?.aborted).toBe(true);
    expect(forwardedSignals[1]?.aborted).toBe(true);
    expect(forwardedSignals[2]?.aborted).toBe(true);
  });

  test('keeps budgets isolated between frozen sessions', async () => {
    let readCount = 0;
    const repository = createReader({
      readCompleteFile: () => {
        readCount += 1;
        return Promise.resolve(new Uint8Array(2));
      },
    });
    const limits = { ...DEFAULT_CORE_RESOURCE_LIMITS, maxTotalBytesRead: 2 };
    const firstSession = createRepositoryInspectionSession(repository, limits);
    const secondSession = createRepositoryInspectionSession(repository, limits);

    await firstSession.reader.readCompleteFile(PROJECT_PATH);
    await secondSession.reader.readCompleteFile(PROJECT_PATH);

    expect(readCount).toBe(2);
    expect(Object.isFrozen(firstSession)).toBe(true);
    expect(Object.isFrozen(firstSession.reader)).toBe(true);
    expect(Object.isFrozen(secondSession)).toBe(true);
    expect(Object.isFrozen(secondSession.reader)).toBe(true);
  });
});

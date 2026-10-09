import { fork } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { CoreOperationException } from '../exceptions/index.js';
import { freezeRecursively } from '../immutable/index.js';
import { normalizeCoreOptions } from '../options/index.js';

import {
  NODE_INSPECTION_LIFETIME_MS,
  NODE_INSPECTION_MAX_REQUESTS,
  NODE_INSPECTION_STDIO_BYTES,
  NODE_INSPECTION_TRANSPORT_BYTES,
} from './constants.js';
import { deserializeInspectionFailure } from './errors.js';
import {
  createInspectionEnvironment,
  createInspectionSender,
  superviseInspectionChild,
} from './lifecycle.js';
import { createInspectionProcessFailure, decodeInspectionMessage } from './protocol.js';
import { executeRepositoryRpc } from './repository-rpc.js';
import type {
  INodeInspectionMetadata,
  INodeProjectInspection,
  INodeProjectInspectionInput,
} from './types.js';
import type { IProjectInspectionPageResult } from '../contracts/index.js';

let isInspectionActive = false;

/** Stores one completion without an unhandled rejection before its owner begins awaiting it. */
const createCompletion = <T>(): {
  promise: Promise<T>;
  resolve: (result: T) => void;
  reject: (cause: unknown) => void;
} => {
  let resolve!: (result: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((resolveResult, rejectResult) => {
    resolve = resolveResult;
    reject = rejectResult;
  });
  void promise.catch(() => {});
  return { promise, resolve, reject };
};

const aborted = (cause?: unknown): CoreOperationException =>
  new CoreOperationException({
    code: 'ABORTED',
    operation: 'create-project-inspection',
    ...(cause === undefined ? {} : { cause }),
  });

/**
 * Prepares content-free inspection inside one supervised subprocess and one analysis worker.
 * The caller owns actual reader work and must dispose the returned handle before publishing success.
 * @returns An async paging handle after the worker reports its actual heap and prepares inspection.
 * @throws
 * - INVALID_ARGUMENT: The Core operation received an invalid argument.
 * - INVALID_RESOURCE_LIMIT: A Core resource limit is invalid.
 * - DUPLICATE_ADAPTER_ID: A runtime adapter ID is registered more than once.
 * - RESERVED_ADAPTER_ID: A reserved runtime adapter ID was supplied.
 * - INVALID_ADAPTER_DEFINITION: A runtime adapter definition is invalid.
 * - ABORTED: The Core operation was aborted.
 * - RESOURCE_LIMIT_EXCEEDED: A Core resource limit was exceeded.
 * - ADAPTER_EXECUTION_FAILED: A runtime adapter failed during inspection.
 * - INSPECTION_BUSY: Project inspection capacity is busy. Try again shortly.
 * - INSPECTION_TIMEOUT: The isolated project inspection timed out.
 * - INSPECTION_PROCESS_FAILED: The isolated project inspection failed.
 * - INVALID_REPOSITORY_PATH: The repository path is invalid.
 * - ENTRY_NOT_FOUND: The requested repository entry was not found.
 * - ENTRY_NOT_FILE: The requested repository entry is not a file.
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
export const createNodeProjectInspection = async (
  input: INodeProjectInspectionInput,
): Promise<INodeProjectInspection> => {
  if (
    input === null ||
    typeof input !== 'object' ||
    input.repository === null ||
    typeof input.repository !== 'object' ||
    typeof input.repository.getEntry !== 'function' ||
    typeof input.repository.listEntriesPage !== 'function' ||
    typeof input.repository.readFilePage !== 'function' ||
    input.repository.snapshot === null ||
    typeof input.repository.snapshot !== 'object' ||
    typeof input.repository.snapshot.id !== 'string' ||
    input.repository.snapshot.id.length === 0 ||
    typeof input.repository.snapshot.sourceKind !== 'string' ||
    input.repository.snapshot.sourceKind.length === 0
  ) {
    throw new CoreOperationException({
      code: 'INVALID_ARGUMENT',
      operation: 'create-project-inspection',
    });
  }
  let repository: INodeProjectInspectionInput['repository'] | undefined = input.repository;
  const snapshot = { id: repository.snapshot.id, sourceKind: repository.snapshot.sourceKind };
  const signal = input.signal;
  if (
    signal !== undefined &&
    (signal === null ||
      typeof signal !== 'object' ||
      typeof signal.aborted !== 'boolean' ||
      typeof signal.addEventListener !== 'function' ||
      typeof signal.removeEventListener !== 'function')
  ) {
    throw new CoreOperationException({
      code: 'INVALID_ARGUMENT',
      operation: 'create-project-inspection',
    });
  }
  const { limits } = normalizeCoreOptions({
    ...(input.limits === undefined ? {} : { limits: input.limits }),
  });
  if (
    !(input.adapterRegistryUrl instanceof URL) ||
    input.adapterRegistryUrl.protocol !== 'file:' ||
    input.adapterRegistryUrl.search !== '' ||
    input.adapterRegistryUrl.hash !== '' ||
    (input.deadline !== undefined && (!Number.isSafeInteger(input.deadline) || input.deadline < 0))
  )
    throw new CoreOperationException({
      code: 'INVALID_ARGUMENT',
      operation: 'create-project-inspection',
    });
  if (signal?.aborted === true) throw aborted(signal.reason);
  if (isInspectionActive)
    throw new CoreOperationException({
      code: 'INSPECTION_BUSY',
      operation: 'create-project-inspection',
    });
  if (limits.maxRetainedBytes <= NODE_INSPECTION_TRANSPORT_BYTES)
    throw new CoreOperationException({
      code: 'RESOURCE_LIMIT_EXCEEDED',
      operation: 'create-project-inspection',
      limit: 'maxRetainedBytes',
      limitMaximum: limits.maxRetainedBytes,
      observedUsage: NODE_INSPECTION_TRANSPORT_BYTES,
      nextAction: 'reduce-input-or-increase-limit',
    });
  const deadline = Math.min(Date.now() + NODE_INSPECTION_LIFETIME_MS, input.deadline ?? Infinity);
  if (deadline <= Date.now())
    throw new CoreOperationException({
      code: 'INSPECTION_TIMEOUT',
      operation: 'create-project-inspection',
    });
  isInspectionActive = true;
  const controller = new AbortController();
  const attemptId = randomBytes(16).toString('hex');
  const prepared = createCompletion<INodeInspectionMetadata>();
  let pendingPage: ReturnType<typeof createCompletion<IProjectInspectionPageResult>> | undefined;
  let pageRequestId = 0;
  let lastReaderRequestId = -1;
  let hasAcknowledgedHeap = false;
  let heapMaximum: number | undefined;
  let hasPrepared = false;
  let isClosing = false;
  let failure: { cause: Error } | undefined;
  let cleanupPromise: Promise<void> | undefined;
  const readerWork = new Set<Promise<unknown>>();
  const relayWork = new Set<Promise<void>>();
  const child = (() => {
    try {
      return fork(fileURLToPath(import.meta.resolve('#moldea-core-runner')), [], {
        execPath: process.execPath,
        execArgv: [],
        env: createInspectionEnvironment(),
        serialization: 'advanced',
        stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
      });
    } catch (cause) {
      isInspectionActive = false;
      throw createInspectionProcessFailure(cause);
    }
  })();
  const send = createInspectionSender((frame, callback) => {
    if (!child.connected) throw createInspectionProcessFailure();
    child.send(frame, callback);
  });
  const supervision = superviseInspectionChild(child, () => {
    void send({ attemptId, kind: 'dispose' }).catch(() => {
      child.kill('SIGKILL');
    });
  });

  /** Keeps admission until child closure and every real reader promise has settled. */
  const cleanup = (): Promise<void> => {
    cleanupPromise ??= (async () => {
      isClosing = true;
      controller.abort(failure?.cause);
      supervision.terminate();
      await supervision.closed;
      await Promise.allSettled([...readerWork, ...relayWork]);
      repository = undefined;
      clearTimeout(timer);
      if (failure === undefined && Date.now() >= deadline) {
        fail(
          new CoreOperationException({
            code: 'INSPECTION_TIMEOUT',
            operation: 'create-project-inspection',
          }),
        );
      }
      signal?.removeEventListener('abort', handleAbort);
      child.removeAllListeners('message');
      child.removeAllListeners('error');
      child.stderr?.removeAllListeners('data');
      isInspectionActive = false;
    })();
    return cleanupPromise;
  };
  const fail = (cause: unknown): void => {
    if (failure === undefined)
      failure = { cause: cause instanceof Error ? cause : createInspectionProcessFailure(cause) };
    prepared.reject(failure.cause);
    pendingPage?.reject(failure.cause);
    void cleanup();
  };
  const getFailureCause = (): Error | undefined => failure?.cause;
  const handleAbort = (): void => {
    fail(aborted(signal?.reason));
  };
  const timer = setTimeout(
    () => {
      fail(
        new CoreOperationException({
          code: 'INSPECTION_TIMEOUT',
          operation: 'create-project-inspection',
        }),
      );
    },
    Math.max(1, deadline - Date.now()),
  );
  signal?.addEventListener('abort', handleAbort, { once: true });
  // Re-read through a function because cancellation can change during listener registration.
  const isCallerAborted = (): boolean => signal?.aborted === true;
  if (isCallerAborted()) handleAbort();
  child.once('error', (cause: unknown) => {
    fail(createInspectionProcessFailure(cause));
  });
  void supervision.closed.then(() => {
    if (!isClosing) fail(createInspectionProcessFailure());
  });
  let stderrBytes = 0;
  child.stderr?.on('data', (chunk: Buffer) => {
    stderrBytes += chunk.byteLength;
    if (stderrBytes > NODE_INSPECTION_STDIO_BYTES) fail(createInspectionProcessFailure());
  });
  child.on('message', (frame: unknown) => {
    if (isClosing) return;
    try {
      const message = decodeInspectionMessage(frame);
      if (message.attemptId !== attemptId) throw createInspectionProcessFailure();
      if (message.kind === 'ready') {
        if (hasAcknowledgedHeap) throw createInspectionProcessFailure();
        heapMaximum = message.maxAnalysisHeapBytes;
        hasAcknowledgedHeap = true;
        void send({ attemptId, kind: 'run' }).catch(fail);
      } else if (message.kind === 'prepared') {
        if (
          !hasAcknowledgedHeap ||
          hasPrepared ||
          message.inspection.maxAnalysisHeapBytes !== heapMaximum ||
          message.inspection.source.id !== snapshot.id ||
          message.inspection.source.sourceKind !== snapshot.sourceKind
        )
          throw createInspectionProcessFailure();
        hasPrepared = true;
        prepared.resolve(freezeRecursively(message.inspection));
      } else if (message.kind === 'reader-request') {
        if (
          !hasAcknowledgedHeap ||
          hasPrepared ||
          message.requestId !== lastReaderRequestId + 1 ||
          readerWork.size >= NODE_INSPECTION_MAX_REQUESTS
        )
          throw createInspectionProcessFailure();
        lastReaderRequestId = message.requestId;
        if (repository === undefined) throw createInspectionProcessFailure();
        const work = executeRepositoryRpc(repository, message.request, controller.signal);
        readerWork.add(work);
        const relay = (async () => {
          try {
            const result = await work;
            readerWork.delete(work);
            if (!isClosing)
              await send({
                attemptId,
                kind: 'reader-response',
                requestId: message.requestId,
                result,
              });
          } catch (cause) {
            fail(cause);
          } finally {
            readerWork.delete(work);
          }
        })();
        relayWork.add(relay);
        void relay.finally(() => relayWork.delete(relay));
      } else if (message.kind === 'page') {
        if (!hasPrepared || pendingPage === undefined || message.requestId !== pageRequestId)
          throw createInspectionProcessFailure();
        const completion = pendingPage;
        pendingPage = undefined;
        completion.resolve(freezeRecursively(message.result));
      } else if (message.kind === 'failure') {
        if (
          message.failure.options['nextAction'] === 'review-inspection-capacity' &&
          (heapMaximum === undefined || message.failure.options['limitMaximum'] !== heapMaximum)
        )
          throw createInspectionProcessFailure();
        fail(deserializeInspectionFailure(message.failure));
      } else throw createInspectionProcessFailure();
    } catch (cause) {
      fail(cause);
    }
  });
  try {
    await send({
      attemptId,
      kind: 'start',
      registryUrl: input.adapterRegistryUrl.href,
      snapshot,
      limits,
      deadline,
    });
    const metadata = await prepared.promise;
    if (Date.now() >= deadline)
      throw new CoreOperationException({
        code: 'INSPECTION_TIMEOUT',
        operation: 'create-project-inspection',
      });
    return Object.freeze({
      ...metadata,
      readPage: async (pageInput): Promise<IProjectInspectionPageResult> => {
        if (failure !== undefined || isClosing) throw failure?.cause ?? aborted();
        if (
          pendingPage !== undefined ||
          pageInput === null ||
          typeof pageInput !== 'object' ||
          Reflect.ownKeys(pageInput).some(
            (key) => key !== 'cursor' && key !== 'maxItems' && key !== 'view',
          ) ||
          !Number.isSafeInteger(pageInput.maxItems) ||
          pageInput.maxItems < 1 ||
          pageInput.maxItems > limits.maxEntries ||
          !['all', 'diagnostics', 'evidence', 'metadata'].includes(pageInput.view) ||
          (pageInput.cursor !== undefined && typeof pageInput.cursor !== 'string')
        )
          throw new CoreOperationException({
            code: 'INVALID_ARGUMENT',
            operation: 'create-project-inspection',
          });
        const completion = createCompletion<IProjectInspectionPageResult>();
        pendingPage = completion;
        pageRequestId++;
        try {
          if (Date.now() >= deadline)
            throw new CoreOperationException({
              code: 'INSPECTION_TIMEOUT',
              operation: 'create-project-inspection',
            });
          await send({
            attemptId,
            kind: 'read-page',
            requestId: pageRequestId,
            input: {
              maxItems: pageInput.maxItems,
              view: pageInput.view,
              ...(pageInput.cursor === undefined ? {} : { cursor: pageInput.cursor }),
            },
          });
          const result = await completion.promise;
          if (Date.now() >= deadline)
            throw new CoreOperationException({
              code: 'INSPECTION_TIMEOUT',
              operation: 'create-project-inspection',
            });
          return result;
        } catch (cause) {
          fail(cause);
          await cleanup();
          throw getFailureCause() ?? createInspectionProcessFailure(cause);
        } finally {
          if (pendingPage === completion) pendingPage = undefined;
        }
      },
      dispose: async (): Promise<void> => {
        pendingPage?.reject(failure?.cause ?? aborted());
        await cleanup();
        const cause = getFailureCause();
        if (cause !== undefined) throw cause;
      },
    } satisfies INodeProjectInspection);
  } catch (cause) {
    fail(cause);
    await cleanup();
    throw getFailureCause() ?? createInspectionProcessFailure(cause);
  }
};

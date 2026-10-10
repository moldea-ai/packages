import process from 'node:process';
import { Worker } from 'node:worker_threads';

import { CoreOperationException } from '../exceptions/index.js';

import {
  NODE_INSPECTION_LIFETIME_MS,
  NODE_INSPECTION_MAX_REQUESTS,
  NODE_INSPECTION_OLD_GENERATION_MIB,
  NODE_INSPECTION_STDIO_BYTES,
  NODE_INSPECTION_YOUNG_GENERATION_MIB,
} from './constants.js';
import { serializeInspectionFailure } from './errors.js';
import { createInspectionSender } from './lifecycle.js';
import {
  createInspectionProcessFailure,
  decodeInspectionMessage,
  encodeInspectionMessage,
} from './protocol.js';
import type { INodeInspectionMessage } from './types.js';

let worker: Worker | undefined;
let attemptId: string | undefined;
let heapMaximum: number | undefined;
let deadlineTimer: NodeJS.Timeout | undefined;
let isClosing = false;
let hasRun = false;
const readerRequests = new Set<number>();
const send = createInspectionSender((frame, callback) => {
  if (process.send === undefined || !process.connected) throw createInspectionProcessFailure();
  process.send(frame, callback);
});

/** Closes the worker before disconnecting the supervisor's private IPC channel. */
const close = async (failure?: unknown): Promise<void> => {
  if (isClosing) return;
  isClosing = true;
  clearTimeout(deadlineTimer);
  const termination = worker?.terminate();
  if (failure !== undefined && attemptId !== undefined && process.connected) {
    try {
      await send({ attemptId, kind: 'failure', failure: serializeInspectionFailure(failure) });
    } catch {
      /* parent disconnect remains authoritative when a failure cannot be delivered */
    }
  }
  await termination;
  readerRequests.clear();
  process.removeListener('message', handleParentMessage);
  process.removeListener('disconnect', handleDisconnect);
  if (process.connected) process.disconnect();
};

const handleDisconnect = (): void => {
  void close();
};
const handleWorkerMessage = (frame: unknown): void => {
  try {
    const message = decodeInspectionMessage(frame);
    if (isClosing) return;
    if (message.attemptId !== attemptId) throw createInspectionProcessFailure();
    if (message.kind === 'ready') {
      if (heapMaximum !== undefined || hasRun) throw createInspectionProcessFailure();
      heapMaximum = message.maxAnalysisHeapBytes;
    } else if (message.kind === 'reader-request') {
      if (
        !hasRun ||
        readerRequests.has(message.requestId) ||
        readerRequests.size >= NODE_INSPECTION_MAX_REQUESTS
      )
        throw createInspectionProcessFailure();
      readerRequests.add(message.requestId);
    } else if (
      message.kind === 'failure' &&
      message.failure.options['limit'] === 'maxAnalysisHeapBytes'
    )
      throw createInspectionProcessFailure();
    else if (!['prepared', 'page', 'failure'].includes(message.kind))
      throw createInspectionProcessFailure();
    void send(message).catch((cause: unknown) => close(cause));
  } catch (cause) {
    void close(cause);
  }
};

/** Starts independent supervision before creating the sole analysis worker. */
const start = (message: Extract<INodeInspectionMessage, { kind: 'start' }>): void => {
  if (attemptId !== undefined || isClosing) throw createInspectionProcessFailure();
  attemptId = message.attemptId;
  clearTimeout(deadlineTimer);
  const remaining = Math.min(NODE_INSPECTION_LIFETIME_MS, message.deadline - Date.now());
  if (remaining <= 0) {
    void close(
      new CoreOperationException({
        code: 'INSPECTION_TIMEOUT',
        operation: 'create-project-inspection',
      }),
    );
    return;
  }
  deadlineTimer = setTimeout(() => {
    void close(
      new CoreOperationException({
        code: 'INSPECTION_TIMEOUT',
        operation: 'create-project-inspection',
      }),
    );
  }, remaining);
  worker = new Worker(new URL(import.meta.resolve('#moldea-core-analysis-worker')), {
    execArgv: [],
    env: process.env,
    stdout: true,
    stderr: true,
    resourceLimits: {
      maxOldGenerationSizeMb: NODE_INSPECTION_OLD_GENERATION_MIB,
      maxYoungGenerationSizeMb: NODE_INSPECTION_YOUNG_GENERATION_MIB,
    },
    workerData: encodeInspectionMessage(message),
  });
  let stdioBytes = 0;
  const consumeStdio = (chunk: Buffer): void => {
    stdioBytes += chunk.byteLength;
    if (stdioBytes > NODE_INSPECTION_STDIO_BYTES) void close(createInspectionProcessFailure());
  };
  worker.stdout.on('data', consumeStdio);
  worker.stderr.on('data', consumeStdio);
  worker.on('message', handleWorkerMessage);
  worker.on('messageerror', (cause: unknown) => {
    void close(createInspectionProcessFailure(cause));
  });
  worker.once('error', (error: Error & { code?: string }) => {
    const failure =
      error.code === 'ERR_WORKER_OUT_OF_MEMORY' && heapMaximum !== undefined
        ? new CoreOperationException({
            code: 'RESOURCE_LIMIT_EXCEEDED',
            operation: 'create-project-inspection',
            limit: 'maxAnalysisHeapBytes',
            limitMaximum: heapMaximum,
            observedUsage: null,
            nextAction: 'review-inspection-capacity',
          })
        : createInspectionProcessFailure(error);
    void close(failure);
  });
  worker.once('exit', () => {
    if (!isClosing) void close(createInspectionProcessFailure());
  });
};

const handleParentMessage = (frame: unknown): void => {
  try {
    const message = decodeInspectionMessage(frame);
    if (isClosing) return;
    if (message.kind === 'start') {
      start(message);
      return;
    }
    if (message.attemptId !== attemptId || worker === undefined)
      throw createInspectionProcessFailure();
    if (message.kind === 'dispose') {
      void close();
      return;
    }
    if (message.kind === 'run') {
      if (heapMaximum === undefined || hasRun) throw createInspectionProcessFailure();
      hasRun = true;
    } else if (message.kind === 'reader-response') {
      if (!readerRequests.delete(message.requestId)) throw createInspectionProcessFailure();
    } else if (message.kind !== 'read-page' || !hasRun) throw createInspectionProcessFailure();
    worker.postMessage(encodeInspectionMessage(message));
  } catch (cause) {
    void close(cause);
  }
};

process.on('disconnect', handleDisconnect);
process.on('message', handleParentMessage);
deadlineTimer = setTimeout(() => {
  void close();
}, NODE_INSPECTION_LIFETIME_MS);
if (process.send === undefined || !process.connected) void close();

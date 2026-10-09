import { getHeapStatistics } from 'node:v8';
import { parentPort, workerData } from 'node:worker_threads';

import { RepositorySourceException, type IRepositoryReader } from '@moldea.ai/repository';

import type { IRuntimeAdapter } from '../adapter/index.js';
import type { IProjectInspection } from '../contracts/index.js';
import { CoreOperationException } from '../exceptions/index.js';
import { normalizeCoreOptions } from '../options/index.js';

import {
  NODE_INSPECTION_FILE_PAGE_BYTES,
  NODE_INSPECTION_MAX_REQUESTS,
  NODE_INSPECTION_TRANSPORT_BYTES,
} from './constants.js';
import { serializeInspectionFailure } from './errors.js';
import {
  createInspectionProcessFailure,
  decodeInspectionMessage,
  encodeInspectionMessage,
} from './protocol.js';
import { parseRpcEntry, parseRpcEntryPage, parseRpcFilePage } from './repository-rpc.js';
import type { INodeInspectionMessage, INodeReaderRequest } from './types.js';

const port = parentPort;
if (port === null) throw createInspectionProcessFailure();
const start = decodeInspectionMessage(workerData);
if (start.kind !== 'start') throw createInspectionProcessFailure();
const attemptId = start.attemptId;
const maxAnalysisHeapBytes = getHeapStatistics().heap_size_limit;
let inspection: IProjectInspection | undefined;
let hasRun = false;
let isReadingPage = false;
let nextRequestId = 0;
const pending = new Map<
  number,
  { resolve: (result: unknown) => void; reject: (cause: unknown) => void }
>();
const send = (message: INodeInspectionMessage): void => {
  port.postMessage(encodeInspectionMessage(message));
};

/** Admits at most four requests across both bridges; no unbounded transport wait queue exists. */
const requestReader = (request: INodeReaderRequest): Promise<unknown> => {
  if (pending.size >= NODE_INSPECTION_MAX_REQUESTS)
    return Promise.reject(
      new CoreOperationException({
        code: 'RESOURCE_LIMIT_EXCEEDED',
        operation: 'create-project-inspection',
        limit: 'maxReaderRequests',
        limitMaximum: NODE_INSPECTION_MAX_REQUESTS,
        observedUsage: pending.size + 1,
        nextAction: null,
      }),
    );
  const requestId = nextRequestId++;
  return new Promise<unknown>((resolve, reject) => {
    pending.set(requestId, { resolve, reject });
    try {
      send({ attemptId, kind: 'reader-request', requestId, request });
    } catch (cause) {
      pending.delete(requestId);
      reject(cause instanceof Error ? cause : createInspectionProcessFailure(cause));
    }
  });
};

const repository: IRepositoryReader = {
  snapshot: start.snapshot,
  getEntry: async (path) => parseRpcEntry(await requestReader({ method: 'getEntry', path })),
  listEntriesPage: async (options) =>
    parseRpcEntryPage(
      await requestReader({
        method: 'listEntriesPage',
        maxEntries: Math.min(128, options.maxEntries),
        ...(options.cursor === undefined ? {} : { cursor: options.cursor }),
        ...(options.prefix === undefined ? {} : { prefix: options.prefix }),
      }),
    ),
  readFilePage: async (path, options) =>
    parseRpcFilePage(
      await requestReader({
        method: 'readFilePage',
        path,
        offset: options.offset,
        maxBytes: Math.min(NODE_INSPECTION_FILE_PAGE_BYTES, options.maxBytes),
      }),
    ),
  compare: () =>
    Promise.reject(
      new RepositorySourceException({
        code: 'SOURCE_UNAVAILABLE',
        operation: 'create-comparison',
        path: null,
        retryable: false,
      }),
    ),
};

/** Imports only the caller-selected installed registry, after the parent acknowledges the heap. */
const prepare = async (): Promise<void> => {
  const registry: unknown = await import(start.registryUrl);
  if (
    registry === null ||
    typeof registry !== 'object' ||
    !('adapters' in registry) ||
    !Array.isArray(registry.adapters)
  )
    throw createInspectionProcessFailure();
  // Core remains the authoritative validator for every executable adapter definition.
  const adapters = registry.adapters as IRuntimeAdapter[];
  const { createCore } = await import('../core/index.js');
  const options = normalizeCoreOptions({
    adapters,
    limits: {
      ...start.limits,
      maxRetainedBytes: start.limits.maxRetainedBytes - NODE_INSPECTION_TRANSPORT_BYTES,
    },
  });
  const core = createCore(options);
  inspection = await core.createProjectInspection({ repository });
  const metadata = {
    source: inspection.source,
    formatVersion: inspection.formatVersion,
    valid: inspection.valid,
    runtimeInspection: inspection.runtimeInspection,
    counts: inspection.counts,
    summary: inspection.summary,
    resourceUsage: inspection.resourceUsage,
    inspectionDigest: inspection.inspectionDigest,
  };
  send({
    attemptId,
    kind: 'prepared',
    inspection: {
      ...metadata,
      maxAnalysisHeapBytes,
      adapters: options.adapters.map((adapter) => ({
        id: adapter.id,
        supportedRepositoryFormatVersions: [...adapter.supportedRepositoryFormatVersions],
      })),
      resourceUsage: {
        ...metadata.resourceUsage,
        retainedBytes: metadata.resourceUsage.retainedBytes + NODE_INSPECTION_TRANSPORT_BYTES,
        peakRetainedBytes:
          metadata.resourceUsage.peakRetainedBytes + NODE_INSPECTION_TRANSPORT_BYTES,
      },
    },
  });
};

/** Translates worker failures to safe package contracts while the supervisor stays responsive. */
const fail = (cause: unknown): void => {
  try {
    const failure = serializeInspectionFailure(cause);
    if (
      cause instanceof CoreOperationException &&
      cause.code === 'RESOURCE_LIMIT_EXCEEDED' &&
      cause.limit === 'maxRetainedBytes' &&
      cause.observedUsage !== null
    ) {
      failure.options['limitMaximum'] = start.limits.maxRetainedBytes;
      failure.options['observedUsage'] = cause.observedUsage + NODE_INSPECTION_TRANSPORT_BYTES;
    }
    send({ attemptId, kind: 'failure', failure });
  } catch {
    port.close();
  }
};

port.on('message', (frame: unknown) => {
  try {
    const message = decodeInspectionMessage(frame);
    if (message.attemptId !== attemptId) throw createInspectionProcessFailure();
    if (message.kind === 'run') {
      if (hasRun) throw createInspectionProcessFailure();
      hasRun = true;
      void prepare().catch(fail);
    } else if (message.kind === 'reader-response') {
      const request = pending.get(message.requestId);
      if (request === undefined) throw createInspectionProcessFailure();
      pending.delete(message.requestId);
      request.resolve(message.result);
    } else if (message.kind === 'read-page') {
      if (inspection === undefined || isReadingPage) throw createInspectionProcessFailure();
      isReadingPage = true;
      try {
        if (message.input.maxItems > start.limits.maxEntries)
          throw new CoreOperationException({
            code: 'INVALID_ARGUMENT',
            operation: 'create-project-inspection',
          });
        let maxItems = Math.min(256, message.input.maxItems);
        while (true) {
          try {
            const frame = encodeInspectionMessage({
              attemptId,
              kind: 'page',
              requestId: message.requestId,
              result: inspection.readPage({ ...message.input, maxItems }),
            });
            port.postMessage(frame);
            break;
          } catch (cause) {
            if (
              !(cause instanceof CoreOperationException) ||
              cause.code !== 'RESOURCE_LIMIT_EXCEEDED' ||
              cause.limit !== 'maxInspectionMessageBytes' ||
              maxItems === 1
            )
              throw cause;
            maxItems = Math.max(1, Math.floor(maxItems / 2));
          }
        }
      } finally {
        isReadingPage = false;
      }
    } else throw createInspectionProcessFailure();
  } catch (cause) {
    fail(cause);
  }
});
port.on('messageerror', fail);
send({ attemptId, kind: 'ready', maxAnalysisHeapBytes });

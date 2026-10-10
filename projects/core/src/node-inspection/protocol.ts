import { Buffer } from 'node:buffer';

import { isRepositoryPath } from '@moldea.ai/repository';

import type { ICoreResourceLimits } from '../contracts/index.js';
import { CoreOperationException } from '../exceptions/index.js';

import { NODE_INSPECTION_FILE_PAGE_BYTES, NODE_INSPECTION_MESSAGE_BYTES } from './constants.js';
import type { INodeInspectionMessage } from './types.js';

/** Creates the safe failure for an untrusted or inconsistent private protocol record. */
export const createInspectionProcessFailure = (cause?: unknown): CoreOperationException =>
  new CoreOperationException({
    code: 'INSPECTION_PROCESS_FAILED',
    operation: 'create-project-inspection',
    ...(cause === undefined ? {} : { cause }),
  });

const isRecord = (input: unknown): input is Record<string, unknown> =>
  input !== null && typeof input === 'object' && !Array.isArray(input);
const JSON_SHORT_ESCAPES = new Set([8, 9, 10, 12, 13]);
const isInteger = (input: unknown): input is number =>
  typeof input === 'number' && Number.isSafeInteger(input) && input >= 0;
const hasKeys = (
  input: Record<string, unknown>,
  required: string[],
  optional: string[] = [],
): boolean =>
  required.every((key) => Object.hasOwn(input, key)) &&
  Object.keys(input).every((key) => required.includes(key) || optional.includes(key));
const isSnapshot = (input: unknown): boolean =>
  isRecord(input) &&
  hasKeys(input, ['id', 'sourceKind']) &&
  typeof input['id'] === 'string' &&
  input['id'].length > 0 &&
  typeof input['sourceKind'] === 'string' &&
  input['sourceKind'].length > 0;
const isOptionalString = (input: Record<string, unknown>, key: string): boolean =>
  !Object.hasOwn(input, key) || typeof input[key] === 'string';
const isRegistryUrl = (input: unknown): boolean => {
  if (typeof input !== 'string') return false;
  try {
    const url = new URL(input);
    return url.protocol === 'file:' && url.search === '' && url.hash === '';
  } catch {
    return false;
  }
};
const isPageInput = (input: unknown): boolean =>
  isRecord(input) &&
  hasKeys(input, ['maxItems', 'view'], ['cursor']) &&
  isInteger(input['maxItems']) &&
  input['maxItems'] > 0 &&
  ['all', 'diagnostics', 'evidence', 'metadata'].includes(String(input['view'])) &&
  isOptionalString(input, 'cursor');
const isLimits = (input: unknown): input is ICoreResourceLimits =>
  isRecord(input) &&
  hasKeys(input, [
    'maxEntries',
    'maxTotalBytesRead',
    'maxFileBytes',
    'maxManifestBytes',
    'maxRetainedBytes',
    'maxDiagnostics',
    'maxEvidence',
  ]) &&
  Object.values(input).every((limit) => isInteger(limit) && limit > 0);
const isCounts = (input: unknown): boolean =>
  isRecord(input) &&
  hasKeys(input, [
    'agents',
    'context',
    'decisions',
    'mirrors',
    'runtimes',
    'unresolved',
    'diagnostics',
    'errors',
    'warnings',
    'evidence',
    'metadata',
  ]) &&
  Object.values(input).every(isInteger);
const isSummary = (input: unknown): boolean =>
  input === null ||
  (isRecord(input) &&
    hasKeys(input, ['counts', 'manifestDigest', 'manifestPath', 'projectDigest', 'projectPath']) &&
    isRecord(input['counts']) &&
    hasKeys(input['counts'], [
      'agents',
      'context',
      'decisions',
      'mirrors',
      'runtimes',
      'unresolved',
    ]) &&
    Object.values(input['counts']).every(isInteger) &&
    typeof input['manifestDigest'] === 'string' &&
    typeof input['projectDigest'] === 'string' &&
    isRepositoryPath(input['manifestPath']) &&
    isRepositoryPath(input['projectPath']));
const isInspectionBase = (input: Record<string, unknown>): boolean =>
  isCounts(input['counts']) &&
  typeof input['valid'] === 'boolean' &&
  ['complete', 'incomplete', 'not-run'].includes(String(input['runtimeInspection'])) &&
  (input['formatVersion'] === null || input['formatVersion'] === 1) &&
  typeof input['inspectionDigest'] === 'string' &&
  isSnapshot(input['source']) &&
  isSummary(input['summary']);
const INSPECTION_KEYS = [
  'counts',
  'valid',
  'runtimeInspection',
  'formatVersion',
  'inspectionDigest',
  'source',
  'summary',
];
const isMetadata = (input: unknown): boolean =>
  isRecord(input) &&
  hasKeys(input, [...INSPECTION_KEYS, 'resourceUsage', 'adapters', 'maxAnalysisHeapBytes']) &&
  isInspectionBase(input) &&
  isInteger(input['maxAnalysisHeapBytes']) &&
  input['maxAnalysisHeapBytes'] > 0 &&
  isRecord(input['resourceUsage']) &&
  hasKeys(input['resourceUsage'], [
    'canonicalBytes',
    'peakRetainedBytes',
    'preparedBytes',
    'retainedBytes',
    'totalBytesRead',
  ]) &&
  Object.values(input['resourceUsage']).every(isInteger) &&
  Array.isArray(input['adapters']) &&
  input['adapters'].every(
    (adapter: unknown) =>
      isRecord(adapter) &&
      hasKeys(adapter, ['id', 'supportedRepositoryFormatVersions']) &&
      typeof adapter['id'] === 'string' &&
      Array.isArray(adapter['supportedRepositoryFormatVersions']) &&
      adapter['supportedRepositoryFormatVersions'].every(
        (version: unknown) => isInteger(version) && version > 0,
      ),
  );
const isPage = (input: unknown): boolean =>
  isRecord(input) &&
  hasKeys(input, [...INSPECTION_KEYS, 'page', 'view']) &&
  isInspectionBase(input) &&
  ['all', 'diagnostics', 'evidence', 'metadata'].includes(String(input['view'])) &&
  isRecord(input['page']) &&
  hasKeys(input['page'], ['isComplete', 'records', 'nextCursor', 'totalItems']) &&
  typeof input['page']['isComplete'] === 'boolean' &&
  isInteger(input['page']['totalItems']) &&
  (input['page']['nextCursor'] === null || typeof input['page']['nextCursor'] === 'string') &&
  Array.isArray(input['page']['records']) &&
  input['page']['records'].every(
    (record: unknown) =>
      isRecord(record) &&
      hasKeys(record, ['item', 'nextCursor']) &&
      (record['nextCursor'] === null || typeof record['nextCursor'] === 'string') &&
      isRecord(record['item']) &&
      typeof record['item']['kind'] === 'string' &&
      ['agent', 'diagnostic', 'evidence', 'metadata'].includes(record['item']['kind']) &&
      hasKeys(record['item'], ['kind', record['item']['kind']]) &&
      isRecord(record['item'][record['item']['kind']]),
  );
const isRequest = (input: unknown): boolean => {
  if (!isRecord(input)) return false;
  switch (input['method']) {
    case 'getEntry':
      return hasKeys(input, ['method', 'path']) && isRepositoryPath(input['path']);
    case 'listEntriesPage':
      return (
        hasKeys(input, ['method', 'maxEntries'], ['cursor', 'prefix']) &&
        isInteger(input['maxEntries']) &&
        input['maxEntries'] > 0 &&
        input['maxEntries'] <= 128 &&
        isOptionalString(input, 'cursor') &&
        (!Object.hasOwn(input, 'prefix') || isRepositoryPath(input['prefix']))
      );
    case 'readFilePage':
      return (
        hasKeys(input, ['method', 'path', 'maxBytes', 'offset']) &&
        isRepositoryPath(input['path']) &&
        isInteger(input['offset']) &&
        isInteger(input['maxBytes']) &&
        input['maxBytes'] > 0 &&
        input['maxBytes'] <= NODE_INSPECTION_FILE_PAGE_BYTES
      );
    default:
      return false;
  }
};

/** Validates closed control envelopes and their typed operation payloads on both bridges. */
const isMessage = (input: unknown): input is INodeInspectionMessage => {
  if (
    !isRecord(input) ||
    typeof input['attemptId'] !== 'string' ||
    !/^[a-f0-9]{32}$/.test(input['attemptId'])
  )
    return false;
  const keys = ['attemptId', 'kind'];
  switch (input['kind']) {
    case 'start':
      return (
        hasKeys(input, [...keys, 'registryUrl', 'snapshot', 'limits', 'deadline']) &&
        isRegistryUrl(input['registryUrl']) &&
        isSnapshot(input['snapshot']) &&
        isLimits(input['limits']) &&
        isInteger(input['deadline'])
      );
    case 'ready':
      return (
        hasKeys(input, [...keys, 'maxAnalysisHeapBytes']) &&
        isInteger(input['maxAnalysisHeapBytes']) &&
        input['maxAnalysisHeapBytes'] > 0
      );
    case 'run':
    case 'dispose':
      return hasKeys(input, keys);
    case 'prepared':
      return hasKeys(input, [...keys, 'inspection']) && isMetadata(input['inspection']);
    case 'read-page':
      return (
        hasKeys(input, [...keys, 'requestId', 'input']) &&
        isInteger(input['requestId']) &&
        isPageInput(input['input'])
      );
    case 'page':
      return (
        hasKeys(input, [...keys, 'requestId', 'result']) &&
        isInteger(input['requestId']) &&
        isPage(input['result'])
      );
    case 'reader-request':
      return (
        hasKeys(input, [...keys, 'requestId', 'request']) &&
        isInteger(input['requestId']) &&
        isRequest(input['request'])
      );
    case 'reader-response':
      return hasKeys(input, [...keys, 'requestId', 'result']) && isInteger(input['requestId']);
    case 'failure':
      return (
        hasKeys(input, [...keys, 'failure']) &&
        isRecord(input['failure']) &&
        hasKeys(input['failure'], ['family', 'options']) &&
        ['configuration', 'operation', 'repository', 'path'].includes(
          String(input['failure']['family']),
        ) &&
        isRecord(input['failure']['options'])
      );
    default:
      return false;
  }
};

/** Counts escaped JSON bytes without first allocating a serialized oversized message. */
const countJsonBytes = (input: unknown, ancestors: WeakSet<object>, depth: number): number => {
  if (depth > 64) throw createInspectionProcessFailure();
  if (input === null) return 4;
  if (typeof input === 'boolean') return input ? 4 : 5;
  if (typeof input === 'number' && Number.isFinite(input)) return String(input).length;
  if (typeof input === 'string') {
    let bytes = 2;
    for (let index = 0; index < input.length; index++) {
      const code = input.charCodeAt(index);
      if (code === 34 || code === 92 || JSON_SHORT_ESCAPES.has(code)) bytes += 2;
      else if (code < 32) bytes += 6;
      else if (code < 128) bytes++;
      else if (code < 2048) bytes += 2;
      else if (
        code >= 0xd800 &&
        code <= 0xdbff &&
        index + 1 < input.length &&
        input.charCodeAt(index + 1) >= 0xdc00 &&
        input.charCodeAt(index + 1) <= 0xdfff
      ) {
        bytes += 4;
        index++;
      } else bytes += code >= 0xd800 && code <= 0xdfff ? 6 : 3;
      if (bytes > NODE_INSPECTION_MESSAGE_BYTES) return bytes;
    }
    return bytes;
  }
  if (typeof input !== 'object' || ancestors.has(input)) throw createInspectionProcessFailure();
  ancestors.add(input);
  let bytes = 2;
  let count = 0;
  if (Array.isArray(input)) {
    for (const element of input) {
      bytes += (count++ === 0 ? 0 : 1) + countJsonBytes(element, ancestors, depth + 1);
      if (bytes > NODE_INSPECTION_MESSAGE_BYTES) break;
    }
  } else {
    for (const key in input) {
      if (!Object.hasOwn(input, key)) continue;
      bytes +=
        (count++ === 0 ? 0 : 1) +
        countJsonBytes(key, ancestors, depth + 1) +
        1 +
        countJsonBytes((input as Record<string, unknown>)[key], ancestors, depth + 1);
      if (bytes > NODE_INSPECTION_MESSAGE_BYTES) break;
    }
  }
  ancestors.delete(input);
  return bytes;
};

/**
 * Admits a complete bounded record before serialization; no record is truncated.
 * @returns One private JSON frame.
 * @throws
 * - RESOURCE_LIMIT_EXCEEDED: A Core resource limit was exceeded.
 * - INSPECTION_PROCESS_FAILED: The isolated project inspection failed.
 */
export const encodeInspectionMessage = (message: INodeInspectionMessage): string => {
  const bytes = countJsonBytes(message, new WeakSet(), 0);
  if (bytes > NODE_INSPECTION_MESSAGE_BYTES)
    throw new CoreOperationException({
      code: 'RESOURCE_LIMIT_EXCEEDED',
      limit: 'maxInspectionMessageBytes',
      limitMaximum: NODE_INSPECTION_MESSAGE_BYTES,
      observedUsage: bytes,
      nextAction: null,
      operation: 'create-project-inspection',
    });
  if (!isMessage(message)) throw createInspectionProcessFailure();
  return JSON.stringify(message);
};

/**
 * Checks frame size before parsing and validates the closed message contract.
 * @returns A validated private message.
 * @throws
 * - INSPECTION_PROCESS_FAILED: The isolated project inspection failed.
 */
export const decodeInspectionMessage = (frame: unknown): INodeInspectionMessage => {
  if (typeof frame !== 'string' || Buffer.byteLength(frame) > NODE_INSPECTION_MESSAGE_BYTES)
    throw createInspectionProcessFailure();
  let message: unknown;
  try {
    message = JSON.parse(frame);
  } catch (cause) {
    throw createInspectionProcessFailure(cause);
  }
  if (!isMessage(message)) throw createInspectionProcessFailure();
  return message;
};

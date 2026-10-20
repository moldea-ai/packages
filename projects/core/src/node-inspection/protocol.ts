import { Buffer } from 'node:buffer';
import { isObjectValid, measureJsonBytes } from 'jg-utilities';

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
  isObjectValid(input, true) &&
  hasKeys(input, ['id', 'sourceKind']) &&
  typeof input['id'] === 'string' &&
  input['id'].length > 0 &&
  typeof input['sourceKind'] === 'string' &&
  input['sourceKind'].length > 0;
const isOptionalString = (input: Record<string, unknown>, key: string): boolean =>
  !Object.hasOwn(input, key) || typeof input[key] === 'string';
const isPageInput = (input: unknown): boolean =>
  isObjectValid(input, true) &&
  hasKeys(input, ['maxItems', 'view'], ['cursor']) &&
  isInteger(input['maxItems']) &&
  input['maxItems'] > 0 &&
  ['all', 'diagnostics', 'coverage', 'metadata'].includes(String(input['view'])) &&
  isOptionalString(input, 'cursor');
const isLimits = (input: unknown): input is ICoreResourceLimits =>
  isObjectValid(input, true) &&
  hasKeys(input, [
    'maxEntries',
    'maxTotalBytesRead',
    'maxFileBytes',
    'maxManifestBytes',
    'maxRetainedBytes',
    'maxDiagnostics',
    'maxCoverage',
    'maxAcceptedWarnings',
  ]) &&
  Object.values(input).every((limit) => isInteger(limit) && limit > 0);
const isCounts = (input: unknown): boolean =>
  isObjectValid(input, true) &&
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
    'acceptedWarnings',
    'coverage',
    'metadata',
  ]) &&
  Object.values(input).every(isInteger);
const isSummary = (input: unknown): boolean =>
  input === null ||
  (isObjectValid(input, true) &&
    hasKeys(input, ['counts', 'manifestDigest', 'manifestPath', 'projectDigest', 'projectPath']) &&
    isObjectValid(input['counts'], true) &&
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
  isObjectValid(input['coverageCounts'], true) &&
  hasKeys(input['coverageCounts'], [
    'bindings',
    'exportsPassed',
    'exportsFailed',
    'exportsNotChecked',
  ]) &&
  Object.values(input['coverageCounts']).every(isInteger) &&
  typeof input['valid'] === 'boolean' &&
  (input['formatVersion'] === null || input['formatVersion'] === 1) &&
  typeof input['inspectionDigest'] === 'string' &&
  isSnapshot(input['source']) &&
  isSummary(input['summary']);
const INSPECTION_KEYS = [
  'counts',
  'coverageCounts',
  'valid',
  'formatVersion',
  'inspectionDigest',
  'source',
  'summary',
];
const isMetadata = (input: unknown): boolean =>
  isObjectValid(input, true) &&
  hasKeys(input, [...INSPECTION_KEYS, 'resourceUsage', 'maxAnalysisHeapBytes']) &&
  isInspectionBase(input) &&
  isInteger(input['maxAnalysisHeapBytes']) &&
  input['maxAnalysisHeapBytes'] > 0 &&
  isObjectValid(input['resourceUsage'], true) &&
  hasKeys(input['resourceUsage'], [
    'canonicalBytes',
    'peakRetainedBytes',
    'preparedBytes',
    'retainedBytes',
    'totalBytesRead',
  ]) &&
  Object.values(input['resourceUsage']).every(isInteger);
const isPage = (input: unknown): boolean =>
  isObjectValid(input, true) &&
  hasKeys(input, [...INSPECTION_KEYS, 'page', 'view']) &&
  isInspectionBase(input) &&
  ['all', 'diagnostics', 'coverage', 'metadata'].includes(String(input['view'])) &&
  isObjectValid(input['page'], true) &&
  hasKeys(input['page'], ['isComplete', 'records', 'nextCursor', 'totalItems']) &&
  typeof input['page']['isComplete'] === 'boolean' &&
  isInteger(input['page']['totalItems']) &&
  (input['page']['nextCursor'] === null || typeof input['page']['nextCursor'] === 'string') &&
  Array.isArray(input['page']['records']) &&
  input['page']['records'].every(
    (record: unknown) =>
      isObjectValid(record, true) &&
      hasKeys(record, ['item', 'nextCursor']) &&
      (record['nextCursor'] === null || typeof record['nextCursor'] === 'string') &&
      isObjectValid(record['item'], true) &&
      typeof record['item']['kind'] === 'string' &&
      ['agent', 'diagnostic', 'coverage', 'metadata'].includes(record['item']['kind']) &&
      hasKeys(record['item'], ['kind', record['item']['kind']]) &&
      isObjectValid(record['item'][record['item']['kind']], true),
  );
const isSource = (input: unknown): boolean => input === 'instructions' || input === 'repository';
const isFilePageRequest = (input: Record<string, unknown>): boolean =>
  isRepositoryPath(input['path']) &&
  isInteger(input['offset']) &&
  isInteger(input['maxBytes']) &&
  input['maxBytes'] > 0 &&
  input['maxBytes'] <= NODE_INSPECTION_FILE_PAGE_BYTES;
const isInstructionSource = (input: unknown): boolean =>
  input === null ||
  (isObjectValid(input, true) && hasKeys(input, ['snapshot']) && isSnapshot(input['snapshot']));
const isRequest = (input: unknown): boolean => {
  if (!isObjectValid(input, true)) return false;
  switch (input['method']) {
    case 'getEntry':
    case 'readLinkText':
      return (
        hasKeys(input, ['method', 'path', 'source']) &&
        isRepositoryPath(input['path']) &&
        isSource(input['source'])
      );
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
        hasKeys(input, ['method', 'path', 'maxBytes', 'offset', 'source']) &&
        isSource(input['source']) &&
        isFilePageRequest(input)
      );
    default:
      return false;
  }
};

/** Validates closed control envelopes and their typed operation payloads on both bridges. */
const isMessage = (input: unknown): input is INodeInspectionMessage => {
  if (
    !isObjectValid(input, true) ||
    typeof input['attemptId'] !== 'string' ||
    !/^[a-f0-9]{32}$/.test(input['attemptId'])
  )
    return false;
  const keys = ['attemptId', 'kind'];
  switch (input['kind']) {
    case 'start':
      return (
        hasKeys(input, [...keys, 'snapshot', 'instructions', 'limits', 'deadline']) &&
        isSnapshot(input['snapshot']) &&
        isInstructionSource(input['instructions']) &&
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
    case 'reader-failure':
    case 'failure':
      return (
        hasKeys(input, [
          ...keys,
          'failure',
          ...(input['kind'] === 'reader-failure' ? ['requestId'] : []),
        ]) &&
        (input['kind'] !== 'reader-failure' || isInteger(input['requestId'])) &&
        isObjectValid(input['failure'], true) &&
        hasKeys(input['failure'], ['family', 'options']) &&
        ['configuration', 'operation', 'repository', 'path'].includes(
          String(input['failure']['family']),
        ) &&
        isObjectValid(input['failure']['options'], true)
      );
    default:
      return false;
  }
};

/**
 * Admits a complete bounded record before serialization; no record is truncated.
 * @returns One private JSON frame.
 * @throws
 * - RESOURCE_LIMIT_EXCEEDED: A Core resource limit was exceeded.
 * - INSPECTION_PROCESS_FAILED: The isolated project inspection failed.
 */
export const encodeInspectionMessage = (message: INodeInspectionMessage): string => {
  let bytes: number;
  try {
    bytes = measureJsonBytes(message, NODE_INSPECTION_MESSAGE_BYTES);
  } catch (error) {
    throw createInspectionProcessFailure(error);
  }
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

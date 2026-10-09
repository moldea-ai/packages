import { Buffer } from 'node:buffer';

import {
  isRepositoryPath,
  parseRepositoryPath,
  RepositorySourceException,
  type IRepositoryEntry,
  type IRepositoryEntryPage,
  type IRepositoryFilePage,
  type IRepositoryReader,
  type IRepositorySnapshot,
} from '@moldea.ai/repository';

import { NODE_INSPECTION_FILE_PAGE_BYTES } from './constants.js';
import type { INodeReaderRequest } from './types.js';

const invalidSource = (): never => {
  throw new RepositorySourceException({
    code: 'INVALID_SOURCE_DATA',
    operation: 'create-reader',
    path: null,
    retryable: false,
  });
};
const isRecord = (input: unknown): input is Record<string, unknown> =>
  input !== null && typeof input === 'object' && !Array.isArray(input);
const isInteger = (input: unknown): input is number =>
  typeof input === 'number' && Number.isSafeInteger(input) && input >= 0;
const keysMatch = (input: Record<string, unknown>, keys: string[]): boolean =>
  Object.keys(input).length === keys.length && keys.every((key) => Object.hasOwn(input, key));

/** Validates the immutable source identity without coercing unknown boundary fields. */
const parseSnapshot = (input: unknown): IRepositorySnapshot => {
  if (
    !isRecord(input) ||
    !keysMatch(input, ['id', 'sourceKind']) ||
    typeof input['id'] !== 'string' ||
    input['id'].length === 0 ||
    typeof input['sourceKind'] !== 'string' ||
    input['sourceKind'].length === 0
  )
    return invalidSource();
  return { id: input['id'], sourceKind: input['sourceKind'] };
};

/** Converts one validated metadata-only repository entry. */
export const parseRpcEntry = (input: unknown): IRepositoryEntry | null => {
  if (input === null) return null;
  if (
    !isRecord(input) ||
    !keysMatch(input, ['path', 'type', 'byteLength', 'contentIdentity']) ||
    !isRepositoryPath(input['path']) ||
    (input['type'] !== 'file' && input['type'] !== 'directory' && input['type'] !== 'symlink') ||
    (input['byteLength'] !== null && !isInteger(input['byteLength'])) ||
    (input['contentIdentity'] !== null && typeof input['contentIdentity'] !== 'string')
  )
    return invalidSource();
  return {
    path: input['path'],
    type: input['type'],
    byteLength: input['byteLength'],
    contentIdentity: input['contentIdentity'],
  };
};

/** Converts a bounded listing page while retaining snapshot and continuation contracts. */
export const parseRpcEntryPage = (input: unknown): IRepositoryEntryPage => {
  if (
    !isRecord(input) ||
    !keysMatch(input, ['entries', 'isComplete', 'nextCursor', 'snapshot']) ||
    !Array.isArray(input['entries']) ||
    input['entries'].length > 128 ||
    typeof input['isComplete'] !== 'boolean' ||
    (input['nextCursor'] !== null && typeof input['nextCursor'] !== 'string')
  )
    return invalidSource();
  const entries: IRepositoryEntry[] = [];
  for (const candidate of input['entries']) {
    const entry = parseRpcEntry(candidate);
    if (entry === null) return invalidSource();
    entries.push(entry);
  }
  return {
    entries,
    isComplete: input['isComplete'],
    nextCursor: input['nextCursor'],
    snapshot: parseSnapshot(input['snapshot']),
  };
};

/** Decodes only an admitted 64 KiB binary page, never a complete repository file. */
export const parseRpcFilePage = (input: unknown): IRepositoryFilePage => {
  if (
    !isRecord(input) ||
    !keysMatch(input, ['bytes', 'isComplete', 'nextOffset', 'offset', 'snapshot', 'totalBytes']) ||
    typeof input['bytes'] !== 'string' ||
    input['bytes'].length > Math.ceil(NODE_INSPECTION_FILE_PAGE_BYTES / 3) * 4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input['bytes']) ||
    typeof input['isComplete'] !== 'boolean' ||
    !isInteger(input['offset']) ||
    !isInteger(input['totalBytes']) ||
    (input['nextOffset'] !== null && !isInteger(input['nextOffset']))
  )
    return invalidSource();
  const bytes = Buffer.from(input['bytes'], 'base64');
  if (
    bytes.byteLength > NODE_INSPECTION_FILE_PAGE_BYTES ||
    bytes.toString('base64') !== input['bytes']
  )
    return invalidSource();
  return {
    bytes,
    isComplete: input['isComplete'],
    nextOffset: input['nextOffset'],
    offset: input['offset'],
    snapshot: parseSnapshot(input['snapshot']),
    totalBytes: input['totalBytes'],
  };
};

/**
 * Calls the real reader with inspection cancellation and returns a bounded transport value.
 * Reader failures propagate unchanged to the parent inspection owner.
 * @returns A metadata value or encoded byte page after actual reader settlement.
 * @throws
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
export const executeRepositoryRpc = async (
  reader: IRepositoryReader,
  request: INodeReaderRequest,
  signal: AbortSignal,
): Promise<unknown> => {
  if (request.method === 'getEntry')
    return parseRpcEntry(await reader.getEntry(parseRepositoryPath(request.path), { signal }));
  if (request.method === 'listEntriesPage')
    return parseRpcEntryPage(
      await reader.listEntriesPage({
        maxEntries: request.maxEntries,
        signal,
        ...(request.prefix === undefined ? {} : { prefix: parseRepositoryPath(request.prefix) }),
        ...(request.cursor === undefined ? {} : { cursor: request.cursor }),
      }),
    );
  const page = await reader.readFilePage(parseRepositoryPath(request.path), {
    maxBytes: request.maxBytes,
    offset: request.offset,
    signal,
  });
  if (!(page.bytes instanceof Uint8Array) || page.bytes.byteLength > request.maxBytes)
    return invalidSource();
  const result = {
    ...page,
    bytes: Buffer.from(page.bytes.buffer, page.bytes.byteOffset, page.bytes.byteLength).toString(
      'base64',
    ),
  };
  parseRpcFilePage(result);
  return result;
};

import {
  RepositorySourceException,
  parseRepositoryPath,
  type IRepositoryFilePage,
  type IRepositoryPath,
  type IRepositoryReader,
} from '@moldea.ai/repository';

import type {
  ICanonicalContentPageInput,
  ICanonicalContentPageResult,
} from '../contracts/index.js';
import { CoreOperationException } from '../exceptions/index.js';
import { freezeRecursively } from '../immutable/index.js';
import type { ICoreOptionsSnapshot } from '../options/index.js';

const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

const invalidArgument = (): never => {
  throw new CoreOperationException({
    code: 'INVALID_ARGUMENT',
    operation: 'read-canonical-content-page',
  });
};

const invalidContent = (): never => {
  throw new CoreOperationException({
    code: 'CONTENT_INVALID',
    operation: 'read-canonical-content-page',
  });
};

const isRepositoryReader = (candidate: unknown): candidate is IRepositoryReader =>
  typeof candidate === 'object' &&
  candidate !== null &&
  typeof (candidate as Partial<IRepositoryReader>).getEntry === 'function' &&
  typeof (candidate as Partial<IRepositoryReader>).readFilePage === 'function';

const readBytes = async (
  repository: IRepositoryReader,
  path: IRepositoryPath,
  offset: number,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<{ readonly bytes: Uint8Array; readonly lastPage: IRepositoryFilePage }> => {
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  let nextOffset = offset;
  let lastPage: IRepositoryFilePage | null = null;
  let totalBytes: number | null = null;

  while (byteLength < maxBytes) {
    const page = await repository.readFilePage(path, {
      maxBytes: maxBytes - byteLength,
      offset: nextOffset,
      ...(signal === undefined ? {} : { signal }),
    });

    if (
      page.snapshot.id !== repository.snapshot.id ||
      page.offset !== nextOffset ||
      page.bytes.byteLength > maxBytes - byteLength ||
      page.totalBytes < page.offset + page.bytes.byteLength ||
      (totalBytes !== null && page.totalBytes !== totalBytes) ||
      (page.bytes.byteLength === 0 && !page.isComplete)
    ) {
      throw new RepositorySourceException({
        code: 'INVALID_SOURCE_DATA',
        operation: 'read-file-page',
        path,
        retryable: false,
      });
    }

    chunks.push(page.bytes);
    byteLength += page.bytes.byteLength;
    totalBytes = page.totalBytes;
    lastPage = page;

    if (page.isComplete || byteLength === maxBytes) {
      break;
    }

    if (page.nextOffset !== page.offset + page.bytes.byteLength) {
      throw new RepositorySourceException({
        code: 'INVALID_SOURCE_DATA',
        operation: 'read-file-page',
        path,
        retryable: false,
      });
    }

    nextOffset = page.nextOffset;
  }

  if (lastPage === null) {
    return invalidArgument();
  }

  const bytes = new Uint8Array(byteLength);
  let writeOffset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, writeOffset);
    writeOffset += chunk.byteLength;
  }

  return { bytes, lastPage };
};

const decodeSafePrefix = (bytes: Uint8Array, maximumBytes: number): [string, number] => {
  const minimumCandidate = Math.max(0, maximumBytes - 3);

  for (let end = maximumBytes; end >= minimumCandidate; end -= 1) {
    try {
      const content = decoder.decode(bytes.subarray(0, end));

      if (end === 0 && bytes.byteLength > 0) {
        continue;
      }

      return [content, end];
    } catch {
      // a UTF-8 scalar may cross the requested byte boundary by at most three bytes
    }
  }

  return invalidContent();
};

/** Reads one explicit canonical file range without materializing the complete file. */
export const readCanonicalContentPage = async (
  input: ICanonicalContentPageInput,
  options: ICoreOptionsSnapshot,
): Promise<ICanonicalContentPageResult> => {
  if (
    typeof input !== 'object' ||
    input === null ||
    Reflect.ownKeys(input).some(
      (key) =>
        key !== 'maxBytes' &&
        key !== 'offset' &&
        key !== 'path' &&
        key !== 'repository' &&
        key !== 'signal',
    ) ||
    !isRepositoryReader(input.repository) ||
    !Number.isSafeInteger(input.maxBytes) ||
    input.maxBytes < 1 ||
    input.maxBytes > options.limits.maxFileBytes ||
    !Number.isSafeInteger(input.offset) ||
    input.offset < 0
  ) {
    return invalidArgument();
  }

  const path = parseRepositoryPath(input.path);

  if (!path.startsWith('/moldea/')) {
    return invalidArgument();
  }

  const operationOptions = input.signal === undefined ? undefined : { signal: input.signal };
  const entry = await input.repository.getEntry(path, operationOptions);

  if (entry === null) {
    throw new RepositorySourceException({
      code: 'ENTRY_NOT_FOUND',
      operation: 'read-file-page',
      path,
      retryable: false,
    });
  }

  if (entry.type !== 'file' || entry.byteLength === null) {
    throw new RepositorySourceException({
      code: 'ENTRY_NOT_FILE',
      operation: 'read-file-page',
      path,
      retryable: false,
    });
  }

  if (entry.byteLength > options.limits.maxFileBytes) {
    throw new CoreOperationException({
      code: 'RESOURCE_LIMIT_EXCEEDED',
      limit: 'maxFileBytes',
      operation: 'read-canonical-content-page',
    });
  }

  if (input.offset > entry.byteLength) {
    return invalidArgument();
  }

  if (input.offset === entry.byteLength) {
    return freezeRecursively({
      byteEnd: input.offset,
      byteStart: input.offset,
      content: '',
      contentIdentity: entry.contentIdentity,
      isComplete: true,
      nextOffset: null,
      path,
      source: input.repository.snapshot,
      totalBytes: entry.byteLength,
    });
  }

  const lookaheadBytes = Math.min(entry.byteLength - input.offset, input.maxBytes + 3);
  const { bytes, lastPage } = await readBytes(
    input.repository,
    path,
    input.offset,
    lookaheadBytes,
    input.signal,
  );

  if (lastPage.totalBytes !== entry.byteLength || ((bytes[0] as number) & 0xc0) === 0x80) {
    return invalidArgument();
  }

  const maximumChunkBytes = Math.min(input.maxBytes, bytes.byteLength);
  const [content, consumedBytes] = decodeSafePrefix(bytes, maximumChunkBytes);
  const byteEnd = input.offset + consumedBytes;
  const isComplete = byteEnd === entry.byteLength;

  return freezeRecursively({
    byteEnd,
    byteStart: input.offset,
    content,
    contentIdentity: entry.contentIdentity,
    isComplete,
    nextOffset: isComplete ? null : byteEnd,
    path,
    source: input.repository.snapshot,
    totalBytes: entry.byteLength,
  });
};

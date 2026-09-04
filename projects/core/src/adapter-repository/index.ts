import {
  REPOSITORY_ROOT,
  RepositorySourceException,
  compareRepositoryPaths,
  parseRepositoryPath,
  type IRepositoryEntry,
  type IRepositoryOperationOptions,
  type IRepositoryPath,
} from '@moldea.ai/repository';

import type { IRuntimeAdapterRepository } from '../adapter/index.js';
import { CoreOperationException } from '../exceptions/index.js';

const invalidSourceData = (
  operation: 'list-entries-page' | 'read-file-page',
  path: IRepositoryPath,
): never => {
  throw new RepositorySourceException({
    code: 'INVALID_SOURCE_DATA',
    operation,
    path,
    retryable: false,
  });
};

const throwResourceLimitExceeded = (
  limit: 'maxEntries' | 'maxFileBytes' | 'maxTotalBytesRead',
): never => {
  throw new CoreOperationException({
    code: 'RESOURCE_LIMIT_EXCEEDED',
    limit,
    operation: 'validate-project',
  });
};

/** Reads one complete adapter source file through bounded repository pages. */
export const readRuntimeAdapterFile = async (
  repository: IRuntimeAdapterRepository,
  path: IRepositoryPath,
  options?: IRepositoryOperationOptions,
): Promise<Uint8Array> => {
  const parsedPath = parseRepositoryPath(path);
  const entry = await repository.getEntry(parsedPath, options);

  if (entry === null) {
    throw new RepositorySourceException({
      code: 'ENTRY_NOT_FOUND',
      operation: 'read-file-page',
      path: parsedPath,
      retryable: false,
    });
  }

  if (entry.type !== 'file' || entry.byteLength === null) {
    throw new RepositorySourceException({
      code: 'ENTRY_NOT_FILE',
      operation: 'read-file-page',
      path: parsedPath,
      retryable: false,
    });
  }

  if (entry.byteLength > repository.limits.maxFileBytes) {
    return throwResourceLimitExceeded('maxFileBytes');
  }

  const content = new Uint8Array(entry.byteLength);
  let offset = 0;
  let isFirstPage = true;

  while (isFirstPage || offset < entry.byteLength) {
    isFirstPage = false;
    options?.signal?.throwIfAborted();
    const page = await repository.readFilePage(parsedPath, {
      maxBytes: Math.min(repository.limits.maxPageBytes, Math.max(1, entry.byteLength - offset)),
      offset,
      ...(options?.signal === undefined ? {} : { signal: options.signal }),
    });

    if (
      page.snapshot.id !== repository.snapshot.id ||
      page.offset !== offset ||
      page.totalBytes !== entry.byteLength ||
      !(page.bytes instanceof Uint8Array) ||
      page.bytes.byteLength > repository.limits.maxPageBytes ||
      page.bytes.byteLength > content.byteLength - offset ||
      (page.bytes.byteLength === 0 && !page.isComplete)
    ) {
      return invalidSourceData('read-file-page', parsedPath);
    }

    content.set(page.bytes, offset);
    offset += page.bytes.byteLength;

    if (page.isComplete) {
      if (page.nextOffset !== null || offset !== content.byteLength) {
        return invalidSourceData('read-file-page', parsedPath);
      }

      return content;
    }

    if (page.nextOffset !== offset) {
      return invalidSourceData('read-file-page', parsedPath);
    }
  }

  return invalidSourceData('read-file-page', parsedPath);
};

/** Iterates one adapter-scoped descendant listing through bounded pages. */
export const iterateRuntimeAdapterEntries = (
  repository: IRuntimeAdapterRepository,
  options?: IRepositoryOperationOptions & { readonly prefix?: IRepositoryPath },
): AsyncIterable<IRepositoryEntry> => {
  const prefix =
    options?.prefix === undefined ? REPOSITORY_ROOT : parseRepositoryPath(options.prefix);

  return {
    async *[Symbol.asyncIterator](): AsyncIterator<IRepositoryEntry> {
      let cursor: string | undefined;
      let entryCount = 0;
      let previousPath: IRepositoryPath | null = null;

      do {
        options?.signal?.throwIfAborted();
        const page = await repository.listEntriesPage({
          ...(cursor === undefined ? {} : { cursor }),
          maxEntries: repository.limits.maxPageEntries,
          prefix,
          ...(options?.signal === undefined ? {} : { signal: options.signal }),
        });

        if (
          page.snapshot.id !== repository.snapshot.id ||
          page.entries.length > repository.limits.maxPageEntries ||
          (page.entries.length === 0 && !page.isComplete)
        ) {
          return invalidSourceData('list-entries-page', prefix);
        }

        for (const entry of page.entries) {
          if (previousPath !== null && compareRepositoryPaths(previousPath, entry.path) >= 0) {
            return invalidSourceData('list-entries-page', entry.path);
          }

          entryCount += 1;
          if (entryCount > repository.limits.maxEntries) {
            return throwResourceLimitExceeded('maxEntries');
          }

          previousPath = entry.path;
          yield entry;
        }

        if (page.isComplete) {
          if (page.nextCursor !== null) {
            return invalidSourceData('list-entries-page', prefix);
          }

          return;
        }

        if (page.nextCursor === null || page.nextCursor === cursor) {
          return invalidSourceData('list-entries-page', prefix);
        }

        cursor = page.nextCursor;
      } while (true);
    },
  };
};

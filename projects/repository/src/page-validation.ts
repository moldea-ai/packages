import { RepositorySourceException, type IRepositoryOperation } from './exceptions.js';
import type { IRepositoryPath } from './repository-path.js';

/** Validates a positive safe integer owned by a page request. */
export const parsePositivePageInteger = (
  value: number,
  operation: IRepositoryOperation,
  path: IRepositoryPath | null,
): number => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RepositorySourceException({
      code: 'INVALID_PAGE_REQUEST',
      operation,
      path,
      retryable: false,
    });
  }

  return value;
};

/** Validates a non-negative safe integer owned by a page request. */
export const parsePageOffset = (
  value: number,
  operation: IRepositoryOperation,
  path: IRepositoryPath,
): number => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RepositorySourceException({
      code: 'INVALID_PAGE_REQUEST',
      operation,
      path,
      retryable: false,
    });
  }

  return value;
};

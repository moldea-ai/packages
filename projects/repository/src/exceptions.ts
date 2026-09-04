import { Exception } from 'error-message-utils';

import type { IRepositoryPath } from './repository-path.js';

// stable source failure codes and operation identifiers
export type IRepositorySourceErrorCode =
  | 'ENTRY_NOT_FOUND'
  | 'ENTRY_NOT_FILE'
  | 'ENTRY_NOT_DIRECTORY'
  | 'INVALID_PAGE_REQUEST'
  | 'ACCESS_DENIED'
  | 'SOURCE_UNAVAILABLE'
  | 'SNAPSHOT_CHANGED'
  | 'PROVIDER_INCOMPLETE'
  | 'INVALID_SOURCE_DATA'
  | 'RESOURCE_LIMIT_EXCEEDED'
  | 'ABORTED';

export type IRepositoryOperation =
  | 'create-reader'
  | 'create-comparison'
  | 'get-entry'
  | 'read-file-page'
  | 'list-entries-page'
  | 'list-changes-page';

// safe construction options for repository path and source exceptions
export interface IRepositoryPathExceptionOptions {
  readonly cause?: unknown;
}

export interface IRepositoryResourceUsage {
  readonly dimension: string;
  readonly limit: number;
  readonly observed: number;
}

export interface IRepositorySourceExceptionOptions {
  readonly cause?: unknown;
  readonly code: IRepositorySourceErrorCode;
  readonly operation: IRepositoryOperation;
  readonly path: IRepositoryPath | null;
  readonly resource?: IRepositoryResourceUsage;
  readonly retryable: boolean;
}

const SOURCE_ERROR_MESSAGES = {
  ABORTED: 'The repository operation was aborted.',
  ACCESS_DENIED: 'Access to the repository source was denied.',
  ENTRY_NOT_DIRECTORY: 'The requested repository entry is not a directory.',
  ENTRY_NOT_FILE: 'The requested repository entry is not a file.',
  ENTRY_NOT_FOUND: 'The requested repository entry was not found.',
  INVALID_PAGE_REQUEST: 'The repository page request is invalid.',
  INVALID_SOURCE_DATA: 'The repository source returned invalid data.',
  PROVIDER_INCOMPLETE: 'The repository provider cannot expose a complete result.',
  RESOURCE_LIMIT_EXCEEDED: 'A named repository resource limit was exceeded.',
  SNAPSHOT_CHANGED: 'The repository snapshot changed during the operation.',
  SOURCE_UNAVAILABLE: 'The repository source is unavailable.',
} as const satisfies Readonly<Record<IRepositorySourceErrorCode, string>>;

const attachCause = (exception: Error, cause: unknown): void => {
  if (cause === undefined) {
    return;
  }

  Object.defineProperty(exception, 'cause', {
    configurable: true,
    enumerable: false,
    value: cause,
    writable: false,
  });
};

/** Represents malformed repository-root logical path input. */
export class RepositoryPathException extends Exception {
  public override readonly code: 'INVALID_REPOSITORY_PATH';

  /** Creates a safe path exception without exposing the rejected value. */
  public constructor(options?: IRepositoryPathExceptionOptions) {
    super('The repository path is invalid.', 'INVALID_REPOSITORY_PATH');
    this.code = 'INVALID_REPOSITORY_PATH';
    this.name = 'RepositoryPathException';
    attachCause(this, options?.cause);
  }
}

/** Represents an operational failure while reading a repository source. */
export class RepositorySourceException extends Exception {
  public override readonly code: IRepositorySourceErrorCode;

  public readonly operation: IRepositoryOperation;

  public readonly path: IRepositoryPath | null;

  public readonly resource: IRepositoryResourceUsage | null;

  public readonly retryable: boolean;

  /** Creates a source exception with documented operation and resource metadata. */
  public constructor(options: IRepositorySourceExceptionOptions) {
    super(SOURCE_ERROR_MESSAGES[options.code], options.code);
    this.code = options.code;
    this.name = 'RepositorySourceException';
    this.operation = options.operation;
    this.path = options.path;
    this.resource = options.resource ?? null;
    this.retryable = options.retryable;
    attachCause(this, options.cause);
  }
}

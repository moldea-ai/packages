import { Exception } from 'error-message-utils';

// stable configuration and operation failure codes
export type ICoreConfigurationErrorCode =
  | 'DUPLICATE_ADAPTER_ID'
  | 'RESERVED_ADAPTER_ID'
  | 'INVALID_ADAPTER_DEFINITION'
  | 'INVALID_RESOURCE_LIMIT';

export type ICoreOperationErrorCode =
  | 'INVALID_ARGUMENT'
  | 'ABORTED'
  | 'RESOURCE_LIMIT_EXCEEDED'
  | 'ADAPTER_EXECUTION_FAILED'
  | 'INSPECTION_BUSY'
  | 'INSPECTION_TIMEOUT'
  | 'INSPECTION_PROCESS_FAILED'
  | 'CONTENT_INVALID';

const CORE_OPERATIONS = [
  'create-core',
  'normalize-text',
  'calculate-content-digest',
  'parse-manifest',
  'match-manifest-scope',
  'parse-decision',
  'create-project-inspection',
  'read-canonical-content-page',
  'validate-project',
  'validate-adapter',
] as const;

export type ICoreOperation = (typeof CORE_OPERATIONS)[number];

// safe construction options for exported Core exceptions
export interface ICoreConfigurationExceptionOptions {
  readonly code: ICoreConfigurationErrorCode;
  readonly operation: ICoreOperation;
  readonly adapterId?: string;
  readonly cause?: unknown;
}

interface ICoreOperationExceptionOptionsBase {
  readonly operation: ICoreOperation;
  readonly adapterId?: string;
  readonly agentId?: string;
  readonly cause?: unknown;
}

// logical budget refusals and verified isolated-worker heap exhaustion
export type ICoreResourceLimitNextAction =
  'reduce-input-or-increase-limit' | 'review-inspection-capacity';

export type ICoreOperationExceptionOptions = ICoreOperationExceptionOptionsBase &
  (
    | {
        readonly code: 'RESOURCE_LIMIT_EXCEEDED';
        readonly limit: string;
        readonly limitMaximum: number;
        readonly nextAction: 'reduce-input-or-increase-limit';
        readonly observedUsage: number;
      }
    | {
        readonly code: 'RESOURCE_LIMIT_EXCEEDED';
        readonly limit: 'maxAnalysisHeapBytes';
        readonly limitMaximum: number;
        readonly nextAction: 'review-inspection-capacity';
        readonly observedUsage: null;
      }
    | {
        readonly code: 'RESOURCE_LIMIT_EXCEEDED';
        readonly limit: 'maxInspectionMessageBytes' | 'maxReaderRequests';
        readonly limitMaximum: number;
        readonly nextAction: null;
        readonly observedUsage: number;
      }
    | {
        readonly code: Exclude<ICoreOperationErrorCode, 'RESOURCE_LIMIT_EXCEEDED'>;
        readonly limit?: never;
        readonly limitMaximum?: never;
        readonly nextAction?: never;
        readonly observedUsage?: never;
      }
  );

const CONFIGURATION_ERROR_MESSAGES = {
  DUPLICATE_ADAPTER_ID: 'A runtime adapter ID is registered more than once.',
  INVALID_ADAPTER_DEFINITION: 'A runtime adapter definition is invalid.',
  INVALID_RESOURCE_LIMIT: 'A Core resource limit is invalid.',
  RESERVED_ADAPTER_ID: 'A reserved runtime adapter ID was supplied.',
} as const satisfies Readonly<Record<ICoreConfigurationErrorCode, string>>;

const OPERATION_ERROR_MESSAGES = {
  ABORTED: 'The Core operation was aborted.',
  ADAPTER_EXECUTION_FAILED: 'A runtime adapter failed during inspection.',
  CONTENT_INVALID: 'The canonical content is not valid UTF-8 text.',
  INVALID_ARGUMENT: 'The Core operation received an invalid argument.',
  INSPECTION_BUSY: 'Project inspection capacity is busy. Try again shortly.',
  INSPECTION_TIMEOUT: 'The isolated project inspection timed out.',
  INSPECTION_PROCESS_FAILED: 'The isolated project inspection failed.',
  RESOURCE_LIMIT_EXCEEDED: 'A Core resource limit was exceeded.',
} as const satisfies Readonly<Record<ICoreOperationErrorCode, string>>;

const OPERATION_ERROR_RETRYABILITY = {
  ABORTED: true,
  ADAPTER_EXECUTION_FAILED: false,
  CONTENT_INVALID: false,
  INVALID_ARGUMENT: false,
  INSPECTION_BUSY: true,
  INSPECTION_TIMEOUT: true,
  INSPECTION_PROCESS_FAILED: false,
  RESOURCE_LIMIT_EXCEEDED: false,
} as const satisfies Readonly<Record<ICoreOperationErrorCode, boolean>>;

/** Checks a transported operation against the authoritative Core operation set. */
export const isCoreOperation = (input: unknown): input is ICoreOperation =>
  CORE_OPERATIONS.some((operation) => operation === input);

/** Checks a transported configuration code against the authoritative message registry. */
export const isCoreConfigurationErrorCode = (
  input: unknown,
): input is ICoreConfigurationErrorCode =>
  typeof input === 'string' && Object.hasOwn(CONFIGURATION_ERROR_MESSAGES, input);

/** Checks a transported operation code against the authoritative message registry. */
export const isCoreOperationErrorCode = (input: unknown): input is ICoreOperationErrorCode =>
  typeof input === 'string' && Object.hasOwn(OPERATION_ERROR_MESSAGES, input);

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

/** Represents invalid immutable Core configuration. */
export class CoreConfigurationException extends Exception {
  public override readonly code: ICoreConfigurationErrorCode;

  public readonly operation: ICoreOperation;

  public readonly adapterId: string | null;

  /** Creates a configuration exception with safe adapter metadata. */
  public constructor(options: ICoreConfigurationExceptionOptions) {
    super(CONFIGURATION_ERROR_MESSAGES[options.code], options.code);
    this.code = options.code;
    this.name = 'CoreConfigurationException';
    this.operation = options.operation;
    this.adapterId = options.adapterId ?? null;
    attachCause(this, options.cause);
  }
}

/** Represents an operational failure that prevented Core from completing. */
export class CoreOperationException extends Exception {
  public override readonly code: ICoreOperationErrorCode;

  public readonly operation: ICoreOperation;

  public readonly retryable: boolean;

  public readonly adapterId: string | null;

  public readonly agentId: string | null;

  public readonly limit: string | null;

  public readonly limitMaximum: number | null;

  public readonly nextAction: ICoreResourceLimitNextAction | null;

  public readonly observedUsage: number | null;

  /** Creates an operation exception with derived retry and safe scope metadata. */
  public constructor(options: ICoreOperationExceptionOptions) {
    super(OPERATION_ERROR_MESSAGES[options.code], options.code);
    this.code = options.code;
    this.name = 'CoreOperationException';
    this.operation = options.operation;
    this.retryable = OPERATION_ERROR_RETRYABILITY[options.code];
    this.adapterId = options.adapterId ?? null;
    this.agentId = options.agentId ?? null;
    this.limit = options.limit ?? null;
    this.limitMaximum = options.limitMaximum ?? null;
    this.nextAction = options.nextAction ?? null;
    this.observedUsage = options.observedUsage ?? null;
    attachCause(this, options.cause);
  }
}

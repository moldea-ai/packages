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
  | 'CONTENT_INVALID';

export type ICoreOperation =
  | 'create-core'
  | 'normalize-text'
  | 'calculate-content-digest'
  | 'parse-manifest'
  | 'match-manifest-scope'
  | 'parse-decision'
  | 'create-project-inspection'
  | 'read-canonical-content-page'
  | 'validate-project'
  | 'validate-adapter';

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

// complete resource-refusal metadata required by Core 5
export type ICoreResourceLimitNextAction = 'reduce-input-or-increase-limit';

export type ICoreOperationExceptionOptions = ICoreOperationExceptionOptionsBase &
  (
    | {
        readonly code: 'RESOURCE_LIMIT_EXCEEDED';
        readonly limit: string;
        readonly limitMaximum: number;
        readonly nextAction: ICoreResourceLimitNextAction;
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
  RESOURCE_LIMIT_EXCEEDED: 'A Core resource limit was exceeded.',
} as const satisfies Readonly<Record<ICoreOperationErrorCode, string>>;

const OPERATION_ERROR_RETRYABILITY = {
  ABORTED: true,
  ADAPTER_EXECUTION_FAILED: false,
  CONTENT_INVALID: false,
  INVALID_ARGUMENT: false,
  RESOURCE_LIMIT_EXCEEDED: false,
} as const satisfies Readonly<Record<ICoreOperationErrorCode, boolean>>;

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

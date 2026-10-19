import type { IRepositoryLinkResolver, IRepositoryReader } from '@moldea.ai/repository';

import { countBindingCoverage } from '../binding-coverage/index.js';
import type {
  IMoldeaProjectIndex,
  IProjectInstructionSource,
  IProjectValidationInput,
  IProjectValidationResult,
} from '../contracts/index.js';
import { countDiagnosticsBySeverity } from '../diagnostic-utilities/index.js';
import { CoreOperationException } from '../exceptions/index.js';
import { freezeRecursively } from '../immutable/index.js';
import { createCoreOperationOptionsSnapshot, type ICoreOptionsSnapshot } from '../options/index.js';
import { createProjectSummary } from '../project-metadata/index.js';
import { createRepositoryInspectionSession } from '../repository-inspection-session/index.js';
import type { IRepositoryInspectionResourceUsage } from '../repository-inspection-session/index.js';
import { inspectUniversalProject } from '../universal-project-inspection/index.js';

interface IValidatedProjectValidationInput {
  readonly instructions?: IProjectInstructionSource;
  readonly repository: IRepositoryReader;
  readonly signal?: AbortSignal;
}

const isRecord = (candidate: unknown): candidate is Readonly<Record<string, unknown>> => {
  return typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate);
};

const invalidArgument = (): never => {
  throw new CoreOperationException({
    code: 'INVALID_ARGUMENT',
    operation: 'validate-project',
  });
};

const isRepositoryReader = (candidate: unknown): candidate is IRepositoryReader => {
  return (
    isRecord(candidate) &&
    isRecord(candidate['snapshot']) &&
    typeof candidate['snapshot']['id'] === 'string' &&
    typeof candidate['snapshot']['sourceKind'] === 'string' &&
    typeof candidate['compare'] === 'function' &&
    typeof candidate['getEntry'] === 'function' &&
    typeof candidate['listEntriesPage'] === 'function' &&
    typeof candidate['readFilePage'] === 'function'
  );
};

const isLinkResolver = (candidate: unknown): candidate is IRepositoryLinkResolver => {
  return (
    isRecord(candidate) &&
    isRecord(candidate['snapshot']) &&
    typeof candidate['snapshot']['id'] === 'string' &&
    typeof candidate['snapshot']['sourceKind'] === 'string' &&
    typeof candidate['resolveLink'] === 'function' &&
    typeof candidate['readLinkTargetPage'] === 'function'
  );
};

// a resolver must observe the same snapshot as the instruction reader it resolves for
const validateInstructions = (candidate: unknown): IProjectInstructionSource => {
  if (
    !isRecord(candidate) ||
    Reflect.ownKeys(candidate).some((key) => key !== 'reader' && key !== 'linkResolver')
  ) {
    return invalidArgument();
  }

  const reader = candidate['reader'];
  const linkResolver = candidate['linkResolver'];

  if (!isRepositoryReader(reader)) {
    return invalidArgument();
  }

  if (linkResolver === undefined) {
    return { reader };
  }

  if (!isLinkResolver(linkResolver) || linkResolver.snapshot.id !== reader.snapshot.id) {
    return invalidArgument();
  }

  return { linkResolver, reader };
};

const isAbortSignal = (candidate: unknown): candidate is AbortSignal => {
  return (
    isRecord(candidate) &&
    typeof candidate['aborted'] === 'boolean' &&
    typeof candidate['addEventListener'] === 'function' &&
    typeof candidate['removeEventListener'] === 'function'
  );
};

const validateInput = (candidate: unknown): IValidatedProjectValidationInput => {
  try {
    if (!isRecord(candidate)) {
      return invalidArgument();
    }

    const repository = candidate['repository'];
    const instructions = candidate['instructions'];
    const signal = candidate['signal'];

    if (
      Reflect.ownKeys(candidate).some(
        (key) => key !== 'repository' && key !== 'instructions' && key !== 'signal',
      ) ||
      !isRepositoryReader(repository) ||
      (signal !== undefined && !isAbortSignal(signal))
    ) {
      return invalidArgument();
    }

    return {
      ...(instructions === undefined ? {} : { instructions: validateInstructions(instructions) }),
      repository,
      ...(signal === undefined ? {} : { signal }),
    };
  } catch (error: unknown) {
    if (error instanceof CoreOperationException) {
      throw error;
    }

    return invalidArgument();
  }
};

// private body-bearing state shared only by Core validation and page projection
export interface IProjectValidationState {
  readonly project: IMoldeaProjectIndex | null;
  readonly resourceUsage: IRepositoryInspectionResourceUsage;
  readonly result: IProjectValidationResult;
}

/**
 * Inspects one coherent repository snapshot through universal file and export validation.
 * @param input The untrusted source-neutral reader, optional instruction source, and signal.
 * @param options The immutable Core configuration snapshot.
 * @returns A promise resolving to the frozen all-or-nothing project inspection result.
 * @throws
 * - INVALID_ARGUMENT: The Core operation received an invalid argument.
 * - INVALID_REPOSITORY_PATH: The repository path is invalid.
 * - ENTRY_NOT_FOUND: The requested repository entry was not found.
 * - ENTRY_NOT_FILE: The requested repository entry is not a file.
 * - ENTRY_NOT_DIRECTORY: The requested repository entry is not a directory.
 * - ACCESS_DENIED: Access to the repository source was denied.
 * - SOURCE_UNAVAILABLE: The repository source is unavailable.
 * - SNAPSHOT_CHANGED: The repository snapshot changed during the operation.
 * - PROVIDER_INCOMPLETE: The repository provider cannot expose a complete result.
 * - INVALID_SOURCE_DATA: The repository source returned invalid data.
 * - RESOURCE_LIMIT_EXCEEDED: A named repository resource limit was exceeded.
 * - RESOURCE_LIMIT_EXCEEDED: A Core resource limit was exceeded.
 * - ABORTED: The repository operation was aborted.
 * - ABORTED: The Core operation was aborted.
 */
export const validateProjectState = async (
  input: IProjectValidationInput,
  options: ICoreOptionsSnapshot,
): Promise<IProjectValidationState> => {
  const validatedInput = validateInput(input);
  const operationOptions = createCoreOperationOptionsSnapshot(options);
  const session = createRepositoryInspectionSession(
    validatedInput.repository,
    operationOptions.limits,
    validatedInput.signal,
    validatedInput.instructions,
  );
  const universal = await inspectUniversalProject(
    {
      session,
      ...(validatedInput.signal === undefined ? {} : { signal: validatedInput.signal }),
    },
    operationOptions,
  );

  session.throwIfAborted();
  const counts = countDiagnosticsBySeverity(universal.diagnostics);
  return freezeRecursively({
    project: universal.project,
    resourceUsage: session.getResourceUsage(),
    result: {
      diagnostics: universal.diagnostics,
      ...counts,
      coverage: universal.coverage,
      coverageCounts: countBindingCoverage(universal.coverage),
      formatVersion: universal.formatVersion,
      source: validatedInput.repository.snapshot,
      summary: universal.project === null ? null : createProjectSummary(universal.project),
      valid: counts.errorCount === 0,
    },
  });
};

/**
 * Validates one project without returning canonical document bodies.
 * @param input The source-neutral reader and optional cancellation signal.
 * @param options The immutable operation limits.
 * @returns A promise resolving to the complete validation result.
 * @throws
 * - INVALID_ARGUMENT: The Core operation received an invalid argument.
 * - INVALID_REPOSITORY_PATH: The repository path is invalid.
 * - ENTRY_NOT_FOUND: The requested repository entry was not found.
 * - ENTRY_NOT_FILE: The requested repository entry is not a file.
 * - ENTRY_NOT_DIRECTORY: The requested repository entry is not a directory.
 * - ACCESS_DENIED: Access to the repository source was denied.
 * - SOURCE_UNAVAILABLE: The repository source is unavailable.
 * - SNAPSHOT_CHANGED: The repository snapshot changed during the operation.
 * - PROVIDER_INCOMPLETE: The repository provider cannot expose a complete result.
 * - INVALID_SOURCE_DATA: The repository source returned invalid data.
 * - RESOURCE_LIMIT_EXCEEDED: A named repository resource limit was exceeded.
 * - RESOURCE_LIMIT_EXCEEDED: A Core resource limit was exceeded.
 * - ABORTED: The repository operation was aborted.
 * - ABORTED: The Core operation was aborted.
 */
export const validateProject = async (
  input: IProjectValidationInput,
  options: ICoreOptionsSnapshot,
): Promise<IProjectValidationResult> => (await validateProjectState(input, options)).result;

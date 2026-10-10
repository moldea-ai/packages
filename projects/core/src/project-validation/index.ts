import type { IRepositoryReader } from '@moldea.ai/repository';

import { validateRuntimeAdapterAvailability } from '../adapter-availability/index.js';
import { inspectRuntimeAdapters } from '../adapter-execution/index.js';
import type {
  IMoldeaProjectIndex,
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
    const signal = candidate['signal'];

    if (
      Reflect.ownKeys(candidate).some((key) => key !== 'repository' && key !== 'signal') ||
      !isRepositoryReader(repository) ||
      (signal !== undefined && !isAbortSignal(signal))
    ) {
      return invalidArgument();
    }

    return {
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
 * Inspects one coherent repository snapshot through universal and adapter validation.
 * @param input The untrusted source-neutral reader and optional cancellation signal.
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
 * - ADAPTER_EXECUTION_FAILED: A runtime adapter failed during inspection.
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
  );
  const universal = await inspectUniversalProject(
    {
      session,
      ...(validatedInput.signal === undefined ? {} : { signal: validatedInput.signal }),
    },
    operationOptions,
  );

  if (universal.project === null) {
    const counts = countDiagnosticsBySeverity(universal.diagnostics);

    return freezeRecursively({
      project: null,
      resourceUsage: session.getResourceUsage(),
      result: {
        diagnostics: universal.diagnostics,
        ...counts,
        evidence: [],
        formatVersion: universal.formatVersion,
        runtimeInspection: 'not-run',
        source: validatedInput.repository.snapshot,
        summary: null,
        valid: false,
      },
    });
  }

  const projectSummary = createProjectSummary(universal.project);

  const availabilityDiagnostics = validateRuntimeAdapterAvailability(
    universal.runtimeLocations,
    universal.project.formatVersion,
    operationOptions,
  );

  if (availabilityDiagnostics.length > 0) {
    const counts = countDiagnosticsBySeverity(availabilityDiagnostics);

    return freezeRecursively({
      project: universal.project,
      resourceUsage: session.getResourceUsage(),
      result: {
        diagnostics: availabilityDiagnostics,
        ...counts,
        evidence: [],
        formatVersion: universal.formatVersion,
        runtimeInspection: 'not-run',
        source: validatedInput.repository.snapshot,
        summary: projectSummary,
        valid: false,
      },
    });
  }

  const adapterInspection = await inspectRuntimeAdapters(
    universal.project,
    session,
    operationOptions,
    validatedInput.signal,
  );
  const counts = countDiagnosticsBySeverity(adapterInspection.diagnostics);
  const valid = counts.errorCount === 0;

  return freezeRecursively({
    project: universal.project,
    resourceUsage: session.getResourceUsage(),
    result: {
      diagnostics: adapterInspection.diagnostics,
      ...counts,
      evidence: adapterInspection.evidence,
      formatVersion: universal.formatVersion,
      runtimeInspection: counts.warningCount === 0 ? 'complete' : 'incomplete',
      source: validatedInput.repository.snapshot,
      summary: projectSummary,
      valid,
    },
  });
};

/**
 * Validates one project without returning canonical document bodies.
 * @param input The source-neutral reader and optional cancellation signal.
 * @param options The immutable adapter registry and operation limits.
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
 * - ADAPTER_EXECUTION_FAILED: A runtime adapter failed during inspection.
 */
export const validateProject = async (
  input: IProjectValidationInput,
  options: ICoreOptionsSnapshot,
): Promise<IProjectValidationResult> => (await validateProjectState(input, options)).result;

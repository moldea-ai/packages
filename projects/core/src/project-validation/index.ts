import type { IRepositoryReader } from '@moldea.ai/repository';

import { validateRuntimeAdapterAvailability } from '../adapter-availability/index.js';
import { inspectRuntimeAdapters } from '../adapter-execution/index.js';
import type {
  IMoldeaProjectIndex,
  IProjectValidationInput,
  IProjectValidationResult,
} from '../contracts/index.js';
import { CoreOperationException } from '../exceptions/index.js';
import { freezeRecursively } from '../immutable/index.js';
import { createCoreOperationOptionsSnapshot, type ICoreOptionsSnapshot } from '../options/index.js';
import { createProjectSummary } from '../project-metadata/index.js';
import { createRepositoryInspectionSession } from '../repository-inspection-session/index.js';
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
  readonly result: IProjectValidationResult;
}

/**
 * Inspects one coherent repository snapshot through universal and adapter validation.
 * @param input The untrusted source-neutral reader and optional cancellation signal.
 * @param options The immutable Core configuration snapshot.
 * @returns A promise resolving to the frozen all-or-nothing project inspection result.
 * @throws
 * - INVALID_ARGUMENT: The Core operation received an invalid argument.
 * - INVALID_REPOSITORY_PATH: A repository path is invalid.
 * - ENTRY_NOT_FOUND: A discovered file disappeared from the reader snapshot.
 * - ENTRY_NOT_FILE: A discovered file changed type during inspection.
 * - ENTRY_NOT_DIRECTORY: A discovered directory changed type during inspection.
 * - ACCESS_DENIED: Access to the repository source was denied.
 * - SOURCE_UNAVAILABLE: The repository source is unavailable.
 * - SNAPSHOT_CHANGED: The repository snapshot changed during inspection.
 * - INVALID_SOURCE_DATA: The repository reader returned invalid contract data.
 * - RESOURCE_LIMIT_EXCEEDED: A Core or repository resource limit was exceeded.
 * - ABORTED: Project inspection or a repository operation was aborted.
 * - ADAPTER_EXECUTION_FAILED: A runtime adapter failed or returned an invalid result.
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
    return freezeRecursively({
      project: null,
      result: {
        diagnostics: universal.diagnostics,
        evidence: [],
        formatVersion: universal.formatVersion,
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
    return freezeRecursively({
      project: universal.project,
      result: {
        diagnostics: availabilityDiagnostics,
        evidence: [],
        formatVersion: universal.formatVersion,
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
  const valid = adapterInspection.diagnostics.length === 0;

  return freezeRecursively({
    project: universal.project,
    result: {
      diagnostics: adapterInspection.diagnostics,
      evidence: adapterInspection.evidence,
      formatVersion: universal.formatVersion,
      source: validatedInput.repository.snapshot,
      summary: projectSummary,
      valid,
    },
  });
};

/** Validates one project without returning canonical document bodies. */
export const validateProject = async (
  input: IProjectValidationInput,
  options: ICoreOptionsSnapshot,
): Promise<IProjectValidationResult> => (await validateProjectState(input, options)).result;

import { compareCodePoints, deepFreeze } from 'jg-utilities';

import { RepositorySourceException, type IRepositoryPath } from '@moldea.ai/repository';

import { parseDecisionDocument } from '../decision/index.js';
import {
  validateDecisionGraph,
  type IDecisionGraphCandidate,
} from '../decision-graph-validation/index.js';
import { createCoreDiagnosticCollector } from '../diagnostic-utilities/index.js';
import type { ICoreDiagnostic } from '../diagnostics/index.js';
import { parseDecisionIdFromPath } from '../format-validation/index.js';
import type { IParsedDecision } from '../format/index.js';
import { createCoreOperationOptionsSnapshot, type ICoreOptionsSnapshot } from '../options/index.js';
import type { IRepositoryInspectionReader } from '../repository-inspection-session/index.js';

// internal repository-level decision result retained for later project indexing
export interface IDecisionGraphResult {
  readonly valid: boolean;
  readonly decisions: readonly IParsedDecision[];
  readonly diagnostics: readonly ICoreDiagnostic[];
}

const invalidSourceData = (path: IRepositoryPath): never => {
  throw new RepositorySourceException({
    code: 'INVALID_SOURCE_DATA',
    operation: 'read-file-page',
    path,
    retryable: false,
  });
};

const sortDecisions = (decisions: readonly IParsedDecision[]): IParsedDecision[] => {
  return [...decisions].sort((left, right) => {
    return compareCodePoints(left.id, right.id) || compareCodePoints(left.path, right.path);
  });
};

/**
 * Reads, parses, and validates every discovered decision through one repository snapshot.
 * @param repository The coherent source-neutral repository reader.
 * @param paths The decision candidates retained by canonical discovery.
 * @param options The immutable Core limit snapshot.
 * @param signal Optional cancellation forwarded to every repository read.
 * @returns A deeply immutable internal decision set and its deterministic diagnostics.
 * @throws
 * - ENTRY_NOT_FOUND: The requested repository entry was not found.
 * - ENTRY_NOT_FILE: The requested repository entry is not a file.
 * - ACCESS_DENIED: Access to the repository source was denied.
 * - SOURCE_UNAVAILABLE: The repository source is unavailable.
 * - SNAPSHOT_CHANGED: The repository snapshot changed during the operation.
 * - INVALID_SOURCE_DATA: The repository source returned invalid data.
 * - RESOURCE_LIMIT_EXCEEDED: A Core resource limit was exceeded.
 * - RESOURCE_LIMIT_EXCEEDED: A named repository resource limit was exceeded.
 * - ABORTED: The Core operation was aborted.
 * - ABORTED: The repository operation was aborted.
 */
export const readDecisionGraph = async (
  repository: IRepositoryInspectionReader,
  paths: readonly IRepositoryPath[],
  options: ICoreOptionsSnapshot,
  signal?: AbortSignal,
): Promise<IDecisionGraphResult> => {
  options = createCoreOperationOptionsSnapshot(options);
  const diagnostics = createCoreDiagnosticCollector(options.limits, 'validate-project');
  const candidates: IDecisionGraphCandidate[] = [];
  const decisions: IParsedDecision[] = [];
  const readOptions = signal === undefined ? undefined : { signal };

  for (const path of [...paths].sort(compareCodePoints)) {
    const content = await repository.readCompleteFile(path, readOptions);

    if (!(content instanceof Uint8Array)) {
      return invalidSourceData(path);
    }

    const parsed = await parseDecisionDocument(
      { content: content.slice(), path },
      options,
      'validate-project',
    );

    for (const diagnostic of parsed.diagnostics) {
      diagnostics.merge(diagnostic);
    }

    candidates.push({
      decision: parsed.decision,
      id: parseDecisionIdFromPath(path),
      path,
    });

    if (parsed.decision !== null) {
      decisions.push(parsed.decision);
    }
  }

  for (const diagnostic of validateDecisionGraph(candidates, options.limits)) {
    diagnostics.merge(diagnostic);
  }

  const finalizedDiagnostics = diagnostics.finalize();

  return deepFreeze({
    decisions: sortDecisions(decisions),
    diagnostics: finalizedDiagnostics,
    valid: finalizedDiagnostics.length === 0,
  });
};

import type { IStaticAnalysisSourceResult, IStaticAnalysisSourceRange } from '../types.js';
import { isSupportedTypeScriptSourcePath } from '../typescript-analysis/index.js';

import { iterateDeclaredRelationships } from './coverage.js';
import type { IDeclaredRelationshipSubject, IRelationshipDeclaration } from './types.js';

// independent source failures retain the declared subject even when runtime wiring is unknown
export interface IDeclaredExportFailure {
  subject: IDeclaredRelationshipSubject;
  kind: 'missing' | 'invalid-text' | 'invalid-syntax';
  range: IStaticAnalysisSourceRange | null;
}

/**
 * Checks declared export existence before provider-specific recognition can return early.
 * Unsupported source languages and incomplete export inventories cannot prove absence.
 * @param declaration Explicit references owned by the selected agent.
 * @param analyzeSource The operation-scoped provider source parser.
 * @param signal The active operation signal.
 * @returns A lazy sequence of proven source failures.
 * @throws Propagates source access failures and cancellation.
 */
export async function* inspectDeclaredExports(
  declaration: IRelationshipDeclaration,
  analyzeSource: (path: string) => Promise<IStaticAnalysisSourceResult>,
  signal?: AbortSignal,
): AsyncGenerator<IDeclaredExportFailure> {
  for (const subject of iterateDeclaredRelationships(declaration)) {
    signal?.throwIfAborted();
    const { reference } = subject;
    if (reference.symbol === undefined || !isSupportedTypeScriptSourcePath(reference.path))
      continue;
    const result = await analyzeSource(reference.path);
    signal?.throwIfAborted();
    if (result.kind !== 'valid') {
      yield {
        subject,
        kind: result.kind,
        range: result.kind === 'invalid-syntax' ? result.range : null,
      };
    } else if (
      !result.analysis.exports.has(reference.symbol) &&
      !result.analysis.hasUnresolvedExports
    ) {
      yield { subject, kind: 'missing', range: null };
    }
  }
}

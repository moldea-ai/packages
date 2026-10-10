import type {
  IRuntimeAdapterContext,
  IRuntimeAdapterEvidence,
  IRuntimeAdapterResult,
} from '../adapter/index.js';
import type { IRuntimeAdapterOutputCounts } from '../adapter-validation/index.js';
import type { ICoreResourceLimits } from '../contracts/index.js';
import type { IAdapterDiagnostic } from '../diagnostics/index.js';
import { CoreOperationException } from '../exceptions/index.js';

import type {
  IRuntimeAdapterOutputBudget,
  IRuntimeAdapterRecordCollector,
  IRuntimeAdapterResultCollector,
} from './types.js';

/** Creates the immutable admission view from Core's authoritative raw counters. */
export const createRuntimeAdapterOutputBudget = (
  counts: IRuntimeAdapterOutputCounts,
  limits: ICoreResourceLimits,
): IRuntimeAdapterOutputBudget =>
  Object.freeze({
    diagnostics: Object.freeze({
      maximum: limits.maxDiagnostics,
      remaining: limits.maxDiagnostics - counts.diagnostics,
    }),
    evidence: Object.freeze({
      maximum: limits.maxEvidence,
      remaining: limits.maxEvidence - counts.evidence,
    }),
  });

/**
 * Collects one adapter result without constructing records beyond its remaining allowance.
 * @param context The trusted invocation agent, raw output budget, and operation signal.
 * @returns Independent collectors and one final immutable adapter result.
 */
export const createRuntimeAdapterResultCollector = (
  context: Pick<IRuntimeAdapterContext, 'agent' | 'outputBudget' | 'signal'>,
): IRuntimeAdapterResultCollector => {
  const diagnostics: IAdapterDiagnostic[] = [];
  const evidence: IRuntimeAdapterEvidence[] = [];

  const createCollector = <TRecord>(
    kind: keyof IRuntimeAdapterOutputBudget,
    records: TRecord[],
  ): IRuntimeAdapterRecordCollector<TRecord> => {
    const { maximum, remaining } = context.outputBudget[kind];
    let admitted = 0;

    return Object.freeze({
      some: (predicate: (record: TRecord) => boolean): boolean => records.some(predicate),
      add: (factory: () => TRecord): void => {
        if (context.signal?.aborted) {
          throw new CoreOperationException({
            adapterId: context.agent.declaration.runtime.id,
            cause: context.signal.reason,
            code: 'ABORTED',
            operation: 'validate-adapter',
          });
        }

        if (admitted >= remaining) {
          throw new CoreOperationException({
            adapterId: context.agent.declaration.runtime.id,
            code: 'RESOURCE_LIMIT_EXCEEDED',
            limit: kind === 'diagnostics' ? 'maxDiagnostics' : 'maxEvidence',
            limitMaximum: maximum,
            nextAction: 'reduce-input-or-increase-limit',
            observedUsage: maximum - remaining + admitted + 1,
            operation: 'validate-adapter',
          });
        }

        admitted += 1;
        records.push(factory());
      },
    });
  };

  return Object.freeze({
    diagnostics: createCollector('diagnostics', diagnostics),
    evidence: createCollector('evidence', evidence),
    finalize: (): IRuntimeAdapterResult =>
      Object.freeze({
        diagnostics: Object.freeze(diagnostics),
        evidence: Object.freeze(evidence),
      }),
  });
};

import type { IAdapterDiagnostic } from '../diagnostics/index.js';
import type { IRuntimeAdapterEvidence, IRuntimeAdapterResult } from '../adapter/index.js';

// immutable remaining admission after earlier adapter invocations in the same operation
export interface IRuntimeAdapterOutputBudget {
  readonly diagnostics: { readonly maximum: number; readonly remaining: number };
  readonly evidence: { readonly maximum: number; readonly remaining: number };
}

// deferred record construction guarded by the operation's raw output allowance
export interface IRuntimeAdapterRecordCollector<TRecord> {
  /**
   * Admits one record before executing its factory.
   * @param factory Constructs the record only after admission succeeds.
   * @throws
   * - RESOURCE_LIMIT_EXCEEDED: A Core resource limit was exceeded.
   * - ABORTED: The Core operation was aborted.
   */
  add(factory: () => TRecord): void;
  /** Checks admitted records without exposing or copying the result collection. */
  some(predicate: (record: TRecord) => boolean): boolean;
}

// one bounded adapter result with independent diagnostic and evidence allowances
export interface IRuntimeAdapterResultCollector {
  readonly diagnostics: IRuntimeAdapterRecordCollector<IAdapterDiagnostic>;
  readonly evidence: IRuntimeAdapterRecordCollector<IRuntimeAdapterEvidence>;

  /** Returns the complete immutable result for Core's authoritative validation. */
  finalize(): IRuntimeAdapterResult;
}

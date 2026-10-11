import type { IDiagnosticEntity } from '../diagnostics/index.js';

// declared relationships whose files Core checks
export type IBindingRelationship =
  | 'runtime-agent'
  | 'instruction-loader'
  | 'agent-input-schema'
  | 'agent-output-schema'
  | 'variable-provider'
  | 'tool-implementation'
  | 'tool-registration'
  | 'tool-input-schema'
  | 'tool-output-schema'
  | 'skill-implementation'
  | 'skill-registration'
  | 'context-binding'
  | 'decision-binding';

// reasons an export check could not reach a conclusion
export type IExportNotCheckedReason =
  | 'no-symbol'
  | 'unsupported-file-type'
  | 'unresolved-exports'
  | 'unparseable-source'
  | 'resource-limit';

// file existence and export checks never establish runtime wiring
export type IBindingCoverage = {
  entity: IDiagnosticEntity;
  relationship: IBindingRelationship;
  path: string;
  symbol: string | null;
  fileCheck: 'passed';
} & (
  | { exportCheck: 'passed' }
  | { exportCheck: 'failed' }
  | { exportCheck: 'not-checked'; exportNotCheckedReason: IExportNotCheckedReason }
);

// complete operation totals, independent of a selected inspection page
export interface IBindingCoverageCounts {
  readonly bindings: number;
  readonly exportsPassed: number;
  readonly exportsFailed: number;
  readonly exportsNotChecked: number;
}

/** Counts every declared, existing binding by its actual export-check outcome. */
export const countBindingCoverage = (
  coverage: readonly IBindingCoverage[],
): IBindingCoverageCounts => ({
  bindings: coverage.length,
  exportsPassed: coverage.filter((record) => record.exportCheck === 'passed').length,
  exportsFailed: coverage.filter((record) => record.exportCheck === 'failed').length,
  exportsNotChecked: coverage.filter((record) => record.exportCheck === 'not-checked').length,
});

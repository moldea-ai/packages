import type {
  ICoreConfigurationErrorCode,
  ICoreOperationErrorCode,
  IDiagnostic,
  IDiagnosticEntity,
  IProjectInspectionCounts,
  IProjectMetadataKind,
  IBindingCoverage,
  IBindingCoverageCounts,
} from '@moldea.ai/core';
import type { IRepositoryPath, IRepositorySourceErrorCode } from '@moldea.ai/repository';

import type { IMoldeaCliOutputPage, IMoldeaCliOutputRecord } from '../output-page/index.js';

import type { MOLDEA_CLI_ERROR_DEFINITIONS } from './constants.js';

// errors owned directly by the CLI executable and its Git integration
export type IMoldeaCliOwnedErrorCode = keyof typeof MOLDEA_CLI_ERROR_DEFINITIONS;

// operational error codes observable through the current executable foundation
export type IMoldeaCliErrorCode =
  | IMoldeaCliOwnedErrorCode
  | IRepositorySourceErrorCode
  | ICoreConfigurationErrorCode
  | ICoreOperationErrorCode;

// Git-specific errors produced by CLI-owned Git operations
export type IMoldeaCliGitErrorCode = Extract<IMoldeaCliOwnedErrorCode, `GIT_${string}`>;

// safe error sources exposed by the CLI
export type IMoldeaCliErrorSource = 'cli' | 'git' | 'repository' | 'core';

// safe operational error fields shared by human and JSON presentation
export interface IMoldeaCliError {
  readonly code: IMoldeaCliErrorCode;
  readonly details: Readonly<Record<string, string | number | boolean | null>>;
  readonly message: string;
  readonly path: string | null;
  readonly retryable: boolean;
  readonly source: IMoldeaCliErrorSource;
}

interface IMoldeaCliDiagnosticRecordBase extends IMoldeaCliOutputRecord {
  readonly code: string;
  readonly group: IDiagnostic['group'];
  readonly entity: IDiagnosticEntity | null;
  readonly kind: 'diagnostic';
  readonly message: string;
  readonly path: IRepositoryPath | null;
  readonly pointer: string | null;
  readonly range: IDiagnostic['range'];
  readonly source: string;
}

export type IMoldeaCliDiagnosticRecord = IMoldeaCliDiagnosticRecordBase &
  (
    | { readonly severity: 'error' }
    | {
        readonly severity: 'warning';
        readonly subject: string;
        readonly qualifier: string | null;
        readonly acceptable: boolean;
        readonly accepted: boolean;
        readonly reason: string | null;
      }
  );

export interface IMoldeaCliMetadataRecord extends IMoldeaCliOutputRecord {
  readonly agentId: string | null;
  readonly byteLength: number;
  readonly decisionId: string | null;
  readonly kind: 'metadata';
  readonly metadataKind: IProjectMetadataKind;
  readonly path: IRepositoryPath;
}

// one content-free record identifies the checks Core actually performed
export type IMoldeaCliCoverageRecord = IMoldeaCliOutputRecord &
  Exclude<IBindingCoverage, { exportCheck: 'passed' }> & { kind: 'coverage' };

export type IMoldeaCliValidateRecord = IMoldeaCliDiagnosticRecord | IMoldeaCliCoverageRecord;

export type IMoldeaCliInspectRecord = IMoldeaCliDiagnosticRecord | IMoldeaCliMetadataRecord;

export interface IMoldeaCliInspectProjection {
  readonly coverageCounts: IBindingCoverageCounts;
  readonly counts: IProjectInspectionCounts;
  readonly formatVersion: number | null;
  readonly getSourceCursor: (record: IMoldeaCliInspectRecord) => string | null;
  readonly records: readonly IMoldeaCliInspectRecord[];
  readonly snapshotDigest: string;
  readonly valid: boolean;
}

export interface IMoldeaCliInspectResult {
  readonly coverageCounts: IBindingCoverageCounts;
  readonly counts: IProjectInspectionCounts;
  readonly formatVersion: number | null;
  readonly page: IMoldeaCliOutputPage<IMoldeaCliInspectRecord>;
  readonly valid: boolean;
}

export interface IMoldeaCliValidateProjection {
  readonly coverageCounts: IBindingCoverageCounts;
  readonly records: readonly IMoldeaCliValidateRecord[];
  readonly diagnosticCount: number;
  readonly acceptedWarningCount: number;
  readonly errorCount: number;
  readonly formatVersion: number | null;
  readonly snapshotDigest: string;
  readonly valid: boolean;
  readonly warningCount: number;
}

export interface IMoldeaCliValidateResult {
  readonly coverageCounts: IBindingCoverageCounts;
  readonly diagnosticCount: number;
  readonly acceptedWarningCount: number;
  readonly errorCount: number;
  readonly formatVersion: number | null;
  readonly page: IMoldeaCliOutputPage<IMoldeaCliValidateRecord>;
  readonly valid: boolean;
  readonly warningCount: number;
}

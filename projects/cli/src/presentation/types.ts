import type {
  ICoreConfigurationErrorCode,
  ICoreOperationErrorCode,
  IDiagnostic,
  IDiagnosticEntity,
  IProjectInspectionCounts,
  IProjectInspectionView,
  IProjectMetadataKind,
  IRuntimeAdapterEvidenceKind,
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

// source descriptor shared by repository command results
export interface IMoldeaCliSource {
  readonly kind: 'git-working-tree';
}

export interface IMoldeaCliAssetIdentity {
  readonly digest: string;
  readonly path: IRepositoryPath;
}

export interface IMoldeaCliDiagnosticRecord extends IMoldeaCliOutputRecord {
  readonly code: string;
  readonly entity: IDiagnosticEntity | null;
  readonly kind: 'diagnostic';
  readonly message: string;
  readonly path: IRepositoryPath | null;
  readonly pointer: string | null;
  readonly range: IDiagnostic['range'];
  readonly source: string;
}

export interface IMoldeaCliMetadataRecord extends IMoldeaCliOutputRecord {
  readonly agentId: string | null;
  readonly byteLength: number;
  readonly canonicalDigest: string | null;
  readonly decisionId: string | null;
  readonly digest: string;
  readonly kind: 'metadata';
  readonly metadataKind: IProjectMetadataKind;
  readonly path: IRepositoryPath;
  readonly scalarLength: number | null;
}

export interface IMoldeaCliEvidenceReference {
  readonly path: IRepositoryPath;
  readonly symbol: string | null;
}

export interface IMoldeaCliEvidenceRecord extends IMoldeaCliOutputRecord {
  readonly agentId: string | null;
  readonly capabilityId: string | null;
  readonly capabilityKind: 'skill' | 'tool' | null;
  readonly evidenceKind: IRuntimeAdapterEvidenceKind;
  readonly kind: 'evidence';
  readonly references: readonly IMoldeaCliEvidenceReference[];
  readonly runtimeName: string | null;
  readonly source: string;
}

export type IMoldeaCliInspectRecord =
  IMoldeaCliDiagnosticRecord | IMoldeaCliEvidenceRecord | IMoldeaCliMetadataRecord;

export interface IMoldeaCliInspectProjectMetadata {
  readonly manifest: IMoldeaCliAssetIdentity;
  readonly project: IMoldeaCliAssetIdentity;
}

export interface IMoldeaCliInspectProjection {
  readonly counts: IProjectInspectionCounts;
  readonly formatVersion: number | null;
  readonly getSourceCursor: (record: IMoldeaCliInspectRecord) => string | null;
  readonly project: IMoldeaCliInspectProjectMetadata | null;
  readonly records: readonly IMoldeaCliInspectRecord[];
  readonly snapshotDigest: string;
  readonly source: IMoldeaCliSource;
  readonly valid: boolean;
  readonly view: IProjectInspectionView;
}

export interface IMoldeaCliInspectResult {
  readonly counts: IProjectInspectionCounts;
  readonly formatVersion: number | null;
  readonly page: IMoldeaCliOutputPage<IMoldeaCliInspectRecord>;
  readonly project: IMoldeaCliInspectProjectMetadata | null;
  readonly snapshotDigest: string;
  readonly source: IMoldeaCliSource;
  readonly valid: boolean;
  readonly view: IProjectInspectionView;
}

export interface IMoldeaCliValidateProjection {
  readonly diagnostics: readonly IMoldeaCliDiagnosticRecord[];
  readonly formatVersion: number | null;
  readonly snapshotDigest: string;
  readonly source: IMoldeaCliSource;
  readonly valid: boolean;
}

export interface IMoldeaCliValidateResult {
  readonly diagnosticCount: number;
  readonly formatVersion: number | null;
  readonly page: IMoldeaCliOutputPage<IMoldeaCliDiagnosticRecord>;
  readonly snapshotDigest: string;
  readonly source: IMoldeaCliSource;
  readonly valid: boolean;
}

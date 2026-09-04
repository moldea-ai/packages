import type {
  ICoreConfigurationErrorCode,
  ICoreOperationErrorCode,
  IDiagnostic,
  IDiagnosticEntity,
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

// source descriptor shared by validation and inspection results
export interface IMoldeaCliSource {
  readonly kind: 'git-working-tree';
}

export interface IMoldeaCliAssetMetadata {
  readonly digest: string;
  readonly path: IRepositoryPath;
  readonly scalarLength: number;
  readonly utf8ByteLength: number;
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

export interface IMoldeaCliAgentRecord extends IMoldeaCliOutputRecord {
  readonly agentId: string;
  readonly contextCount: number;
  readonly decisionCount: number;
  readonly description: IMoldeaCliAssetMetadata;
  readonly handoffDescription: IMoldeaCliAssetMetadata | null;
  readonly instruction: IMoldeaCliAssetMetadata;
  readonly kind: 'agent';
  readonly runtimeId: string;
}

export interface IMoldeaCliContextRecord extends IMoldeaCliOutputRecord {
  readonly asset: IMoldeaCliAssetMetadata;
  readonly kind: 'context';
}

export interface IMoldeaCliDecisionRecord extends IMoldeaCliOutputRecord {
  readonly asset: IMoldeaCliAssetMetadata;
  readonly createdAt: string;
  readonly decisionId: string;
  readonly kind: 'decision';
  readonly status: string;
  readonly supersedesCount: number;
}

export interface IMoldeaCliDecisionSupersessionRecord extends IMoldeaCliOutputRecord {
  readonly decisionId: string;
  readonly kind: 'decision-supersession';
  readonly supersededDecisionId: string;
}

export interface IMoldeaCliRelationshipRecord extends IMoldeaCliOutputRecord {
  readonly agentId: string | null;
  readonly declarationKind: 'exact' | 'glob';
  readonly field: string;
  readonly kind: 'relationship';
  readonly ownerId: string;
  readonly ownerKind: 'agent' | 'context' | 'decision' | 'skill' | 'tool' | 'unresolved';
  readonly path: string;
  readonly symbol: string | null;
}

export interface IMoldeaCliRequirementRecord extends IMoldeaCliOutputRecord {
  readonly agentId: string;
  readonly capabilityId: string;
  readonly capabilityKind: 'skill' | 'tool';
  readonly implementationPath: IRepositoryPath;
  readonly implementationSymbol: string | null;
  readonly kind: 'requirement';
  readonly name: string;
  readonly registrationPath: IRepositoryPath | null;
}

export interface IMoldeaCliMirrorRecord extends IMoldeaCliOutputRecord {
  readonly agentId: string;
  readonly canonicalDigest: string;
  readonly digest: string;
  readonly kind: 'mirror';
  readonly path: IRepositoryPath;
}

export interface IMoldeaCliRuntimeRecord extends IMoldeaCliOutputRecord {
  readonly asset: IMoldeaCliAssetMetadata;
  readonly kind: 'runtime';
}

export interface IMoldeaCliUnresolvedRecord extends IMoldeaCliOutputRecord {
  readonly agentId: string | null;
  readonly category: string;
  readonly effect: string;
  readonly kind: 'unresolved';
  readonly relatedCount: number;
  readonly requirementId: string;
}

export interface IMoldeaCliEvidenceRecord extends IMoldeaCliOutputRecord {
  readonly agentId: string | null;
  readonly capabilityId: string | null;
  readonly capabilityKind: 'skill' | 'tool' | null;
  readonly evidenceKind: IRuntimeAdapterEvidenceKind;
  readonly kind: 'evidence';
  readonly referenceCount: number;
  readonly runtimeName: string | null;
  readonly source: string;
}

export interface IMoldeaCliEvidenceReferenceRecord extends IMoldeaCliOutputRecord {
  readonly evidenceKey: string;
  readonly kind: 'evidence-reference';
  readonly path: IRepositoryPath;
  readonly symbol: string | null;
}

export type IMoldeaCliInspectRecord =
  | IMoldeaCliAgentRecord
  | IMoldeaCliContextRecord
  | IMoldeaCliDecisionRecord
  | IMoldeaCliDecisionSupersessionRecord
  | IMoldeaCliDiagnosticRecord
  | IMoldeaCliEvidenceRecord
  | IMoldeaCliEvidenceReferenceRecord
  | IMoldeaCliMirrorRecord
  | IMoldeaCliRelationshipRecord
  | IMoldeaCliRequirementRecord
  | IMoldeaCliRuntimeRecord
  | IMoldeaCliUnresolvedRecord;

export interface IMoldeaCliInspectCounts {
  readonly agents: number;
  readonly context: number;
  readonly decisions: number;
  readonly decisionSupersessions: number;
  readonly diagnostics: number;
  readonly evidence: number;
  readonly evidenceReferences: number;
  readonly mirrors: number;
  readonly relationships: number;
  readonly requirements: number;
  readonly runtimes: number;
  readonly unresolved: number;
}

export interface IMoldeaCliInspectProjectMetadata {
  readonly manifest: IMoldeaCliAssetMetadata;
  readonly project: IMoldeaCliAssetMetadata;
}

export interface IMoldeaCliInspectProjection {
  readonly canonicalBodies: readonly string[];
  readonly counts: IMoldeaCliInspectCounts;
  readonly formatVersion: number | null;
  readonly project: IMoldeaCliInspectProjectMetadata | null;
  readonly records: readonly IMoldeaCliInspectRecord[];
  readonly snapshotDigest: string;
  readonly source: IMoldeaCliSource;
}

export interface IMoldeaCliInspectResult {
  readonly counts: IMoldeaCliInspectCounts;
  readonly formatVersion: number | null;
  readonly page: IMoldeaCliOutputPage<IMoldeaCliInspectRecord>;
  readonly project: IMoldeaCliInspectProjectMetadata | null;
  readonly snapshotDigest: string;
  readonly source: IMoldeaCliSource;
}

export interface IMoldeaCliValidateProjection {
  readonly canonicalBodies: readonly string[];
  readonly diagnostics: readonly IMoldeaCliDiagnosticRecord[];
  readonly formatVersion: number | null;
  readonly snapshotDigest: string;
  readonly source: IMoldeaCliSource;
}

export interface IMoldeaCliValidateResult {
  readonly diagnosticCount: number;
  readonly formatVersion: number | null;
  readonly page: IMoldeaCliOutputPage<IMoldeaCliDiagnosticRecord>;
  readonly snapshotDigest: string;
  readonly source: IMoldeaCliSource;
}

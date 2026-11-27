import type {
  ICore,
  ICoreOptions,
  IManifestScopeCounts,
  IManifestScopeOwnerKind,
  IManifestScopeRelationshipField,
  IManifestScopeResult,
} from '@moldea.ai/core';
import type { IRepositoryReader } from '@moldea.ai/repository';

import type { IMoldeaCliResourceLimits } from '../command-line/index.js';
import type { IMoldeaCliOutputPage, IMoldeaCliOutputRecord } from '../output-page/index.js';
import type { IMoldeaCliDiagnosticRecord } from '../presentation/index.js';

export type IMoldeaCliProjectScopeErrorCode = 'PATH_INPUT_INVALID';

export interface IMoldeaCliProjectScopeInput {
  readonly paths: readonly string[];
  readonly repository: IRepositoryReader;
  readonly resourceLimits: IMoldeaCliResourceLimits;
  readonly signal?: AbortSignal;
}

export interface IMoldeaCliProjectScopeExecutionResult {
  readonly manifestContent: string;
  readonly scope: IManifestScopeResult;
}

export interface IMoldeaCliScopeRelationship {
  readonly field: IManifestScopeRelationshipField;
  readonly path: string;
}

export interface IMoldeaCliScopeOwnerRecord extends IMoldeaCliOutputRecord {
  readonly kind: 'match';
  readonly path: string;
  readonly ownerKind: IManifestScopeOwnerKind;
  readonly capabilityId?: string;
  readonly relationships: readonly IMoldeaCliScopeRelationship[];
}

export type IMoldeaCliScopeRecord = IMoldeaCliDiagnosticRecord | IMoldeaCliScopeOwnerRecord;

export interface IMoldeaCliScopeCounts extends IManifestScopeCounts {
  readonly diagnostics: number;
}

export interface IMoldeaCliScopeProjection {
  readonly canonicalBodies: readonly string[];
  readonly counts: IMoldeaCliScopeCounts;
  readonly inputDigest: string;
  readonly records: readonly IMoldeaCliScopeRecord[];
  readonly relevant: boolean;
  readonly snapshotDigest: string;
  readonly valid: boolean;
}

export interface IMoldeaCliScopeResult extends Omit<
  IMoldeaCliScopeProjection,
  'canonicalBodies' | 'inputDigest' | 'records' | 'snapshotDigest'
> {
  readonly page: IMoldeaCliOutputPage<IMoldeaCliScopeRecord>;
}

export type IMoldeaCliProjectScopeCoreFactory = (options?: ICoreOptions) => ICore;

export type IMoldeaCliProjectScopeExecutor = (
  input: IMoldeaCliProjectScopeInput,
) => Promise<IMoldeaCliProjectScopeExecutionResult>;

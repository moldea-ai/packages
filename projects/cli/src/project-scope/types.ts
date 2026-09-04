import type {
  ICore,
  ICoreOptions,
  IManifestScopeCounts,
  IManifestScopeMatch,
  IManifestScopeResult,
} from '@moldea.ai/core';
import type { IRepositoryReader } from '@moldea.ai/repository';

import type { IMoldeaCliResourceLimits } from '../command-line/index.js';
import type { IMoldeaCliOutputPage, IMoldeaCliOutputRecord } from '../output-page/index.js';
import type { IMoldeaCliDiagnosticRecord, IMoldeaCliSource } from '../presentation/index.js';

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

export type IMoldeaCliScopeRecord =
  | IMoldeaCliDiagnosticRecord
  | (IMoldeaCliOutputRecord & {
      readonly kind: 'match';
      readonly match: IManifestScopeMatch;
    });

export interface IMoldeaCliScopeCounts extends IManifestScopeCounts {
  readonly diagnostics: number;
}

export interface IMoldeaCliScopeProjection {
  readonly canonicalBodies: readonly string[];
  readonly counts: IMoldeaCliScopeCounts;
  readonly inputDigest: string;
  readonly manifestDigest: string | null;
  readonly records: readonly IMoldeaCliScopeRecord[];
  readonly relevant: boolean;
  readonly snapshotDigest: string;
  readonly valid: boolean;
}

export interface IMoldeaCliScopeResult extends Omit<
  IMoldeaCliScopeProjection,
  'canonicalBodies' | 'records'
> {
  readonly page: IMoldeaCliOutputPage<IMoldeaCliScopeRecord>;
  readonly source: IMoldeaCliSource;
}

export type IMoldeaCliProjectScopeCoreFactory = (options?: ICoreOptions) => ICore;

export type IMoldeaCliProjectScopeExecutor = (
  input: IMoldeaCliProjectScopeInput,
) => Promise<IMoldeaCliProjectScopeExecutionResult>;

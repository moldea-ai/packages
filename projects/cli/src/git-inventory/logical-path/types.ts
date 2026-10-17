import type { IRepositoryPath } from '@moldea.ai/repository';

import type {
  IGitContentTransformationClassifiedEntry,
  IGitContentTransformationClassifiedTrackedEntry,
  IGitContentTransformationClassifiedUntrackedEntry,
} from '../content-transformation/index.js';

// tracked effective inventory entry with one validated logical path
export interface IGitTrackedInventoryEntry extends Omit<
  IGitContentTransformationClassifiedTrackedEntry,
  'path'
> {
  readonly path: IRepositoryPath;
}

// untracked effective inventory entry with one validated logical path
export interface IGitUntrackedInventoryEntry extends Omit<
  IGitContentTransformationClassifiedUntrackedEntry,
  'path'
> {
  readonly path: IRepositoryPath;
}

// one normalized entry in the effective selected-repository inventory
export type IGitInventoryEntry = IGitTrackedInventoryEntry | IGitUntrackedInventoryEntry;

// decoded Git candidates entering pre-exclusion logical-path filtering
export interface IGitInventoryLogicalPathCandidate {
  readonly kind: 'tracked' | 'untracked';
  readonly path: string;
}

// complete decoded candidate set entering pre-exclusion logical-path filtering
export interface IGitInventoryCandidateLogicalPathFilterInput<
  TCandidate extends IGitInventoryLogicalPathCandidate,
> {
  readonly candidates: readonly TCandidate[];
}

// portable candidates retained with their complete decoded metadata
export interface IGitInventoryCandidateLogicalPathsFilteredResult<
  TCandidate extends IGitInventoryLogicalPathCandidate,
> {
  readonly candidates: readonly TCandidate[];
  readonly kind: 'filtered';
}

// non-portable or contradictory Git path state
export interface IGitInventoryLogicalPathFailedResult {
  readonly errorCode: 'GIT_OUTPUT_INVALID';
  readonly kind: 'failed';
}

// filtered candidates or an invalid canonical path failure
export type IGitInventoryCandidateLogicalPathFilterResult<
  TCandidate extends IGitInventoryLogicalPathCandidate,
> =
  | IGitInventoryCandidateLogicalPathsFilteredResult<TCandidate>
  | IGitInventoryLogicalPathFailedResult;

// entry-type-normalized paths entering logical-path normalization
export interface IGitInventoryLogicalPathNormalizerInput {
  readonly entries: readonly IGitContentTransformationClassifiedEntry[];
}

// complete logical-path-normalized effective inventory
export interface IGitInventoryLogicalPathsNormalizedResult {
  readonly entries: readonly IGitInventoryEntry[];
  readonly kind: 'normalized';
}

// all-or-nothing logical-path normalization result
export type IGitInventoryLogicalPathNormalizationResult =
  IGitInventoryLogicalPathFailedResult | IGitInventoryLogicalPathsNormalizedResult;

// injectable logical-path normalization boundary
export type IGitInventoryLogicalPathNormalizer = (
  input: IGitInventoryLogicalPathNormalizerInput,
) => IGitInventoryLogicalPathNormalizationResult;

import type {
  IProjectInspectionItem,
  IProjectInspectionPageResult,
  IProjectValidationResult,
} from '@moldea.ai/core';
import type { INodeProjectInspection, INodeProjectInspectionInput } from '@moldea.ai/core/node';
import type { IRepositoryReader } from '@moldea.ai/repository';

import type { IMoldeaCliResourceLimits } from '../command-line/index.js';
import type { IMoldeaCliCursorState } from '../output-page/index.js';
import type { IMoldeaCliPackageMetadata } from '../package-metadata/index.js';

// immutable inputs for one cancellable attempt-local Core inspection
export interface IMoldeaCliCoreInspectionInput {
  readonly command: 'inspect' | 'validate';
  readonly cursor?: IMoldeaCliCursorState;
  readonly instructions?: IRepositoryReader;
  readonly repository: IRepositoryReader;
  readonly packageMetadata: IMoldeaCliPackageMetadata;
  readonly resourceLimits: IMoldeaCliResourceLimits;
  readonly signal?: AbortSignal;
}

// injectable isolated inspection boundary
export type IMoldeaCliNodeInspectionFactory = (
  input: INodeProjectInspectionInput,
) => Promise<INodeProjectInspection>;

// bounded inventory and diagnostic rows with CLI-specific continuation positions
export type IMoldeaCliInspectItem = Extract<
  IProjectInspectionItem,
  { kind: 'metadata' | 'diagnostic' }
>;

export interface IMoldeaCliCoreInspectPage extends Pick<
  IProjectInspectionPageResult,
  'counts' | 'coverageCounts' | 'formatVersion' | 'inspectionDigest' | 'valid'
> {
  readonly startIndex: number;
  readonly records: readonly { item: IMoldeaCliInspectItem; nextCursor: string | null }[];
}

// attempt-local Core inspection boundary
export type IMoldeaCliCoreInspectionExecutor = (
  input: IMoldeaCliCoreInspectionInput,
) => Promise<IMoldeaCliCoreInspectPage | IProjectValidationResult>;

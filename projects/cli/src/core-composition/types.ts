import type { IProjectInspectionPageResult, IProjectValidationResult } from '@moldea.ai/core';
import type { INodeProjectInspection, INodeProjectInspectionInput } from '@moldea.ai/core/node';
import type { IRepositoryReader } from '@moldea.ai/repository';

import type { IMoldeaCliResourceLimits } from '../command-line/index.js';
import type { IMoldeaCliPackageMetadata } from '../package-metadata/index.js';

// immutable inputs for one cancellable attempt-local Core inspection
export interface IMoldeaCliCoreInspectionInput {
  readonly command: 'inspect' | 'validate';
  readonly cursor?: string;
  readonly repository: IRepositoryReader;
  readonly packageMetadata: IMoldeaCliPackageMetadata;
  readonly resourceLimits: IMoldeaCliResourceLimits;
  readonly signal?: AbortSignal;
}

// injectable isolated inspection boundary
export type IMoldeaCliNodeInspectionFactory = (
  input: INodeProjectInspectionInput,
) => Promise<INodeProjectInspection>;

// attempt-local Core inspection boundary
export type IMoldeaCliCoreInspectionExecutor = (
  input: IMoldeaCliCoreInspectionInput,
) => Promise<IProjectInspectionPageResult | IProjectValidationResult>;

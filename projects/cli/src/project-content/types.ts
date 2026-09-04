import type { ICanonicalContentPageResult, ICore, ICoreOptions } from '@moldea.ai/core';
import type { IRepositoryPath, IRepositoryReader } from '@moldea.ai/repository';

import type { IMoldeaCliResourceLimits } from '../command-line/index.js';

export type IMoldeaCliProjectContentErrorCode = 'CONTENT_INVALID' | 'CONTENT_PATH_INVALID';

export interface IMoldeaCliProjectContentInput {
  readonly maxBytes: number;
  readonly offset: number;
  readonly path: IRepositoryPath;
  readonly repository: IRepositoryReader;
  readonly resourceLimits: IMoldeaCliResourceLimits;
  readonly signal?: AbortSignal;
}

export interface IMoldeaCliContentAsset {
  readonly contentIdentity: string | null;
  readonly path: IRepositoryPath;
  readonly totalBytes: number;
}

export interface IMoldeaCliContentChunk {
  readonly byteEnd: number;
  readonly byteStart: number;
  readonly content: string;
}

export interface IMoldeaCliContentResult {
  readonly asset: IMoldeaCliContentAsset;
  readonly chunk: IMoldeaCliContentChunk;
  readonly cursor: string | null;
  readonly snapshotDigest: string;
}

export interface IMoldeaCliContentPageInput {
  readonly cursor: string | null;
  readonly maxOutputBytes: number;
  readonly measure: (result: IMoldeaCliContentResult) => number;
  readonly page: ICanonicalContentPageResult;
}

export type IMoldeaCliProjectContentCoreFactory = (options?: ICoreOptions) => ICore;

export type IMoldeaCliProjectContentExecutor = (
  input: IMoldeaCliProjectContentInput,
) => Promise<ICanonicalContentPageResult>;

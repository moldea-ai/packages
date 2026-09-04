import type { ICore, ICoreOptions } from '@moldea.ai/core';
import type { IRepositoryPath, IRepositoryReader } from '@moldea.ai/repository';

import type { IMoldeaCliResourceLimits } from '../command-line/index.js';

export type IMoldeaCliProjectContentErrorCode = 'CONTENT_INVALID' | 'CONTENT_PATH_INVALID';

export interface IMoldeaCliProjectContentInput {
  readonly path: IRepositoryPath;
  readonly repository: IRepositoryReader;
  readonly resourceLimits: IMoldeaCliResourceLimits;
  readonly signal?: AbortSignal;
}

export interface IMoldeaCliContentAsset {
  readonly content: string;
  readonly digest: string;
  readonly path: IRepositoryPath;
  readonly scalarLength: number;
  readonly utf8ByteLength: number;
}

export interface IMoldeaCliContentChunk {
  readonly content: string;
  readonly scalarEnd: number;
  readonly scalarStart: number;
}

export interface IMoldeaCliContentResult {
  readonly asset: Omit<IMoldeaCliContentAsset, 'content'>;
  readonly chunk: IMoldeaCliContentChunk;
  readonly cursor: string | null;
  readonly snapshotDigest: string;
}

export interface IMoldeaCliContentPageInput {
  readonly asset: IMoldeaCliContentAsset;
  readonly cursor: string | null;
  readonly maxOutputBytes: number;
  readonly measure: (result: IMoldeaCliContentResult) => number;
}

export type IMoldeaCliProjectContentCoreFactory = (options?: ICoreOptions) => ICore;

export type IMoldeaCliProjectContentExecutor = (
  input: IMoldeaCliProjectContentInput,
) => Promise<IMoldeaCliContentAsset>;

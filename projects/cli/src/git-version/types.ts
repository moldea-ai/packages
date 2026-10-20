import type { readGitVersion } from 'jg-git-commands';

import type { IMoldeaCliGitErrorCode } from '../presentation/index.js';

// parsed numeric Git version used for compatibility decisions
export interface IGitVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

// successful Git prerequisite result
export interface IGitVersionSupportedResult {
  readonly kind: 'supported';
  readonly version: IGitVersion;
}

// safe Git prerequisite failure result
export interface IGitVersionFailedResult {
  readonly errorCode: IMoldeaCliGitErrorCode;
  readonly kind: 'failed';
}

// result of the Git prerequisite preflight
export type IGitVersionPreflightResult = IGitVersionSupportedResult | IGitVersionFailedResult;

// injectable Git prerequisite preflight that runs Git in one existing directory
export type IGitVersionPreflight = (
  directory: string,
  signal?: AbortSignal,
) => Promise<IGitVersionPreflightResult>;

// injectable typed Git version read
export type IGitVersionReader = typeof readGitVersion;

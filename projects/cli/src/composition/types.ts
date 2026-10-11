import type { IMoldeaCliPackageMetadata } from '../package-metadata/index.js';

// one exact installed package version reported by the composition command
export interface IMoldeaCliPackageComposition {
  readonly name: string;
  readonly version: string;
}

// compact technical composition state derived by the installed CLI
export interface IMoldeaCliCompositionResult {
  readonly minimumGitVersion: string;
  readonly packages: readonly IMoldeaCliPackageComposition[];
  readonly repositoryFormatVersions: readonly number[];
  readonly supportedNodeRange: string;
}

// actual runtime and package state checked before any command produces a result
export interface IMoldeaCliCompositionStateInput {
  readonly coreSupportedRepositoryFormatVersions: readonly number[];
  readonly minimumGitVersion: string;
  readonly outputSchemaVersion: 7;
  readonly packageMetadata: IMoldeaCliPackageMetadata;
}

// installed input resolved through the executable's fixed runtime composition
export interface IMoldeaCliInstalledCompositionInput {
  readonly packageMetadata: IMoldeaCliPackageMetadata;
  readonly signal?: AbortSignal;
}

// all-or-nothing runtime composition resolution
export type IMoldeaCliCompositionResolution =
  | {
      readonly kind: 'invalid';
    }
  | {
      readonly kind: 'valid';
      readonly result: IMoldeaCliCompositionResult;
    };

// injectable installed composition boundary used by command execution
export type IMoldeaCliCompositionResolver = (
  input: IMoldeaCliInstalledCompositionInput,
) => IMoldeaCliCompositionResolution;

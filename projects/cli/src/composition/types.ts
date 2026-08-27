import type { IRuntimeAdapter } from '@moldea.ai/core/adapter';

import type { IMoldeaCliPackageMetadata } from '../package-metadata/index.js';

// one exact installed package version reported by the composition command
export interface IMoldeaCliPackageComposition {
  readonly name: string;
  readonly version: string;
}

// one executable adapter and the repository formats accepted by its implementation
export interface IMoldeaCliAdapterComposition {
  readonly id: string;
  readonly repositoryFormatVersions: readonly number[];
}

// compact technical composition state derived by the installed CLI
export interface IMoldeaCliCompositionResult {
  readonly adapters: readonly IMoldeaCliAdapterComposition[];
  readonly minimumGitVersion: string;
  readonly packages: readonly IMoldeaCliPackageComposition[];
  readonly repositoryFormatVersions: readonly number[];
  readonly supportedNodeRange: string;
}

// actual runtime and package state checked before any command produces a result
export interface IMoldeaCliCompositionStateInput {
  readonly activeAdapters: readonly IRuntimeAdapter[];
  readonly coreSupportedRepositoryFormatVersions: readonly number[];
  readonly minimumGitVersion: string;
  readonly outputSchemaVersion: 2;
  readonly packageMetadata: IMoldeaCliPackageMetadata;
}

// installed input resolved through the executable's fixed runtime composition
export interface IMoldeaCliInstalledCompositionInput {
  readonly packageMetadata: IMoldeaCliPackageMetadata;
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

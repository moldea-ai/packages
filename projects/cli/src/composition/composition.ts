import { SUPPORTED_REPOSITORY_FORMAT_VERSIONS } from '@moldea.ai/core';

import { MINIMUM_GIT_VERSION } from '../git-version/index.js';
import { MOLDEA_CLI_JSON_SCHEMA_VERSION } from '../json-output-contract/index.js';

import { createMoldeaCliCompositionResult } from './transformers.js';
import {
  MOLDEA_CLI_ADAPTER_PACKAGE_PREFIX,
  MOLDEA_CLI_FIRST_CLASS_PACKAGE_RANGES,
} from './constants.js';
import type {
  IMoldeaCliCompositionResolution,
  IMoldeaCliCompositionStateInput,
  IMoldeaCliInstalledCompositionInput,
} from './types.js';
import { isMoldeaCliCompositionStateValid } from './validations.js';

const INVALID_COMPOSITION_RESOLUTION = Object.freeze({ kind: 'invalid' as const });

// manifest-only preflight; executable identities are verified inside the isolated inspection
const EXPECTED_ADAPTERS = Object.keys(MOLDEA_CLI_FIRST_CLASS_PACKAGE_RANGES)
  .filter((name) => name.startsWith(MOLDEA_CLI_ADAPTER_PACKAGE_PREFIX))
  .map((name) => ({
    id: name.slice(MOLDEA_CLI_ADAPTER_PACKAGE_PREFIX.length),
    supportedRepositoryFormatVersions: SUPPORTED_REPOSITORY_FORMAT_VERSIONS,
  }));

/**
 * Resolves one explicit runtime composition without emitting a partial composition result.
 * @param input The installed and actual runtime state to compare.
 * @returns A valid immutable result or the single invalid-state outcome.
 */
export const resolveMoldeaCliComposition = (
  input: IMoldeaCliCompositionStateInput,
): IMoldeaCliCompositionResolution => {
  try {
    if (!isMoldeaCliCompositionStateValid(input)) {
      return INVALID_COMPOSITION_RESOLUTION;
    }

    return Object.freeze({
      kind: 'valid',
      result: createMoldeaCliCompositionResult(input),
    });
  } catch {
    return INVALID_COMPOSITION_RESOLUTION;
  }
};

/**
 * Checks installed package metadata and supplied worker-validated adapter identities.
 * Without identities, this is only the manifest preflight before repository discovery.
 * @param input The installed package metadata and optional actual executable identities.
 * @returns A valid immutable result or the single invalid-state outcome.
 */
export const resolveInstalledMoldeaCliComposition = (
  input: IMoldeaCliInstalledCompositionInput,
): IMoldeaCliCompositionResolution =>
  resolveMoldeaCliComposition({
    activeAdapters: input.activeAdapters ?? EXPECTED_ADAPTERS,
    coreSupportedRepositoryFormatVersions: SUPPORTED_REPOSITORY_FORMAT_VERSIONS,
    minimumGitVersion: MINIMUM_GIT_VERSION,
    outputSchemaVersion: MOLDEA_CLI_JSON_SCHEMA_VERSION,
    packageMetadata: input.packageMetadata,
  });

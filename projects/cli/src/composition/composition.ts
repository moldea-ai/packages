import { SUPPORTED_REPOSITORY_FORMAT_VERSIONS } from '@moldea.ai/core';

import { MINIMUM_GIT_VERSION } from '../git-version/index.js';
import { MOLDEA_CLI_JSON_SCHEMA_VERSION } from '../json-output-contract/index.js';

import { createMoldeaCliCompositionResult } from './transformers.js';
import type {
  IMoldeaCliCompositionResolution,
  IMoldeaCliCompositionStateInput,
  IMoldeaCliInstalledCompositionInput,
} from './types.js';
import { isMoldeaCliCompositionStateValid } from './validations.js';

const INVALID_COMPOSITION_RESOLUTION = Object.freeze({ kind: 'invalid' as const });

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
 * Checks installed package metadata and resolved first-class package identities.
 * @param input The installed package metadata.
 * @returns A valid immutable result or the single invalid-state outcome.
 */
export const resolveInstalledMoldeaCliComposition = (
  input: IMoldeaCliInstalledCompositionInput,
): IMoldeaCliCompositionResolution =>
  resolveMoldeaCliComposition({
    coreSupportedRepositoryFormatVersions: SUPPORTED_REPOSITORY_FORMAT_VERSIONS,
    minimumGitVersion: MINIMUM_GIT_VERSION,
    outputSchemaVersion: MOLDEA_CLI_JSON_SCHEMA_VERSION,
    packageMetadata: input.packageMetadata,
  });

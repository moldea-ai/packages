// types
export type {
  IGitVersion,
  IGitVersionFailedResult,
  IGitVersionPreflight,
  IGitVersionPreflightResult,
  IGitVersionReader,
  IGitVersionSupportedResult,
} from './types.js';

// constants
export { MAX_GIT_VERSION_OUTPUT_BYTES, MINIMUM_GIT_VERSION } from './constants.js';

// prerequisite checks
export { createGitVersionPreflight } from './preflight.js';

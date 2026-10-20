// types
export type {
  IGitCommandOptions,
  IGitCommandRunner,
  IGitFailureReason,
  IGitReadResult,
} from './types.js';

// constants
export { GIT_TIMEOUT_SECONDS, MAX_GIT_DIAGNOSTIC_BYTES } from './constants.js';

// failure classification and typed reads
export { classifyGitFailure, createGitFailure, readGit } from './utilities.js';

// commands
export { runGitCommand } from './run-git-command.js';

import { readGitVersion } from 'jg-git-commands';

import { GIT_TIMEOUT_SECONDS, readGit, type IGitFailureReason } from '../git-command/index.js';
import type { IMoldeaCliGitErrorCode } from '../presentation/index.js';

import { MAX_GIT_VERSION_OUTPUT_BYTES, MINIMUM_GIT_VERSION_COMPONENTS } from './constants.js';
import type {
  IGitVersion,
  IGitVersionPreflight,
  IGitVersionPreflightResult,
  IGitVersionReader,
} from './types.js';

/**
 * Maps Git failures to stable safe CLI errors.
 * @param reason The normalized Git failure reason.
 * @returns The public Git error code.
 */
const mapGitFailure = (reason: IGitFailureReason): IMoldeaCliGitErrorCode => {
  switch (reason) {
    case 'aborted':
      return 'GIT_OPERATION_ABORTED';
    case 'not-found':
      return 'GIT_NOT_FOUND';
    case 'access-denied':
      return 'GIT_ACCESS_DENIED';
    case 'output-limit-exceeded':
    case 'output-invalid':
      return 'GIT_VERSION_INVALID';
    case 'repository-not-found':
    case 'command-failed':
      return 'GIT_COMMAND_FAILED';
  }
};

/**
 * Determines whether a parsed Git version meets the supported minimum.
 * @param version The parsed Git version.
 * @returns Whether the numeric version is supported.
 */
const isGitVersionSupported = (version: IGitVersion): boolean => {
  if (version.major !== MINIMUM_GIT_VERSION_COMPONENTS.major) {
    return version.major > MINIMUM_GIT_VERSION_COMPONENTS.major;
  }

  if (version.minor !== MINIMUM_GIT_VERSION_COMPONENTS.minor) {
    return version.minor > MINIMUM_GIT_VERSION_COMPONENTS.minor;
  }

  return version.patch >= MINIMUM_GIT_VERSION_COMPONENTS.patch;
};

/**
 * Creates a Git prerequisite check around an injectable typed version read.
 * @param readVersion The installed Git version read.
 * @returns A preflight that validates the installed Git version.
 */
export const createGitVersionPreflight =
  (readVersion: IGitVersionReader = readGitVersion): IGitVersionPreflight =>
  async (directory, signal): Promise<IGitVersionPreflightResult> => {
    const versionResult = await readGit(
      () =>
        readVersion(directory, {
          maxOutputBytes: MAX_GIT_VERSION_OUTPUT_BYTES,
          timeoutSeconds: GIT_TIMEOUT_SECONDS,
          ...(signal === undefined ? {} : { signal }),
        }),
      signal,
    );

    if (versionResult.kind === 'failed') {
      return Object.freeze({ errorCode: mapGitFailure(versionResult.reason), kind: 'failed' });
    }

    if (!isGitVersionSupported(versionResult.value)) {
      return Object.freeze({ errorCode: 'GIT_VERSION_UNSUPPORTED', kind: 'failed' });
    }

    return Object.freeze({ kind: 'supported', version: Object.freeze({ ...versionResult.value }) });
  };

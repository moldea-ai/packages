import { getErrorCode } from 'jg-exception';
import { ERRORS as PROCESS_ERRORS, type IProcessResult } from 'jg-process';
import { ERRORS as GIT_ERRORS, assertGitSucceeded } from 'jg-git-commands';

import { MAX_GIT_DIAGNOSTIC_BYTES } from './constants.js';
import type { IGitFailureReason, IGitReadResult } from './types.js';

/** Creates one immutable Git failure. */
export const createGitFailure = (reason: IGitFailureReason): IGitReadResult<never> =>
  Object.freeze({ kind: 'failed', reason });

/**
 * Classifies one Git error by its code, without retaining its diagnostics.
 * @param error The error a Git command or read rejected with.
 * @param signal The command's cancellation signal, whose abort takes precedence.
 * @returns The failure reason.
 */
export const classifyGitFailure = (error: unknown, signal?: AbortSignal): IGitFailureReason => {
  if (signal?.aborted === true) {
    return 'aborted';
  }

  switch (getErrorCode(error)) {
    case GIT_ERRORS.GIT_NOT_FOUND:
      return 'not-found';
    case GIT_ERRORS.GIT_REPOSITORY_NOT_FOUND:
      return 'repository-not-found';
    case GIT_ERRORS.GIT_ACCESS_DENIED:
      return 'access-denied';
    case GIT_ERRORS.GIT_OUTPUT_INVALID:
      return 'output-invalid';
    case PROCESS_ERRORS.PROCESS_OUTPUT_TOO_LARGE:
      return 'output-limit-exceeded';
    case PROCESS_ERRORS.PROCESS_START_FAILED: {
      const causeCode = getErrorCode((error as { readonly cause?: unknown }).cause);

      return causeCode === 'EACCES' || causeCode === 'EPERM' ? 'access-denied' : 'command-failed';
    }
    default:
      return 'command-failed';
  }
};

/**
 * Runs one typed Git read and turns its rejection into a failure reason.
 * @param read The read, such as one of jg-git-commands' typed commands.
 * @param signal The read's cancellation signal.
 * @returns A promise resolving to the read's value, or why it failed.
 */
export const readGit = async <TValue>(
  read: () => Promise<TValue>,
  signal?: AbortSignal,
): Promise<IGitReadResult<TValue>> => {
  try {
    return Object.freeze({ kind: 'completed', value: await read() });
  } catch (error) {
    return createGitFailure(classifyGitFailure(error, signal));
  }
};

/**
 * Checks one finished Git command. Git exits with 0 after warning on stderr that it skipped
 * something, so any diagnostic fails a command that otherwise succeeded.
 * @param result The command's result, as bytes.
 * @param subcommand The Git subcommand that ran.
 * @returns Why the command failed, or null when it succeeded without diagnostics.
 */
export const checkGitResult = (
  result: IProcessResult<Buffer>,
  subcommand: string,
): IGitFailureReason | null => {
  if (result.stderr.byteLength > MAX_GIT_DIAGNOSTIC_BYTES) {
    return 'output-invalid';
  }

  try {
    assertGitSucceeded(result, subcommand);
  } catch (error) {
    return classifyGitFailure(error);
  }

  return result.stderr.byteLength === 0 ? null : 'output-invalid';
};

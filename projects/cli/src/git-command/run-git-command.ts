import { runGit } from 'jg-git-commands';

import { GIT_TIMEOUT_SECONDS } from './constants.js';
import type { IGitCommandRunner } from './types.js';
import { checkGitResult, createGitFailure, readGit } from './utilities.js';

/**
 * Runs one read-only Git command through jg-git-commands, bounded by the caller's combined output
 * limit and the CLI's timeout, and refuses any stderr. A failure names the subcommand.
 * @param args The command's trusted arguments, its subcommand first.
 * @param options The working directory, output limit, stdin, and cancellation.
 * @returns A promise resolving to the command's stdout, or why it failed.
 */
export const runGitCommand: IGitCommandRunner = async (
  args,
  { cwd, input, maxOutputBytes, signal },
) => {
  const subcommand = args[0];
  const execution = await readGit(
    () =>
      runGit(args, {
        cwd,
        encoding: 'buffer',
        maxOutputBytes,
        timeoutSeconds: GIT_TIMEOUT_SECONDS,
        ...(input === undefined ? {} : { input }),
        ...(signal === undefined ? {} : { signal }),
      }),
    signal,
    subcommand,
  );

  if (execution.kind === 'failed') {
    return execution;
  }

  const reason = checkGitResult(execution.value, subcommand ?? '');

  return reason === null
    ? Object.freeze({ kind: 'completed', value: execution.value.stdout })
    : createGitFailure(reason, subcommand);
};

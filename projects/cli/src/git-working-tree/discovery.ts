import path from 'node:path';
import { readConfigBoolean, readTopLevel } from 'jg-git-commands';

import { GIT_TIMEOUT_SECONDS, readGit, type IGitFailureReason } from '../git-command/index.js';
import { createGitVersionPreflight, type IGitVersionPreflight } from '../git-version/index.js';
import type { IMoldeaCliGitErrorCode } from '../presentation/index.js';

import { MAX_GIT_DISCOVERY_OUTPUT_BYTES } from './constants.js';
import { inspectGitStartingDirectory } from './starting-directory.js';
import type {
  IGitStartingDirectoryInspector,
  IGitWorkingTreeDiscovery,
  IGitWorkingTreeDiscoveryFailedResult,
  IGitWorkingTreeDiscoveryReads,
  IGitWorkingTreeDiscoveryResult,
} from './types.js';

// the typed Git reads discovery uses outside tests
const GIT_DISCOVERY_READS: IGitWorkingTreeDiscoveryReads = Object.freeze({
  readConfigBoolean,
  readTopLevel,
});

/** Maps a normalized Git failure to a safe discovery error. */
const mapGitFailure = (reason: IGitFailureReason): IMoldeaCliGitErrorCode => {
  switch (reason) {
    case 'aborted':
      return 'GIT_OPERATION_ABORTED';
    case 'not-found':
      return 'GIT_NOT_FOUND';
    case 'repository-not-found':
      return 'GIT_REPOSITORY_NOT_FOUND';
    case 'access-denied':
      return 'GIT_ACCESS_DENIED';
    case 'output-limit-exceeded':
    case 'output-invalid':
      return 'GIT_OUTPUT_INVALID';
    case 'command-failed':
      return 'GIT_COMMAND_FAILED';
  }
};

/** Creates one immutable discovery failure. */
const createDiscoveryFailure = (
  errorCode: IMoldeaCliGitErrorCode,
): IGitWorkingTreeDiscoveryFailedResult => Object.freeze({ errorCode, kind: 'failed' });

/**
 * Creates Git working-tree discovery around injectable Git and filesystem boundaries.
 * @param git The typed Git reads.
 * @param startingDirectoryInspector The safe directory inspection boundary.
 * @param gitVersionPreflight The Git version prerequisite check.
 * @returns A working-tree discovery operation.
 */
export const createGitWorkingTreeDiscovery =
  (
    git: IGitWorkingTreeDiscoveryReads = GIT_DISCOVERY_READS,
    startingDirectoryInspector: IGitStartingDirectoryInspector = inspectGitStartingDirectory,
    gitVersionPreflight: IGitVersionPreflight = createGitVersionPreflight(),
  ): IGitWorkingTreeDiscovery =>
  async (input): Promise<IGitWorkingTreeDiscoveryResult> => {
    const startingDirectoryResult = await startingDirectoryInspector(input);

    if (startingDirectoryResult.kind === 'failed') {
      return createDiscoveryFailure(startingDirectoryResult.errorCode);
    }

    const gitOptions = {
      maxOutputBytes: MAX_GIT_DISCOVERY_OUTPUT_BYTES,
      timeoutSeconds: GIT_TIMEOUT_SECONDS,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    };
    const rootResult = await readGit(
      () => git.readTopLevel(startingDirectoryResult.directory, gitOptions),
      input.signal,
    );

    if (rootResult.kind === 'failed') {
      return createDiscoveryFailure(mapGitFailure(rootResult.reason));
    }

    if (rootResult.value === null) {
      return createDiscoveryFailure('GIT_WORK_TREE_REQUIRED');
    }

    const repositoryRoot = rootResult.value;

    if (!path.isAbsolute(repositoryRoot)) {
      return createDiscoveryFailure('GIT_OUTPUT_INVALID');
    }

    const rootDirectoryResult = await startingDirectoryInspector({
      invocationDirectory: startingDirectoryResult.directory,
      repositoryDirectory: repositoryRoot,
    });

    if (rootDirectoryResult.kind === 'failed') {
      return createDiscoveryFailure(rootDirectoryResult.errorCode);
    }

    const versionResult = await gitVersionPreflight(rootDirectoryResult.directory, input.signal);

    if (versionResult.kind === 'failed') {
      return createDiscoveryFailure(versionResult.errorCode);
    }

    const sparseCheckoutResult = await readGit(
      () =>
        git.readConfigBoolean(
          rootDirectoryResult.directory,
          'core.sparseCheckout',
          false,
          gitOptions,
        ),
      input.signal,
    );

    if (sparseCheckoutResult.kind === 'failed') {
      return createDiscoveryFailure(mapGitFailure(sparseCheckoutResult.reason));
    }

    if (sparseCheckoutResult.value) {
      return createDiscoveryFailure('GIT_SPARSE_CHECKOUT_UNSUPPORTED');
    }

    return Object.freeze({ kind: 'discovered', repositoryRoot });
  };

// default Git working-tree discovery used by command execution
export const discoverGitWorkingTree = createGitWorkingTreeDiscovery();

import { readConfigBoolean } from 'jg-git-commands';

import { GIT_TIMEOUT_SECONDS, readGit, type IGitFailureReason } from '../../git-command/index.js';
import type { IGitInventoryProbeErrorCode } from '../types.js';

import type {
  IGitConfigBooleanReader,
  IGitSymlinkConfigurationFailedResult,
  IGitSymlinkConfigurationResolver,
  IGitSymlinkConfigurationResult,
} from './types.js';

/** Creates one immutable effective symlink configuration failure. */
const createConfigurationFailure = (
  errorCode: IGitInventoryProbeErrorCode,
): IGitSymlinkConfigurationFailedResult => Object.freeze({ errorCode, kind: 'failed' });

/** Maps one bounded Git configuration failure to the existing safe CLI contract. */
const mapGitFailure = (reason: IGitFailureReason): IGitInventoryProbeErrorCode => {
  switch (reason) {
    case 'aborted':
      return 'GIT_OPERATION_ABORTED';
    case 'not-found':
      return 'GIT_NOT_FOUND';
    case 'access-denied':
      return 'GIT_ACCESS_DENIED';
    case 'output-limit-exceeded':
      return 'RESOURCE_LIMIT_EXCEEDED';
    case 'repository-not-found':
    case 'output-invalid':
      return 'GIT_OUTPUT_INVALID';
    case 'command-failed':
      return 'GIT_COMMAND_FAILED';
  }
};

/**
 * Creates the bounded effective core.symlinks resolver around a typed Git config read.
 * @param readBoolean The typed Git boolean config read.
 * @returns A resolver for the selected repository's effective symlink behavior.
 */
export const createGitSymlinkConfigurationResolver = (
  readBoolean: IGitConfigBooleanReader = readConfigBoolean,
): IGitSymlinkConfigurationResolver => {
  return async (input): Promise<IGitSymlinkConfigurationResult> => {
    if (input.signal?.aborted) {
      return createConfigurationFailure('GIT_OPERATION_ABORTED');
    }

    if (!Number.isSafeInteger(input.maxMetadataBytes) || input.maxMetadataBytes < 0) {
      return createConfigurationFailure('RESOURCE_LIMIT_EXCEEDED');
    }

    const result = await readGit(
      () =>
        readBoolean(input.repositoryRoot, 'core.symlinks', true, {
          maxOutputBytes: Math.max(input.maxMetadataBytes, 1),
          timeoutSeconds: GIT_TIMEOUT_SECONDS,
          ...(input.signal === undefined ? {} : { signal: input.signal }),
        }),
      input.signal,
    );

    if (result.kind === 'failed') {
      return createConfigurationFailure(mapGitFailure(result.reason));
    }

    // Git writes `true\n` or `false\n`
    const gitMetadataBytes = result.value ? 5 : 6;

    if (gitMetadataBytes > input.maxMetadataBytes) {
      return createConfigurationFailure('RESOURCE_LIMIT_EXCEEDED');
    }

    return Object.freeze({ gitMetadataBytes, isEnabled: result.value, kind: 'resolved' });
  };
};

// default bounded effective core.symlinks resolver
export const resolveGitSymlinkConfiguration = createGitSymlinkConfigurationResolver();

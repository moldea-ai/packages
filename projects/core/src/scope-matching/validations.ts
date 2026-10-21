import { compareCodePoints, countUtf8Bytes, isObjectValid } from 'jg-utilities';

import { parseRepositoryPath, type IRepositoryPath } from '@moldea.ai/repository';

import type { ICoreResourceLimits, ITextDocumentInput } from '../contracts/index.js';
import { CoreOperationException } from '../exceptions/index.js';

import type { IManifestScopeInput } from './types.js';

/** Throws the stable invalid-argument failure for malformed scope input. */
const invalidArgument = (): never => {
  throw new CoreOperationException({
    code: 'INVALID_ARGUMENT',
    operation: 'match-manifest-scope',
  });
};

/** Throws the stable resource failure for an exhausted scope-input budget. */
const resourceLimitExceeded = (
  limit: 'maxEntries' | 'maxTotalBytesRead',
  limitMaximum: number,
  observedUsage: number,
): never => {
  throw new CoreOperationException({
    code: 'RESOURCE_LIMIT_EXCEEDED',
    limit,
    limitMaximum,
    nextAction: 'reduce-input-or-increase-limit',
    observedUsage,
    operation: 'match-manifest-scope',
  });
};

export interface INormalizedManifestScopeInput {
  readonly manifest: ITextDocumentInput;
  readonly paths: readonly IRepositoryPath[];
}

/**
 * Validates and snapshots one public manifest-scope input.
 * @param input The untrusted manifest document and changed logical paths.
 * @param limits The immutable Core resource limits.
 * @returns The detached manifest input and sorted unique repository paths.
 * @throws
 * - INVALID_REPOSITORY_PATH: A changed repository path is invalid.
 * - INVALID_ARGUMENT: The scope operation received an invalid argument.
 * - RESOURCE_LIMIT_EXCEEDED: The changed-path count or byte budget was exceeded.
 */
export const normalizeManifestScopeInput = (
  input: IManifestScopeInput,
  limits: ICoreResourceLimits,
): INormalizedManifestScopeInput => {
  if (!isObjectValid(input, true)) {
    return invalidArgument();
  }

  const manifest = input['manifest'];
  const pathCandidates = input['paths'];

  if (!isObjectValid(manifest, true) || !Array.isArray(pathCandidates)) {
    return invalidArgument();
  }

  if (pathCandidates.length > limits.maxEntries) {
    return resourceLimitExceeded('maxEntries', limits.maxEntries, pathCandidates.length);
  }

  const uniquePaths = new Set<IRepositoryPath>();
  let totalBytes = 0;

  for (const [index, candidate] of pathCandidates.entries()) {
    if (typeof candidate !== 'string') {
      return invalidArgument();
    }

    const path = parseRepositoryPath(candidate);
    totalBytes += countUtf8Bytes(path) + (index === 0 ? 0 : 1);

    if (totalBytes > limits.maxTotalBytesRead) {
      return resourceLimitExceeded('maxTotalBytesRead', limits.maxTotalBytesRead, totalBytes);
    }

    uniquePaths.add(path);
  }

  return {
    manifest,
    paths: [...uniquePaths].sort(compareCodePoints),
  };
};

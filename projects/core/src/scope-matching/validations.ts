import { parseRepositoryPath, type IRepositoryPath } from '@moldea.ai/repository';

import { compareExactStrings } from '../format-validation/index.js';

import type { ICoreResourceLimits, ITextDocumentInput } from '../contracts/index.js';
import { CoreOperationException } from '../exceptions/index.js';

import type { IManifestScopeInput } from './types.js';

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

/** Throws the stable invalid-argument failure for malformed scope input. */
const invalidArgument = (): never => {
  throw new CoreOperationException({
    code: 'INVALID_ARGUMENT',
    operation: 'match-manifest-scope',
  });
};

/** Throws the stable resource failure for an exhausted scope-input budget. */
const resourceLimitExceeded = (limit: 'maxEntries' | 'maxTotalBytesRead'): never => {
  throw new CoreOperationException({
    code: 'RESOURCE_LIMIT_EXCEEDED',
    limit,
    operation: 'match-manifest-scope',
  });
};

/** Measures scalar UTF-8 bytes without allocating an encoded copy. */
export const measureUtf8ByteLength = (value: string): number => {
  let byteLength = 0;

  for (const scalar of value) {
    const codePoint = scalar.codePointAt(0) ?? 0;
    byteLength += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }

  return byteLength;
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
  if (!isRecord(input)) {
    return invalidArgument();
  }

  const manifest = input['manifest'];
  const pathCandidates = input['paths'];

  if (!isRecord(manifest) || !Array.isArray(pathCandidates)) {
    return invalidArgument();
  }

  if (pathCandidates.length > limits.maxEntries) {
    return resourceLimitExceeded('maxEntries');
  }

  const uniquePaths = new Set<IRepositoryPath>();
  let totalBytes = 0;

  for (const [index, candidate] of pathCandidates.entries()) {
    if (typeof candidate !== 'string') {
      return invalidArgument();
    }

    const path = parseRepositoryPath(candidate);
    totalBytes += measureUtf8ByteLength(path) + (index === 0 ? 0 : 1);

    if (totalBytes > limits.maxTotalBytesRead) {
      return resourceLimitExceeded('maxTotalBytesRead');
    }

    uniquePaths.add(path);
  }

  return {
    manifest,
    paths: [...uniquePaths].sort(compareExactStrings),
  };
};

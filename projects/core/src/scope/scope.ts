import type { ICoreOptions } from '../contracts/index.js';
import { normalizeCoreOptions, createCoreOperationOptionsSnapshot } from '../options/index.js';
import {
  matchManifestScope as matchScope,
  type IManifestScopeInput,
  type IManifestScopeResult,
} from '../scope-matching/index.js';

/**
 * Matches only the supplied manifest and changed paths, without inspecting source files.
 * @returns A content-free result with deterministic relationship matches.
 * @throws
 * - INVALID_RESOURCE_LIMIT: A Core resource limit is invalid.
 * - INVALID_REPOSITORY_PATH: The repository path is invalid.
 * - INVALID_ARGUMENT: The Core operation received an invalid argument.
 * - RESOURCE_LIMIT_EXCEEDED: A Core resource limit was exceeded.
 */
export const matchManifestScope = (
  input: IManifestScopeInput,
  options?: ICoreOptions,
): Promise<IManifestScopeResult> =>
  matchScope(input, createCoreOperationOptionsSnapshot(normalizeCoreOptions(options)));

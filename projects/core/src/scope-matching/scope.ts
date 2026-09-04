import type { ICoreOptionsSnapshot } from '../options/index.js';
import { freezeRecursively } from '../immutable/index.js';
import { parseManifestDocument } from '../manifest/index.js';

import { calculateManifestScopeInputDigest, matchParsedManifestScope } from './matching.js';
import type { IManifestScopeInput, IManifestScopeResult } from './types.js';
import { normalizeManifestScopeInput } from './validations.js';

/**
 * Parses a manifest and matches its repository relationships against changed logical paths.
 * @param input The canonical manifest document and untrusted changed-path collection.
 * @param options The immutable Core operation options.
 * @returns A promise resolving to frozen content-free scope metadata and matches.
 * @throws
 * - INVALID_REPOSITORY_PATH: The manifest path or a changed repository path is invalid.
 * - INVALID_ARGUMENT: The scope operation received an invalid argument.
 * - RESOURCE_LIMIT_EXCEEDED: A Core resource limit was exceeded.
 */
export const matchManifestScope = async (
  input: IManifestScopeInput,
  options: ICoreOptionsSnapshot,
): Promise<IManifestScopeResult> => {
  const normalized = normalizeManifestScopeInput(input, options.limits);
  const inputDigest = await calculateManifestScopeInputDigest(normalized.paths);
  const parsed = await parseManifestDocument(normalized.manifest, options, 'match-manifest-scope');

  if (!parsed.valid || parsed.asset === null || parsed.manifest === null) {
    return freezeRecursively({
      counts: {
        declarations: 0,
        inputPaths: normalized.paths.length,
        matchedOwners: 0,
        matchedPaths: 0,
        matches: 0,
      },
      diagnostics: parsed.diagnostics,
      inputDigest,
      manifestDigest: null,
      matches: [],
      relevant: false,
      valid: false,
    });
  }

  const matched = matchParsedManifestScope(parsed.manifest, normalized.paths, options.limits);

  return freezeRecursively({
    counts: matched.counts,
    diagnostics: [],
    inputDigest,
    manifestDigest: parsed.asset.digest,
    matches: matched.matches,
    relevant: matched.matches.length > 0,
    valid: true,
  });
};

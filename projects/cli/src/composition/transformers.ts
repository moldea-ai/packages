import { deepFreeze } from 'jg-utilities';

import type { IMoldeaCliCompositionResult, IMoldeaCliCompositionStateInput } from './types.js';

const compareIdentifiers = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

/**
 * Creates the compact immutable composition result from validated installed state.
 * @param input The already validated installed and executable composition.
 * @returns A deeply immutable composition result in deterministic report order.
 */
export const createMoldeaCliCompositionResult = (
  input: IMoldeaCliCompositionStateInput,
): IMoldeaCliCompositionResult => {
  const packages = Object.entries(input.packageMetadata.installedPackageVersions ?? {})
    .map(([name, version]) => ({ name, version }))
    .sort((left, right) => compareIdentifiers(left.name, right.name));

  return deepFreeze({
    minimumGitVersion: input.minimumGitVersion,
    packages,
    repositoryFormatVersions: [...input.coreSupportedRepositoryFormatVersions].sort(
      (left, right) => left - right,
    ),
    supportedNodeRange: input.packageMetadata.supportedNodeRange ?? '',
  });
};

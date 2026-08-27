import { MOLDEA_CLI_CUSTOM_ADAPTER_ID } from './constants.js';
import type {
  IMoldeaCliAdapterComposition,
  IMoldeaCliCompositionResult,
  IMoldeaCliCompositionStateInput,
} from './types.js';

const compareIdentifiers = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

/** Recursively freezes a composition result without retaining mutable input ownership. */
const freezeCompositionValue = <TValue extends object>(value: TValue): TValue => {
  const pendingValues: object[] = [value];
  const visitedValues = new Set<object>();

  while (pendingValues.length > 0) {
    const currentValue = pendingValues.pop();

    if (currentValue === undefined || visitedValues.has(currentValue)) {
      continue;
    }

    visitedValues.add(currentValue);
    for (const nestedValue of Object.values(currentValue as Readonly<Record<string, unknown>>)) {
      if (typeof nestedValue === 'object' && nestedValue !== null) {
        pendingValues.push(nestedValue);
      }
    }

    Object.freeze(currentValue);
  }

  return value;
};

/**
 * Creates the compact immutable composition result from validated installed state.
 * @param input The already validated installed and executable composition.
 * @returns A deeply immutable composition result in deterministic report order.
 */
export const createMoldeaCliCompositionResult = (
  input: IMoldeaCliCompositionStateInput,
): IMoldeaCliCompositionResult => {
  const adapters: IMoldeaCliAdapterComposition[] = [
    {
      id: MOLDEA_CLI_CUSTOM_ADAPTER_ID,
      repositoryFormatVersions: [...input.coreSupportedRepositoryFormatVersions].sort(
        (left, right) => left - right,
      ),
    },
    ...input.activeAdapters.map((adapter) => ({
      id: adapter.id,
      repositoryFormatVersions: [...adapter.supportedRepositoryFormatVersions].sort(
        (left, right) => left - right,
      ),
    })),
  ].sort((left, right) => compareIdentifiers(left.id, right.id));
  const packages = Object.entries(input.packageMetadata.installedPackageVersions ?? {})
    .map(([name, version]) => ({ name, version }))
    .sort((left, right) => compareIdentifiers(left.name, right.name));

  return freezeCompositionValue({
    adapters,
    minimumGitVersion: input.minimumGitVersion,
    packages,
    repositoryFormatVersions: [...input.coreSupportedRepositoryFormatVersions].sort(
      (left, right) => left - right,
    ),
    supportedNodeRange: input.packageMetadata.supportedNodeRange ?? '',
  });
};

import { satisfies as doesVersionSatisfy, valid as isValidVersion, validRange } from 'semver';

import {
  MOLDEA_CLI_FIRST_CLASS_PACKAGE_RANGES,
  MOLDEA_CLI_FOUNDATIONAL_PACKAGE_NAMES,
} from './constants.js';
import type { IMoldeaCliCompositionStateInput } from './types.js';

const hasExactStringSet = (left: readonly string[], right: readonly string[]): boolean => {
  if (
    left.length !== right.length ||
    new Set(left).size !== left.length ||
    new Set(right).size !== right.length
  ) {
    return false;
  }

  const rightValues = new Set(right);
  return left.every((entry) => rightValues.has(entry));
};

const hasUniquePositiveIntegers = (entries: readonly number[]): boolean =>
  entries.length > 0 &&
  entries.every((entry) => Number.isSafeInteger(entry) && entry > 0) &&
  new Set(entries).size === entries.length;

/**
 * Verifies the installed package manifest and resolved package composition.
 * @param input The installed package, Core, Git, and JSON-schema state.
 * @returns Whether every runtime composition invariant is satisfied.
 */
export const isMoldeaCliCompositionStateValid = (
  input: IMoldeaCliCompositionStateInput,
): boolean => {
  const { dependencies, installedPackageVersions, supportedNodeRange, version } =
    input.packageMetadata;

  if (
    isValidVersion(version) === null ||
    supportedNodeRange === null ||
    validRange(supportedNodeRange) === null ||
    isValidVersion(input.minimumGitVersion) === null ||
    input.outputSchemaVersion !== 7 ||
    dependencies === null ||
    installedPackageVersions === null ||
    !hasUniquePositiveIntegers(input.coreSupportedRepositoryFormatVersions)
  ) {
    return false;
  }

  const expectedPackageNames = [...MOLDEA_CLI_FOUNDATIONAL_PACKAGE_NAMES];
  const declaredPackageNames = Object.keys(dependencies).filter((packageName) =>
    packageName.startsWith('@moldea.ai/'),
  );
  const resolvedPackageNames = Object.keys(installedPackageVersions);

  if (
    !hasExactStringSet(declaredPackageNames, expectedPackageNames) ||
    !hasExactStringSet(resolvedPackageNames, expectedPackageNames)
  ) {
    return false;
  }

  return expectedPackageNames.every((packageName) => {
    const resolvedVersion = installedPackageVersions[packageName];
    const declaredRange = dependencies[packageName];
    const supportedRange = MOLDEA_CLI_FIRST_CLASS_PACKAGE_RANGES[packageName];

    return (
      resolvedVersion !== undefined &&
      isValidVersion(resolvedVersion) !== null &&
      supportedRange !== undefined &&
      (declaredRange === supportedRange || declaredRange === `workspace:${supportedRange}`) &&
      doesVersionSatisfy(resolvedVersion, supportedRange)
    );
  });
};

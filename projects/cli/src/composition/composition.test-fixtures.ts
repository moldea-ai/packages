import type { IMoldeaCliPackageMetadata } from '../package-metadata/index.js';

import { MOLDEA_CLI_FIRST_CLASS_PACKAGE_RANGES } from './constants.js';
import type { IMoldeaCliCompositionStateInput } from './types.js';

const PACKAGE_VERSIONS = {
  '@moldea.ai/core': '7.0.4',
  '@moldea.ai/repository': '2.0.0',
  '@moldea.ai/repository-fs': '2.0.3',
} as const;

// exact installed package metadata used by composition tests
export const INSTALLED_PACKAGE_METADATA: IMoldeaCliPackageMetadata = Object.freeze({
  dependencies: Object.freeze(
    Object.fromEntries(
      Object.keys(PACKAGE_VERSIONS).map((name) => [
        name,
        `workspace:${MOLDEA_CLI_FIRST_CLASS_PACKAGE_RANGES[name as keyof typeof MOLDEA_CLI_FIRST_CLASS_PACKAGE_RANGES]}`,
      ]),
    ),
  ),
  installedPackageVersions: Object.freeze({ ...PACKAGE_VERSIONS }),
  supportedNodeRange: '>=22.17.0',
  version: '11.0.2',
});

/** Creates the exact valid current runtime composition state. */
export const createTestCompositionState = (): IMoldeaCliCompositionStateInput => ({
  coreSupportedRepositoryFormatVersions: [1],
  minimumGitVersion: '2.30.0',
  outputSchemaVersion: 7,
  packageMetadata: INSTALLED_PACKAGE_METADATA,
});

import { hasErrorCode } from 'jg-exception';
import { request, type IRequestOptions, type IRequestResult } from 'jg-fetch';
import { ERRORS, isObjectValid, waitUntil } from 'jg-utilities';
import { satisfies, valid, validRange } from 'semver';

import {
  NPM_RELEASE_REGISTRY_PROPAGATION,
  NPM_RELEASE_REGISTRY_REQUEST_TIMEOUT_SECONDS,
  NPM_RELEASE_REGISTRY_URL,
  NPM_RELEASE_WORKSPACE_PROTOCOL_PREFIX,
} from './constants.ts';

// injectable registry request, jg-fetch's request outside tests
export type INpmRegistryRequest = (
  url: URL,
  options: IRequestOptions<unknown>,
) => Promise<IRequestResult<unknown>>;

// how long a newly published version may take to appear, and how often it's checked
export type INpmRegistryPropagation = Readonly<{ intervalSeconds: number; timeoutSeconds: number }>;

/**
 * Parses the exact published version inventory from npm package metadata.
 * @param metadata The untrusted registry document.
 * @param packageName The expected npm package identity.
 * @returns The published semantic versions in registry order.
 * @throws
 * - If the registry metadata identity or version inventory is invalid
 */
export const parseNpmRegistryVersions = (metadata: unknown, packageName: string): string[] => {
  if (
    !isObjectValid(metadata, true) ||
    metadata['name'] !== packageName ||
    !isObjectValid(metadata['versions'], true)
  ) {
    throw new TypeError(`The npm registry metadata for ${packageName} is invalid.`);
  }

  const versions = Object.keys(metadata['versions']);

  if (versions.some((version) => valid(version) === null)) {
    throw new TypeError(`The npm registry versions for ${packageName} are invalid.`);
  }

  return versions;
};

/**
 * Loads all published versions of one public package without registry credentials.
 * @param packageName The public npm package identity.
 * @param requestRegistry The HTTP boundary used to request public registry metadata.
 * @returns A promise resolving to published versions, or an empty list when unpublished.
 * @throws
 * - If the registry request fails or returns invalid package metadata
 */
export const loadNpmRegistryVersions = async (
  packageName: string,
  requestRegistry: INpmRegistryRequest = request,
): Promise<string[]> => {
  const { data, error, meta } = await requestRegistry(
    new URL(encodeURIComponent(packageName), NPM_RELEASE_REGISTRY_URL),
    {
      headers: { accept: 'application/json' },
      timeoutSeconds: NPM_RELEASE_REGISTRY_REQUEST_TIMEOUT_SECONDS,
    },
  );

  if (meta.status === 404) {
    return [];
  }

  if (error !== null) {
    throw new Error(
      `The npm registry request for ${packageName} failed with ${meta.status ?? error.code}.`,
      { cause: error },
    );
  }

  return parseNpmRegistryVersions(data, packageName);
};

/**
 * Waits for a newly published internal dependency to become visible in npm metadata.
 * @param packageName The internal npm package identity.
 * @param sourceRange The workspace dependency range from the candidate manifest.
 * @param requestRegistry The HTTP boundary used to request public registry metadata.
 * @param propagation How long to wait for the version, and how often to check.
 * @returns A promise resolving to the latest observed published versions.
 * @throws
 * - If a registry request fails or returns invalid package metadata
 */
export const loadNpmRegistryDependencyVersions = async (
  packageName: string,
  sourceRange: string,
  requestRegistry: INpmRegistryRequest = request,
  propagation: INpmRegistryPropagation = NPM_RELEASE_REGISTRY_PROPAGATION,
): Promise<string[]> => {
  const publishedRange = sourceRange.startsWith(NPM_RELEASE_WORKSPACE_PROTOCOL_PREFIX)
    ? sourceRange.slice(NPM_RELEASE_WORKSPACE_PROTOCOL_PREFIX.length)
    : null;

  if (publishedRange === null || validRange(publishedRange) === null) {
    return loadNpmRegistryVersions(packageName, requestRegistry);
  }

  let versions: string[] = [];

  try {
    return await waitUntil(async () => {
      versions = await loadNpmRegistryVersions(packageName, requestRegistry);

      return versions.some((version) => satisfies(version, publishedRange)) ? versions : null;
    }, propagation);
  } catch (error) {
    // the caller decides what a version that never appeared means
    if (hasErrorCode(error, ERRORS.WAIT_UNTIL_TIMED_OUT)) {
      return versions;
    }

    throw error;
  }
};

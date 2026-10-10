import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { NPM_RELEASE_PROJECTS } from './constants.ts';
import { loadNpmRegistryDependencyVersions } from './registry.ts';
import { createNpmReleaseIdentity } from './validations.ts';

// a stalled registry request must not exhaust the Pages job's ten-minute availability window
const REGISTRY_REQUEST_TIMEOUT_MS = 30_000;
const requestRegistry: typeof fetch = (input, init) =>
  fetch(input, { ...init, signal: AbortSignal.timeout(REGISTRY_REQUEST_TIMEOUT_MS) });

/**
 * Requires every advertised exact package version to be visible in the public npm registry.
 * Uses the release owner's bounded propagation retries; Pages can be retried after publication.
 * @returns A promise that resolves once the complete current inventory is available.
 * @throws If a manifest, registry response, or advertised version is unavailable or invalid.
 */
export const verifyNpmReleaseAvailability = async (options: {
  repositoryRoot: URL;
  request?: typeof fetch;
  wait?: (delayMs: number) => Promise<unknown>;
}): Promise<void> => {
  // the release inventory has fifteen fixed entries; requests cannot grow with repository contents
  await Promise.all(
    Object.entries(NPM_RELEASE_PROJECTS).map(async ([project, configuration]) => {
      const manifest: unknown = JSON.parse(
        await readFile(
          new URL(`${configuration.projectDirectory}/package.json`, options.repositoryRoot),
          'utf8',
        ),
      );
      const { manifest: identity } = createNpmReleaseIdentity({
        commit: '0'.repeat(40),
        gitRef: 'refs/heads/main',
        manifest,
        mode: 'bootstrap',
        project,
      });
      const versions = await loadNpmRegistryDependencyVersions(
        identity.name,
        `workspace:${identity.version}`,
        options.request ?? requestRegistry,
        options.wait,
      );
      if (!versions.includes(identity.version)) {
        throw new Error(
          `${identity.name}@${identity.version} is not available on npm. Retry Pages after publication completes.`,
        );
      }
    }),
  );
};

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.length !== 2) throw new TypeError('Use availability.ts without arguments.');
  await verifyNpmReleaseAvailability({ repositoryRoot: new URL('../../', import.meta.url) });
}

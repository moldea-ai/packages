import { readFile } from 'node:fs/promises';
import { isMainModule } from 'jg-process';

import { NPM_RELEASE_PROJECTS } from './constants.ts';
import {
  loadNpmRegistryDependencyVersions,
  type INpmRegistryPropagation,
  type INpmRegistryRequest,
} from './registry.ts';
import { createNpmReleaseIdentity } from './validations.ts';

/**
 * Requires every advertised exact package version to be visible in the public npm registry.
 * Uses the release owner's bounded propagation retries; Pages can be retried after publication.
 * @returns A promise that resolves once the complete current inventory is available.
 * @throws If a manifest, registry response, or advertised version is unavailable or invalid.
 */
export const verifyNpmReleaseAvailability = async (options: {
  repositoryRoot: URL;
  request?: INpmRegistryRequest;
  propagation?: INpmRegistryPropagation;
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
        options.request,
        options.propagation,
      );
      if (!versions.includes(identity.version)) {
        throw new Error(
          `${identity.name}@${identity.version} is not available on npm. Retry Pages after publication completes.`,
        );
      }
    }),
  );
};

if (isMainModule(import.meta.url)) {
  if (process.argv.length !== 2) throw new TypeError('Use availability.ts without arguments.');
  await verifyNpmReleaseAvailability({ repositoryRoot: new URL('../../', import.meta.url) });
}

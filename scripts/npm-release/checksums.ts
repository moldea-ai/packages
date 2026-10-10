import path from 'node:path';
import { readFile } from 'node:fs/promises';

import {
  loadNpmReleaseArtifactNames,
  verifyNpmReleaseChecksumManifest,
  verifyNpmReleaseConsumerChecksums,
  writeNpmReleaseChecksumManifest,
} from './artifacts.ts';
import { NPM_RELEASE_CHECKSUM_FILE_NAME, NPM_RELEASE_PROJECTS } from './constants.ts';

const repositoryRoot = new URL('../../', import.meta.url);

const [operation, artifactDirectoryValue] = process.argv.slice(2);

if (
  (operation !== 'create' && operation !== 'verify' && operation !== 'verify-consumers') ||
  artifactDirectoryValue === undefined ||
  process.argv.length !== 4
) {
  throw new TypeError('Use checksums.ts <create|verify|verify-consumers> <artifact-directory>.');
}

const artifactDirectory = path.resolve(artifactDirectoryValue);
const expectedArtifactNames = await loadNpmReleaseArtifactNames(repositoryRoot);

if (operation === 'create') {
  await writeNpmReleaseChecksumManifest(artifactDirectory, expectedArtifactNames);
} else {
  await verifyNpmReleaseChecksumManifest(artifactDirectory, expectedArtifactNames);
  if (operation === 'verify-consumers') {
    const [actual, consumer] = await Promise.all([
      readFile(path.join(artifactDirectory, NPM_RELEASE_CHECKSUM_FILE_NAME), 'utf8'),
      readFile(new URL('compatibility/consumers/SHA256SUMS', repositoryRoot), 'utf8'),
    ]);
    verifyNpmReleaseConsumerChecksums(
      actual,
      consumer,
      expectedArtifactNames.filter(
        (name) => !name.startsWith(`${NPM_RELEASE_PROJECTS['website-ui'].artifactPrefix}-`),
      ),
    );
  }
}

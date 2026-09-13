import { readFile } from 'node:fs/promises';
import { posix } from 'node:path';

import { NPM_RELEASE_PROJECT_ORDER, NPM_RELEASE_PROJECTS } from './constants.ts';
import { hasGitProjectChanges, readGitFile, readOptionalGitFile } from './git.ts';
import type { INpmReleaseProjectChange, INpmReleaseWorkflowPlanSources } from './types.ts';

/** Reads the committed version and whether the npm file selection can include docs. */
const readManifestReleaseState = (
  manifestSource: string,
  packageName: string,
): {
  version: string;
  publishesDocumentation: boolean;
} => {
  const manifest = JSON.parse(manifestSource) as unknown;

  if (
    typeof manifest !== 'object' ||
    manifest === null ||
    Array.isArray(manifest) ||
    !('name' in manifest) ||
    manifest.name !== packageName ||
    !('version' in manifest) ||
    typeof manifest.version !== 'string'
  ) {
    throw new TypeError(`The ${packageName} package manifest is invalid.`);
  }

  const files: unknown = 'files' in manifest ? manifest.files : undefined;

  if (
    files !== undefined &&
    (!Array.isArray(files) || !files.every((entry: unknown) => typeof entry === 'string'))
  ) {
    throw new TypeError(`The ${packageName} package file selection is invalid.`);
  }

  // without an allowlist npm includes docs by default; broad root globs may include them too
  const publishesDocumentation =
    files === undefined ||
    files.some((entry: string) => {
      const rootPattern = entry.replace(/^\.\//u, '').split('/')[0] ?? '';
      return !rootPattern.startsWith('!') && posix.matchesGlob('docs', rootPattern);
    });

  return { version: manifest.version, publishesDocumentation };
};

/**
 * Loads every public project's package-version and Git change state.
 * @param repositoryRoot The checked-out repository root.
 * @param baseCommit The optional commit before an automatic release.
 * @param currentCommit The optional commit containing the release candidates.
 * @returns The complete per-project change inventory.
 * @throws
 * - If commit inputs are incomplete or a package manifest cannot be read safely
 */
export const loadNpmReleaseProjectChanges = async (
  repositoryRoot: URL,
  baseCommit: string | null,
  currentCommit: string | null,
): Promise<INpmReleaseWorkflowPlanSources['projectChanges']> => {
  if ((baseCommit === null) !== (currentCommit === null)) {
    throw new TypeError('The npm release comparison commits are incomplete.');
  }

  return Object.fromEntries(
    await Promise.all(
      NPM_RELEASE_PROJECT_ORDER.map(async (project) => {
        const configuration = NPM_RELEASE_PROJECTS[project];
        const manifestPath = `${configuration.projectDirectory}/package.json`;
        const currentManifestSource =
          currentCommit === null
            ? await readFile(new URL(manifestPath, repositoryRoot), 'utf8')
            : readGitFile(repositoryRoot, currentCommit, manifestPath);
        const currentManifest = readManifestReleaseState(
          currentManifestSource,
          configuration.packageName,
        );
        const previousManifestSource =
          baseCommit === null
            ? currentManifestSource
            : readOptionalGitFile(repositoryRoot, baseCommit, manifestPath);
        const previousManifest =
          previousManifestSource === null
            ? null
            : readManifestReleaseState(previousManifestSource, configuration.packageName);
        const change: INpmReleaseProjectChange = {
          currentVersion: currentManifest.version,
          isChanged:
            baseCommit !== null && currentCommit !== null
              ? hasGitProjectChanges(
                  repositoryRoot,
                  baseCommit,
                  currentCommit,
                  configuration.projectDirectory,
                  currentManifest.publishesDocumentation ||
                    previousManifest?.publishesDocumentation === true,
                )
              : false,
          previousVersion: previousManifest?.version ?? null,
        };

        return [project, change] as const;
      }),
    ),
  ) as INpmReleaseWorkflowPlanSources['projectChanges'];
};

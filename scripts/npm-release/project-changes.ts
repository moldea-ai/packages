import { readFile } from 'node:fs/promises';
import { posix } from 'node:path';

import {
  loadGitWorkspaceSnapshot,
  readGitFile,
  readOptionalGitFile,
  type IWorkspacePackageState,
} from '../workspace-graph/index.ts';

import { NPM_RELEASE_PROJECT_ORDER, NPM_RELEASE_PROJECTS } from './constants.ts';
import { hasGitLibraryBuildConfigChanges, hasGitProjectChanges } from './git.ts';
import type {
  INpmReleaseProject,
  INpmReleaseProjectChange,
  INpmReleaseWorkflowPlanSources,
} from './types.ts';

const PUBLIC_PROJECT_BY_PACKAGE_NAME = new Map<string, INpmReleaseProject>(
  NPM_RELEASE_PROJECT_ORDER.map((project) => [NPM_RELEASE_PROJECTS[project].packageName, project]),
);

/** Carries changed private inputs through private dependents to public artifacts only. */
const collectPrivatePackageConsumers = (
  snapshot: Map<string, IWorkspacePackageState>,
  changedPrivateNames: ReadonlySet<string>,
  selectedProjects: Set<INpmReleaseProject>,
): void => {
  const dependents = new Map<string, string[]>();

  for (const packageState of snapshot.values()) {
    for (const dependencyName of packageState.workspaceDependencies) {
      if (snapshot.get(dependencyName)?.isPrivate) {
        const consumers = dependents.get(dependencyName) ?? [];
        consumers.push(packageState.name);
        dependents.set(dependencyName, consumers);
      }
    }
  }

  const pending = [...changedPrivateNames].filter((name) => snapshot.get(name)?.isPrivate);
  const visited = new Set<string>();

  while (pending.length > 0) {
    const packageName = pending.pop();

    if (packageName === undefined || visited.has(packageName)) {
      continue;
    }

    visited.add(packageName);

    for (const consumerName of dependents.get(packageName) ?? []) {
      const consumer = snapshot.get(consumerName);

      if (consumer?.isPrivate) {
        pending.push(consumerName);
        continue;
      }

      const project = PUBLIC_PROJECT_BY_PACKAGE_NAME.get(consumerName);

      if (project === undefined) {
        throw new TypeError(`The ${consumerName} public workspace consumer is not releaseable.`);
      }

      selectedProjects.add(project);
    }
  }
};

/** Compares both dependency graphs so removed or replaced private inputs still select consumers. */
const loadPrivateInputProjects = (
  repositoryRoot: URL,
  baseCommit: string,
  currentCommit: string,
): Set<INpmReleaseProject> => {
  const previous = loadGitWorkspaceSnapshot(repositoryRoot, baseCommit);
  const current = loadGitWorkspaceSnapshot(repositoryRoot, currentCommit);
  const changedPrivateNames = new Set<string>();

  for (const packageName of new Set([...previous.keys(), ...current.keys()])) {
    const previousPackage = previous.get(packageName);
    const currentPackage = current.get(packageName);

    if (!previousPackage?.isPrivate && !currentPackage?.isPrivate) {
      continue;
    }

    if (
      previousPackage?.directory !== currentPackage?.directory ||
      previousPackage?.isPrivate !== currentPackage?.isPrivate ||
      (currentPackage !== undefined &&
        hasGitProjectChanges(
          repositoryRoot,
          baseCommit,
          currentCommit,
          currentPackage.directory,
          false,
        ))
    ) {
      changedPrivateNames.add(packageName);
    }
  }

  const selectedProjects = new Set<INpmReleaseProject>();
  collectPrivatePackageConsumers(previous, changedPrivateNames, selectedProjects);
  collectPrivatePackageConsumers(current, changedPrivateNames, selectedProjects);

  return selectedProjects;
};

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

  const publicChanges = Object.fromEntries(
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

  if (baseCommit === null || currentCommit === null) {
    return publicChanges;
  }

  const privateInputProjects = loadPrivateInputProjects(repositoryRoot, baseCommit, currentCommit);
  const hasBuildConfigChanges = hasGitLibraryBuildConfigChanges(
    repositoryRoot,
    baseCommit,
    currentCommit,
  );

  return Object.fromEntries(
    NPM_RELEASE_PROJECT_ORDER.map((project) => [
      project,
      {
        ...publicChanges[project],
        isChanged:
          publicChanges[project].isChanged ||
          hasBuildConfigChanges ||
          privateInputProjects.has(project),
      },
    ]),
  ) as INpmReleaseWorkflowPlanSources['projectChanges'];
};

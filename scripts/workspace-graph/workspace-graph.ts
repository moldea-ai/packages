import { posix } from 'node:path';

import { listGitWorkspaceManifestPaths, readGitFile } from './git.ts';
import type { IWorkspacePackageState } from './types.ts';

/**
 * Parses committed identity, scripts, and local edges without reading implementation files.
 * @throws
 * - If the workspace manifest or its local dependency/script declarations are invalid.
 */
export const readWorkspacePackageState = (
  manifestSource: string,
  manifestPath: string,
): IWorkspacePackageState => {
  const manifest: unknown = JSON.parse(manifestSource);
  if (
    typeof manifest !== 'object' ||
    manifest === null ||
    Array.isArray(manifest) ||
    !('name' in manifest) ||
    typeof manifest.name !== 'string' ||
    manifest.name.length === 0 ||
    ('private' in manifest && typeof manifest.private !== 'boolean')
  )
    throw new TypeError(`The ${manifestPath} workspace manifest is invalid.`);

  const record = manifest as Record<string, unknown>;
  const workspaceDependencies = new Set<string>();
  for (const field of ['dependencies', 'devDependencies']) {
    const dependencies = record[field];
    if (dependencies === undefined) continue;
    if (
      typeof dependencies !== 'object' ||
      dependencies === null ||
      Array.isArray(dependencies) ||
      !Object.values(dependencies).every((version) => typeof version === 'string')
    )
      throw new TypeError(`The ${manifestPath} ${field} are invalid.`);
    for (const [dependencyName, version] of Object.entries(dependencies)) {
      if (typeof version === 'string' && version.startsWith('workspace:'))
        workspaceDependencies.add(dependencyName);
    }
  }
  const scripts = record['scripts'];
  if (
    scripts !== undefined &&
    (typeof scripts !== 'object' ||
      scripts === null ||
      Array.isArray(scripts) ||
      !Object.values(scripts).every((command) => typeof command === 'string'))
  )
    throw new TypeError(`The ${manifestPath} scripts are invalid.`);
  return {
    directory: posix.dirname(manifestPath),
    isPrivate: record['private'] === true,
    name: manifest.name,
    scripts: scripts === undefined ? [] : Object.keys(scripts),
    workspaceDependencies: [...workspaceDependencies].sort(),
  };
};

/**
 * Loads committed workspace facts and enforces the existing private-input graph invariants.
 * Public package edges remain traversable by CI without changing release propagation policy.
 * @throws
 * - If committed manifests cannot be read or parsed, names are duplicated, dependencies are missing, or private dependency cycles exist.
 */
export const loadGitWorkspaceSnapshot = (
  repositoryRoot: URL,
  commit: string,
): Map<string, IWorkspacePackageState> => {
  const packages = new Map<string, IWorkspacePackageState>();
  for (const manifestPath of listGitWorkspaceManifestPaths(repositoryRoot, commit)) {
    const state = readWorkspacePackageState(
      readGitFile(repositoryRoot, commit, manifestPath),
      manifestPath,
    );
    if (packages.has(state.name))
      throw new TypeError(`The ${state.name} workspace package is duplicated.`);
    packages.set(state.name, state);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visitPrivatePackage = (packageName: string): void => {
    if (visiting.has(packageName))
      throw new TypeError(`The ${packageName} private workspace dependency graph is cyclic.`);
    if (visited.has(packageName)) return;
    const state = packages.get(packageName);
    if (state === undefined)
      throw new TypeError(`The ${packageName} workspace dependency is missing.`);
    visiting.add(packageName);
    for (const name of state.workspaceDependencies) {
      const dependency = packages.get(name);
      if (dependency === undefined)
        throw new TypeError(`The ${name} workspace dependency is missing.`);
      if (dependency.isPrivate) visitPrivatePackage(name);
    }
    visiting.delete(packageName);
    visited.add(packageName);
  };
  for (const name of packages.keys()) visitPrivatePackage(name);
  return packages;
};

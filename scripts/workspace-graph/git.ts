import { spawnSync } from 'node:child_process';

const COMMIT_PATTERN = /^[0-9a-f]{40}$/u;
const EXCLUDED_DIRECTORIES = new Set(['_archive', '_archives', '_backup', '_backups']);

/** Identifies paths whose contents must never be inspected. */
export const isExcludedPath = (filePath: string): boolean =>
  filePath.split('/').some((segment) => EXCLUDED_DIRECTORIES.has(segment));

/**
 * Requires an exact Git commit identity before constructing Git arguments.
 * @throws
 * - The Git commit is invalid.
 */
export const requireGitCommit = (commit: string): void => {
  if (!COMMIT_PATTERN.test(commit)) throw new TypeError('The Git commit is invalid.');
};

const requireReadablePath = (filePath: string): void => {
  if (
    filePath.length === 0 ||
    filePath.startsWith('/') ||
    /^[a-z]:/iu.test(filePath) ||
    filePath.includes('\\') ||
    filePath.includes('\0') ||
    filePath.split('/').some((segment) => segment === '..' || segment === '.') ||
    isExcludedPath(filePath)
  ) {
    throw new TypeError('The committed file path is invalid or excluded.');
  }
};

/**
 * Reads a permitted file from an exact committed tree without following filesystem links.
 * @throws
 * - The Git commit is invalid.
 * - The committed file path is invalid or excluded.
 * - If Git cannot read the committed file.
 */
export const readGitFile = (repositoryRoot: URL, commit: string, filePath: string): string => {
  requireGitCommit(commit);
  requireReadablePath(filePath);
  const result = spawnSync('git', ['show', `${commit}:${filePath}`], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`The ${filePath} file could not be read from ${commit}.`);
  }
  return result.stdout;
};

/**
 * Reads a permitted committed file, returning null only when its tree entry is absent.
 * @throws
 * - The Git commit is invalid.
 * - The committed file path is invalid or excluded.
 * - If Git cannot inspect or read the committed file.
 */
export const readOptionalGitFile = (
  repositoryRoot: URL,
  commit: string,
  filePath: string,
): string | null => {
  requireGitCommit(commit);
  requireReadablePath(filePath);
  const result = spawnSync('git', ['ls-tree', '-z', '--name-only', commit, '--', filePath], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`The ${filePath} file state could not be read from ${commit}.`);
  }
  if (result.stdout === '') return null;
  if (result.stdout !== `${filePath}\0`) {
    throw new Error(`The ${filePath} file state could not be resolved safely from ${commit}.`);
  }
  return readGitFile(repositoryRoot, commit, filePath);
};

/**
 * Lists immediate workspace manifests using tree metadata only.
 * @throws
 * - The Git commit is invalid.
 * - If Git cannot enumerate workspace manifests.
 */
export const listGitWorkspaceManifestPaths = (repositoryRoot: URL, commit: string): string[] => {
  requireGitCommit(commit);
  const result = spawnSync(
    'git',
    ['ls-tree', '-r', '-z', '--name-only', commit, '--', 'apps', 'packages', 'projects'],
    { cwd: repositoryRoot, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    throw new Error(`The ${commit} workspace manifests could not be listed safely.`);
  }
  return result.stdout
    .split('\0')
    .filter(
      (filePath) =>
        /^(?:apps|packages|projects)\/[^/]+\/package\.json$/u.test(filePath) &&
        !isExcludedPath(filePath),
    );
};

/**
 * Lists changed paths without loading blobs for rename similarity or external diff drivers.
 * A move is represented by its old deletion and new addition, preserving both owners.
 * @throws
 * - The Git commit is invalid.
 * - If Git cannot enumerate changed path metadata.
 */
export const listGitChangedPaths = (
  repositoryRoot: URL,
  baseCommit: string,
  currentCommit: string,
): string[] => {
  requireGitCommit(baseCommit);
  requireGitCommit(currentCommit);
  const result = spawnSync(
    'git',
    [
      'diff',
      '--no-ext-diff',
      '--no-textconv',
      '--no-renames',
      '--name-only',
      '-z',
      baseCommit,
      currentCommit,
      '--',
    ],
    { cwd: repositoryRoot, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 },
  );
  if (result.status !== 0) throw new Error('The Git changed paths could not be listed safely.');
  return result.stdout
    .split('\0')
    .filter((filePath) => filePath !== '' && !isExcludedPath(filePath));
};

/**
 * Tests whether an exact comparison commit is available locally.
 * @throws
 * - The Git commit is invalid.
 */
export const hasGitCommit = (repositoryRoot: URL, commit: string): boolean => {
  requireGitCommit(commit);
  return (
    spawnSync('git', ['cat-file', '-e', `${commit}^{commit}`], { cwd: repositoryRoot }).status === 0
  );
};

/**
 * Resolves the actual checked-out commit rather than trusting event metadata alone.
 * @throws
 * - If Git cannot resolve the checked-out commit.
 * - The Git commit is invalid.
 */
export const getGitHead = (repositoryRoot: URL): string => {
  const result = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error('The checked-out Git commit could not be resolved.');
  const commit = result.stdout.trim();
  requireGitCommit(commit);
  return commit;
};

import { spawnSync } from 'node:child_process';

import { requireGitCommit } from '../workspace-graph/index.ts';

const COMMIT_PATTERN = /^[0-9a-f]{40}$/u;

/** Detects changes to shared library-build inputs while excluding tests and prose. */
export const hasGitLibraryBuildConfigChanges = (
  repositoryRoot: URL,
  baseCommit: string,
  currentCommit: string,
): boolean => {
  requireGitCommit(baseCommit);
  requireGitCommit(currentCommit);

  const result = spawnSync(
    'git',
    [
      'diff',
      '--no-renames',
      '--name-only',
      '-z',
      baseCommit,
      currentCommit,
      '--',
      'configs/vite',
      'configs/typescript',
    ],
    { cwd: repositoryRoot, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 },
  );

  if (result.status !== 0) {
    throw new Error('The shared library-build configuration changes could not be resolved safely.');
  }

  return result.stdout.split('\0').some((filePath) => {
    if (!/\.(?:cjs|js|json|mjs|ts)$/u.test(filePath)) {
      return false;
    }

    const segments = filePath.split('/');

    return (
      !segments.some((segment) =>
        ['_archive', '_archives', '_backup', '_backups', 'docs'].includes(segment),
      ) && !/\.test-(?:unit|integration|e2e|bench|fixtures)\./u.test(filePath)
    );
  });
};

/**
 * Checks whether one project has an npm release-relevant change between exact Git commits.
 * @param repositoryRoot The repository containing both commits.
 * @param baseCommit The commit before the push.
 * @param currentCommit The pushed commit.
 * @param projectDirectory The repository-relative public project directory.
 * @param publishesDocumentation Whether either compared manifest includes documentation in npm artifacts.
 * @returns Whether the project contains a package-artifact or implementation change.
 * @throws
 * - If either commit is invalid or Git cannot compare the project safely
 */
export const hasGitProjectChanges = (
  repositoryRoot: URL,
  baseCommit: string,
  currentCommit: string,
  projectDirectory: string,
  publishesDocumentation: boolean,
): boolean => {
  requireGitCommit(baseCommit);
  requireGitCommit(currentCommit);

  const result = spawnSync(
    'git',
    [
      'diff',
      '--quiet',
      baseCommit,
      currentCommit,
      '--',
      projectDirectory,
      `:(exclude)${projectDirectory}/_archive/**`,
      `:(exclude)${projectDirectory}/_archives/**`,
      `:(exclude)${projectDirectory}/_backup/**`,
      `:(exclude)${projectDirectory}/_backups/**`,
      `:(exclude)${projectDirectory}/**/_archive/**`,
      `:(exclude)${projectDirectory}/**/_archives/**`,
      `:(exclude)${projectDirectory}/**/_backup/**`,
      `:(exclude)${projectDirectory}/**/_backups/**`,
      ...(publishesDocumentation
        ? []
        : [`:(exclude)${projectDirectory}/docs`, `:(exclude)${projectDirectory}/docs/**`]),
      `:(exclude)${projectDirectory}/**/*.test-unit.*`,
      `:(exclude)${projectDirectory}/**/*.test-integration.*`,
      `:(exclude)${projectDirectory}/**/*.test-e2e.*`,
      `:(exclude)${projectDirectory}/**/*.test-bench.*`,
      `:(exclude)${projectDirectory}/**/*.test-fixtures.*`,
    ],
    { cwd: repositoryRoot, encoding: 'utf8' },
  );

  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`The ${projectDirectory} project changes could not be resolved safely.`);
  }

  return result.status === 1;
};

/**
 * Resolves an annotated or lightweight tag to its commit without changing Git state.
 * @param tag The validated package release tag.
 * @returns The exact commit, or null when the tag does not exist.
 * @throws
 * - If Git cannot resolve the tag state safely
 */
export const loadGitTagCommit = (tag: string): string | null => {
  const result = spawnSync(
    'git',
    ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}^{commit}`],
    {
      encoding: 'utf8',
    },
  );

  if (result.status === 1 && result.stdout === '' && result.stderr === '') {
    return null;
  }

  const commit = result.stdout.trim();

  if (result.status !== 0 || !COMMIT_PATTERN.test(commit)) {
    throw new Error(`The ${tag} Git tag could not be resolved safely.`);
  }

  return commit;
};

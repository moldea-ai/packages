import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { readChangedPaths, resolveCommit } from 'jg-git-commands';

import { requireGitCommit } from '../workspace-graph/index.ts';

// directories holding private copies, which never belong to a release
const PRIVATE_COPY_SEGMENTS: ReadonlySet<string> = new Set([
  '_archive',
  '_archives',
  '_backup',
  '_backups',
]);

// files that test a package and never ship in it
const TEST_FILE_PATTERN = /\.test-(?:unit|integration|e2e|bench|fixtures)\./u;

// most bytes the changed-path list of one comparison may take
const MAX_CHANGED_PATHS_BYTES = 8 * 1024 * 1024;

/**
 * Lists every path that changed between two exact commits, both paths of a rename included.
 * @param repositoryRoot The repository containing both commits.
 * @param baseCommit The commit before the push.
 * @param currentCommit The pushed commit.
 * @returns A promise resolving to the changed repository-relative paths.
 * @throws
 * - If either commit is invalid or Git cannot compare them safely
 */
export const loadGitChangedPaths = async (
  repositoryRoot: URL,
  baseCommit: string,
  currentCommit: string,
): Promise<string[]> => {
  requireGitCommit(baseCommit);
  requireGitCommit(currentCommit);

  try {
    return await readChangedPaths(fileURLToPath(repositoryRoot), baseCommit, {
      maxOutputBytes: MAX_CHANGED_PATHS_BYTES,
      to: currentCommit,
    });
  } catch (error) {
    throw new Error('The changed paths could not be resolved safely.', { cause: error });
  }
};

/**
 * Detects changes to shared library-build inputs while excluding tests and prose.
 * @param changedPaths The paths changed between the compared commits.
 * @returns Whether a shared Vite or TypeScript build input changed.
 */
export const hasLibraryBuildConfigChanges = (changedPaths: readonly string[]): boolean =>
  changedPaths.some(
    (filePath) =>
      /^configs\/(?:vite|typescript)\//u.test(filePath) &&
      /\.(?:cjs|js|json|mjs|ts)$/u.test(filePath) &&
      !filePath
        .split('/')
        .some((segment) => PRIVATE_COPY_SEGMENTS.has(segment) || segment === 'docs') &&
      !TEST_FILE_PATTERN.test(filePath),
  );

/**
 * Checks whether one project has an npm release-relevant change: anything but its private copies,
 * its tests, and its docs, unless its npm artifact publishes them.
 * @param changedPaths The paths changed between the compared commits.
 * @param projectDirectory The repository-relative project directory.
 * @param publishesDocumentation Whether either compared manifest includes documentation in npm artifacts.
 * @returns Whether the project contains a package-artifact or implementation change.
 */
export const hasProjectChanges = (
  changedPaths: readonly string[],
  projectDirectory: string,
  publishesDocumentation: boolean,
): boolean =>
  changedPaths.some((filePath) => {
    if (filePath !== projectDirectory && !filePath.startsWith(`${projectDirectory}/`)) {
      return false;
    }

    const projectPath = filePath.slice(projectDirectory.length + 1);
    const segments = projectPath.split('/');

    return (
      !segments.slice(0, -1).some((segment) => PRIVATE_COPY_SEGMENTS.has(segment)) &&
      (publishesDocumentation || segments[0] !== 'docs') &&
      !TEST_FILE_PATTERN.test(projectPath)
    );
  });

/**
 * Resolves an annotated or lightweight tag to its commit without changing Git state.
 * @param tag The validated package release tag.
 * @returns A promise resolving to the exact commit, or null when the tag does not exist.
 * @throws
 * - If Git cannot resolve the tag state safely
 */
export const loadGitTagCommit = async (tag: string): Promise<string | null> => {
  try {
    return await resolveCommit(process.cwd(), `refs/tags/${tag}`);
  } catch (error) {
    throw new Error(`The ${tag} Git tag could not be resolved safely.`, { cause: error });
  }
};

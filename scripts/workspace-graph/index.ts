// types
export type { IWorkspacePackageState } from './types.ts';

// committed tree access
export {
  getGitHead,
  hasGitCommit,
  isExcludedPath,
  listGitChangedPaths,
  listGitWorkspaceManifestPaths,
  readGitFile,
  readOptionalGitFile,
  requireGitCommit,
} from './git.ts';

// workspace facts
export { loadGitWorkspaceSnapshot, readWorkspacePackageState } from './workspace-graph.ts';

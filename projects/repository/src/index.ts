// repository reader contracts
export type {
  IRepositoryChange,
  IRepositoryChangeKind,
  IRepositoryChangePage,
  IRepositoryChangePageOptions,
  IRepositoryComparison,
  IRepositoryEntry,
  IRepositoryEntryPage,
  IRepositoryEntryPageOptions,
  IRepositoryEntryType,
  IRepositoryFilePage,
  IRepositoryFilePageOptions,
  IRepositoryOperationOptions,
  IRepositoryReader,
  IRepositorySnapshot,
} from './contracts.js';

// exception contracts
export type {
  IRepositoryOperation,
  IRepositoryPathExceptionOptions,
  IRepositoryResourceUsage,
  IRepositorySourceErrorCode,
  IRepositorySourceExceptionOptions,
} from './exceptions.js';

// exceptions
export { RepositoryPathException, RepositorySourceException } from './exceptions.js';

// comparison
export { createRepositoryComparison } from './comparison.js';

// deterministic identity
export { createRepositoryIdentity } from './identity.js';

// logical path contract
export type { IRepositoryPath } from './repository-path.js';

// logical path values and functions
export {
  REPOSITORY_ROOT,
  compareRepositoryPaths,
  isRepositoryPath,
  parseRepositoryPath,
} from './repository-path.js';

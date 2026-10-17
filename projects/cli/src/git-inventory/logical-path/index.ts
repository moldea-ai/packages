// types
export type {
  IGitInventoryEntry,
  IGitInventoryLogicalPathNormalizer,
  IGitTrackedInventoryEntry,
  IGitUntrackedInventoryEntry,
} from './types.js';

// logical-path normalization
export {
  filterGitInventoryCandidateLogicalPaths,
  normalizeGitInventoryLogicalPaths,
} from './normalizer.js';

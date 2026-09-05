import type { IFilesystemRepositoryResourceLimits } from '../contracts/index.js';

// calibrated filesystem-reader defaults with independent peak and lifetime bounds
export const DEFAULT_FILESYSTEM_REPOSITORY_RESOURCE_LIMITS: IFilesystemRepositoryResourceLimits =
  Object.freeze({
    maxCachedBytes: 67_108_864,
    maxConcurrentOperations: 16,
    maxDirectoryEntries: 131_072,
    maxEntries: 131_072,
    maxPageEntries: 4_096,
    maxQueuedOperations: 256,
    maxReadBytes: 1_048_576,
  });

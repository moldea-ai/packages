import type { IRepositoryPath, IRepositoryReader } from '@moldea.ai/repository';
import { createFilesystemRepositoryReader } from '@moldea.ai/repository-fs';

import { createGitContentTransformationGuardRepositoryReader } from '../repository-content-transformation-guard/index.js';
import { createGitSymlinkOverlayRepositoryReader } from '../repository-symlink-overlay/index.js';

import type {
  IWorkingTreeInstructionSourceFactory,
  IWorkingTreeRepositoryReaderFactory,
  IWorkingTreeRepositoryReaderInput,
} from './types.js';

// injectable package and overlay factories used by the composition boundary
type IFilesystemRepositoryReaderFactory = typeof createFilesystemRepositoryReader;
type IGitContentTransformationGuardRepositoryReaderFactory =
  typeof createGitContentTransformationGuardRepositoryReader;
type IGitSymlinkOverlayRepositoryReaderFactory = typeof createGitSymlinkOverlayRepositoryReader;

/** Composes the filesystem, Git symlink overlay, and content-transformation guard layers. */
const composeWorkingTreeReader = async (
  input: IWorkingTreeRepositoryReaderInput,
  filesystemReaderFactory: IFilesystemRepositoryReaderFactory,
  symlinkOverlayFactory: IGitSymlinkOverlayRepositoryReaderFactory,
  contentTransformationGuardFactory: IGitContentTransformationGuardRepositoryReaderFactory,
): Promise<IRepositoryReader> => {
  const selectedPaths = Object.freeze(input.entries.map((entry) => entry.path));
  const symlinkOverlayPaths = Object.freeze(
    input.entries.reduce<IRepositoryPath[]>((paths, entry) => {
      if (entry.requiresSymlinkOverlay) {
        paths.push(entry.path);
      }

      return paths;
    }, []),
  );
  const guardedPaths = Object.freeze(
    input.entries.reduce<IRepositoryPath[]>((paths, entry) => {
      if (entry.contentTransformation.isGuarded) {
        paths.push(entry.path);
      }

      return paths;
    }, []),
  );
  const filesystemReader = await filesystemReaderFactory({
    limits: Object.freeze({
      maxCachedBytes: input.resourceLimits.maxTotalBytes,
      maxDirectoryEntries: input.resourceLimits.maxEntries,
      maxEntries: input.resourceLimits.maxEntries,
      maxPageEntries: Math.min(4096, input.resourceLimits.maxEntries),
      maxReadBytes: input.resourceLimits.maxFileBytes,
    }),
    rootDirectory: input.repositoryRoot,
    selection: Object.freeze({ kind: 'paths', paths: selectedPaths }),
    ...(input.signal === undefined ? {} : { signal: input.signal }),
  });
  const overlaidReader = symlinkOverlayFactory(filesystemReader, symlinkOverlayPaths);

  return contentTransformationGuardFactory(overlaidReader, guardedPaths);
};

/**
 * Creates the private working-tree reader factory around injectable composition boundaries.
 * @param filesystemReaderFactory The exact-path filesystem snapshot factory.
 * @param symlinkOverlayFactory The logical Git symlink overlay factory.
 * @param contentTransformationGuardFactory The guarded logical regular-file reader factory.
 * @returns A factory that composes one coherent selected working-tree reader.
 */
export const createWorkingTreeRepositoryReaderFactory =
  (
    filesystemReaderFactory: IFilesystemRepositoryReaderFactory = createFilesystemRepositoryReader,
    symlinkOverlayFactory: IGitSymlinkOverlayRepositoryReaderFactory = createGitSymlinkOverlayRepositoryReader,
    contentTransformationGuardFactory: IGitContentTransformationGuardRepositoryReaderFactory = createGitContentTransformationGuardRepositoryReader,
  ): IWorkingTreeRepositoryReaderFactory =>
  (input): Promise<IRepositoryReader> =>
    composeWorkingTreeReader(
      input,
      filesystemReaderFactory,
      symlinkOverlayFactory,
      contentTransformationGuardFactory,
    );

// default exact-path working-tree reader composition used by command execution
export const createWorkingTreeRepositoryReader = createWorkingTreeRepositoryReaderFactory();

/**
 * Creates the instruction-source factory: an exact-path reader for the probed instruction
 * entries, with the same layers as the repository reader.
 * @param filesystemReaderFactory The exact-path filesystem snapshot factory.
 * @param symlinkOverlayFactory The logical Git symlink overlay factory.
 * @param contentTransformationGuardFactory The guarded logical regular-file reader factory.
 * @returns A factory that composes one coherent instruction reader.
 */
export const createWorkingTreeInstructionSourceFactory =
  (
    filesystemReaderFactory: IFilesystemRepositoryReaderFactory = createFilesystemRepositoryReader,
    symlinkOverlayFactory: IGitSymlinkOverlayRepositoryReaderFactory = createGitSymlinkOverlayRepositoryReader,
    contentTransformationGuardFactory: IGitContentTransformationGuardRepositoryReaderFactory = createGitContentTransformationGuardRepositoryReader,
  ): IWorkingTreeInstructionSourceFactory =>
  (input): Promise<IRepositoryReader> =>
    composeWorkingTreeReader(
      input,
      filesystemReaderFactory,
      symlinkOverlayFactory,
      contentTransformationGuardFactory,
    );

// default instruction-source composition used by validation and inspection
export const createWorkingTreeInstructionSource = createWorkingTreeInstructionSourceFactory();

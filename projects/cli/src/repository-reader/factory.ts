import type { IProjectInstructionSource } from '@moldea.ai/core';
import type { IRepositoryPath, IRepositoryReader } from '@moldea.ai/repository';
import {
  createFilesystemRepositoryLinkResolver,
  createFilesystemRepositoryReader,
} from '@moldea.ai/repository-fs';

import { createGitContentTransformationGuardRepositoryReader } from '../repository-content-transformation-guard/index.js';
import {
  createGitSymlinkOverlayLinkResolver,
  createGitSymlinkOverlayRepositoryReader,
} from '../repository-symlink-overlay/index.js';

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

// one composed working-tree reader with the filesystem reader and overlay paths beneath it
interface IComposedWorkingTreeReader {
  readonly filesystemReader: IRepositoryReader;
  readonly reader: IRepositoryReader;
  readonly symlinkOverlayPaths: readonly IRepositoryPath[];
}

/** Composes the filesystem, Git symlink overlay, and content-transformation guard layers. */
const composeWorkingTreeReader = async (
  input: IWorkingTreeRepositoryReaderInput,
  filesystemReaderFactory: IFilesystemRepositoryReaderFactory,
  symlinkOverlayFactory: IGitSymlinkOverlayRepositoryReaderFactory,
  contentTransformationGuardFactory: IGitContentTransformationGuardRepositoryReaderFactory,
): Promise<IComposedWorkingTreeReader> => {
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

  return {
    filesystemReader,
    reader: contentTransformationGuardFactory(overlaidReader, guardedPaths),
    symlinkOverlayPaths,
  };
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
  async (input): Promise<IRepositoryReader> =>
    (
      await composeWorkingTreeReader(
        input,
        filesystemReaderFactory,
        symlinkOverlayFactory,
        contentTransformationGuardFactory,
      )
    ).reader;

// default exact-path working-tree reader composition used by command execution
export const createWorkingTreeRepositoryReader = createWorkingTreeRepositoryReaderFactory();

/**
 * Creates the instruction-source factory: an exact-path reader for the probed instruction
 * entries, with the same layers as the repository reader, and Repository FS's link resolver bound
 * to its filesystem reader so that Git-materialized links resolve as unsafe.
 * @param filesystemReaderFactory The exact-path filesystem snapshot factory.
 * @param symlinkOverlayFactory The logical Git symlink overlay factory.
 * @param contentTransformationGuardFactory The guarded logical regular-file reader factory.
 * @returns A factory that composes one coherent instruction source.
 */
export const createWorkingTreeInstructionSourceFactory =
  (
    filesystemReaderFactory: IFilesystemRepositoryReaderFactory = createFilesystemRepositoryReader,
    symlinkOverlayFactory: IGitSymlinkOverlayRepositoryReaderFactory = createGitSymlinkOverlayRepositoryReader,
    contentTransformationGuardFactory: IGitContentTransformationGuardRepositoryReaderFactory = createGitContentTransformationGuardRepositoryReader,
  ): IWorkingTreeInstructionSourceFactory =>
  async (input): Promise<IProjectInstructionSource> => {
    const composed = await composeWorkingTreeReader(
      input,
      filesystemReaderFactory,
      symlinkOverlayFactory,
      contentTransformationGuardFactory,
    );

    return Object.freeze({
      linkResolver: createGitSymlinkOverlayLinkResolver(
        createFilesystemRepositoryLinkResolver(composed.filesystemReader),
        composed.symlinkOverlayPaths,
      ),
      reader: composed.reader,
    });
  };

// default instruction-source composition used by validation and inspection
export const createWorkingTreeInstructionSource = createWorkingTreeInstructionSourceFactory();

import {
  RepositorySourceException,
  parseRepositoryPath,
  type IRepositoryFilePage,
  type IRepositoryFilePageOptions,
  type IRepositoryLinkResolution,
  type IRepositoryLinkResolver,
  type IRepositoryOperationOptions,
  type IRepositoryPath,
} from '@moldea.ai/repository';

/**
 * Wraps a link resolver so Git symlinks materialized as host files resolve as unsafe. Their host
 * bytes are link text Git wrote, not a link the filesystem can follow, so they are never read.
 * @param resolver The resolver bound to the underlying filesystem reader.
 * @param symlinkPaths The logical paths whose host files represent Git symlinks.
 * @returns A frozen resolver that shares the underlying resolver's snapshot.
 * @throws
 * - INVALID_REPOSITORY_PATH: The repository path is invalid.
 */
export const createGitSymlinkOverlayLinkResolver = (
  resolver: IRepositoryLinkResolver,
  symlinkPaths: readonly IRepositoryPath[],
): IRepositoryLinkResolver => {
  const overlayPaths: ReadonlySet<IRepositoryPath> = new Set(
    symlinkPaths.map((symlinkPath) => parseRepositoryPath(symlinkPath)),
  );

  return Object.freeze({
    snapshot: resolver.snapshot,
    resolveLink: async (
      path: IRepositoryPath,
      options?: IRepositoryOperationOptions,
    ): Promise<IRepositoryLinkResolution> =>
      overlayPaths.has(parseRepositoryPath(path))
        ? { state: 'unsafe' }
        : resolver.resolveLink(path, options),
    readLinkTargetPage: async (
      path: IRepositoryPath,
      options: IRepositoryFilePageOptions,
    ): Promise<IRepositoryFilePage> => {
      const parsedPath = parseRepositoryPath(path);

      if (overlayPaths.has(parsedPath)) {
        throw new RepositorySourceException({
          code: 'ENTRY_NOT_FILE',
          operation: 'read-file-page',
          path: parsedPath,
          retryable: false,
        });
      }

      return resolver.readLinkTargetPage(parsedPath, options);
    },
  });
};

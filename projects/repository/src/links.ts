import type {
  IRepositoryLinkResolution,
  IRepositoryOperationOptions,
  IRepositoryReader,
} from './contracts.js';
import { isRepositoryPath, parseRepositoryPath, type IRepositoryPath } from './repository-path.js';

// longest stored link text, in UTF-8 bytes, a reader returns from `readLinkText`
export const REPOSITORY_LINK_TEXT_MAX_BYTES = 4096;

// most symlinks one resolution follows before it reports a loop
export const REPOSITORY_LINK_MAX_HOPS = 32;

// the two reader operations link resolution uses
export type IRepositoryLinkSource = Pick<IRepositoryReader, 'getEntry' | 'readLinkText'>;

type ILinkStep =
  | { readonly kind: 'path'; readonly path: IRepositoryPath }
  | { readonly kind: 'outside' | 'unsupported' };

const DRIVE_PREFIX_PATTERN = /^[A-Za-z]:/u;

/**
 * Applies one link's stored text to the directory that holds the link, without guessing where
 * lexical and operating-system resolution could disagree.
 */
const resolveLinkText = (linkPath: IRepositoryPath, text: string | null): ILinkStep => {
  if (text === null || text === '') {
    return { kind: 'unsupported' };
  }

  if (text.startsWith('/') || DRIVE_PREFIX_PATTERN.test(text)) {
    return { kind: 'outside' };
  }

  const segments = text.split('/');

  // a trailing separator requires a directory, which a regular-file target can never satisfy
  if (segments.at(-1) === '') {
    return { kind: 'unsupported' };
  }

  const namedSegments = segments.filter((segment) => segment !== '' && segment !== '.');
  const directorySegments = linkPath.split('/').slice(1, -1);
  let segmentIndex = 0;

  while (namedSegments[segmentIndex] === '..') {
    if (directorySegments.length === 0) {
      return { kind: 'outside' };
    }

    directorySegments.pop();
    segmentIndex += 1;
  }

  const remainingSegments = namedSegments.slice(segmentIndex);

  // `..` after a named segment depends on whether that segment is itself a link
  if (remainingSegments.includes('..')) {
    return { kind: 'unsupported' };
  }

  const candidate = `/${[...directorySegments, ...remainingSegments].join('/')}`;

  return isRepositoryPath(candidate) ? { kind: 'path', path: candidate } : { kind: 'unsupported' };
};

/**
 * Follows symlink entries inside one snapshot to the regular file they lead to. Each link costs
 * one `getEntry` and one `readLinkText`, and nothing outside the snapshot is ever read.
 * @param source The reader operations of the snapshot to resolve in.
 * @param path The validated repository-logical path to start from.
 * @param options Optional cancellation controls passed to every read.
 * @returns The final regular-file path, or the reason the chain doesn't lead to one.
 * @throws
 * - INVALID_REPOSITORY_PATH: The repository path is invalid.
 * - ACCESS_DENIED: Access to the repository source was denied.
 * - SOURCE_UNAVAILABLE: The repository source is unavailable.
 * - SNAPSHOT_CHANGED: The repository snapshot changed during the operation.
 * - PROVIDER_INCOMPLETE: The repository provider cannot expose a complete result.
 * - INVALID_SOURCE_DATA: The repository source returned invalid data.
 * - RESOURCE_LIMIT_EXCEEDED: A named repository resource limit was exceeded.
 * - ABORTED: The repository operation was aborted.
 */
export const resolveRepositoryLink = async (
  source: IRepositoryLinkSource,
  path: IRepositoryPath,
  options?: IRepositoryOperationOptions,
): Promise<IRepositoryLinkResolution> => {
  const visitedPaths = new Set<IRepositoryPath>();
  let currentPath = parseRepositoryPath(path);

  for (let followedLinks = 0; ; followedLinks += 1) {
    if (visitedPaths.has(currentPath)) {
      return { state: 'loop' };
    }

    visitedPaths.add(currentPath);
    const entry = await source.getEntry(currentPath, options);

    if (entry === null) {
      return { state: 'missing' };
    }

    if (entry.type === 'file') {
      return { state: 'file', targetPath: currentPath };
    }

    if (entry.type !== 'symlink') {
      return { state: 'not-file' };
    }

    if (followedLinks === REPOSITORY_LINK_MAX_HOPS) {
      return { state: 'loop' };
    }

    const step = resolveLinkText(currentPath, await source.readLinkText(currentPath, options));

    if (step.kind !== 'path') {
      return { state: step.kind };
    }

    currentPath = step.path;
  }
};

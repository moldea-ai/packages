import type { ILinkPathApi, ILinkWalkStart } from './types.js';

// the local long-path form \\?\X:\ is the only device-namespace spelling that stays on a local volume
const LOCAL_LONG_PATH_PATTERN = /^[\\/]{2}\?[\\/](?=[A-Za-z]:[\\/])/u;

/**
 * Reports whether one link text or candidate path names a target the resolver refuses before any
 * filesystem access: a UNC or device-namespace path other than the local long-path form, a
 * drive-relative Windows path, or anything under the automount roots `/net` and `/Network`.
 * @param candidate The raw link text or an absolute candidate path, in either separator style.
 * @returns `true` when the candidate must be refused as unsafe.
 */
export const isRefusedLinkPath = (candidate: string): boolean => {
  const normalized = candidate.replaceAll('\\', '/');

  if (normalized.startsWith('//')) {
    return !/^\/\/\?\/[A-Za-z]:\//u.test(normalized);
  }

  if (/^[A-Za-z]:(?!\/)/u.test(normalized)) {
    return true;
  }

  // macOS volumes are case-insensitive by default, so /NET reaches the same automount root
  return /^\/(?:net|network)(?:\/|$)/iu.test(normalized);
};

/**
 * Removes the `\\?\` prefix of a local long path so it walks like the drive path it names.
 * @param text The raw link text.
 * @returns The text without a local long-path prefix.
 */
export const stripLocalLongPathPrefix = (text: string): string =>
  text.replace(LOCAL_LONG_PATH_PATTERN, '');

/**
 * Joins link text to the link's directory and removes `..` textually. The result is only an early
 * refusal check; it is never the walked path, because POSIX resolves `..` after following links.
 * @param pathApi The platform path API.
 * @param directory The physical directory that contains the link.
 * @param text The link text.
 * @returns The lexically normalized absolute candidate.
 */
export const getLexicalLinkCandidate = (
  pathApi: ILinkPathApi,
  directory: string,
  text: string,
): string => pathApi.resolve(directory, text);

/**
 * Determines where a walk continues after following one link's text. POSIX keeps every raw
 * component, so `..` later moves to the parent of the directory the walk has reached. Windows
 * resolves relative link text lexically against the link's directory, as its I/O manager does.
 * @param pathApi The platform path API.
 * @param directory The physical directory that contains the link.
 * @param text The link text, without a local long-path prefix.
 * @returns The directory to continue from and the components still to walk.
 */
export const getLinkWalkStart = (
  pathApi: ILinkPathApi,
  directory: string,
  text: string,
): ILinkWalkStart => {
  if (pathApi.sep === '/') {
    return {
      components: text.split('/'),
      directory: pathApi.isAbsolute(text) ? '/' : directory,
    };
  }

  const lexical = pathApi.resolve(directory, text);
  const relative = pathApi.relative(directory, lexical);

  if (
    relative === '' ||
    (relative !== '..' && !relative.startsWith(`..${pathApi.sep}`) && !pathApi.isAbsolute(relative))
  ) {
    return { components: relative === '' ? [] : relative.split(pathApi.sep), directory };
  }

  const root = pathApi.parse(lexical).root;

  return {
    components: lexical.slice(root.length).split(pathApi.sep),
    directory: root,
  };
};

/**
 * Maps a physical target path beneath the repository root to its logical spelling.
 * @param pathApi The platform path API.
 * @param rootDirectory The resolved repository root.
 * @param hostPath The physical final target path.
 * @returns The root-absolute logical spelling, or `null` when the target lies outside the root.
 */
export const getContainedLogicalPath = (
  pathApi: ILinkPathApi,
  rootDirectory: string,
  hostPath: string,
): string | null => {
  const relative = pathApi.relative(rootDirectory, hostPath);

  if (relative === '') {
    return '/';
  }

  if (
    relative === '..' ||
    relative.startsWith(`..${pathApi.sep}`) ||
    pathApi.isAbsolute(relative)
  ) {
    return null;
  }

  return `/${relative.split(pathApi.sep).join('/')}`;
};

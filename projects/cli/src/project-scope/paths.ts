import { MoldeaCliProjectScopeException } from './exception.js';

/**
 * Parses bounded NUL-delimited UTF-8 changed paths without shell interpretation.
 * @param input Exact stdin bytes supplied to the scope command.
 * @param maxEntries Maximum changed-path records accepted by the operation.
 * @returns Detached path strings in supplied order for Core validation and normalization.
 * @throws
 * - PATH_INPUT_INVALID: The NUL-delimited changed-path input is invalid.
 */
export const parseMoldeaCliScopePathBytes = (
  input: Uint8Array,
  maxEntries: number,
): readonly string[] => {
  if (input.byteLength === 0) {
    return Object.freeze([]);
  }

  let text: string;

  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(input);
  } catch {
    throw new MoldeaCliProjectScopeException('PATH_INPUT_INVALID');
  }

  if (!text.endsWith('\0')) {
    throw new MoldeaCliProjectScopeException('PATH_INPUT_INVALID');
  }

  const paths = text.slice(0, -1).split('\0');

  if (paths.length > maxEntries || paths.some((path) => path.length === 0)) {
    throw new MoldeaCliProjectScopeException('PATH_INPUT_INVALID');
  }

  return Object.freeze(paths);
};

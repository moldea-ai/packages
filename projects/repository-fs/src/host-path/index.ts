import path from 'node:path';

/**
 * Determines whether a value is one valid absolute host root path for the active platform.
 * @param candidate The boundary value to inspect without coercion.
 * @returns Whether the value is non-empty scalar text, contains no NUL, and is absolute.
 */
export const isAbsoluteHostRootDirectory = (candidate: unknown): candidate is string => {
  return (
    typeof candidate === 'string' &&
    candidate.length > 0 &&
    !candidate.includes('\0') &&
    candidate.isWellFormed() &&
    path.isAbsolute(candidate)
  );
};

import { MOLDEA_CLI_ERROR_DEFINITIONS } from './constants.js';
import type { IMoldeaCliError, IMoldeaCliOwnedErrorCode } from './types.js';

const EMPTY_ERROR_DETAILS = Object.freeze({});

/**
 * Creates one immutable safe error from a CLI- or Git-owned definition.
 * @param code The stable executable-owned error code.
 * @param details Safe fixed details, such as the Git subcommand that failed.
 * @returns The complete safe error object.
 */
export const createMoldeaCliOwnedError = (
  code: IMoldeaCliOwnedErrorCode,
  details: IMoldeaCliError['details'] = EMPTY_ERROR_DETAILS,
): IMoldeaCliError => {
  const definition = MOLDEA_CLI_ERROR_DEFINITIONS[code];

  return Object.freeze({
    code,
    details: Object.freeze({ ...details }),
    message: definition.message,
    path: null,
    retryable: definition.retryable,
    source: definition.source,
  });
};

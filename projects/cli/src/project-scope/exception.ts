import type { IMoldeaCliProjectScopeErrorCode } from './types.js';

/** Represents invalid NUL-delimited changed-path input owned by the CLI. */
export class MoldeaCliProjectScopeException extends Error {
  public readonly code: IMoldeaCliProjectScopeErrorCode;

  /** Creates one scope-input failure with a stable public code. */
  public constructor(code: IMoldeaCliProjectScopeErrorCode) {
    super(code);
    this.code = code;
    this.name = 'MoldeaCliProjectScopeException';
  }
}

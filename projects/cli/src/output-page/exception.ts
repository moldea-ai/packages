import type { IMoldeaCliOutputPageErrorCode } from './types.js';

/** Represents a safe pagination or output-budget failure owned by the CLI. */
export class MoldeaCliOutputPageException extends Error {
  public readonly code: IMoldeaCliOutputPageErrorCode;

  /** Creates one output-page failure with a stable public code. */
  public constructor(code: IMoldeaCliOutputPageErrorCode) {
    super(code);
    this.code = code;
    this.name = 'MoldeaCliOutputPageException';
  }
}

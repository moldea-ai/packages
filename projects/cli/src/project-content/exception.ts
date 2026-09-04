import type { IMoldeaCliProjectContentErrorCode } from './types.js';

/** Represents an invalid explicit canonical content request. */
export class MoldeaCliProjectContentException extends Error {
  public readonly code: IMoldeaCliProjectContentErrorCode;

  /** Creates one content request failure with a stable public code. */
  public constructor(code: IMoldeaCliProjectContentErrorCode) {
    super(code);
    this.code = code;
    this.name = 'MoldeaCliProjectContentException';
  }
}

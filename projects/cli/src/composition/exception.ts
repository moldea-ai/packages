import { createMoldeaCliOwnedError } from '../presentation/index.js';

/** Represents an inconsistent installed executable composition. */
export class MoldeaCliCompositionException extends Error {
  public readonly code = 'COMPOSITION_STATE_INVALID';

  /** Uses the canonical CLI-owned composition failure message. */
  public constructor() {
    super(createMoldeaCliOwnedError('COMPOSITION_STATE_INVALID').message);
    this.name = 'MoldeaCliCompositionException';
  }
}

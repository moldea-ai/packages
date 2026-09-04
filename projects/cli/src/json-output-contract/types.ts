import type { IMoldeaCliCommand } from '../command-line/index.js';
import type { IMoldeaCliError } from '../presentation/types.js';

export type IMoldeaCliJsonStatus = 'error' | 'invalid' | 'valid';

// one strict schema 4 envelope shared by every machine-readable command result
export interface IMoldeaCliJsonEnvelope<TResult = unknown> {
  readonly cliVersion: string;
  readonly command: IMoldeaCliCommand | null;
  readonly error: IMoldeaCliError | null;
  readonly result: TResult | null;
  readonly schemaVersion: 4;
  readonly status: IMoldeaCliJsonStatus;
}

export interface IMoldeaCliJsonDocumentInput<TResult> {
  readonly cliVersion: string;
  readonly command: IMoldeaCliCommand | null;
  readonly error: IMoldeaCliError | null;
  readonly result: TResult | null;
  readonly status: IMoldeaCliJsonStatus;
}

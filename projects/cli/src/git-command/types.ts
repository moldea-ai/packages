// reasons a Git command can fail, without its process diagnostics
export type IGitFailureReason =
  | 'aborted'
  | 'not-found'
  | 'repository-not-found'
  | 'access-denied'
  | 'output-limit-exceeded'
  | 'output-invalid'
  | 'command-failed';

// one Git read's value, or why it failed and, when known, the Git subcommand that failed
export type IGitReadResult<TValue> =
  | { readonly kind: 'completed'; readonly value: TValue }
  | { readonly kind: 'failed'; readonly reason: IGitFailureReason; readonly subcommand?: string };

// the directory, combined output limit, stdin, and cancellation of one Git command
export interface IGitCommandOptions {
  readonly cwd: string;
  readonly input?: Uint8Array;
  readonly maxOutputBytes: number;
  readonly signal?: AbortSignal;
}

// injectable boundary that runs one Git command and gives its stdout
export type IGitCommandRunner = (
  args: readonly string[],
  options: IGitCommandOptions,
) => Promise<IGitReadResult<Buffer>>;

// process termination signals handled by the executable
export type IMoldeaCliTerminationSignal = 'SIGINT' | 'SIGTERM';

// private launcher loss is handled by the existing operation-signal owner
export type IMoldeaCliProcessEvent = IMoldeaCliTerminationSignal | 'disconnect';

// handled exit codes associated with process termination signals
export type IMoldeaCliSignalExitCode = 130 | 143;

// injectable process-listener boundary used by the signal session
export interface IMoldeaCliProcessSignalSource {
  addListener(event: IMoldeaCliProcessEvent, listener: () => void): void;
  removeListener(event: IMoldeaCliProcessEvent, listener: () => void): void;
  closeIpc(): void;
  hasDisconnectedLauncher(): boolean;
}

// one operation-scoped process-signal lifecycle
export interface IMoldeaCliProcessSignalSession {
  readonly exitCode: IMoldeaCliSignalExitCode | null;
  readonly hasReceivedSignal: boolean;
  readonly signal: AbortSignal;
  completeOutput(): void;
  dispose(): void;
}

import process from 'node:process';

import { MOLDEA_CLI_EXIT_CODES } from '../cli-execution/constants.js';

import type {
  IMoldeaCliProcessSignalSession,
  IMoldeaCliProcessSignalSource,
  IMoldeaCliProcessEvent,
  IMoldeaCliSignalExitCode,
  IMoldeaCliTerminationSignal,
} from './types.js';

const SIGNAL_EXIT_CODES = Object.freeze({
  SIGINT: MOLDEA_CLI_EXIT_CODES.Interrupted,
  SIGTERM: MOLDEA_CLI_EXIT_CODES.Terminated,
} as const satisfies Readonly<Record<IMoldeaCliTerminationSignal, IMoldeaCliSignalExitCode>>);

const PROCESS_SIGNAL_SOURCE: IMoldeaCliProcessSignalSource = Object.freeze({
  addListener: (signal: IMoldeaCliProcessEvent, listener: () => void): void => {
    process.on(signal, listener);
  },
  removeListener: (signal: IMoldeaCliProcessEvent, listener: () => void): void => {
    process.off(signal, listener);
  },
  closeIpc: (): void => {
    if (process.connected) process.disconnect();
  },
  hasDisconnectedLauncher: (): boolean => typeof process.send === 'function' && !process.connected,
});

/**
 * Creates one process-signal session around an operation-scoped abort controller.
 * @param signalSource The process-listener boundary.
 * @returns A session that records the first signal until output completes.
 */
export const createMoldeaCliProcessSignalSession = (
  signalSource: IMoldeaCliProcessSignalSource = PROCESS_SIGNAL_SOURCE,
): IMoldeaCliProcessSignalSession => {
  const controller = new AbortController();
  let exitCode: IMoldeaCliSignalExitCode | null = null;
  let isDisposed = false;
  let isOutputComplete = false;

  const handleSignal = (signal: IMoldeaCliTerminationSignal): void => {
    if (exitCode !== null || isDisposed || isOutputComplete) {
      return;
    }

    exitCode = SIGNAL_EXIT_CODES[signal];
    controller.abort();
  };
  const handleSigint = (): void => handleSignal('SIGINT');
  const handleSigterm = (): void => handleSignal('SIGTERM');
  const handleDisconnect = (): void => handleSignal('SIGTERM');

  signalSource.addListener('SIGINT', handleSigint);
  signalSource.addListener('SIGTERM', handleSigterm);
  signalSource.addListener('disconnect', handleDisconnect);
  if (signalSource.hasDisconnectedLauncher()) handleDisconnect();

  return Object.freeze({
    completeOutput: (): void => {
      isOutputComplete = true;
    },
    dispose: (): void => {
      if (isDisposed) {
        return;
      }

      isDisposed = true;
      signalSource.removeListener('SIGINT', handleSigint);
      signalSource.removeListener('SIGTERM', handleSigterm);
      signalSource.removeListener('disconnect', handleDisconnect);
      signalSource.closeIpc();
    },
    get exitCode(): IMoldeaCliSignalExitCode | null {
      return exitCode;
    },
    get hasReceivedSignal(): boolean {
      return exitCode !== null;
    },
    signal: controller.signal,
  });
};

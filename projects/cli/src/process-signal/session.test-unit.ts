// @vitest-environment node
import { describe, expect, test, vi } from 'vitest';

import { createMoldeaCliProcessSignalSession } from './session.js';
import type { IMoldeaCliProcessSignalSource, IMoldeaCliProcessEvent } from './types.js';

/** Creates an evented process-signal boundary for lifecycle tests. */
const createSignalSource = (
  hasDisconnectedLauncher = false,
): {
  readonly emit: (signal: IMoldeaCliProcessEvent) => void;
  readonly removeListener: ReturnType<
    typeof vi.fn<IMoldeaCliProcessSignalSource['removeListener']>
  >;
  readonly source: IMoldeaCliProcessSignalSource;
  readonly closeIpc: ReturnType<typeof vi.fn>;
} => {
  const listeners = new Map<IMoldeaCliProcessEvent, Set<() => void>>();
  const closeIpc = vi.fn();
  const addListener = vi.fn<IMoldeaCliProcessSignalSource['addListener']>((signal, listener) => {
    const signalListeners = listeners.get(signal) ?? new Set();

    signalListeners.add(listener);
    listeners.set(signal, signalListeners);
  });
  const removeListener = vi.fn<IMoldeaCliProcessSignalSource['removeListener']>(
    (signal, listener) => {
      listeners.get(signal)?.delete(listener);
    },
  );

  return {
    emit: (signal): void => {
      for (const listener of listeners.get(signal) ?? []) {
        listener();
      }
    },
    removeListener,
    source: {
      addListener,
      removeListener,
      closeIpc,
      hasDisconnectedLauncher: () => hasDisconnectedLauncher,
    },
    closeIpc,
  };
};

describe('createMoldeaCliProcessSignalSession', () => {
  test('cancels when private launcher IPC was already lost before session creation', () => {
    const source = createSignalSource(true);
    const session = createMoldeaCliProcessSignalSession(source.source);
    expect(session.signal.aborted).toBe(true);
    expect(session.exitCode).toBe(143);
    session.dispose();
  });
  test.each([
    ['SIGINT', 130],
    ['SIGTERM', 143],
    ['disconnect', 143],
  ] as const)('aborts once and maps the first %s to exit code %d', (signal, exitCode) => {
    const signalSource = createSignalSource();
    const session = createMoldeaCliProcessSignalSession(signalSource.source);

    signalSource.emit(signal);
    signalSource.emit(signal === 'SIGINT' ? 'SIGTERM' : 'SIGINT');

    expect(session.signal.aborted).toBe(true);
    expect(session.hasReceivedSignal).toBe(true);
    expect(session.exitCode).toBe(exitCode);
    expect(Object.isFrozen(session)).toBe(true);

    session.dispose();
  });

  test('ignores termination signals after output completes', () => {
    const signalSource = createSignalSource();
    const session = createMoldeaCliProcessSignalSession(signalSource.source);

    session.completeOutput();
    signalSource.emit('SIGINT');

    expect(session.signal.aborted).toBe(false);
    expect(session.hasReceivedSignal).toBe(false);
    expect(session.exitCode).toBeNull();

    session.dispose();
  });

  test('removes listeners and closes IPC exactly once when disposed', () => {
    const signalSource = createSignalSource();
    const session = createMoldeaCliProcessSignalSession(signalSource.source);

    session.dispose();
    session.dispose();
    signalSource.emit('SIGTERM');

    expect(signalSource.removeListener).toHaveBeenCalledTimes(3);
    expect(signalSource.closeIpc).toHaveBeenCalledTimes(1);
    expect(session.signal.aborted).toBe(false);
    expect(session.exitCode).toBeNull();
  });
});

import type { ChildProcess } from 'node:child_process';
import process from 'node:process';

import { NODE_INSPECTION_TERMINATION_GRACE_MS } from './constants.js';
import { NODE_INSPECTION_MAX_REQUESTS } from './constants.js';
import { createInspectionProcessFailure, encodeInspectionMessage } from './protocol.js';
import type { INodeInspectionMessage } from './types.js';

/** Serializes bounded IPC sends and waits for Node's send callback before admitting the next. */
export const createInspectionSender = (
  send: (frame: string, callback: (error: Error | null) => void) => void,
): ((message: INodeInspectionMessage) => Promise<void>) => {
  let queued = 0;
  let tail = Promise.resolve();
  return async (message) => {
    if (queued >= NODE_INSPECTION_MAX_REQUESTS) throw createInspectionProcessFailure();
    queued++;
    const operation = tail.then(
      () =>
        new Promise<void>((resolve, reject) => {
          try {
            send(encodeInspectionMessage(message), (error) => {
              if (error !== null) reject(createInspectionProcessFailure(error));
              else resolve();
            });
          } catch (cause) {
            reject(cause instanceof Error ? cause : createInspectionProcessFailure(cause));
          }
        }),
    );
    tail = operation.catch(() => {});
    try {
      await operation;
    } finally {
      queued--;
    }
  };
};

/** Keeps only operating-system bootstrap variables; no credentials or Node overrides cross. */
export const createInspectionEnvironment = (): NodeJS.ProcessEnv => {
  const names = new Set(['systemroot', 'windir', 'temp', 'tmp', 'tmpdir']);
  return Object.fromEntries(
    Object.entries(process.env).filter(([name]) => names.has(name.toLowerCase())),
  );
};

/**
 * Supervises one owned child without PID polling, shell commands, or process-group killing.
 * @returns Idempotent termination and actual close notification.
 */
export const superviseInspectionChild = (
  child: ChildProcess,
  requestStop: () => void,
): {
  closed: Promise<void>;
  terminate: () => void;
} => {
  let hasClosed = false;
  let forceTimer: NodeJS.Timeout | undefined;
  const closed = new Promise<void>((resolve) => {
    child.once('close', () => {
      hasClosed = true;
      clearTimeout(forceTimer);
      resolve();
    });
  });
  return {
    closed,
    terminate: (): void => {
      if (hasClosed || forceTimer !== undefined) return;
      // Let the child close IPC. Local disconnect can suppress ChildProcess's close event.
      forceTimer = setTimeout(() => {
        if (!hasClosed) child.kill('SIGKILL');
      }, NODE_INSPECTION_TERMINATION_GRACE_MS);
      requestStop();
    },
  };
};

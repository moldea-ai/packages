// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { createInspectionEnvironment, createInspectionSender } from './lifecycle.js';

const message = { attemptId: 'a'.repeat(32), kind: 'run' as const };

describe('inspection process lifecycle support', () => {
  test('admits four bounded sends and waits for each real transport callback', async () => {
    const callbacks: ((error: Error | null) => void)[] = [];
    const send = createInspectionSender((_frame, callback) => {
      callbacks.push(callback);
    });
    const pending = Array.from({ length: 4 }, () => send(message));
    await expect(send(message)).rejects.toMatchObject({ code: 'INSPECTION_PROCESS_FAILED' });
    expect(callbacks).toHaveLength(1);
    for (let index = 0; index < pending.length; index++) {
      const callback = callbacks[index];
      expect(callback).toBeTypeOf('function');
      callback?.(null);
      await pending[index];
    }
    expect(callbacks).toHaveLength(4);
    await Promise.all(pending);
  });

  test('maps transport callback failure without exposing native details', async () => {
    const send = createInspectionSender((_frame, callback) =>
      callback(new Error('private native detail')),
    );
    await expect(send(message)).rejects.toMatchObject({
      code: 'INSPECTION_PROCESS_FAILED',
      message: 'The isolated project inspection failed.',
    });
  });

  test('inherits only OS bootstrap variables and no credentials or Node overrides', () => {
    const environment = createInspectionEnvironment();
    expect(
      Object.keys(environment).every((name) =>
        ['systemroot', 'windir', 'temp', 'tmp', 'tmpdir'].includes(name.toLowerCase()),
      ),
    ).toBe(true);
  });
});

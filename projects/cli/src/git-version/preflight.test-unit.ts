// @vitest-environment node
import { Exception } from 'jg-exception';
import { ERRORS as PROCESS_ERRORS } from 'jg-process';
import { ERRORS as GIT_ERRORS } from 'jg-git-commands';
import { describe, expect, test, vi } from 'vitest';

import { GIT_TIMEOUT_SECONDS } from '../git-command/index.js';

import { MAX_GIT_VERSION_OUTPUT_BYTES } from './constants.js';
import { createGitVersionPreflight } from './preflight.js';
import type { IGitVersionReader } from './types.js';

const DIRECTORY = '/repository';

describe('createGitVersionPreflight', () => {
  test.each([
    [GIT_ERRORS.GIT_NOT_FOUND, 'GIT_NOT_FOUND'],
    [GIT_ERRORS.GIT_REPOSITORY_NOT_FOUND, 'GIT_COMMAND_FAILED'],
    [GIT_ERRORS.GIT_ACCESS_DENIED, 'GIT_ACCESS_DENIED'],
    [GIT_ERRORS.GIT_OUTPUT_INVALID, 'GIT_VERSION_INVALID'],
    [GIT_ERRORS.GIT_COMMAND_FAILED, 'GIT_COMMAND_FAILED'],
    [PROCESS_ERRORS.PROCESS_OUTPUT_TOO_LARGE, 'GIT_VERSION_INVALID'],
    [PROCESS_ERRORS.PROCESS_TIMED_OUT, 'GIT_COMMAND_FAILED'],
  ] as const)('maps %s to %s', async (code, errorCode) => {
    const readVersion = vi
      .fn<IGitVersionReader>()
      .mockRejectedValue(new Exception('Git failed.', { code }));

    await expect(createGitVersionPreflight(readVersion)(DIRECTORY)).resolves.toStrictEqual({
      errorCode,
      kind: 'failed',
    });
    expect(readVersion).toHaveBeenCalledOnce();
    expect(readVersion).toHaveBeenCalledWith(DIRECTORY, {
      maxOutputBytes: MAX_GIT_VERSION_OUTPUT_BYTES,
      timeoutSeconds: GIT_TIMEOUT_SECONDS,
    });
  });

  test('reports a cancelled read as an aborted operation', async () => {
    const controller = new AbortController();
    const readVersion = vi.fn<IGitVersionReader>(() => {
      const reason = new Error('stopped by the test');

      controller.abort(reason);

      return Promise.reject(reason);
    });

    await expect(
      createGitVersionPreflight(readVersion)(DIRECTORY, controller.signal),
    ).resolves.toStrictEqual({ errorCode: 'GIT_OPERATION_ABORTED', kind: 'failed' });
    expect(readVersion).toHaveBeenCalledWith(DIRECTORY, {
      maxOutputBytes: MAX_GIT_VERSION_OUTPUT_BYTES,
      signal: controller.signal,
      timeoutSeconds: GIT_TIMEOUT_SECONDS,
    });
  });

  test.each([
    { major: 2, minor: 31, patch: 9 },
    { major: 1, minor: 99, patch: 99 },
  ])('rejects Git %o as unsupported', async (version) => {
    const readVersion = vi.fn<IGitVersionReader>().mockResolvedValue(version);

    await expect(createGitVersionPreflight(readVersion)(DIRECTORY)).resolves.toStrictEqual({
      errorCode: 'GIT_VERSION_UNSUPPORTED',
      kind: 'failed',
    });
  });

  test.each([
    { major: 2, minor: 32, patch: 0 },
    { major: 2, minor: 53, patch: 0 },
    { major: 3, minor: 0, patch: 0 },
  ])('accepts Git %o', async (version) => {
    const readVersion = vi.fn<IGitVersionReader>().mockResolvedValue(version);

    const result = await createGitVersionPreflight(readVersion)(DIRECTORY);

    expect(result).toStrictEqual({ kind: 'supported', version });
    expect(Object.isFrozen(result)).toBe(true);
  });
});

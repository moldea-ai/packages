// @vitest-environment node
import { Exception } from 'jg-exception';
import { ERRORS as PROCESS_ERRORS } from 'jg-process';
import { ERRORS as GIT_ERRORS } from 'jg-git-commands';
import { describe, expect, test, vi } from 'vitest';

import { GIT_TIMEOUT_SECONDS } from '../../git-command/index.js';

import { createGitSymlinkConfigurationResolver } from './symlink-configuration.js';
import type { IGitConfigBooleanReader } from './types.js';

describe('createGitSymlinkConfigurationResolver', () => {
  test.each([
    [true, 5],
    [false, 6],
  ] as const)(
    'resolves core.symlinks %s, counting its %d bytes of output',
    async (isEnabled, gitMetadataBytes) => {
      const readBoolean = vi.fn<IGitConfigBooleanReader>().mockResolvedValue(isEnabled);
      const resolveConfiguration = createGitSymlinkConfigurationResolver(readBoolean);

      await expect(
        resolveConfiguration({ maxMetadataBytes: 32, repositoryRoot: '/repository' }),
      ).resolves.toStrictEqual({ gitMetadataBytes, isEnabled, kind: 'resolved' });
      expect(readBoolean).toHaveBeenCalledExactlyOnceWith('/repository', 'core.symlinks', true, {
        maxOutputBytes: 32,
        timeoutSeconds: GIT_TIMEOUT_SECONDS,
      });
    },
  );

  test.each([
    [GIT_ERRORS.GIT_NOT_FOUND, 'GIT_NOT_FOUND'],
    [GIT_ERRORS.GIT_REPOSITORY_NOT_FOUND, 'GIT_OUTPUT_INVALID'],
    [GIT_ERRORS.GIT_ACCESS_DENIED, 'GIT_ACCESS_DENIED'],
    [GIT_ERRORS.GIT_OUTPUT_INVALID, 'GIT_OUTPUT_INVALID'],
    [PROCESS_ERRORS.PROCESS_OUTPUT_TOO_LARGE, 'RESOURCE_LIMIT_EXCEEDED'],
    [GIT_ERRORS.GIT_COMMAND_FAILED, 'GIT_COMMAND_FAILED'],
  ] as const)('maps %s without exposing Git diagnostics', async (code, errorCode) => {
    const readBoolean = vi
      .fn<IGitConfigBooleanReader>()
      .mockRejectedValue(new Exception('private diagnostic', { code }));
    const resolveConfiguration = createGitSymlinkConfigurationResolver(readBoolean);

    await expect(
      resolveConfiguration({ maxMetadataBytes: 8, repositoryRoot: '/private' }),
    ).resolves.toStrictEqual({ errorCode, kind: 'failed' });
  });

  test('refuses output larger than the remaining metadata budget', async () => {
    const readBoolean = vi.fn<IGitConfigBooleanReader>().mockResolvedValue(false);
    const resolveConfiguration = createGitSymlinkConfigurationResolver(readBoolean);

    await expect(
      resolveConfiguration({ maxMetadataBytes: 5, repositoryRoot: '/repository' }),
    ).resolves.toStrictEqual({ errorCode: 'RESOURCE_LIMIT_EXCEEDED', kind: 'failed' });
  });

  test('asks Git for at least one byte when the budget is exhausted', async () => {
    const readBoolean = vi.fn<IGitConfigBooleanReader>().mockResolvedValue(true);

    await expect(
      createGitSymlinkConfigurationResolver(readBoolean)({
        maxMetadataBytes: 0,
        repositoryRoot: '/repository',
      }),
    ).resolves.toStrictEqual({ errorCode: 'RESOURCE_LIMIT_EXCEEDED', kind: 'failed' });
    expect(readBoolean.mock.calls[0]?.[3]?.maxOutputBytes).toBe(1);
  });

  test('stops before reading Git when the operation is already aborted', async () => {
    const readBoolean = vi.fn<IGitConfigBooleanReader>();
    const controller = new AbortController();

    controller.abort();

    await expect(
      createGitSymlinkConfigurationResolver(readBoolean)({
        maxMetadataBytes: 32,
        repositoryRoot: '/repository',
        signal: controller.signal,
      }),
    ).resolves.toStrictEqual({ errorCode: 'GIT_OPERATION_ABORTED', kind: 'failed' });
    expect(readBoolean).not.toHaveBeenCalled();
  });

  test.each([-1, Number.NaN])('rejects an invalid metadata budget of %s', async (budget) => {
    const readBoolean = vi.fn<IGitConfigBooleanReader>();
    const resolveConfiguration = createGitSymlinkConfigurationResolver(readBoolean);

    await expect(
      resolveConfiguration({ maxMetadataBytes: budget, repositoryRoot: '/repository' }),
    ).resolves.toStrictEqual({ errorCode: 'RESOURCE_LIMIT_EXCEEDED', kind: 'failed' });
    expect(readBoolean).not.toHaveBeenCalled();
  });
});

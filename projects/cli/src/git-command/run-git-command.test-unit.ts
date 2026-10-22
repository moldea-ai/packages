// @vitest-environment node
import type * as GitCommandsModule from 'jg-git-commands';
import { Exception } from 'jg-exception';
import { ERRORS as PROCESS_ERRORS } from 'jg-process';
import { ERRORS as GIT_ERRORS, runGit } from 'jg-git-commands';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { GIT_TIMEOUT_SECONDS, MAX_GIT_DIAGNOSTIC_BYTES } from './constants.js';
import { runGitCommand } from './run-git-command.js';

vi.mock('jg-git-commands', async (importOriginal) => ({
  ...(await importOriginal<typeof GitCommandsModule>()),
  runGit: vi.fn(),
}));

const OPTIONS = { cwd: '/repository', maxOutputBytes: 1024 };

/** Makes the next Git command finish with an exit code and output. */
const finishGit = (exitCode: number, stdout: string, stderr = ''): void => {
  vi.mocked(runGit).mockResolvedValueOnce({
    durationMs: 1,
    exitCode,
    signalCode: null,
    stderr: Buffer.from(stderr),
    stdout: Buffer.from(stdout),
  });
};

afterEach(() => {
  vi.mocked(runGit).mockReset();
});

describe('runGitCommand', () => {
  test('gives the stdout of a command that succeeded without diagnostics', async () => {
    const input = Buffer.from('path\u0000');
    const { signal } = new AbortController();

    finishGit(0, 'output');

    await expect(
      runGitCommand(['check-attr', '--stdin'], { ...OPTIONS, input, signal }),
    ).resolves.toStrictEqual({ kind: 'completed', value: Buffer.from('output') });
    expect(runGit).toHaveBeenCalledExactlyOnceWith(['check-attr', '--stdin'], {
      cwd: '/repository',
      encoding: 'buffer',
      input,
      maxOutputBytes: 1024,
      signal,
      timeoutSeconds: GIT_TIMEOUT_SECONDS,
    });
  });

  test('refuses a command that succeeded after warning on stderr, naming the subcommand', async () => {
    finishGit(0, 'partial\u0000', "warning: could not open directory 'locked/'\n");

    await expect(runGitCommand(['ls-files', '--others'], OPTIONS)).resolves.toStrictEqual({
      kind: 'failed',
      reason: 'output-invalid',
      subcommand: 'ls-files',
    });
  });

  test('refuses diagnostics past the stderr ceiling before classifying them', async () => {
    finishGit(128, '', `fatal: not a git repository${'x'.repeat(MAX_GIT_DIAGNOSTIC_BYTES)}\n`);

    await expect(runGitCommand(['rev-parse'], OPTIONS)).resolves.toStrictEqual({
      kind: 'failed',
      reason: 'output-invalid',
      subcommand: 'rev-parse',
    });
  });

  test.each([
    [
      'fatal: not a git repository (or any of the parent directories): .git\n',
      'repository-not-found',
    ],
    ["fatal: detected dubious ownership in repository at '/repository'\n", 'access-denied'],
    ['fatal: bad object\n', 'command-failed'],
  ] as const)('classifies a failed command from stderr %j as %s', async (stderr, reason) => {
    finishGit(128, '', stderr);

    await expect(runGitCommand(['rev-parse'], OPTIONS)).resolves.toStrictEqual({
      kind: 'failed',
      reason,
      subcommand: 'rev-parse',
    });
  });

  test.each([
    [new Exception('missing', { code: GIT_ERRORS.GIT_NOT_FOUND }), 'not-found'],
    [
      new Exception('too large', { code: PROCESS_ERRORS.PROCESS_OUTPUT_TOO_LARGE }),
      'output-limit-exceeded',
    ],
    [
      new Exception('cannot start', {
        code: PROCESS_ERRORS.PROCESS_START_FAILED,
        cause: Object.assign(new Error('spawn git EACCES'), { code: 'EACCES' }),
      }),
      'access-denied',
    ],
    [
      new Exception('cannot start', {
        code: PROCESS_ERRORS.PROCESS_START_FAILED,
        cause: Object.assign(new Error('spawn git EMFILE'), { code: 'EMFILE' }),
      }),
      'command-failed',
    ],
    [new Exception('timed out', { code: PROCESS_ERRORS.PROCESS_TIMED_OUT }), 'command-failed'],
    [new Error('unexpected'), 'command-failed'],
  ] as const)('classifies the rejection %o as %s', async (error, reason) => {
    vi.mocked(runGit).mockRejectedValueOnce(error);

    await expect(runGitCommand(['status'], OPTIONS)).resolves.toStrictEqual({
      kind: 'failed',
      reason,
      subcommand: 'status',
    });
  });

  test('reports a command its signal stopped as aborted', async () => {
    const controller = new AbortController();

    vi.mocked(runGit).mockImplementationOnce(() => {
      const reason = new Error('stopped by the test');

      controller.abort(reason);

      return Promise.reject(reason);
    });

    await expect(
      runGitCommand(['status'], { ...OPTIONS, signal: controller.signal }),
    ).resolves.toStrictEqual({ kind: 'failed', reason: 'aborted', subcommand: 'status' });
  });
});

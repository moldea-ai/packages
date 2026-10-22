// @vitest-environment node
import { Exception } from 'jg-exception';
import { ERRORS as GIT_ERRORS } from 'jg-git-commands';
import { describe, expect, test } from 'vitest';

import { createGitFailure, readGit } from './utilities.js';

describe('readGit', () => {
  const failure = new Exception('private diagnostic', { code: GIT_ERRORS.GIT_OUTPUT_INVALID });

  test('names the subcommand in a failure when the caller supplies it', async () => {
    await expect(
      readGit(() => Promise.reject(failure), undefined, 'config'),
    ).resolves.toStrictEqual({ kind: 'failed', reason: 'output-invalid', subcommand: 'config' });
  });

  test('leaves the subcommand out when the caller supplies none', async () => {
    await expect(readGit(() => Promise.reject(failure))).resolves.toStrictEqual({
      kind: 'failed',
      reason: 'output-invalid',
    });
  });

  test('returns a completed read unchanged', async () => {
    await expect(
      readGit(() => Promise.resolve('value'), undefined, 'config'),
    ).resolves.toStrictEqual({ kind: 'completed', value: 'value' });
  });
});

describe('createGitFailure', () => {
  test('creates an immutable failure with or without a subcommand', () => {
    const named = createGitFailure('command-failed', 'check-attr');
    const unnamed = createGitFailure('command-failed');

    expect(named).toStrictEqual({
      kind: 'failed',
      reason: 'command-failed',
      subcommand: 'check-attr',
    });
    expect(unnamed).toStrictEqual({ kind: 'failed', reason: 'command-failed' });
    expect(Object.isFrozen(named) && Object.isFrozen(unnamed)).toBe(true);
  });
});

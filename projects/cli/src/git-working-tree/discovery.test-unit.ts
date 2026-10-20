// @vitest-environment node
import path from 'node:path';
import { Exception } from 'jg-exception';
import { ERRORS as PROCESS_ERRORS } from 'jg-process';
import { ERRORS as GIT_ERRORS } from 'jg-git-commands';
import { describe, expect, test, vi } from 'vitest';

import { GIT_TIMEOUT_SECONDS } from '../git-command/index.js';
import type { IGitVersionPreflight } from '../git-version/index.js';

import { MAX_GIT_DISCOVERY_OUTPUT_BYTES } from './constants.js';
import { createGitWorkingTreeDiscovery } from './discovery.js';
import type { IGitStartingDirectoryInspector, IGitWorkingTreeDiscoveryReads } from './types.js';

const STARTING_DIRECTORY = path.resolve('workspace', 'nested');
const REPOSITORY_ROOT = path.resolve('workspace');
const GIT_OPTIONS = {
  maxOutputBytes: MAX_GIT_DISCOVERY_OUTPUT_BYTES,
  timeoutSeconds: GIT_TIMEOUT_SECONDS,
};
const INPUT = { invocationDirectory: STARTING_DIRECTORY, repositoryDirectory: null };

/** Creates typed Git reads that find the repository root and the sparse-checkout setting. */
const createGitReads = (topLevel: string | null = REPOSITORY_ROOT, isSparseCheckout = false) => ({
  readConfigBoolean: vi
    .fn<IGitWorkingTreeDiscoveryReads['readConfigBoolean']>()
    .mockResolvedValue(isSparseCheckout),
  readTopLevel: vi.fn<IGitWorkingTreeDiscoveryReads['readTopLevel']>().mockResolvedValue(topLevel),
});

/** Creates the default successful starting-directory inspector. */
const createStartingDirectoryInspector = (): ReturnType<
  typeof vi.fn<IGitStartingDirectoryInspector>
> =>
  vi
    .fn<IGitStartingDirectoryInspector>()
    .mockResolvedValueOnce(Object.freeze({ directory: STARTING_DIRECTORY, kind: 'found' }))
    .mockResolvedValueOnce(Object.freeze({ directory: REPOSITORY_ROOT, kind: 'found' }));

/** Creates the default supported Git version preflight. */
const createVersionPreflight = (): ReturnType<typeof vi.fn<IGitVersionPreflight>> =>
  vi.fn<IGitVersionPreflight>().mockResolvedValue(
    Object.freeze({
      kind: 'supported',
      version: Object.freeze({ major: 2, minor: 32, patch: 0 }),
    }),
  );

describe('createGitWorkingTreeDiscovery', () => {
  test('discovers one accessible nonsparse working tree in the required order', async () => {
    const git = createGitReads();
    const startingDirectoryInspector = createStartingDirectoryInspector();
    const gitVersionPreflight = createVersionPreflight();
    const discoverWorkingTree = createGitWorkingTreeDiscovery(
      git,
      startingDirectoryInspector,
      gitVersionPreflight,
    );

    const result = await discoverWorkingTree(INPUT);

    expect(result).toStrictEqual({ kind: 'discovered', repositoryRoot: REPOSITORY_ROOT });
    expect(Object.isFrozen(result)).toBe(true);
    expect(startingDirectoryInspector).toHaveBeenNthCalledWith(1, INPUT);
    expect(startingDirectoryInspector).toHaveBeenNthCalledWith(2, {
      invocationDirectory: STARTING_DIRECTORY,
      repositoryDirectory: REPOSITORY_ROOT,
    });
    expect(git.readTopLevel.mock.calls).toStrictEqual([[STARTING_DIRECTORY, GIT_OPTIONS]]);
    expect(gitVersionPreflight).toHaveBeenCalledExactlyOnceWith(REPOSITORY_ROOT, undefined);
    expect(git.readConfigBoolean.mock.calls).toStrictEqual([
      [REPOSITORY_ROOT, 'core.sparseCheckout', false, GIT_OPTIONS],
    ]);
  });

  test('passes the caller signal to every Git read', async () => {
    const git = createGitReads();
    const gitVersionPreflight = createVersionPreflight();
    const { signal } = new AbortController();

    await createGitWorkingTreeDiscovery(
      git,
      createStartingDirectoryInspector(),
      gitVersionPreflight,
    )({ ...INPUT, signal });

    expect(git.readTopLevel).toHaveBeenCalledWith(STARTING_DIRECTORY, { ...GIT_OPTIONS, signal });
    expect(gitVersionPreflight).toHaveBeenCalledWith(REPOSITORY_ROOT, signal);
    expect(git.readConfigBoolean).toHaveBeenCalledWith(
      REPOSITORY_ROOT,
      'core.sparseCheckout',
      false,
      { ...GIT_OPTIONS, signal },
    );
  });

  test.each([
    [GIT_ERRORS.GIT_NOT_FOUND, 'GIT_NOT_FOUND'],
    [GIT_ERRORS.GIT_REPOSITORY_NOT_FOUND, 'GIT_REPOSITORY_NOT_FOUND'],
    [GIT_ERRORS.GIT_ACCESS_DENIED, 'GIT_ACCESS_DENIED'],
    [GIT_ERRORS.GIT_OUTPUT_INVALID, 'GIT_OUTPUT_INVALID'],
    [GIT_ERRORS.GIT_COMMAND_FAILED, 'GIT_COMMAND_FAILED'],
    [PROCESS_ERRORS.PROCESS_OUTPUT_TOO_LARGE, 'GIT_OUTPUT_INVALID'],
  ] as const)(
    'maps initial Git failure %s to %s without leaking diagnostics',
    async (code, errorCode) => {
      const git = createGitReads();

      git.readTopLevel.mockRejectedValue(
        new Exception(`Git failed in ${STARTING_DIRECTORY}.`, { code }),
      );

      const result = await createGitWorkingTreeDiscovery(
        git,
        createStartingDirectoryInspector(),
        createVersionPreflight(),
      )(INPUT);

      expect(result).toStrictEqual({ errorCode, kind: 'failed' });
      expect(Object.isFrozen(result)).toBe(true);
      expect(JSON.stringify(result)).not.toContain(STARTING_DIRECTORY);
    },
  );

  test('rejects a directory without a working tree before root resolution', async () => {
    const git = createGitReads(null);
    const startingDirectoryInspector = createStartingDirectoryInspector();
    const gitVersionPreflight = createVersionPreflight();

    await expect(
      createGitWorkingTreeDiscovery(git, startingDirectoryInspector, gitVersionPreflight)(INPUT),
    ).resolves.toStrictEqual({ errorCode: 'GIT_WORK_TREE_REQUIRED', kind: 'failed' });
    expect(startingDirectoryInspector).toHaveBeenCalledOnce();
    expect(gitVersionPreflight).not.toHaveBeenCalled();
    expect(git.readConfigBoolean).not.toHaveBeenCalled();
  });

  test('rejects a relative repository root before revalidation or version preflight', async () => {
    const startingDirectoryInspector = createStartingDirectoryInspector();
    const gitVersionPreflight = createVersionPreflight();

    await expect(
      createGitWorkingTreeDiscovery(
        createGitReads('relative-root'),
        startingDirectoryInspector,
        gitVersionPreflight,
      )(INPUT),
    ).resolves.toStrictEqual({ errorCode: 'GIT_OUTPUT_INVALID', kind: 'failed' });
    expect(startingDirectoryInspector).toHaveBeenCalledOnce();
    expect(gitVersionPreflight).not.toHaveBeenCalled();
  });

  test('returns a safe failure when the discovered root is no longer accessible', async () => {
    const startingDirectoryInspector = vi
      .fn<IGitStartingDirectoryInspector>()
      .mockResolvedValueOnce(Object.freeze({ directory: STARTING_DIRECTORY, kind: 'found' }))
      .mockResolvedValueOnce({ errorCode: 'GIT_REPOSITORY_NOT_FOUND', kind: 'failed' });
    const gitVersionPreflight = createVersionPreflight();

    const result = await createGitWorkingTreeDiscovery(
      createGitReads(),
      startingDirectoryInspector,
      gitVersionPreflight,
    )(INPUT);

    expect(result).toStrictEqual({ errorCode: 'GIT_REPOSITORY_NOT_FOUND', kind: 'failed' });
    expect(Object.isFrozen(result)).toBe(true);
    expect(gitVersionPreflight).not.toHaveBeenCalled();
  });

  test('stops before sparse-checkout inspection when version preflight fails', async () => {
    const git = createGitReads();
    const gitVersionPreflight = vi
      .fn<IGitVersionPreflight>()
      .mockResolvedValue(Object.freeze({ errorCode: 'GIT_VERSION_UNSUPPORTED', kind: 'failed' }));

    await expect(
      createGitWorkingTreeDiscovery(
        git,
        createStartingDirectoryInspector(),
        gitVersionPreflight,
      )(INPUT),
    ).resolves.toStrictEqual({ errorCode: 'GIT_VERSION_UNSUPPORTED', kind: 'failed' });
    expect(git.readConfigBoolean).not.toHaveBeenCalled();
  });

  test('rejects sparse checkout after successful version preflight', async () => {
    await expect(
      createGitWorkingTreeDiscovery(
        createGitReads(REPOSITORY_ROOT, true),
        createStartingDirectoryInspector(),
        createVersionPreflight(),
      )(INPUT),
    ).resolves.toStrictEqual({ errorCode: 'GIT_SPARSE_CHECKOUT_UNSUPPORTED', kind: 'failed' });
  });

  test('maps a sparse-checkout setting Git cannot read as a boolean to invalid output', async () => {
    const git = createGitReads();

    git.readConfigBoolean.mockRejectedValue(
      new Exception('Git failed.', { code: GIT_ERRORS.GIT_COMMAND_FAILED }),
    );

    await expect(
      createGitWorkingTreeDiscovery(
        git,
        createStartingDirectoryInspector(),
        createVersionPreflight(),
      )(INPUT),
    ).resolves.toStrictEqual({ errorCode: 'GIT_COMMAND_FAILED', kind: 'failed' });
  });

  test('returns a starting-directory failure without invoking Git', async () => {
    const git = createGitReads();
    const startingDirectoryInspector = vi
      .fn<IGitStartingDirectoryInspector>()
      .mockResolvedValue({ errorCode: 'GIT_REPOSITORY_NOT_FOUND', kind: 'failed' });

    const result = await createGitWorkingTreeDiscovery(
      git,
      startingDirectoryInspector,
      createVersionPreflight(),
    )(INPUT);

    expect(result).toStrictEqual({ errorCode: 'GIT_REPOSITORY_NOT_FOUND', kind: 'failed' });
    expect(Object.isFrozen(result)).toBe(true);
    expect(git.readTopLevel).not.toHaveBeenCalled();
  });
});

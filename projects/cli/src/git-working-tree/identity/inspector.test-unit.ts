// @vitest-environment node
import path from 'node:path';
import { describe, expect, test, vi } from 'vitest';

import type { IGitCommandRunner } from '../../git-command/index.js';

import { MAX_GIT_DISCOVERY_OUTPUT_BYTES } from '../constants.js';

import { GIT_WORKING_TREE_IDENTITY_ARGUMENTS } from './constants.js';
import { createGitWorkingTreeIdentityInspector } from './inspector.js';
import type { IGitWorkingTreeIdentityStat } from './types.js';

const REPOSITORY_ROOT = path.resolve('repository');
const GIT_DIRECTORY = path.join(REPOSITORY_ROOT, '.git', 'worktrees', 'selected');
const COMMON_DIRECTORY = path.join(REPOSITORY_ROOT, '.git');

/** Creates one successful Git path-query boundary. */
const createGitRunner = (
  outputs: Readonly<Record<string, string>> = {
    '--absolute-git-dir': GIT_DIRECTORY,
    '--git-common-dir': '.git',
    '--show-toplevel': REPOSITORY_ROOT,
  },
): IGitCommandRunner =>
  vi.fn<IGitCommandRunner>((args) => {
    const query = args.at(-1);
    const output = query === undefined ? undefined : outputs[query];

    if (output === undefined) {
      return Promise.resolve(Object.freeze({ kind: 'failed', reason: 'command-failed' }));
    }

    return Promise.resolve(Object.freeze({ kind: 'completed', value: Buffer.from(`${output}\n`) }));
  });

/** Creates deterministic directory identity observations. */
const createStat = (): IGitWorkingTreeIdentityStat =>
  vi.fn<IGitWorkingTreeIdentityStat>((hostPath) => {
    const inode = new Map([
      [REPOSITORY_ROOT, 1n],
      [GIT_DIRECTORY, 2n],
      [COMMON_DIRECTORY, 3n],
    ]).get(hostPath);

    if (inode === undefined) {
      return Promise.reject(Object.assign(new Error('private missing path'), { code: 'ENOENT' }));
    }

    return Promise.resolve({ dev: 1n, ino: inode, isDirectory: () => true });
  });

describe('createGitWorkingTreeIdentityInspector', () => {
  test('captures one immutable root, Git directory, and resolved common directory identity', async () => {
    const runGit = createGitRunner();
    const inspectPath = createStat();
    const inspectIdentity = createGitWorkingTreeIdentityInspector(runGit, inspectPath);
    const result = await inspectIdentity({ repositoryRoot: REPOSITORY_ROOT });

    expect(result).toStrictEqual({
      identity: {
        commonDirectory: { dev: 1n, ino: 3n, path: COMMON_DIRECTORY },
        gitDirectory: { dev: 1n, ino: 2n, path: GIT_DIRECTORY },
        repositoryRoot: { dev: 1n, ino: 1n, path: REPOSITORY_ROOT },
      },
      kind: 'inspected',
    });
    expect(Object.isFrozen(result)).toBe(true);

    if (result.kind === 'inspected') {
      expect(Object.isFrozen(result.identity)).toBe(true);
      expect(Object.values(result.identity).every((location) => Object.isFrozen(location))).toBe(
        true,
      );
    }

    expect(vi.mocked(runGit).mock.calls).toStrictEqual(
      [
        GIT_WORKING_TREE_IDENTITY_ARGUMENTS.RepositoryRoot,
        GIT_WORKING_TREE_IDENTITY_ARGUMENTS.GitDirectory,
        GIT_WORKING_TREE_IDENTITY_ARGUMENTS.CommonDirectory,
      ].map((args) => [
        args,
        { cwd: REPOSITORY_ROOT, maxOutputBytes: MAX_GIT_DISCOVERY_OUTPUT_BYTES },
      ]),
    );
    expect(vi.mocked(inspectPath).mock.calls.map(([hostPath]) => hostPath)).toStrictEqual([
      REPOSITORY_ROOT,
      GIT_DIRECTORY,
      COMMON_DIRECTORY,
    ]);
  });

  test.each([
    ['aborted', 'GIT_OPERATION_ABORTED'],
    ['not-found', 'GIT_NOT_FOUND'],
    ['repository-not-found', 'GIT_REPOSITORY_NOT_FOUND'],
    ['access-denied', 'GIT_ACCESS_DENIED'],
    ['output-limit-exceeded', 'GIT_OUTPUT_INVALID'],
    ['output-invalid', 'GIT_OUTPUT_INVALID'],
    ['command-failed', 'GIT_COMMAND_FAILED'],
  ] as const)('maps Git failure %s without host diagnostics', async (reason, errorCode) => {
    const runGit = vi
      .fn<IGitCommandRunner>()
      .mockResolvedValue(Object.freeze({ kind: 'failed', reason }));

    await expect(
      createGitWorkingTreeIdentityInspector(
        runGit,
        createStat(),
      )({
        repositoryRoot: REPOSITORY_ROOT,
      }),
    ).resolves.toStrictEqual({ errorCode, kind: 'failed' });
  });

  test('rejects a Git root that no longer matches the selected repository', async () => {
    const replacementRoot = path.resolve('replacement');
    const runGit = createGitRunner({
      '--absolute-git-dir': GIT_DIRECTORY,
      '--git-common-dir': '.git',
      '--show-toplevel': replacementRoot,
    });
    const inspectPath = vi.fn<IGitWorkingTreeIdentityStat>((hostPath) =>
      Promise.resolve({
        dev: 1n,
        ino: hostPath === replacementRoot ? 2n : 1n,
        isDirectory: () => true,
      }),
    );

    await expect(
      createGitWorkingTreeIdentityInspector(
        runGit,
        inspectPath,
      )({
        repositoryRoot: REPOSITORY_ROOT,
      }),
    ).resolves.toStrictEqual({ kind: 'mismatched' });
    expect(inspectPath.mock.calls.map(([hostPath]) => hostPath)).toStrictEqual([
      replacementRoot,
      REPOSITORY_ROOT,
    ]);
  });

  test('accepts distinct absolute root spellings with the same filesystem identity', async () => {
    const selectedRoot = path.resolve('selected-alias');
    const discoveredRoot = path.resolve('canonical-repository');
    const gitDirectory = path.join(discoveredRoot, '.git');
    const runGit = createGitRunner({
      '--absolute-git-dir': gitDirectory,
      '--git-common-dir': gitDirectory,
      '--show-toplevel': discoveredRoot,
    });
    const inspectPath = vi.fn<IGitWorkingTreeIdentityStat>((hostPath) => {
      const inode = new Map([
        [selectedRoot, 1n],
        [discoveredRoot, 1n],
        [gitDirectory, 2n],
      ]).get(hostPath);

      if (inode === undefined) {
        return Promise.reject(Object.assign(new Error('private missing path'), { code: 'ENOENT' }));
      }

      return Promise.resolve({ dev: 1n, ino: inode, isDirectory: () => true });
    });
    const inspectIdentity = createGitWorkingTreeIdentityInspector(runGit, inspectPath);

    await expect(inspectIdentity({ repositoryRoot: selectedRoot })).resolves.toStrictEqual({
      identity: {
        commonDirectory: { dev: 1n, ino: 2n, path: gitDirectory },
        gitDirectory: { dev: 1n, ino: 2n, path: gitDirectory },
        repositoryRoot: { dev: 1n, ino: 1n, path: discoveredRoot },
      },
      kind: 'inspected',
    });
    expect(inspectPath.mock.calls.map(([hostPath]) => hostPath)).toStrictEqual([
      discoveredRoot,
      selectedRoot,
      gitDirectory,
      gitDirectory,
    ]);
  });

  test.each([
    ['ENOENT', 'GIT_REPOSITORY_NOT_FOUND'],
    ['ENOTDIR', 'GIT_REPOSITORY_NOT_FOUND'],
    ['EACCES', 'GIT_ACCESS_DENIED'],
    ['EPERM', 'GIT_ACCESS_DENIED'],
    ['EIO', 'GIT_COMMAND_FAILED'],
  ] as const)('maps filesystem failure %s without exposing its cause', async (code, errorCode) => {
    const inspectPath = vi
      .fn<IGitWorkingTreeIdentityStat>()
      .mockRejectedValue(Object.assign(new Error('private host diagnostic'), { code }));

    await expect(
      createGitWorkingTreeIdentityInspector(
        createGitRunner(),
        inspectPath,
      )({
        repositoryRoot: REPOSITORY_ROOT,
      }),
    ).resolves.toStrictEqual({ errorCode, kind: 'failed' });
  });

  test('maps hostile filesystem failures without trusting their properties', async () => {
    const inspectPath = vi.fn<IGitWorkingTreeIdentityStat>().mockRejectedValue(
      new Proxy(new Error('private host diagnostic'), {
        has: () => true,
        get: () => {
          throw new Error('hostile error property');
        },
      }),
    );

    await expect(
      createGitWorkingTreeIdentityInspector(
        createGitRunner(),
        inspectPath,
      )({
        repositoryRoot: REPOSITORY_ROOT,
      }),
    ).resolves.toStrictEqual({ errorCode: 'GIT_COMMAND_FAILED', kind: 'failed' });
  });

  test('rejects an unavailable or non-directory identity', async () => {
    const unavailableIdentity = vi
      .fn<IGitWorkingTreeIdentityStat>()
      .mockResolvedValue({ dev: 0n, ino: 0n, isDirectory: () => true });
    const nonDirectory = vi
      .fn<IGitWorkingTreeIdentityStat>()
      .mockResolvedValue({ dev: 1n, ino: 1n, isDirectory: () => false });

    await expect(
      createGitWorkingTreeIdentityInspector(
        createGitRunner(),
        unavailableIdentity,
      )({
        repositoryRoot: REPOSITORY_ROOT,
      }),
    ).resolves.toStrictEqual({ errorCode: 'GIT_WORK_TREE_REQUIRED', kind: 'failed' });
    await expect(
      createGitWorkingTreeIdentityInspector(
        createGitRunner(),
        nonDirectory,
      )({
        repositoryRoot: REPOSITORY_ROOT,
      }),
    ).resolves.toStrictEqual({ errorCode: 'GIT_WORK_TREE_REQUIRED', kind: 'failed' });
  });
});

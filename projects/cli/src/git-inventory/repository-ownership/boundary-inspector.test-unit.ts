// @vitest-environment node
import { Buffer } from 'node:buffer';
import path from 'node:path';
import { Exception } from 'jg-exception';
import { ERRORS as PROCESS_ERRORS } from 'jg-process';
import { ERRORS as GIT_ERRORS } from 'jg-git-commands';
import { describe, expect, test, vi } from 'vitest';

import { GIT_TIMEOUT_SECONDS } from '../../git-command/index.js';

import { createGitInventoryBoundaryInspector } from './boundary-inspector.js';
import { planGitInventoryOwnershipPath } from './path-planner.js';
import type {
  IGitInventoryOwnershipLstat,
  IGitInventoryOwnershipPathPlan,
  IGitInventoryOwnershipReadDirectory,
  IGitInventoryOwnershipStatistics,
  IGitTopLevelReader,
} from './types.js';

const ENCODER = new TextEncoder();
const REPOSITORY_ROOT = path.resolve('selected-repository');

type IFilesystemEntryType = 'directory' | 'file' | 'symlink';

/** Creates the no-follow statistics used by deterministic filesystem fixtures. */
const createStatistics = (
  entryType: IFilesystemEntryType,
  inode: bigint,
): IGitInventoryOwnershipStatistics => ({
  dev: 1n,
  ino: inode,
  isDirectory: () => entryType === 'directory',
  isFile: () => entryType === 'file',
  isSymbolicLink: () => entryType === 'symlink',
});

/** Creates injectable raw-directory and no-follow stat fixtures. */
const createFilesystem = (
  directories: Readonly<Record<string, readonly string[]>>,
  entries: Readonly<Record<string, IGitInventoryOwnershipStatistics>>,
): {
  readonly inspectHostPath: ReturnType<typeof vi.fn<IGitInventoryOwnershipLstat>>;
  readonly readDirectory: ReturnType<typeof vi.fn<IGitInventoryOwnershipReadDirectory>>;
} => {
  const inspectHostPath = vi.fn<IGitInventoryOwnershipLstat>((hostPath) => {
    const statistics = entries[hostPath];

    if (statistics === undefined) {
      return Promise.reject(Object.assign(new Error('missing fixture path'), { code: 'ENOENT' }));
    }

    return Promise.resolve(statistics);
  });
  const readDirectory = vi.fn<IGitInventoryOwnershipReadDirectory>((hostPath) => {
    const names = directories[hostPath];

    if (names === undefined) {
      return Promise.reject(
        Object.assign(new Error('missing fixture directory'), { code: 'ENOENT' }),
      );
    }

    return Promise.resolve(names.map((name) => Buffer.from(name, 'utf8')));
  });

  return { inspectHostPath, readDirectory };
};

/** Plans one untracked path and fails the test fixture if its path is invalid. */
const createUntrackedPlan = (candidatePath: string): IGitInventoryOwnershipPathPlan => {
  const result = planGitInventoryOwnershipPath({ kind: 'untracked', path: candidatePath });

  if (result.kind === 'failed') {
    throw new Error('The ownership path fixture is invalid.');
  }

  return result.plan;
};

/** Measures the stdout of readTopLevel's two commands for one root. */
const measureTopLevelOutput = (repositoryRoot: string): number =>
  ENCODER.encode(`true\n${repositoryRoot}\n`).byteLength;

/** Creates a bounded typed Git read returning one repository root. */
const createRootReader = (
  repositoryRoot: string | ((directory: string) => string),
): ReturnType<typeof vi.fn<IGitTopLevelReader>> =>
  vi.fn<IGitTopLevelReader>((directory, options) => {
    const root = typeof repositoryRoot === 'string' ? repositoryRoot : repositoryRoot(directory);

    // each of readTopLevel's commands may write up to the output limit
    if (ENCODER.encode(`${root}\n`).byteLength > (options?.maxOutputBytes ?? Infinity)) {
      return Promise.reject(
        new Exception('Too much output.', { code: PROCESS_ERRORS.PROCESS_OUTPUT_TOO_LARGE }),
      );
    }

    return Promise.resolve(root);
  });

describe('createGitInventoryBoundaryInspector', () => {
  test('classifies nested ownership once per exact cached directory prefix', async () => {
    const nestedDirectory = path.join(REPOSITORY_ROOT, 'nested');
    const ordinaryDirectory = path.join(REPOSITORY_ROOT, 'ordinary');
    const { inspectHostPath, readDirectory } = createFilesystem(
      {
        [REPOSITORY_ROOT]: ['nested', 'ordinary'],
        [nestedDirectory]: ['.git', 'first.txt', 'second.txt'],
        [ordinaryDirectory]: ['file.txt'],
      },
      {
        [nestedDirectory]: createStatistics('directory', 2n),
        [path.join(nestedDirectory, '.git')]: createStatistics('file', 3n),
        [ordinaryDirectory]: createStatistics('directory', 4n),
      },
    );
    const readRoot = createRootReader(nestedDirectory);
    const inspectBoundaries = createGitInventoryBoundaryInspector(
      readRoot,
      inspectHostPath,
      readDirectory,
    );
    const result = await inspectBoundaries({
      maxMetadataBytes: 4096,
      plans: [
        createUntrackedPlan('nested/first.txt'),
        createUntrackedPlan('nested/second.txt'),
        createUntrackedPlan('ordinary/file.txt'),
      ],
      repositoryRoot: REPOSITORY_ROOT,
    });

    expect(result).toStrictEqual({
      gitMetadataBytes: measureTopLevelOutput(nestedDirectory),
      kind: 'inspected',
      ownership: ['nested-repository', 'nested-repository', 'selected-repository'],
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(readRoot).toHaveBeenCalledExactlyOnceWith(nestedDirectory, {
      maxOutputBytes: 4096,
      timeoutSeconds: GIT_TIMEOUT_SECONDS,
    });
    expect(readDirectory).toHaveBeenCalledTimes(3);
    expect(readDirectory).toHaveBeenCalledWith(REPOSITORY_ROOT);
    expect(readDirectory).toHaveBeenCalledWith(nestedDirectory);
    expect(readDirectory).toHaveBeenCalledWith(ordinaryDirectory);
    expect(inspectHostPath).not.toHaveBeenCalledWith(path.join(nestedDirectory, 'first.txt'));
  });

  test('classifies a nested root returned through a host path alias', async () => {
    const nestedDirectory = path.join(REPOSITORY_ROOT, 'nested');
    const nestedDirectoryAlias = path.resolve('host-alias', 'nested');
    const nestedStatistics = createStatistics('directory', 2n);
    const { inspectHostPath, readDirectory } = createFilesystem(
      {
        [REPOSITORY_ROOT]: ['nested'],
        [nestedDirectory]: ['.git', 'file.txt'],
      },
      {
        [nestedDirectory]: nestedStatistics,
        [nestedDirectoryAlias]: nestedStatistics,
        [path.join(nestedDirectory, '.git')]: createStatistics('directory', 3n),
      },
    );
    const inspectBoundaries = createGitInventoryBoundaryInspector(
      createRootReader(nestedDirectoryAlias),
      inspectHostPath,
      readDirectory,
    );

    await expect(
      inspectBoundaries({
        maxMetadataBytes: 4096,
        plans: [createUntrackedPlan('nested/file.txt')],
        repositoryRoot: REPOSITORY_ROOT,
      }),
    ).resolves.toStrictEqual({
      gitMetadataBytes: measureTopLevelOutput(nestedDirectoryAlias),
      kind: 'inspected',
      ownership: ['nested-repository'],
    });
    expect(inspectHostPath).toHaveBeenCalledWith(nestedDirectoryAlias);
  });

  test('requires a trailing-slash directory record to resolve to a nested boundary', async () => {
    const ordinaryDirectory = path.join(REPOSITORY_ROOT, 'ordinary');
    const { inspectHostPath, readDirectory } = createFilesystem(
      {
        [REPOSITORY_ROOT]: ['ordinary'],
        [ordinaryDirectory]: [],
      },
      {
        [ordinaryDirectory]: createStatistics('directory', 2n),
      },
    );
    const inspectBoundaries = createGitInventoryBoundaryInspector(
      vi.fn<IGitTopLevelReader>(),
      inspectHostPath,
      readDirectory,
    );

    await expect(
      inspectBoundaries({
        maxMetadataBytes: 4096,
        plans: [createUntrackedPlan('ordinary/')],
        repositoryRoot: REPOSITORY_ROOT,
      }),
    ).resolves.toStrictEqual({ errorCode: 'GIT_OUTPUT_INVALID', kind: 'failed' });
  });

  test('never descends through a symlinked candidate ancestor', async () => {
    const linkPath = path.join(REPOSITORY_ROOT, 'link');
    const { inspectHostPath, readDirectory } = createFilesystem(
      { [REPOSITORY_ROOT]: ['link'] },
      { [linkPath]: createStatistics('symlink', 2n) },
    );
    const readRoot = vi.fn<IGitTopLevelReader>();
    const inspectBoundaries = createGitInventoryBoundaryInspector(
      readRoot,
      inspectHostPath,
      readDirectory,
    );

    await expect(
      inspectBoundaries({
        maxMetadataBytes: 4096,
        plans: [createUntrackedPlan('link/private.txt')],
        repositoryRoot: REPOSITORY_ROOT,
      }),
    ).resolves.toStrictEqual({ errorCode: 'GIT_OUTPUT_INVALID', kind: 'failed' });
    expect(readDirectory).not.toHaveBeenCalledWith(linkPath);
    expect(readRoot).not.toHaveBeenCalled();
  });

  test('rejects a host-resolved alias for a non-exact Git control marker', async () => {
    const nestedDirectory = path.join(REPOSITORY_ROOT, 'nested');
    const gitControlPath = path.join(nestedDirectory, '.git');
    const { inspectHostPath, readDirectory } = createFilesystem(
      {
        [REPOSITORY_ROOT]: ['nested'],
        [nestedDirectory]: ['.GIT', 'file.txt'],
      },
      {
        [nestedDirectory]: createStatistics('directory', 2n),
        [gitControlPath]: createStatistics('directory', 3n),
      },
    );
    const readRoot = vi.fn<IGitTopLevelReader>();
    const inspectBoundaries = createGitInventoryBoundaryInspector(
      readRoot,
      inspectHostPath,
      readDirectory,
    );

    await expect(
      inspectBoundaries({
        maxMetadataBytes: 4096,
        plans: [createUntrackedPlan('nested/file.txt')],
        repositoryRoot: REPOSITORY_ROOT,
      }),
    ).resolves.toStrictEqual({ errorCode: 'GIT_OUTPUT_INVALID', kind: 'failed' });
    expect(readRoot).not.toHaveBeenCalled();
  });

  test('rejects an exact Git control marker that is itself a symlink', async () => {
    const nestedDirectory = path.join(REPOSITORY_ROOT, 'nested');
    const { inspectHostPath, readDirectory } = createFilesystem(
      {
        [REPOSITORY_ROOT]: ['nested'],
        [nestedDirectory]: ['.git', 'file.txt'],
      },
      {
        [nestedDirectory]: createStatistics('directory', 2n),
        [path.join(nestedDirectory, '.git')]: createStatistics('symlink', 3n),
      },
    );
    const readRoot = vi.fn<IGitTopLevelReader>();
    const inspectBoundaries = createGitInventoryBoundaryInspector(
      readRoot,
      inspectHostPath,
      readDirectory,
    );

    await expect(
      inspectBoundaries({
        maxMetadataBytes: 4096,
        plans: [createUntrackedPlan('nested/file.txt')],
        repositoryRoot: REPOSITORY_ROOT,
      }),
    ).resolves.toStrictEqual({ errorCode: 'GIT_OUTPUT_INVALID', kind: 'failed' });
    expect(readRoot).not.toHaveBeenCalled();
  });

  test('rejects a directory identity change observed during traversal', async () => {
    const nestedDirectory = path.join(REPOSITORY_ROOT, 'nested');
    const inspectHostPath = vi
      .fn<IGitInventoryOwnershipLstat>()
      .mockResolvedValueOnce(createStatistics('directory', 2n))
      .mockResolvedValueOnce(createStatistics('directory', 3n));
    const readDirectory = vi.fn<IGitInventoryOwnershipReadDirectory>((hostPath) =>
      Promise.resolve(
        (hostPath === REPOSITORY_ROOT ? ['nested'] : ['file.txt']).map((name) =>
          Buffer.from(name, 'utf8'),
        ),
      ),
    );
    const readRoot = vi.fn<IGitTopLevelReader>();
    const inspectBoundaries = createGitInventoryBoundaryInspector(
      readRoot,
      inspectHostPath,
      readDirectory,
    );

    await expect(
      inspectBoundaries({
        maxMetadataBytes: 4096,
        plans: [createUntrackedPlan('nested/file.txt')],
        repositoryRoot: REPOSITORY_ROOT,
      }),
    ).resolves.toStrictEqual({ errorCode: 'GIT_OUTPUT_INVALID', kind: 'failed' });
    expect(readDirectory).toHaveBeenCalledWith(nestedDirectory);
    expect(readRoot).not.toHaveBeenCalled();
  });

  test('charges nested-root output to the remaining metadata budget', async () => {
    const nestedDirectory = path.join(REPOSITORY_ROOT, 'nested');
    const { inspectHostPath, readDirectory } = createFilesystem(
      {
        [REPOSITORY_ROOT]: ['nested'],
        [nestedDirectory]: ['.git', 'file.txt'],
      },
      {
        [nestedDirectory]: createStatistics('directory', 2n),
        [path.join(nestedDirectory, '.git')]: createStatistics('directory', 3n),
      },
    );
    const readRoot = createRootReader(nestedDirectory);
    const inspectBoundaries = createGitInventoryBoundaryInspector(
      readRoot,
      inspectHostPath,
      readDirectory,
    );

    await expect(
      inspectBoundaries({
        maxMetadataBytes: 1,
        plans: [createUntrackedPlan('nested/file.txt')],
        repositoryRoot: REPOSITORY_ROOT,
      }),
    ).resolves.toStrictEqual({ errorCode: 'RESOURCE_LIMIT_EXCEEDED', kind: 'failed' });
    expect(readRoot).toHaveBeenCalledWith(nestedDirectory, {
      maxOutputBytes: 1,
      timeoutSeconds: GIT_TIMEOUT_SECONDS,
    });
  });

  test('shares the remaining metadata budget across independent nested boundaries', async () => {
    const firstNestedDirectory = path.join(REPOSITORY_ROOT, 'first-nested');
    const secondNestedDirectory = path.join(REPOSITORY_ROOT, 'second-nested');
    const { inspectHostPath, readDirectory } = createFilesystem(
      {
        [REPOSITORY_ROOT]: ['first-nested', 'second-nested'],
        [firstNestedDirectory]: ['.git', 'file.txt'],
        [secondNestedDirectory]: ['.git', 'file.txt'],
      },
      {
        [firstNestedDirectory]: createStatistics('directory', 2n),
        [path.join(firstNestedDirectory, '.git')]: createStatistics('directory', 3n),
        [secondNestedDirectory]: createStatistics('directory', 4n),
        [path.join(secondNestedDirectory, '.git')]: createStatistics('directory', 5n),
      },
    );
    const firstOutputBytes = measureTopLevelOutput(firstNestedDirectory);
    const secondOutputBytes = measureTopLevelOutput(secondNestedDirectory);
    const maxMetadataBytes = firstOutputBytes + secondOutputBytes - 1;
    const readRoot = createRootReader((directory) => directory);
    const inspectBoundaries = createGitInventoryBoundaryInspector(
      readRoot,
      inspectHostPath,
      readDirectory,
    );

    await expect(
      inspectBoundaries({
        maxMetadataBytes,
        plans: [
          createUntrackedPlan('first-nested/file.txt'),
          createUntrackedPlan('second-nested/file.txt'),
        ],
        repositoryRoot: REPOSITORY_ROOT,
      }),
    ).resolves.toStrictEqual({ errorCode: 'RESOURCE_LIMIT_EXCEEDED', kind: 'failed' });
    expect(readRoot).toHaveBeenCalledTimes(2);
    expect(readRoot.mock.calls[0]?.[1]?.maxOutputBytes).toBe(maxMetadataBytes);
    expect(readRoot.mock.calls[1]?.[1]?.maxOutputBytes).toBe(secondOutputBytes - 1);
  });

  test.each([
    [GIT_ERRORS.GIT_NOT_FOUND, 'GIT_NOT_FOUND'],
    [GIT_ERRORS.GIT_REPOSITORY_NOT_FOUND, 'GIT_OUTPUT_INVALID'],
    [GIT_ERRORS.GIT_ACCESS_DENIED, 'GIT_ACCESS_DENIED'],
    [GIT_ERRORS.GIT_OUTPUT_INVALID, 'GIT_OUTPUT_INVALID'],
    [PROCESS_ERRORS.PROCESS_OUTPUT_TOO_LARGE, 'RESOURCE_LIMIT_EXCEEDED'],
    [GIT_ERRORS.GIT_COMMAND_FAILED, 'GIT_COMMAND_FAILED'],
  ] as const)('maps nested-root Git failure %s', async (code, errorCode) => {
    const nestedDirectory = path.join(REPOSITORY_ROOT, 'nested');
    const { inspectHostPath, readDirectory } = createFilesystem(
      {
        [REPOSITORY_ROOT]: ['nested'],
        [nestedDirectory]: ['.git', 'file.txt'],
      },
      {
        [nestedDirectory]: createStatistics('directory', 2n),
        [path.join(nestedDirectory, '.git')]: createStatistics('directory', 3n),
      },
    );
    const readRoot = vi
      .fn<IGitTopLevelReader>()
      .mockRejectedValue(new Exception('private diagnostic', { code }));
    const inspectBoundaries = createGitInventoryBoundaryInspector(
      readRoot,
      inspectHostPath,
      readDirectory,
    );

    await expect(
      inspectBoundaries({
        maxMetadataBytes: 4096,
        plans: [createUntrackedPlan('nested/file.txt')],
        repositoryRoot: REPOSITORY_ROOT,
      }),
    ).resolves.toStrictEqual({ errorCode, kind: 'failed' });
  });

  test.each([
    ['EACCES', 'GIT_ACCESS_DENIED'],
    ['EPERM', 'GIT_ACCESS_DENIED'],
    ['ENOENT', 'GIT_OUTPUT_INVALID'],
    ['EIO', 'GIT_COMMAND_FAILED'],
  ] as const)('normalizes filesystem failure %s', async (code, errorCode) => {
    const inspectHostPath = vi.fn<IGitInventoryOwnershipLstat>();
    const readDirectory = vi
      .fn<IGitInventoryOwnershipReadDirectory>()
      .mockRejectedValue(Object.assign(new Error('private host diagnostic'), { code }));
    const inspectBoundaries = createGitInventoryBoundaryInspector(
      vi.fn<IGitTopLevelReader>(),
      inspectHostPath,
      readDirectory,
    );
    const result = await inspectBoundaries({
      maxMetadataBytes: 4096,
      plans: [createUntrackedPlan('nested/file.txt')],
      repositoryRoot: REPOSITORY_ROOT,
    });

    expect(result).toStrictEqual({ errorCode, kind: 'failed' });
    expect(JSON.stringify(result)).not.toContain('private');
  });

  test('rejects a missing, relative, or unrelated nested root', async () => {
    const nestedDirectory = path.join(REPOSITORY_ROOT, 'nested');
    const { inspectHostPath, readDirectory } = createFilesystem(
      {
        [REPOSITORY_ROOT]: ['nested'],
        [nestedDirectory]: ['.git', 'file.txt'],
      },
      {
        [nestedDirectory]: createStatistics('directory', 2n),
        [path.join(nestedDirectory, '.git')]: createStatistics('directory', 3n),
      },
    );

    for (const [root, errorCode] of [
      [null, 'GIT_COMMAND_FAILED'],
      ['relative', 'GIT_OUTPUT_INVALID'],
      [path.resolve('other'), 'GIT_OUTPUT_INVALID'],
    ] as const) {
      const inspectBoundaries = createGitInventoryBoundaryInspector(
        vi.fn<IGitTopLevelReader>().mockResolvedValue(root),
        inspectHostPath,
        readDirectory,
      );

      await expect(
        inspectBoundaries({
          maxMetadataBytes: 4096,
          plans: [createUntrackedPlan('nested/file.txt')],
          repositoryRoot: REPOSITORY_ROOT,
        }),
      ).resolves.toStrictEqual({ errorCode, kind: 'failed' });
    }
  });
});

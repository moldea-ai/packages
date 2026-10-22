// @vitest-environment node
import { Exception } from 'jg-exception';
import { ERRORS as PROCESS_ERRORS } from 'jg-process';
import { ERRORS as GIT_ERRORS, type IIndexEntry } from 'jg-git-commands';
import { describe, expect, test, vi } from 'vitest';

import { parseRepositoryPath } from '@moldea.ai/repository';

import {
  GIT_TIMEOUT_SECONDS,
  type IGitCommandRunner,
  type IGitReadResult,
} from '../git-command/index.js';

import {
  GIT_IGNORED_INVENTORY_ARGUMENTS,
  GIT_TRACKED_RECORD_OVERHEAD_BYTES,
  INSTRUCTION_PATHS,
} from './constants.js';
import type { IGitContentTransformationClassifier } from './content-transformation/index.js';
import type { IGitInventoryEntryTypeNormalizer } from './entry-type/index.js';
import type { IGitLinkAncestorShadower } from './link-ancestors/index.js';
import type { IGitInventoryLogicalPathNormalizer } from './logical-path/index.js';
import { createGitInventoryProbe } from './probe.js';
import type { IGitInventoryOwnershipFilter } from './repository-ownership/index.js';
import type { IGitInventoryListingReads } from './types.js';

const ENCODER = new TextEncoder();
const CONTENT_TRANSFORMATION = Object.freeze({
  filter: 'unspecified',
  ident: 'unspecified',
  isGuarded: false,
  workingTreeEncoding: 'unspecified',
});

interface IGitListingFixture {
  readonly ignored?: IGitReadResult<Buffer>;
  readonly tracked?: readonly IIndexEntry[] | Exception;
  readonly untracked?: readonly string[] | Exception;
}

/** Creates typed Git listing reads that resolve, or reject, with deterministic fixtures. */
const createGitReads = ({ ignored, tracked = [], untracked = [] }: IGitListingFixture = {}) => ({
  listUntrackedFiles: vi.fn<IGitInventoryListingReads['listUntrackedFiles']>(() =>
    untracked instanceof Exception ? Promise.reject(untracked) : Promise.resolve([...untracked]),
  ),
  readIndexEntries: vi.fn<IGitInventoryListingReads['readIndexEntries']>(() =>
    tracked instanceof Exception ? Promise.reject(tracked) : Promise.resolve([...tracked]),
  ),
  runGit: vi.fn<IGitCommandRunner>(() =>
    Promise.resolve(ignored ?? Object.freeze({ kind: 'completed', value: Buffer.alloc(0) })),
  ),
});

/** Measures the stdout `ls-files --stage -z` is charged for, with the longest object name. */
const measureTracked = (paths: readonly string[]): number =>
  paths.reduce(
    (bytes, path) => bytes + GIT_TRACKED_RECORD_OVERHEAD_BYTES + ENCODER.encode(path).byteLength,
    0,
  );

/** Measures the stdout `ls-files --others -z` writes. */
const measureUntracked = (paths: readonly string[]): number =>
  paths.reduce((bytes, path) => bytes + ENCODER.encode(`${path}\u0000`).byteLength, 0);

/** Creates an ownership filter that keeps every candidate. */
const createPassThroughOwnershipFilter = (
  gitMetadataBytes = 0,
): ReturnType<typeof vi.fn<IGitInventoryOwnershipFilter>> =>
  vi.fn<IGitInventoryOwnershipFilter>((input) =>
    Promise.resolve(
      Object.freeze({ candidates: input.candidates, gitMetadataBytes, kind: 'filtered' }),
    ),
  );

/** Creates a link-ancestor shadower that keeps every candidate without observing the filesystem. */
const createPassThroughShadower = (): ReturnType<typeof vi.fn<IGitLinkAncestorShadower>> =>
  vi.fn<IGitLinkAncestorShadower>((input) =>
    Promise.resolve(Object.freeze({ candidates: input.candidates, kind: 'shadowed' })),
  );

/** Creates an entry-type normalizer that resolves no entries. */
const createEmptyEntryTypeNormalizer = (): ReturnType<
  typeof vi.fn<IGitInventoryEntryTypeNormalizer>
> =>
  vi
    .fn<IGitInventoryEntryTypeNormalizer>()
    .mockResolvedValue(
      Object.freeze({ entries: Object.freeze([]), gitMetadataBytes: 0, kind: 'normalized' }),
    );

/** Classifies every fixture entry without invoking Git. */
const createContentTransformationClassifier = (
  gitMetadataBytes = 0,
): ReturnType<typeof vi.fn<IGitContentTransformationClassifier>> =>
  vi.fn<IGitContentTransformationClassifier>((input) =>
    Promise.resolve(
      Object.freeze({
        entries: Object.freeze(
          input.entries.map((entry) =>
            Object.freeze({ ...entry, contentTransformation: CONTENT_TRANSFORMATION }),
          ),
        ),
        gitMetadataBytes,
        kind: 'classified',
      }),
    ),
  );

describe('createGitInventoryProbe', () => {
  test('lists tracked and untracked candidates under one combined budget', async () => {
    const git = createGitReads({
      tracked: [
        { mode: '100644', path: 'tracked', stage: 0 },
        { mode: '100755', path: 'conflict', stage: 2 },
      ],
      untracked: ['untracked'],
    });
    const trackedBytes = measureTracked(['tracked', 'conflict']);
    const untrackedBytes = measureUntracked(['untracked']);
    const ownershipFilter = createPassThroughOwnershipFilter(7);
    const entryTypeNormalizer = vi.fn<IGitInventoryEntryTypeNormalizer>().mockResolvedValue(
      Object.freeze({
        entries: Object.freeze([
          Object.freeze({
            entryType: 'file',
            indexEntries: Object.freeze([Object.freeze({ mode: '100644', stage: 0 as const })]),
            kind: 'tracked',
            path: 'tracked',
            requiresSymlinkOverlay: false,
          }),
          Object.freeze({
            entryType: 'file',
            indexEntries: Object.freeze([Object.freeze({ mode: '100755', stage: 2 as const })]),
            kind: 'tracked',
            path: 'conflict',
            requiresSymlinkOverlay: false,
          }),
          Object.freeze({
            entryType: 'file',
            kind: 'untracked',
            path: 'untracked',
            requiresSymlinkOverlay: false,
          }),
        ]),
        gitMetadataBytes: 0,
        kind: 'normalized',
      }),
    );
    const contentTransformationClassifier = createContentTransformationClassifier(11);
    const probe = createGitInventoryProbe(
      git,
      ownershipFilter,
      entryTypeNormalizer,
      contentTransformationClassifier,
    );
    const result = await probe({
      maxEntries: 3,
      maxMetadataBytes: 512,
      repositoryRoot: '/repository',
    });

    expect(result).toStrictEqual({
      entries: [
        {
          contentTransformation: CONTENT_TRANSFORMATION,
          entryType: 'file',
          indexEntries: [{ mode: '100755', stage: 2 }],
          kind: 'tracked',
          path: '/conflict',
          requiresSymlinkOverlay: false,
        },
        {
          contentTransformation: CONTENT_TRANSFORMATION,
          entryType: 'file',
          indexEntries: [{ mode: '100644', stage: 0 }],
          kind: 'tracked',
          path: '/tracked',
          requiresSymlinkOverlay: false,
        },
        {
          contentTransformation: CONTENT_TRANSFORMATION,
          entryType: 'file',
          kind: 'untracked',
          path: '/untracked',
          requiresSymlinkOverlay: false,
        },
      ],
      kind: 'probed',
    });
    expect(Object.isFrozen(result)).toBe(true);

    if (result.kind === 'probed') {
      expect(Object.isFrozen(result.entries)).toBe(true);
    }

    expect(git.readIndexEntries).toHaveBeenCalledExactlyOnceWith('/repository', {
      maxOutputBytes: 512,
      timeoutSeconds: GIT_TIMEOUT_SECONDS,
    });
    expect(git.listUntrackedFiles).toHaveBeenCalledExactlyOnceWith('/repository', {
      maxOutputBytes: 512 - trackedBytes,
      timeoutSeconds: GIT_TIMEOUT_SECONDS,
    });
    expect(git.runGit).not.toHaveBeenCalled();
    expect(ownershipFilter).toHaveBeenCalledExactlyOnceWith({
      candidates: [
        { kind: 'tracked', mode: '100644', path: 'tracked', stage: 0 },
        { kind: 'tracked', mode: '100755', path: 'conflict', stage: 2 },
        { kind: 'untracked', path: 'untracked' },
      ],
      maxMetadataBytes: 512 - trackedBytes - untrackedBytes,
      repositoryRoot: '/repository',
    });
    expect(entryTypeNormalizer).toHaveBeenCalledExactlyOnceWith({
      candidates: [
        { kind: 'tracked', mode: '100644', path: 'tracked', stage: 0 },
        { kind: 'tracked', mode: '100755', path: 'conflict', stage: 2 },
        { kind: 'untracked', path: 'untracked' },
      ],
      maxMetadataBytes: 512 - trackedBytes - untrackedBytes - 7,
      repositoryRoot: '/repository',
    });
    expect(contentTransformationClassifier).toHaveBeenCalledExactlyOnceWith({
      entries: [
        {
          entryType: 'file',
          indexEntries: [{ mode: '100644', stage: 0 }],
          kind: 'tracked',
          path: 'tracked',
          requiresSymlinkOverlay: false,
        },
        {
          entryType: 'file',
          indexEntries: [{ mode: '100755', stage: 2 }],
          kind: 'tracked',
          path: 'conflict',
          requiresSymlinkOverlay: false,
        },
        {
          entryType: 'file',
          kind: 'untracked',
          path: 'untracked',
          requiresSymlinkOverlay: false,
        },
      ],
      maxMetadataBytes: 512 - trackedBytes - untrackedBytes - 7,
      repositoryRoot: '/repository',
    });
  });

  test('enforces the combined entry limit before stage collapse or deduplication', async () => {
    const git = createGitReads({
      tracked: [
        { mode: '100644', path: 'conflict', stage: 1 },
        { mode: '100644', path: 'conflict', stage: 2 },
      ],
      untracked: ['untracked'],
    });

    await expect(
      createGitInventoryProbe(git)({
        maxEntries: 2,
        maxMetadataBytes: 1024,
        repositoryRoot: '/repository',
      }),
    ).resolves.toStrictEqual({ errorCode: 'RESOURCE_LIMIT_EXCEEDED', kind: 'failed' });
  });

  test('refuses more tracked entries than the limit before listing untracked files', async () => {
    const git = createGitReads({
      tracked: [
        { mode: '100644', path: 'first', stage: 0 },
        { mode: '100644', path: 'second', stage: 0 },
      ],
    });

    await expect(
      createGitInventoryProbe(git)({
        maxEntries: 1,
        maxMetadataBytes: 1024,
        repositoryRoot: '/repository',
      }),
    ).resolves.toStrictEqual({ errorCode: 'RESOURCE_LIMIT_EXCEEDED', kind: 'failed' });
    expect(git.listUntrackedFiles).not.toHaveBeenCalled();
  });

  test('refuses a listing whose output leaves the metadata budget exhausted', async () => {
    const tracked = [{ mode: '100644', path: 'tracked', stage: 0 }] as const;
    const trackedBytes = measureTracked(['tracked']);

    await expect(
      createGitInventoryProbe(createGitReads({ tracked }))({
        maxEntries: 1,
        maxMetadataBytes: trackedBytes - 1,
        repositoryRoot: '/repository',
      }),
    ).resolves.toStrictEqual({ errorCode: 'RESOURCE_LIMIT_EXCEEDED', kind: 'failed' });

    const git = createGitReads({ tracked, untracked: ['untracked'] });

    await expect(
      createGitInventoryProbe(git)({
        maxEntries: 2,
        maxMetadataBytes: trackedBytes,
        repositoryRoot: '/repository',
      }),
    ).resolves.toStrictEqual({ errorCode: 'RESOURCE_LIMIT_EXCEEDED', kind: 'failed' });
    // Git needs a positive output limit, even with the budget spent
    expect(git.listUntrackedFiles.mock.calls[0]?.[1]?.maxOutputBytes).toBe(1);
  });

  test('lists an exact selection by its literal paths from the repository root', async () => {
    const git = createGitReads();
    const probe = createGitInventoryProbe(
      git,
      createPassThroughOwnershipFilter(),
      createEmptyEntryTypeNormalizer(),
      createContentTransformationClassifier(),
    );

    await probe({
      maxEntries: 1,
      maxMetadataBytes: 1024,
      repositoryRoot: '/repository',
      selectionPaths: [parseRepositoryPath('/moldea/moldea.yaml')],
    });

    const options = {
      maxOutputBytes: 1024,
      paths: ['moldea/moldea.yaml'],
      timeoutSeconds: GIT_TIMEOUT_SECONDS,
    };
    expect(git.readIndexEntries).toHaveBeenCalledWith('/repository', options);
    expect(git.listUntrackedFiles).toHaveBeenCalledWith('/repository', options);
  });

  test('adds ignored instruction candidates only for an explicit selection', async () => {
    const git = createGitReads({
      ignored: Object.freeze({
        kind: 'completed',
        value: Buffer.from('AGENTS.md\u0000CLAUDE.md\u0000'),
      }),
      untracked: ['CLAUDE.md'],
    });
    const ownershipFilter = vi
      .fn<IGitInventoryOwnershipFilter>()
      .mockResolvedValue(
        Object.freeze({ candidates: Object.freeze([]), gitMetadataBytes: 0, kind: 'filtered' }),
      );
    const probe = createGitInventoryProbe(
      git,
      ownershipFilter,
      createEmptyEntryTypeNormalizer(),
      createContentTransformationClassifier(),
    );

    await probe({
      includeIgnored: true,
      maxEntries: 8,
      maxMetadataBytes: 1024,
      repositoryRoot: '/repository',
      selectionPaths: INSTRUCTION_PATHS,
    });

    const paths = ['AGENTS.md', 'CLAUDE.md', '.claude/CLAUDE.md', 'CLAUDE.local.md'];
    expect(git.readIndexEntries.mock.calls[0]?.[1]?.paths).toStrictEqual(paths);
    expect(git.listUntrackedFiles.mock.calls[0]?.[1]?.paths).toStrictEqual(paths);
    expect(git.runGit).toHaveBeenCalledExactlyOnceWith(
      [...GIT_IGNORED_INVENTORY_ARGUMENTS, ...paths],
      { cwd: '/repository', maxOutputBytes: 1024 - 10 },
    );
    expect(ownershipFilter.mock.calls[0]?.[0].candidates).toStrictEqual([
      { kind: 'untracked', path: 'CLAUDE.md' },
      { kind: 'untracked', path: 'AGENTS.md' },
    ]);
    expect(ownershipFilter.mock.calls[0]?.[0].maxMetadataBytes).toBe(1024 - 10 - 20);
  });

  test('never lists ignored files without a selection', async () => {
    const git = createGitReads();
    const probe = createGitInventoryProbe(
      git,
      createPassThroughOwnershipFilter(),
      createEmptyEntryTypeNormalizer(),
      createContentTransformationClassifier(),
    );

    await probe({
      includeIgnored: true,
      maxEntries: 8,
      maxMetadataBytes: 1024,
      repositoryRoot: '/repository',
    });

    expect(git.runGit).not.toHaveBeenCalled();
  });

  test.each([
    [GIT_ERRORS.GIT_NOT_FOUND, 'GIT_NOT_FOUND'],
    [GIT_ERRORS.GIT_REPOSITORY_NOT_FOUND, 'GIT_REPOSITORY_NOT_FOUND'],
    [GIT_ERRORS.GIT_ACCESS_DENIED, 'GIT_ACCESS_DENIED'],
    [GIT_ERRORS.GIT_OUTPUT_INVALID, 'GIT_OUTPUT_INVALID'],
    [PROCESS_ERRORS.PROCESS_OUTPUT_TOO_LARGE, 'RESOURCE_LIMIT_EXCEEDED'],
    [GIT_ERRORS.GIT_COMMAND_FAILED, 'GIT_COMMAND_FAILED'],
  ] as const)(
    'maps %s to its subcommand without exposing Git diagnostics',
    async (code, errorCode) => {
      const failure = new Exception('private diagnostic', { code });

      for (const git of [
        createGitReads({ tracked: failure }),
        createGitReads({ untracked: failure }),
      ]) {
        await expect(
          createGitInventoryProbe(git)({
            maxEntries: 1,
            maxMetadataBytes: 64,
            repositoryRoot: '/private',
          }),
        ).resolves.toStrictEqual({ errorCode, kind: 'failed', subcommand: 'ls-files' });
      }
    },
  );

  test('names the subcommand of a failed ignored-instruction listing', async () => {
    const git = createGitReads({
      ignored: Object.freeze({ kind: 'failed', reason: 'output-invalid', subcommand: 'ls-files' }),
    });

    await expect(
      createGitInventoryProbe(git)({
        includeIgnored: true,
        maxEntries: 4,
        maxMetadataBytes: 1024,
        repositoryRoot: '/repository',
        selectionPaths: INSTRUCTION_PATHS,
      }),
    ).resolves.toStrictEqual({
      errorCode: 'GIT_OUTPUT_INVALID',
      kind: 'failed',
      subcommand: 'ls-files',
    });
  });

  test('reports an aborted listing as an aborted operation', async () => {
    const controller = new AbortController();
    const git = createGitReads();

    git.readIndexEntries.mockImplementation(() => {
      const reason = new Error('stopped by the test');

      controller.abort(reason);

      return Promise.reject(reason);
    });

    await expect(
      createGitInventoryProbe(git)({
        maxEntries: 1,
        maxMetadataBytes: 64,
        repositoryRoot: '/repository',
        signal: controller.signal,
      }),
    ).resolves.toStrictEqual({
      errorCode: 'GIT_OPERATION_ABORTED',
      kind: 'failed',
      subcommand: 'ls-files',
    });
  });

  test('rejects an unsupported mode, an empty path, and malformed ignored output atomically', async () => {
    const input = { maxEntries: 4, maxMetadataBytes: 1024, repositoryRoot: '/private' };
    const ownershipFilter = vi.fn<IGitInventoryOwnershipFilter>();

    for (const git of [
      createGitReads({ tracked: [{ mode: '040000', path: 'directory', stage: 0 }] }),
      createGitReads({ untracked: [''] }),
    ]) {
      await expect(createGitInventoryProbe(git, ownershipFilter)(input)).resolves.toStrictEqual({
        errorCode: 'GIT_OUTPUT_INVALID',
        kind: 'failed',
      });
    }

    for (const ignored of [
      Object.freeze({ kind: 'completed' as const, value: Buffer.from('AGENTS.md') }),
      Object.freeze({ kind: 'failed' as const, reason: 'output-invalid' as const }),
    ]) {
      await expect(
        createGitInventoryProbe(
          createGitReads({ ignored }),
          ownershipFilter,
        )({
          ...input,
          includeIgnored: true,
          selectionPaths: INSTRUCTION_PATHS,
        }),
      ).resolves.toStrictEqual({ errorCode: 'GIT_OUTPUT_INVALID', kind: 'failed' });
    }

    expect(ownershipFilter).not.toHaveBeenCalled();
  });

  test('rejects a non-portable canonical candidate before ownership filtering', async () => {
    const ownershipFilter = vi.fn<IGitInventoryOwnershipFilter>();
    const probe = createGitInventoryProbe(
      createGitReads({ tracked: [{ mode: '100644', path: 'moldea/control\npath', stage: 0 }] }),
      ownershipFilter,
    );

    await expect(
      probe({ maxEntries: 1, maxMetadataBytes: 256, repositoryRoot: '/repository' }),
    ).resolves.toStrictEqual({ errorCode: 'GIT_OUTPUT_INVALID', kind: 'failed' });
    expect(ownershipFilter).not.toHaveBeenCalled();
  });

  test('omits invalid external candidates before inspection while charging their raw bytes', async () => {
    const git = createGitReads({
      tracked: [
        { mode: '100644', path: 'control\npath', stage: 0 },
        { mode: '100644', path: 'retained', stage: 0 },
      ],
      untracked: ['windows\\path'],
    });
    const listedBytes =
      measureTracked(['control\npath', 'retained']) + measureUntracked(['windows\\path']);
    const ownershipFilter = createPassThroughOwnershipFilter();
    const entryTypeNormalizer = vi.fn<IGitInventoryEntryTypeNormalizer>(() =>
      Promise.resolve(Object.freeze({ entries: [], gitMetadataBytes: 0, kind: 'normalized' })),
    );
    const probe = createGitInventoryProbe(
      git,
      ownershipFilter,
      entryTypeNormalizer,
      createContentTransformationClassifier(),
    );

    await expect(
      probe({ maxEntries: 3, maxMetadataBytes: 512, repositoryRoot: '/repository' }),
    ).resolves.toStrictEqual({ entries: [], kind: 'probed' });
    const candidates = [{ kind: 'tracked', mode: '100644', path: 'retained', stage: 0 }];
    expect(ownershipFilter).toHaveBeenCalledExactlyOnceWith({
      candidates,
      maxMetadataBytes: 512 - listedBytes,
      repositoryRoot: '/repository',
    });
    expect(entryTypeNormalizer).toHaveBeenCalledExactlyOnceWith({
      candidates,
      maxMetadataBytes: 512 - listedBytes,
      repositoryRoot: '/repository',
    });
  });

  test('counts omitted candidates against the combined raw entry limit', async () => {
    const ownershipFilter = vi.fn<IGitInventoryOwnershipFilter>();
    const probe = createGitInventoryProbe(
      createGitReads({
        tracked: [{ mode: '100644', path: 'control\npath', stage: 0 }],
        untracked: ['windows\\path'],
      }),
      ownershipFilter,
    );

    await expect(
      probe({ maxEntries: 1, maxMetadataBytes: 512, repositoryRoot: '/repository' }),
    ).resolves.toStrictEqual({ errorCode: 'RESOURCE_LIMIT_EXCEEDED', kind: 'failed' });
    expect(ownershipFilter).not.toHaveBeenCalled();
  });

  test('returns an atomic ownership failure after both raw listings complete', async () => {
    const git = createGitReads({
      tracked: [{ mode: '100644', path: 'tracked', stage: 0 }],
      untracked: ['nested/untracked'],
    });
    const ownershipFilter = vi
      .fn<IGitInventoryOwnershipFilter>()
      .mockResolvedValue(Object.freeze({ errorCode: 'GIT_ACCESS_DENIED', kind: 'failed' }));
    const probe = createGitInventoryProbe(
      git,
      ownershipFilter,
      undefined,
      undefined,
      undefined,
      createPassThroughShadower(),
    );

    await expect(
      probe({ maxEntries: 2, maxMetadataBytes: 1024, repositoryRoot: '/private' }),
    ).resolves.toStrictEqual({ errorCode: 'GIT_ACCESS_DENIED', kind: 'failed' });
    expect(ownershipFilter).toHaveBeenCalledOnce();
  });

  test('returns an atomic entry-type failure without exposing partial entries', async () => {
    const git = createGitReads({ tracked: [{ mode: '120000', path: 'link', stage: 0 }] });
    const ownershipFilter = vi.fn<IGitInventoryOwnershipFilter>((input) =>
      Promise.resolve(
        Object.freeze({ candidates: input.candidates, gitMetadataBytes: 0, kind: 'filtered' }),
      ),
    );
    const entryTypeNormalizer = vi
      .fn<IGitInventoryEntryTypeNormalizer>()
      .mockResolvedValue(Object.freeze({ errorCode: 'GIT_OUTPUT_INVALID', kind: 'failed' }));
    const probe = createGitInventoryProbe(git, ownershipFilter, entryTypeNormalizer);

    await expect(
      probe({ maxEntries: 1, maxMetadataBytes: 128, repositoryRoot: '/repository' }),
    ).resolves.toStrictEqual({ errorCode: 'GIT_OUTPUT_INVALID', kind: 'failed' });
    expect(entryTypeNormalizer).toHaveBeenCalledOnce();
  });

  test('returns an atomic logical-path failure without exposing partial entries', async () => {
    const git = createGitReads({ tracked: [{ mode: '100644', path: 'invalid', stage: 0 }] });
    const ownershipFilter = vi.fn<IGitInventoryOwnershipFilter>((input) =>
      Promise.resolve(
        Object.freeze({ candidates: input.candidates, gitMetadataBytes: 0, kind: 'filtered' }),
      ),
    );
    const entryTypeNormalizer = vi.fn<IGitInventoryEntryTypeNormalizer>().mockResolvedValue(
      Object.freeze({
        entries: Object.freeze([
          Object.freeze({
            entryType: 'file',
            indexEntries: Object.freeze([Object.freeze({ mode: '100644', stage: 0 as const })]),
            kind: 'tracked',
            path: 'invalid',
            requiresSymlinkOverlay: false,
          }),
        ]),
        gitMetadataBytes: 0,
        kind: 'normalized',
      }),
    );
    const logicalPathNormalizer = vi
      .fn<IGitInventoryLogicalPathNormalizer>()
      .mockReturnValue(Object.freeze({ errorCode: 'GIT_OUTPUT_INVALID', kind: 'failed' }));
    const probe = createGitInventoryProbe(
      git,
      ownershipFilter,
      entryTypeNormalizer,
      createContentTransformationClassifier(),
      logicalPathNormalizer,
    );

    await expect(
      probe({ maxEntries: 1, maxMetadataBytes: 128, repositoryRoot: '/repository' }),
    ).resolves.toStrictEqual({ errorCode: 'GIT_OUTPUT_INVALID', kind: 'failed' });
    expect(logicalPathNormalizer).toHaveBeenCalledOnce();
    expect(logicalPathNormalizer).toHaveBeenCalledWith({
      entries: [
        {
          contentTransformation: CONTENT_TRANSFORMATION,
          entryType: 'file',
          indexEntries: [{ mode: '100644', stage: 0 }],
          kind: 'tracked',
          path: 'invalid',
          requiresSymlinkOverlay: false,
        },
      ],
    });
  });

  test('returns an atomic content-transformation failure before path normalization', async () => {
    const git = createGitReads({ tracked: [{ mode: '100644', path: 'guarded', stage: 0 }] });
    const ownershipFilter = vi.fn<IGitInventoryOwnershipFilter>((input) =>
      Promise.resolve(
        Object.freeze({ candidates: input.candidates, gitMetadataBytes: 0, kind: 'filtered' }),
      ),
    );
    const entryTypeNormalizer = vi.fn<IGitInventoryEntryTypeNormalizer>().mockResolvedValue(
      Object.freeze({
        entries: Object.freeze([
          Object.freeze({
            entryType: 'file',
            indexEntries: Object.freeze([Object.freeze({ mode: '100644', stage: 0 as const })]),
            kind: 'tracked',
            path: 'guarded',
            requiresSymlinkOverlay: false,
          }),
        ]),
        gitMetadataBytes: 0,
        kind: 'normalized',
      }),
    );
    const contentTransformationClassifier = vi
      .fn<IGitContentTransformationClassifier>()
      .mockResolvedValue(Object.freeze({ errorCode: 'GIT_OUTPUT_INVALID', kind: 'failed' }));
    const logicalPathNormalizer = vi.fn<IGitInventoryLogicalPathNormalizer>();
    const probe = createGitInventoryProbe(
      git,
      ownershipFilter,
      entryTypeNormalizer,
      contentTransformationClassifier,
      logicalPathNormalizer,
    );

    await expect(
      probe({ maxEntries: 1, maxMetadataBytes: 128, repositoryRoot: '/repository' }),
    ).resolves.toStrictEqual({ errorCode: 'GIT_OUTPUT_INVALID', kind: 'failed' });
    expect(contentTransformationClassifier).toHaveBeenCalledOnce();
    expect(logicalPathNormalizer).not.toHaveBeenCalled();
  });

  test('shadows working-tree links between logical-path filtering and ownership', async () => {
    const git = createGitReads({
      tracked: [
        { mode: '100644', path: 'control\npath', stage: 0 },
        { mode: '100644', path: 'linked/file.md', stage: 0 },
      ],
      untracked: ['retained.md'],
    });
    const listedBytes =
      measureTracked(['control\npath', 'linked/file.md']) + measureUntracked(['retained.md']);
    const shadowedCandidates = Object.freeze([
      Object.freeze({ kind: 'untracked' as const, path: 'retained.md' }),
      Object.freeze({ kind: 'untracked' as const, path: 'linked' }),
    ]);
    const linkAncestorShadower = vi
      .fn<IGitLinkAncestorShadower>()
      .mockResolvedValue(Object.freeze({ candidates: shadowedCandidates, kind: 'shadowed' }));
    const ownershipFilter = createPassThroughOwnershipFilter();
    const probe = createGitInventoryProbe(
      git,
      ownershipFilter,
      createEmptyEntryTypeNormalizer(),
      createContentTransformationClassifier(),
      undefined,
      linkAncestorShadower,
    );

    await expect(
      probe({ maxEntries: 3, maxMetadataBytes: 512, repositoryRoot: '/repository' }),
    ).resolves.toStrictEqual({ entries: [], kind: 'probed' });
    expect(linkAncestorShadower).toHaveBeenCalledExactlyOnceWith({
      candidates: [
        { kind: 'tracked', mode: '100644', path: 'linked/file.md', stage: 0 },
        { kind: 'untracked', path: 'retained.md' },
      ],
      repositoryRoot: '/repository',
    });
    expect(ownershipFilter).toHaveBeenCalledExactlyOnceWith({
      candidates: shadowedCandidates,
      maxMetadataBytes: 512 - listedBytes,
      repositoryRoot: '/repository',
    });
  });

  test('returns a link-shadowing failure before ownership filtering', async () => {
    const controller = new AbortController();
    const ownershipFilter = vi.fn<IGitInventoryOwnershipFilter>();
    const linkAncestorShadower = vi
      .fn<IGitLinkAncestorShadower>()
      .mockResolvedValue(Object.freeze({ errorCode: 'GIT_ACCESS_DENIED', kind: 'failed' }));
    const probe = createGitInventoryProbe(
      createGitReads({ tracked: [{ mode: '100644', path: 'folder/file.md', stage: 0 }] }),
      ownershipFilter,
      undefined,
      undefined,
      undefined,
      linkAncestorShadower,
    );

    await expect(
      probe({
        maxEntries: 1,
        maxMetadataBytes: 256,
        repositoryRoot: '/repository',
        signal: controller.signal,
      }),
    ).resolves.toStrictEqual({ errorCode: 'GIT_ACCESS_DENIED', kind: 'failed' });
    expect(linkAncestorShadower).toHaveBeenCalledExactlyOnceWith({
      candidates: [{ kind: 'tracked', mode: '100644', path: 'folder/file.md', stage: 0 }],
      repositoryRoot: '/repository',
      signal: controller.signal,
    });
    expect(ownershipFilter).not.toHaveBeenCalled();
  });
});

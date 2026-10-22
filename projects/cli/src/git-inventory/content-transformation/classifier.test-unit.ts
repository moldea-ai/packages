// @vitest-environment node
import { describe, expect, test, vi } from 'vitest';

import type { IGitCommandRunner, IGitFailureReason } from '../../git-command/index.js';

import { GIT_CONTENT_TRANSFORMATION_ARGUMENTS } from './constants.js';
import { createGitContentTransformationClassifier } from './classifier.js';

const ENCODER = new TextEncoder();

interface IGitFixture {
  readonly failureReason?: IGitFailureReason;
  readonly stdout?: Uint8Array;
}

/** Creates a Git command boundary that, like the real runner, names its subcommand on failure. */
const createGitRunner = (fixture: IGitFixture): IGitCommandRunner =>
  vi.fn<IGitCommandRunner>((args) =>
    Promise.resolve(
      fixture.failureReason === undefined
        ? Object.freeze({ kind: 'completed', value: Buffer.from(fixture.stdout ?? []) })
        : Object.freeze({
            kind: 'failed',
            reason: fixture.failureReason,
            ...(args[0] === undefined ? {} : { subcommand: args[0] }),
          }),
    ),
  );

/** Encodes the exact three `check-attr` records for one path. */
const encodeAttributes = (
  path: string,
  filter: string,
  workingTreeEncoding: string,
  ident: string,
): Uint8Array =>
  ENCODER.encode(
    `${path}\u0000filter\u0000${filter}\u0000${path}\u0000working-tree-encoding\u0000${workingTreeEncoding}\u0000${path}\u0000ident\u0000${ident}\u0000`,
  );

describe('createGitContentTransformationClassifier', () => {
  test('retains exact effective states and derives conservative immutable guards', async () => {
    const output = new Uint8Array([
      ...encodeAttributes('ordinary.txt', 'unspecified', 'unset', 'unspecified'),
      ...encodeAttributes('guarded.txt', 'lfs', 'unspecified', 'set'),
    ]);
    const runGit = createGitRunner({ stdout: output });
    const classify = createGitContentTransformationClassifier(runGit);
    const result = await classify({
      entries: [
        {
          entryType: 'file',
          kind: 'untracked',
          path: 'ordinary.txt',
          requiresSymlinkOverlay: false,
        },
        {
          entryType: 'file',
          indexEntries: [{ mode: '100644', stage: 0 }],
          kind: 'tracked',
          path: 'guarded.txt',
          requiresSymlinkOverlay: false,
        },
      ],
      maxMetadataBytes: output.byteLength,
      repositoryRoot: '/repository',
    });

    expect(result).toStrictEqual({
      entries: [
        {
          contentTransformation: {
            filter: 'unspecified',
            ident: 'unspecified',
            isGuarded: false,
            workingTreeEncoding: 'unset',
          },
          entryType: 'file',
          kind: 'untracked',
          path: 'ordinary.txt',
          requiresSymlinkOverlay: false,
        },
        {
          contentTransformation: {
            filter: 'lfs',
            ident: 'set',
            isGuarded: true,
            workingTreeEncoding: 'unspecified',
          },
          entryType: 'file',
          indexEntries: [{ mode: '100644', stage: 0 }],
          kind: 'tracked',
          path: 'guarded.txt',
          requiresSymlinkOverlay: false,
        },
      ],
      gitMetadataBytes: output.byteLength,
      kind: 'classified',
    });
    expect(Object.isFrozen(result)).toBe(true);

    if (result.kind === 'classified') {
      expect(Object.isFrozen(result.entries)).toBe(true);
      expect(
        result.entries.every(
          (entry) => Object.isFrozen(entry) && Object.isFrozen(entry.contentTransformation),
        ),
      ).toBe(true);
    }

    expect(vi.mocked(runGit).mock.calls).toStrictEqual([
      [
        GIT_CONTENT_TRANSFORMATION_ARGUMENTS,
        {
          cwd: '/repository',
          input: ENCODER.encode('ordinary.txt\u0000guarded.txt\u0000'),
          maxOutputBytes: output.byteLength,
        },
      ],
    ]);
  });

  test('does not invoke Git for an empty effective inventory', async () => {
    const runGit = vi.fn<IGitCommandRunner>();
    const classify = createGitContentTransformationClassifier(runGit);

    await expect(
      classify({ entries: [], maxMetadataBytes: 0, repositoryRoot: '/repository' }),
    ).resolves.toStrictEqual({ entries: [], gitMetadataBytes: 0, kind: 'classified' });
    expect(runGit).not.toHaveBeenCalled();
  });

  test.each([
    ['filter', 'private', 'unspecified', 'unspecified'],
    ['working-tree-encoding', 'unspecified', 'UTF-16LE', 'unspecified'],
    ['ident', 'unspecified', 'unspecified', 'set'],
  ] as const)(
    'guards an independently enabled %s attribute',
    async (_attribute, filter, workingTreeEncoding, ident) => {
      const output = encodeAttributes('guarded.txt', filter, workingTreeEncoding, ident);
      const classify = createGitContentTransformationClassifier(
        createGitRunner({ stdout: output }),
      );

      await expect(
        classify({
          entries: [
            {
              entryType: 'file',
              kind: 'untracked',
              path: 'guarded.txt',
              requiresSymlinkOverlay: false,
            },
          ],
          maxMetadataBytes: output.byteLength,
          repositoryRoot: '/repository',
        }),
      ).resolves.toMatchObject({
        entries: [{ contentTransformation: { isGuarded: true } }],
        kind: 'classified',
      });
    },
  );

  test.each([
    ['aborted', 'GIT_OPERATION_ABORTED'],
    ['not-found', 'GIT_NOT_FOUND'],
    ['repository-not-found', 'GIT_REPOSITORY_NOT_FOUND'],
    ['access-denied', 'GIT_ACCESS_DENIED'],
    ['output-invalid', 'GIT_OUTPUT_INVALID'],
    ['output-limit-exceeded', 'RESOURCE_LIMIT_EXCEEDED'],
    ['command-failed', 'GIT_COMMAND_FAILED'],
  ] as const)(
    'maps %s to its subcommand without exposing Git diagnostics',
    async (failureReason, errorCode) => {
      const classify = createGitContentTransformationClassifier(createGitRunner({ failureReason }));

      await expect(
        classify({
          entries: [
            {
              entryType: 'file',
              kind: 'untracked',
              path: 'private.txt',
              requiresSymlinkOverlay: false,
            },
          ],
          maxMetadataBytes: 1,
          repositoryRoot: '/private',
        }),
      ).resolves.toStrictEqual({ errorCode, kind: 'failed', subcommand: 'check-attr' });
    },
  );

  test('rejects parser failures and output beyond the remaining budget atomically', async () => {
    const entry = {
      entryType: 'file' as const,
      kind: 'untracked' as const,
      path: 'file.txt',
      requiresSymlinkOverlay: false as const,
    };
    const malformedClassifier = createGitContentTransformationClassifier(
      createGitRunner({ stdout: ENCODER.encode('file.txt\u0000filter\u0000') }),
    );

    await expect(
      malformedClassifier({ entries: [entry], maxMetadataBytes: 256, repositoryRoot: '/private' }),
    ).resolves.toStrictEqual({ errorCode: 'GIT_OUTPUT_INVALID', kind: 'failed' });

    const oversizedClassifier = createGitContentTransformationClassifier(
      createGitRunner({
        stdout: encodeAttributes('file.txt', 'unspecified', 'unspecified', 'unspecified'),
      }),
    );

    await expect(
      oversizedClassifier({ entries: [entry], maxMetadataBytes: 8, repositoryRoot: '/private' }),
    ).resolves.toStrictEqual({ errorCode: 'RESOURCE_LIMIT_EXCEEDED', kind: 'failed' });
  });

  test('rejects an invalid remaining metadata budget before invoking Git', async () => {
    const runGit = vi.fn<IGitCommandRunner>();
    const classify = createGitContentTransformationClassifier(runGit);

    await expect(
      classify({ entries: [], maxMetadataBytes: -1, repositoryRoot: '/repository' }),
    ).resolves.toStrictEqual({ errorCode: 'RESOURCE_LIMIT_EXCEEDED', kind: 'failed' });
    expect(runGit).not.toHaveBeenCalled();
  });
});

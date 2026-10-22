// @vitest-environment node
import { describe, expect, test, vi } from 'vitest';

import type { IGitInventoryEntryInspector } from '../entry-type/index.js';
import type { IGitInventoryCandidate } from '../types.js';

import { createGitLinkAncestorShadower } from './shadower.js';

type IInspection = Awaited<ReturnType<IGitInventoryEntryInspector>>;

const DIRECTORY: IInspection = Object.freeze({ entryType: 'unsupported', kind: 'inspected' });
const LINK: IInspection = Object.freeze({ entryType: 'symlink', kind: 'inspected' });

/** Creates an inspector that reports each listed path, and a directory for every other path. */
const createInspector = (observations: Readonly<Record<string, IInspection>> = {}) =>
  vi.fn<IGitInventoryEntryInspector>((_root, candidatePath) =>
    Promise.resolve(observations[candidatePath] ?? DIRECTORY),
  );

const tracked = (path: string): IGitInventoryCandidate =>
  Object.freeze({ kind: 'tracked', mode: '100644', path, stage: 0 });

const untracked = (path: string): IGitInventoryCandidate =>
  Object.freeze({ kind: 'untracked', path });

describe('createGitLinkAncestorShadower', () => {
  test('replaces tracked and untracked candidates beneath a link with one link candidate', async () => {
    const inspectEntry = createInspector({ '.claude/skills/jg-bash': LINK });
    const candidates = [
      tracked('.agents/skills/jg-bash/SKILL.md'),
      tracked('.claude/skills/jg-bash/SKILL.md'),
      tracked('.claude/skills/jg-bash/references/style.md'),
      untracked('.claude/skills/jg-bash/notes.md'),
      untracked('.claude/settings.json'),
    ];

    const result = await createGitLinkAncestorShadower(inspectEntry)({
      candidates,
      repositoryRoot: '/repository',
    });

    expect(result).toStrictEqual({
      candidates: [
        tracked('.agents/skills/jg-bash/SKILL.md'),
        untracked('.claude/settings.json'),
        untracked('.claude/skills/jg-bash'),
      ],
      kind: 'shadowed',
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(result.kind === 'shadowed' && Object.isFrozen(result.candidates)).toBe(true);
  });

  test.each([
    ['an untracked candidate', untracked('linked')],
    ['a tracked candidate', tracked('linked')],
  ])('adds no link candidate when %s already sits at the link path', async (_label, existing) => {
    const inspectEntry = createInspector({ linked: LINK });

    await expect(
      createGitLinkAncestorShadower(inspectEntry)({
        candidates: [existing, tracked('linked/file.md')],
        repositoryRoot: '/repository',
      }),
    ).resolves.toStrictEqual({ candidates: [existing], kind: 'shadowed' });
  });

  test('inspects each ancestor once, shallowest first, and nothing beneath a found link', async () => {
    const inspectEntry = createInspector({ 'a/b': LINK });

    await createGitLinkAncestorShadower(inspectEntry)({
      candidates: [
        tracked('a/b/c/d.md'),
        tracked('a/b/e.md'),
        tracked('a/f.md'),
        tracked('g/h.md'),
      ],
      repositoryRoot: '/repository',
    });

    expect(inspectEntry.mock.calls).toStrictEqual([
      ['/repository', 'a'],
      ['/repository', 'g'],
      ['/repository', 'a/b'],
    ]);
  });

  test.each([
    ['missing', Object.freeze({ kind: 'missing' }) satisfies IInspection],
    [
      'a regular file',
      Object.freeze({ entryType: 'file', kind: 'inspected' }) satisfies IInspection,
    ],
    ['a directory', DIRECTORY],
  ])('leaves candidates unchanged when an ancestor is %s', async (_label, observation) => {
    const candidates = Object.freeze([tracked('folder/file.md'), untracked('folder/other.md')]);

    const result = await createGitLinkAncestorShadower(createInspector({ folder: observation }))({
      candidates,
      repositoryRoot: '/repository',
    });

    expect(result).toStrictEqual({ candidates, kind: 'shadowed' });
    expect(result.kind === 'shadowed' && result.candidates).toBe(candidates);
  });

  test('treats a directory-boundary record as a path, not as an ancestor of itself', async () => {
    const inspectEntry = createInspector();

    await createGitLinkAncestorShadower(inspectEntry)({
      candidates: [untracked('nested/repository/')],
      repositoryRoot: '/repository',
    });

    expect(inspectEntry.mock.calls).toStrictEqual([['/repository', 'nested']]);
  });

  test('inspects nothing when no candidate has an ancestor', async () => {
    const inspectEntry = createInspector();
    const candidates = Object.freeze([tracked('README.md'), untracked('notes.md')]);

    await expect(
      createGitLinkAncestorShadower(inspectEntry)({ candidates, repositoryRoot: '/repository' }),
    ).resolves.toStrictEqual({ candidates, kind: 'shadowed' });
    expect(inspectEntry).not.toHaveBeenCalled();
  });

  test.each(['GIT_ACCESS_DENIED', 'GIT_COMMAND_FAILED', 'GIT_OUTPUT_INVALID'] as const)(
    'propagates a %s inspection failure without shadowed candidates',
    async (errorCode) => {
      const inspectEntry = createInspector({
        folder: Object.freeze({ errorCode, kind: 'failed' }),
      });

      await expect(
        createGitLinkAncestorShadower(inspectEntry)({
          candidates: [tracked('folder/file.md')],
          repositoryRoot: '/repository',
        }),
      ).resolves.toStrictEqual({ errorCode, kind: 'failed' });
    },
  );

  test('stops before inspecting when already aborted, and between inspections', async () => {
    const controller = new AbortController();
    controller.abort();
    const idleInspector = createInspector();

    await expect(
      createGitLinkAncestorShadower(idleInspector)({
        candidates: [tracked('folder/file.md')],
        repositoryRoot: '/repository',
        signal: controller.signal,
      }),
    ).resolves.toStrictEqual({ errorCode: 'GIT_OPERATION_ABORTED', kind: 'failed' });
    expect(idleInspector).not.toHaveBeenCalled();

    const midwayController = new AbortController();
    const abortingInspector = vi.fn<IGitInventoryEntryInspector>(() => {
      midwayController.abort();
      return Promise.resolve(DIRECTORY);
    });

    await expect(
      createGitLinkAncestorShadower(abortingInspector)({
        candidates: [tracked('a/file.md'), tracked('b/file.md')],
        repositoryRoot: '/repository',
        signal: midwayController.signal,
      }),
    ).resolves.toStrictEqual({ errorCode: 'GIT_OPERATION_ABORTED', kind: 'failed' });
    expect(abortingInspector).toHaveBeenCalledOnce();
  });
});

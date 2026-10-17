// @vitest-environment node
import { describe, expect, test } from 'vitest';

import {
  filterGitInventoryCandidateLogicalPaths,
  normalizeGitInventoryLogicalPaths,
} from './normalizer.js';

const CONTENT_TRANSFORMATION = Object.freeze({
  filter: 'unspecified',
  ident: 'unspecified',
  isGuarded: false,
  workingTreeEncoding: 'unspecified',
});

describe('filterGitInventoryCandidateLogicalPaths', () => {
  test('preserves complete candidate metadata, repeated stages, and exact valid paths', () => {
    const candidates = [
      { kind: 'tracked', mode: '100644', path: 'conflict', stage: 1 },
      { kind: 'tracked', mode: '100755', path: 'conflict', stage: 2 },
      { kind: 'untracked', path: 'nested/😀.txt' },
      { kind: 'untracked', path: 'nested/worktree/' },
      { kind: 'tracked', mode: '100644', path: 'moldea', stage: 0 },
      { kind: 'untracked', path: 'moldea/' },
      { kind: 'untracked', path: 'moldea/C:/source' },
    ] as const;
    const result = filterGitInventoryCandidateLogicalPaths({ candidates });

    expect(result).toStrictEqual({ candidates, kind: 'filtered' });
    expect(Object.isFrozen(result)).toBe(true);
    if (result.kind === 'filtered') {
      expect(Object.isFrozen(result.candidates)).toBe(true);
      expect(result.candidates.every((candidate, index) => candidate === candidates[index])).toBe(
        true,
      );
    }
  });

  test.each([
    '',
    '/absolute',
    'control\npath.txt',
    'control\u007fpath.txt',
    'windows\\separator',
    'C:/drive-path',
    'C:drive-relative',
    'empty//segment',
    './relative',
    'parent/../escape',
    'moldea-other/../escape',
    'Moldea/control\npath.txt',
    'moldea\\context\\file.md',
  ])('omits the invalid external candidate %o without altering retained candidates', (path) => {
    for (const kind of ['tracked', 'untracked'] as const) {
      const retained = { kind: 'untracked', path: 'moldea/project.md' } as const;
      expect(
        filterGitInventoryCandidateLogicalPaths({
          candidates: [retained, { kind, path }],
        }),
      ).toStrictEqual({ candidates: [retained], kind: 'filtered' });
    }
  });

  test.each([
    'moldea/control\npath.md',
    'moldea/control\u007fpath.md',
    'moldea/windows\\separator',
    'moldea//segment',
    'moldea/./relative',
    'moldea/../escape',
  ])('rejects the invalid canonical candidate %o atomically', (path) => {
    for (const kind of ['tracked', 'untracked'] as const) {
      expect(
        filterGitInventoryCandidateLogicalPaths({
          candidates: [
            { kind: 'untracked', path: 'ordinary.txt' },
            { kind, path },
          ],
        }),
      ).toStrictEqual({ errorCode: 'GIT_OUTPUT_INVALID', kind: 'failed' });
    }
  });

  test.each([
    { kind: 'tracked' as const, path: 'tracked-directory/' },
    { kind: 'untracked' as const, path: 'empty//directory/' },
    { kind: 'untracked' as const, path: '/' },
  ])('omits the malformed external candidate record $path', (candidate) => {
    expect(filterGitInventoryCandidateLogicalPaths({ candidates: [candidate] })).toStrictEqual({
      candidates: [],
      kind: 'filtered',
    });
  });

  test.each([
    { kind: 'tracked' as const, path: 'moldea/' },
    { kind: 'untracked' as const, path: 'moldea//' },
  ])('rejects the malformed canonical candidate record $path', (candidate) => {
    expect(filterGitInventoryCandidateLogicalPaths({ candidates: [candidate] })).toStrictEqual({
      errorCode: 'GIT_OUTPUT_INVALID',
      kind: 'failed',
    });
  });
});

describe('normalizeGitInventoryLogicalPaths', () => {
  test('brands, preserves, and code-point-sorts exact logical paths', () => {
    const result = normalizeGitInventoryLogicalPaths({
      entries: [
        {
          contentTransformation: CONTENT_TRANSFORMATION,
          entryType: 'file',
          kind: 'untracked',
          path: '😀.txt',
          requiresSymlinkOverlay: false,
        },
        {
          contentTransformation: CONTENT_TRANSFORMATION,
          entryType: 'file',
          indexEntries: Object.freeze([
            Object.freeze({ mode: '100644' as const, stage: 0 as const }),
          ]),
          kind: 'tracked',
          path: '\ue000.txt',
          requiresSymlinkOverlay: false,
        },
        {
          contentTransformation: CONTENT_TRANSFORMATION,
          entryType: 'file',
          kind: 'untracked',
          path: 'case.txt',
          requiresSymlinkOverlay: false,
        },
        {
          contentTransformation: CONTENT_TRANSFORMATION,
          entryType: 'file',
          kind: 'untracked',
          path: 'Case.txt',
          requiresSymlinkOverlay: false,
        },
        {
          contentTransformation: CONTENT_TRANSFORMATION,
          entryType: 'file',
          kind: 'untracked',
          path: 'café.txt',
          requiresSymlinkOverlay: false,
        },
        {
          contentTransformation: CONTENT_TRANSFORMATION,
          entryType: 'file',
          kind: 'untracked',
          path: 'cafe\u0301.txt',
          requiresSymlinkOverlay: false,
        },
        {
          contentTransformation: CONTENT_TRANSFORMATION,
          entryType: 'file',
          kind: 'untracked',
          path: '\ufeff.txt',
          requiresSymlinkOverlay: false,
        },
      ],
    });

    expect(result).toStrictEqual({
      entries: [
        {
          contentTransformation: CONTENT_TRANSFORMATION,
          entryType: 'file',
          kind: 'untracked',
          path: '/Case.txt',
          requiresSymlinkOverlay: false,
        },
        {
          contentTransformation: CONTENT_TRANSFORMATION,
          entryType: 'file',
          kind: 'untracked',
          path: '/cafe\u0301.txt',
          requiresSymlinkOverlay: false,
        },
        {
          contentTransformation: CONTENT_TRANSFORMATION,
          entryType: 'file',
          kind: 'untracked',
          path: '/café.txt',
          requiresSymlinkOverlay: false,
        },
        {
          contentTransformation: CONTENT_TRANSFORMATION,
          entryType: 'file',
          kind: 'untracked',
          path: '/case.txt',
          requiresSymlinkOverlay: false,
        },
        {
          contentTransformation: CONTENT_TRANSFORMATION,
          entryType: 'file',
          indexEntries: [{ mode: '100644', stage: 0 }],
          kind: 'tracked',
          path: '/\ue000.txt',
          requiresSymlinkOverlay: false,
        },
        {
          contentTransformation: CONTENT_TRANSFORMATION,
          entryType: 'file',
          kind: 'untracked',
          path: '/\ufeff.txt',
          requiresSymlinkOverlay: false,
        },
        {
          contentTransformation: CONTENT_TRANSFORMATION,
          entryType: 'file',
          kind: 'untracked',
          path: '/😀.txt',
          requiresSymlinkOverlay: false,
        },
      ],
      kind: 'normalized',
    });
    expect(Object.isFrozen(result)).toBe(true);

    if (result.kind === 'normalized') {
      expect(Object.isFrozen(result.entries)).toBe(true);
      expect(result.entries.every(Object.isFrozen)).toBe(true);
    }
  });

  test.each([
    '',
    '/absolute',
    'empty//segment',
    './relative',
    'parent/../escape',
    'windows\\separator',
    'C:/drive-path',
    'control\ncharacter',
    'trailing/',
  ])('rejects the non-portable Git path %o atomically', (candidatePath) => {
    expect(
      normalizeGitInventoryLogicalPaths({
        entries: [
          {
            contentTransformation: CONTENT_TRANSFORMATION,
            entryType: 'file',
            kind: 'untracked',
            path: candidatePath,
            requiresSymlinkOverlay: false,
          },
        ],
      }),
    ).toStrictEqual({ errorCode: 'GIT_OUTPUT_INVALID', kind: 'failed' });
  });

  test('rejects duplicate logical paths instead of choosing one entry', () => {
    expect(
      normalizeGitInventoryLogicalPaths({
        entries: [
          {
            contentTransformation: CONTENT_TRANSFORMATION,
            entryType: 'file',
            kind: 'untracked',
            path: 'same',
            requiresSymlinkOverlay: false,
          },
          {
            contentTransformation: CONTENT_TRANSFORMATION,
            entryType: 'symlink',
            kind: 'untracked',
            path: 'same',
            requiresSymlinkOverlay: false,
          },
        ],
      }),
    ).toStrictEqual({ errorCode: 'GIT_OUTPUT_INVALID', kind: 'failed' });
  });
});

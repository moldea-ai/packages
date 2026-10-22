import { inspectGitInventoryEntry, type IGitInventoryEntryInspector } from '../entry-type/index.js';
import type { IGitInventoryCandidate, IGitInventoryProbeFailedResult } from '../types.js';

import type { IGitLinkAncestorShadower, IGitLinkAncestorShadowResult } from './types.js';

/** Creates one immutable cancellation failure. */
const createAbortedFailure = (): IGitInventoryProbeFailedResult =>
  Object.freeze({ errorCode: 'GIT_OPERATION_ABORTED', kind: 'failed' });

/**
 * Lists the proper ancestor directories of one Git-relative path, shallowest first. An untracked
 * directory-boundary record keeps Git's trailing separator, which names the path itself.
 * @param candidatePath The Git-relative candidate path.
 * @returns Every directory above the candidate, such as `a` and `a/b` for `a/b/c`.
 */
const listProperAncestors = (candidatePath: string): string[] => {
  const segments = candidatePath.replace(/\/$/u, '').split('/');

  return segments.slice(0, -1).map((_segment, index) => segments.slice(0, index + 1).join('/'));
};

/** Determines whether a path sits beneath any recorded link. */
const isBeneathLink = (candidatePath: string, links: ReadonlySet<string>): boolean =>
  listProperAncestors(candidatePath).some((ancestor) => links.has(ancestor));

/**
 * Creates link-ancestor shadowing around an injectable no-follow entry inspector. Git can list
 * entries beneath a path the working tree holds as a symlink or junction, such as the files a
 * Windows junction exposes, while every later read treats that path as a link.
 * @param inspectEntry The no-follow inspector for one Git-relative path.
 * @returns A shadower that replaces every candidate beneath a working-tree link with the link.
 */
export const createGitLinkAncestorShadower = (
  inspectEntry: IGitInventoryEntryInspector = inspectGitInventoryEntry,
): IGitLinkAncestorShadower => {
  return async (input): Promise<IGitLinkAncestorShadowResult> => {
    if (input.signal?.aborted) {
      return createAbortedFailure();
    }

    const ancestors = [
      ...new Set(input.candidates.flatMap(({ path }) => listProperAncestors(path))),
    ].sort((left, right) => left.split('/').length - right.split('/').length);
    const links = new Set<string>();

    for (const ancestor of ancestors) {
      if (isBeneathLink(ancestor, links)) {
        continue;
      }

      const inspection = await inspectEntry(input.repositoryRoot, ancestor);

      if (input.signal?.aborted) {
        return createAbortedFailure();
      }

      if (inspection.kind === 'failed') {
        return inspection;
      }

      // a junction is a link too; anything else keeps the existing ownership and missing-path rules
      if (inspection.kind === 'inspected' && inspection.entryType === 'symlink') {
        links.add(ancestor);
      }
    }

    if (links.size === 0) {
      return Object.freeze({ candidates: input.candidates, kind: 'shadowed' });
    }

    const remainingCandidates = input.candidates.filter(({ path }) => !isBeneathLink(path, links));
    const remainingPaths = new Set(remainingCandidates.map(({ path }) => path));
    const linkCandidates: IGitInventoryCandidate[] = [...links]
      .filter((link) => !remainingPaths.has(link))
      .map((link) => Object.freeze({ kind: 'untracked', path: link }));

    return Object.freeze({
      candidates: Object.freeze([...remainingCandidates, ...linkCandidates]),
      kind: 'shadowed',
    });
  };
};

// default link-ancestor shadowing over the current working tree
export const shadowGitLinkAncestors = createGitLinkAncestorShadower();

import {
  decodeMoldeaCliCursor,
  encodeMoldeaCliCursor,
  MoldeaCliOutputPageException,
} from '../output-page/index.js';

import type {
  IMoldeaCliContentAsset,
  IMoldeaCliContentPageInput,
  IMoldeaCliContentResult,
} from './types.js';

/** Creates public content metadata without retaining its body. */
const createContentMetadata = (
  asset: IMoldeaCliContentAsset,
): Omit<IMoldeaCliContentAsset, 'content'> => ({
  digest: asset.digest,
  path: asset.path,
  scalarLength: asset.scalarLength,
  utf8ByteLength: asset.utf8ByteLength,
});

/** Creates one candidate content result ending at a scalar offset. */
const createCandidate = (
  asset: IMoldeaCliContentAsset,
  scalars: readonly string[],
  scalarStart: number,
  scalarEnd: number,
): IMoldeaCliContentResult => ({
  asset: createContentMetadata(asset),
  chunk: {
    content: scalars.slice(scalarStart, scalarEnd).join(''),
    scalarEnd,
    scalarStart,
  },
  cursor:
    scalarEnd < scalars.length
      ? encodeMoldeaCliCursor('content', { path: asset.path }, asset.digest, `scalar:${scalarEnd}`)
      : null,
  snapshotDigest: asset.digest,
});

/**
 * Selects the largest Unicode-scalar-safe content chunk within an exact output budget.
 * @param input The canonical asset, cursor, byte budget, and final result measurement.
 * @returns A content result with a continuation cursor when more scalars remain.
 * @throws
 * - CURSOR_INVALID: The continuation cursor is invalid for this request.
 * - CURSOR_SNAPSHOT_CHANGED: The continuation cursor belongs to a different repository snapshot.
 * - OUTPUT_BUDGET_TOO_SMALL: The output byte budget cannot contain the next complete result.
 */
export const createMoldeaCliContentPage = (
  input: IMoldeaCliContentPageInput,
): IMoldeaCliContentResult => {
  const scalars = Array.from(input.asset.content);
  const cursorState =
    input.cursor === null
      ? null
      : decodeMoldeaCliCursor({
          command: 'content',
          cursor: input.cursor,
          filters: { path: input.asset.path },
          snapshotDigest: input.asset.digest,
        });
  const scalarStart =
    cursorState === null || !/^scalar:\d+$/u.test(cursorState.lastKey)
      ? cursorState === null
        ? 0
        : -1
      : Number(cursorState.lastKey.slice('scalar:'.length));

  if (
    !Number.isSafeInteger(scalarStart) ||
    scalarStart < 0 ||
    scalarStart > scalars.length ||
    (input.cursor !== null && scalarStart === scalars.length)
  ) {
    throw new MoldeaCliOutputPageException('CURSOR_INVALID');
  }

  if (scalars.length === 0) {
    const emptyResult = createCandidate(input.asset, scalars, 0, 0);

    if (input.measure(emptyResult) > input.maxOutputBytes) {
      throw new MoldeaCliOutputPageException('OUTPUT_BUDGET_TOO_SMALL');
    }

    return Object.freeze({
      ...emptyResult,
      asset: Object.freeze(emptyResult.asset),
      chunk: Object.freeze(emptyResult.chunk),
    });
  }

  let lower = scalarStart + 1;
  let upper = scalars.length;
  let selected: IMoldeaCliContentResult | null = null;

  while (lower <= upper) {
    const scalarEnd = lower + Math.floor((upper - lower) / 2);
    const candidate = createCandidate(input.asset, scalars, scalarStart, scalarEnd);

    if (input.measure(candidate) <= input.maxOutputBytes) {
      selected = candidate;
      lower = scalarEnd + 1;
    } else {
      upper = scalarEnd - 1;
    }
  }

  if (selected === null) {
    throw new MoldeaCliOutputPageException('OUTPUT_BUDGET_TOO_SMALL');
  }

  return Object.freeze({
    ...selected,
    asset: Object.freeze(selected.asset),
    chunk: Object.freeze(selected.chunk),
  });
};

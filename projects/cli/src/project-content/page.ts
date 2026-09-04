import type { IJsonValue } from '../json-serialization/index.js';
import {
  calculateMoldeaCliJsonDigest,
  decodeMoldeaCliCursor,
  encodeMoldeaCliCursor,
  MoldeaCliOutputPageException,
} from '../output-page/index.js';

import type { IMoldeaCliContentPageInput, IMoldeaCliContentResult } from './types.js';

/** Creates one candidate content result ending at a Unicode scalar boundary. */
const createCandidate = (
  input: IMoldeaCliContentPageInput,
  scalars: readonly string[],
  scalarEnd: number,
  snapshotDigest: string,
): IMoldeaCliContentResult => {
  const content = scalars.slice(0, scalarEnd).join('');
  const byteEnd = input.page.byteStart + Buffer.byteLength(content, 'utf8');
  const isComplete = byteEnd === input.page.totalBytes;

  return {
    asset: {
      contentIdentity: input.page.contentIdentity,
      path: input.page.path,
      totalBytes: input.page.totalBytes,
    },
    chunk: {
      byteEnd,
      byteStart: input.page.byteStart,
      content,
    },
    cursor: isComplete
      ? null
      : encodeMoldeaCliCursor(
          'content',
          { path: input.page.path },
          snapshotDigest,
          `byte:${byteEnd}`,
          `byte:${byteEnd}`,
        ),
    snapshotDigest,
  };
};

/** Creates the stable identity shared by every page of one canonical file snapshot. */
const createSnapshotDigest = (input: IMoldeaCliContentPageInput): string =>
  calculateMoldeaCliJsonDigest({
    contentIdentity: input.page.contentIdentity,
    path: input.page.path,
    totalBytes: input.page.totalBytes,
  } satisfies IJsonValue);

/** Selects the largest Unicode-safe content prefix within the exact output budget. */
export const createMoldeaCliContentPage = (
  input: IMoldeaCliContentPageInput,
): IMoldeaCliContentResult => {
  const snapshotDigest = createSnapshotDigest(input);
  const cursorState =
    input.cursor === null
      ? null
      : decodeMoldeaCliCursor({
          command: 'content',
          cursor: input.cursor,
          filters: { path: input.page.path },
          snapshotDigest,
        });
  const expectedSourceCursor = `byte:${input.page.byteStart}`;

  if (
    (cursorState === null && input.page.byteStart !== 0) ||
    (cursorState !== null && cursorState.sourceCursor !== expectedSourceCursor)
  ) {
    throw new MoldeaCliOutputPageException('CURSOR_INVALID');
  }

  const scalars = Array.from(input.page.content);
  const emptyResult = createCandidate(input, scalars, 0, snapshotDigest);

  if (scalars.length === 0) {
    if (!input.page.isComplete || input.measure(emptyResult) > input.maxOutputBytes) {
      throw new MoldeaCliOutputPageException('OUTPUT_BUDGET_TOO_SMALL');
    }

    return Object.freeze({
      ...emptyResult,
      asset: Object.freeze(emptyResult.asset),
      chunk: Object.freeze(emptyResult.chunk),
    });
  }

  let lower = 1;
  let upper = scalars.length;
  let selected: IMoldeaCliContentResult | null = null;

  while (lower <= upper) {
    const scalarEnd = lower + Math.floor((upper - lower) / 2);
    const candidate = createCandidate(input, scalars, scalarEnd, snapshotDigest);

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

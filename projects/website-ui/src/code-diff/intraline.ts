import { diffArrays } from 'diff';

import type { ICodeDiffLine, ICodeDiffToken } from './types.js';

// optional presentation work has a shared source budget and a bounded token edit search
const MIN_INLINE_RETAINED_RATIO = 0.5;
const MAX_INLINE_BLOCK_LENGTH = 16_384;
const MAX_INLINE_TOTAL_LENGTH = 65_536;
const MAX_INLINE_EDIT_LENGTH = 256;
const GRAPHEME_SEGMENTER = new Intl.Segmenter('en', { granularity: 'grapheme' });
const WORD_GRAPHEME = /^[\p{L}\p{M}\p{N}_]+$/u;
const WHITESPACE_GRAPHEME = /^\s+$/u;

// comparison offsets use UTF-16, matching source strings and Shiki token slicing
interface IComparisonToken {
  content: string;
  start: number;
  end: number;
  lineIndex: number;
  isWord: boolean;
}

interface IInlineRange {
  start: number;
  end: number;
}

interface IBlockSide {
  lines: ICodeDiffLine[];
  starts: number[];
  lengths: number[];
  tokens: IComparisonToken[];
  hasTokens: boolean[];
  hasRetainedTokens: boolean[];
  ranges: IInlineRange[][];
}

interface IChangedRun {
  side: IBlockSide;
  firstToken: number;
  lastToken: number;
}

/** Keeps graphemes intact while omitting whitespace only from comparison. */
const tokenizeSource = (source: string, starts: number[]): IComparisonToken[] => {
  const tokens: IComparisonToken[] = [];
  let lineIndex = 0;
  for (const { segment, index } of GRAPHEME_SEGMENTER.segment(source)) {
    if (WHITESPACE_GRAPHEME.test(segment)) continue;
    while (lineIndex + 1 < starts.length && index >= starts[lineIndex + 1]!) lineIndex += 1;
    const isWord = WORD_GRAPHEME.test(segment);
    const previous = tokens.at(-1);
    if (isWord && previous?.isWord && previous.end === index) {
      previous.end += segment.length;
    } else {
      tokens.push({
        content: segment,
        start: index,
        end: index + segment.length,
        lineIndex,
        isWord,
      });
    }
  }
  for (const token of tokens) token.content = source.slice(token.start, token.end);
  return tokens;
};

/** Reconstructs an admitted side with line offsets for source-preserving projection. */
const buildSide = (lines: ICodeDiffLine[]): IBlockSide => {
  const contents = lines.map((line) => line.tokens.map((token) => token.content).join(''));
  const starts: number[] = [];
  let offset = 0;
  for (const content of contents) {
    starts.push(offset);
    offset += content.length + 1;
  }
  const tokens = tokenizeSource(contents.join('\n'), starts);
  const hasTokens: boolean[] = lines.map(() => false);
  for (const token of tokens) hasTokens[token.lineIndex] = true;
  return {
    lines,
    starts,
    lengths: contents.map((content) => content.length),
    tokens,
    hasTokens,
    hasRetainedTokens: lines.map(() => false),
    ranges: lines.map(() => []),
  };
};

/** Suppresses standalone whole-line edits without discarding wrapped continuations. */
const projectRun = ({ side, firstToken, lastToken }: IChangedRun): void => {
  let touchesRetainedLine = false;
  for (let index = firstToken; index <= lastToken; index += 1) {
    if (side.hasRetainedTokens[side.tokens[index]!.lineIndex]) {
      touchesRetainedLine = true;
      break;
    }
  }
  if (!touchesRetainedLine) return;
  const first = side.tokens[firstToken]!;
  const last = side.tokens[lastToken]!;
  for (let index = first.lineIndex; index <= last.lineIndex; index += 1) {
    if (!side.hasTokens[index]) continue;
    const start = side.starts[index]!;
    side.ranges[index]!.push({
      start: Math.max(first.start, start) - start,
      end: Math.min(last.end, start + side.lengths[index]!) - start,
    });
  }
};

/** Splits syntax tokens with forward range cursors, retaining text and both theme colors. */
const applyLineRanges = (line: ICodeDiffLine, ranges: IInlineRange[]): void => {
  if (ranges.length === 0) return;
  const fragments: ICodeDiffToken[] = [];
  let tokenStart = 0;
  let rangeIndex = 0;
  for (const token of line.tokens) {
    const tokenEnd = tokenStart + token.content.length;
    if (tokenEnd === tokenStart) fragments.push(token);
    let position = tokenStart;
    while (position < tokenEnd) {
      while (rangeIndex < ranges.length && ranges[rangeIndex]!.end <= position) rangeIndex += 1;
      const range = ranges[rangeIndex];
      const isChanged = range !== undefined && range.start <= position;
      const end = Math.min(tokenEnd, isChanged ? range.end : (range?.start ?? tokenEnd));
      fragments.push({
        content: token.content.slice(position - tokenStart, end - tokenStart),
        lightColor: token.lightColor,
        darkColor: token.darkColor,
        ...(isChanged ? { isChanged: true } : {}),
      });
      position = end;
    }
    tokenStart = tokenEnd;
  }
  line.tokens = fragments;
};

/** Refines related replacement text once, without changing the underlying line comparison. */
const refineBlock = (removed: ICodeDiffLine[], added: ICodeDiffLine[]): void => {
  const before = buildSide(removed);
  const after = buildSide(added);
  const shorterCount = Math.min(before.tokens.length, after.tokens.length);
  if (shorterCount === 0) return;
  const changes = diffArrays(
    before.tokens.map((token) => token.content),
    after.tokens.map((token) => token.content),
    { maxEditLength: MAX_INLINE_EDIT_LENGTH },
  );
  if (changes === undefined) return;
  const retainedCount = changes.reduce(
    (count, change) => count + (change.added || change.removed ? 0 : change.count),
    0,
  );
  if (retainedCount < shorterCount * MIN_INLINE_RETAINED_RATIO) return;
  const runs: IChangedRun[] = [];
  let beforeIndex = 0;
  let afterIndex = 0;
  for (const change of changes) {
    if (change.removed) {
      runs.push({
        side: before,
        firstToken: beforeIndex,
        lastToken: beforeIndex + change.count - 1,
      });
    } else if (change.added) {
      runs.push({ side: after, firstToken: afterIndex, lastToken: afterIndex + change.count - 1 });
    } else {
      for (let offset = 0; offset < change.count; offset += 1) {
        before.hasRetainedTokens[before.tokens[beforeIndex + offset]!.lineIndex] = true;
        after.hasRetainedTokens[after.tokens[afterIndex + offset]!.lineIndex] = true;
      }
    }
    if (!change.added) beforeIndex += change.count;
    if (!change.removed) afterIndex += change.count;
  }
  for (const run of runs) projectRun(run);
  for (const side of [before, after]) {
    for (let index = 0; index < side.lines.length; index += 1) {
      applyLineRanges(side.lines[index]!, side.ranges[index]!);
    }
  }
};

/** Counts source and separators before joined strings or comparison tokens are allocated. */
const sourceLength = (lines: ICodeDiffLine[]): number => {
  let length = Math.max(0, lines.length - 1);
  for (const line of lines) for (const token of line.tokens) length += token.content.length;
  return length;
};

/**
 * Adds optional emphasis to newly constructed model lines within isolated source groups.
 * The shared budget includes admitted searches that abort. Only line token arrays are replaced;
 * source syntax-token objects and the recorded line/hunk structure are never mutated.
 * @param lineGroups Complete comparison rows or individual recorded-hunk rows.
 * @mutates Replaces eligible lines' token arrays with source-preserving emphasized fragments.
 */
export const applyIntralineHighlights = (lineGroups: ICodeDiffLine[][]): void => {
  let remainingLength = MAX_INLINE_TOTAL_LENGTH;
  for (const lines of lineGroups) {
    let index = 0;
    while (index < lines.length) {
      if (lines[index]!.kind === 'unchanged') {
        index += 1;
        continue;
      }
      const removed: ICodeDiffLine[] = [];
      const added: ICodeDiffLine[] = [];
      while (index < lines.length && lines[index]!.kind !== 'unchanged') {
        const line = lines[index++]!;
        (line.kind === 'removed' ? removed : added).push(line);
      }
      if (removed.length === 0 || added.length === 0) continue;
      const length = sourceLength(removed) + sourceLength(added);
      if (length > MAX_INLINE_BLOCK_LENGTH) continue;
      if (length > remainingLength) return;
      remainingLength -= length;
      refineBlock(removed, added);
    }
  }
};

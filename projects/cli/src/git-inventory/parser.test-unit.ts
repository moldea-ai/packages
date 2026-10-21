// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { createUntrackedGitInventoryParser } from './parser.js';
import type { IGitInventoryCandidate, IGitInventoryParser } from './types.js';

const ENCODER = new TextEncoder();

/** Feeds one parser using deliberately irregular process-chunk boundaries. */
const consumeInChunks = <TCandidate extends IGitInventoryCandidate>(
  parser: IGitInventoryParser<TCandidate>,
  bytes: Uint8Array,
  chunkLengths: readonly number[],
): void => {
  let offset = 0;

  for (const chunkLength of chunkLengths) {
    parser.consume(bytes.subarray(offset, offset + chunkLength));
    offset += chunkLength;
  }

  parser.consume(bytes.subarray(offset));
};

describe('untracked Git inventory parser', () => {
  test('preserves exact Unicode, tabs, newlines, case, and normalization form', () => {
    const parser = createUntrackedGitInventoryParser(4);
    const decomposedPath = '\ufeffA/e\u0301\tline\n😀.txt';
    const bytes = ENCODER.encode(`${decomposedPath}\u0000ordinary\u0000`);

    consumeInChunks(parser, bytes, [3, 1, 4, 2, 1]);

    expect(parser.finish()).toStrictEqual({
      candidates: [
        { kind: 'untracked', path: decomposedPath },
        { kind: 'untracked', path: 'ordinary' },
      ],
      kind: 'completed',
    });
  });

  test.each([
    { description: 'empty record', output: Uint8Array.from([0x00]) },
    {
      description: 'UTF-8 surrogate encoding',
      output: Uint8Array.from([0xed, 0xa0, 0x80, 0x00]),
    },
    { description: 'unterminated record', output: ENCODER.encode('unterminated') },
  ])('rejects $description', ({ output }) => {
    const parser = createUntrackedGitInventoryParser(2);

    parser.consume(output);
    expect(parser.finish()).toStrictEqual({ kind: 'failed', reason: 'invalid' });
  });

  test('enforces its raw record budget without returning partial candidates', () => {
    const parser = createUntrackedGitInventoryParser(1);

    parser.consume(ENCODER.encode('first\u0000second\u0000'));

    expect(parser.finish()).toStrictEqual({
      kind: 'failed',
      reason: 'entry-limit-exceeded',
    });
  });
});

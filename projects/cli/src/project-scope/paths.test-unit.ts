// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { MoldeaCliProjectScopeException } from './exception.js';
import { parseMoldeaCliScopePathBytes } from './paths.js';

describe('scope path input', () => {
  test('parses NUL-delimited Unicode paths without interpreting shell text', () => {
    const input = new TextEncoder().encode('/src/😀.ts\0$(touch should-not-run)\0');

    expect(parseMoldeaCliScopePathBytes(input, 2)).toStrictEqual([
      '/src/😀.ts',
      '$(touch should-not-run)',
    ]);
  });

  test('accepts an empty changed-path stream', () => {
    expect(parseMoldeaCliScopePathBytes(new Uint8Array(), 1)).toStrictEqual([]);
  });

  test.each([
    [new TextEncoder().encode('/src/a.ts'), 1],
    [new TextEncoder().encode('/src/a.ts\0\0'), 2],
    [new TextEncoder().encode('/src/a.ts\0/src/b.ts\0'), 1],
    [Uint8Array.from([0xc3, 0x28, 0]), 1],
  ])('rejects malformed or over-limit bytes %#', (input, maxEntries) => {
    expect(() => parseMoldeaCliScopePathBytes(input, maxEntries)).toThrow(
      MoldeaCliProjectScopeException,
    );
  });
});

// @vitest-environment node
import { createHash } from 'node:crypto';

import { describe, expect, test } from 'vitest';

import { createRepositoryIdentity } from './identity.js';

const frameParts = (parts: readonly Uint8Array[]): Uint8Array => {
  const bytes = new Uint8Array(parts.reduce((total, part) => total + 8 + part.byteLength, 0));
  const view = new DataView(bytes.buffer);
  let offset = 0;

  for (const part of parts) {
    const length = BigInt(part.byteLength);
    view.setUint32(offset, Number(length >> 32n), false);
    view.setUint32(offset + 4, Number(length & 0xffffffffn), false);
    bytes.set(part, offset + 8);
    offset += 8 + part.byteLength;
  }

  return bytes;
};

describe('createRepositoryIdentity', () => {
  test.each([
    [[]],
    [[new Uint8Array()]],
    [[new TextEncoder().encode('moldea')]],
    [[new Uint8Array([0, 255]), new Uint8Array([1, 2, 3])]],
  ])('matches SHA-256 for framed parts %#', (parts) => {
    const expected = createHash('sha256').update(frameParts(parts)).digest('hex');

    expect(createRepositoryIdentity(parts)).toBe(`sha256:${expected}`);
  });

  test('preserves part boundaries', () => {
    expect(createRepositoryIdentity([new Uint8Array([1]), new Uint8Array([2])])).not.toBe(
      createRepositoryIdentity([new Uint8Array([1, 2])]),
    );
  });

  test.each([55, 56, 63, 64, 65, 127, 128, 129])(
    'matches SHA-256 across the %d-byte block boundary',
    (byteLength) => {
      const parts = [
        new Uint8Array(byteLength).map((_value, index) => index % 251),
        new Uint8Array([1, 2, 3]),
      ];
      const expected = createHash('sha256').update(frameParts(parts)).digest('hex');

      expect(createRepositoryIdentity(parts)).toBe(`sha256:${expected}`);
    },
  );
});

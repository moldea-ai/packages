const SHA256_INITIAL_STATE = [
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
] as const;

const SHA256_ROUND_CONSTANTS = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

const rotateRight = (value: number, shift: number): number =>
  (value >>> shift) | (value << (32 - shift));

/** Applies one complete 64-byte SHA-256 block to the mutable hash state. */
const processSha256Block = (
  state: number[],
  input: Uint8Array,
  offset: number,
  schedule: Uint32Array,
): void => {
  for (let index = 0; index < 16; index += 1) {
    const wordOffset = offset + index * 4;
    schedule[index] =
      ((input[wordOffset] ?? 0) << 24) |
      ((input[wordOffset + 1] ?? 0) << 16) |
      ((input[wordOffset + 2] ?? 0) << 8) |
      (input[wordOffset + 3] ?? 0);
  }

  for (let index = 16; index < 64; index += 1) {
    const first = schedule[index - 15] ?? 0;
    const second = schedule[index - 2] ?? 0;
    const firstSigma = rotateRight(first, 7) ^ rotateRight(first, 18) ^ (first >>> 3);
    const secondSigma = rotateRight(second, 17) ^ rotateRight(second, 19) ^ (second >>> 10);
    schedule[index] =
      ((schedule[index - 16] ?? 0) + firstSigma + (schedule[index - 7] ?? 0) + secondSigma) >>> 0;
  }

  let a = state[0] ?? 0;
  let b = state[1] ?? 0;
  let c = state[2] ?? 0;
  let d = state[3] ?? 0;
  let e = state[4] ?? 0;
  let f = state[5] ?? 0;
  let g = state[6] ?? 0;
  let h = state[7] ?? 0;

  for (let index = 0; index < 64; index += 1) {
    const sumOne = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
    const choice = (e & f) ^ (~e & g);
    const temporaryOne =
      (h + sumOne + choice + (SHA256_ROUND_CONSTANTS[index] ?? 0) + (schedule[index] ?? 0)) >>> 0;
    const sumZero = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
    const majority = (a & b) ^ (a & c) ^ (b & c);
    const temporaryTwo = (sumZero + majority) >>> 0;

    h = g;
    g = f;
    f = e;
    e = (d + temporaryOne) >>> 0;
    d = c;
    c = b;
    b = a;
    a = (temporaryOne + temporaryTwo) >>> 0;
  }

  state[0] = ((state[0] ?? 0) + a) >>> 0;
  state[1] = ((state[1] ?? 0) + b) >>> 0;
  state[2] = ((state[2] ?? 0) + c) >>> 0;
  state[3] = ((state[3] ?? 0) + d) >>> 0;
  state[4] = ((state[4] ?? 0) + e) >>> 0;
  state[5] = ((state[5] ?? 0) + f) >>> 0;
  state[6] = ((state[6] ?? 0) + g) >>> 0;
  state[7] = ((state[7] ?? 0) + h) >>> 0;
};

/** Computes incrementally framed SHA-256 without retaining a combined input buffer. */
const sha256 = (parts: Iterable<Uint8Array>): Uint8Array => {
  const state: number[] = [...SHA256_INITIAL_STATE];
  const schedule = new Uint32Array(64);
  const pending = new Uint8Array(64);
  let pendingLength = 0;
  let totalByteLength = 0n;

  const update = (input: Uint8Array): void => {
    totalByteLength += BigInt(input.byteLength);
    let offset = 0;

    if (pendingLength > 0) {
      const copied = Math.min(64 - pendingLength, input.byteLength);
      pending.set(input.subarray(0, copied), pendingLength);
      pendingLength += copied;
      offset = copied;

      if (pendingLength === 64) {
        processSha256Block(state, pending, 0, schedule);
        pendingLength = 0;
      }
    }

    while (offset + 64 <= input.byteLength) {
      processSha256Block(state, input, offset, schedule);
      offset += 64;
    }

    if (offset < input.byteLength) {
      pending.set(input.subarray(offset), 0);
      pendingLength = input.byteLength - offset;
    }
  };

  for (const part of parts) {
    const length = BigInt(part.byteLength);
    const lengthPrefix = new Uint8Array(8);
    const lengthView = new DataView(lengthPrefix.buffer);
    lengthView.setUint32(0, Number(length >> 32n), false);
    lengthView.setUint32(4, Number(length & 0xffffffffn), false);
    update(lengthPrefix);
    update(part);
  }

  const finalLength = pendingLength < 56 ? 64 : 128;
  const finalBlocks = new Uint8Array(finalLength);
  finalBlocks.set(pending.subarray(0, pendingLength));
  finalBlocks[pendingLength] = 0x80;
  const bitLength = totalByteLength * 8n;
  const finalView = new DataView(finalBlocks.buffer);
  finalView.setUint32(finalLength - 8, Number(bitLength >> 32n), false);
  finalView.setUint32(finalLength - 4, Number(bitLength & 0xffffffffn), false);

  for (let offset = 0; offset < finalLength; offset += 64) {
    processSha256Block(state, finalBlocks, offset, schedule);
  }

  const digest = new Uint8Array(32);
  const digestView = new DataView(digest.buffer);
  state.forEach((word, index) => digestView.setUint32(index * 4, word, false));

  return digest;
};

/** Produces a collision-resistant identity for repository snapshot data. */
export const createRepositoryIdentity = (parts: Iterable<Uint8Array>): string => {
  const digest = sha256(parts);
  const hex = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');

  return `sha256:${hex}`;
};

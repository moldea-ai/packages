// @vitest-environment node
import { Buffer } from 'node:buffer';

import { describe, expect, test } from 'vitest';

import { CoreOperationException } from '../exceptions/index.js';

import { NODE_INSPECTION_MESSAGE_BYTES } from './constants.js';
import { decodeInspectionMessage, encodeInspectionMessage } from './protocol.js';
import type { INodeInspectionMessage } from './types.js';

const attemptId = 'a'.repeat(32);

describe('bounded private inspection protocol', () => {
  test.each(['plain', 'é漢😀', '"\\\n\r\t\u0000', '\ud800', '\udc00'])(
    'round trips escaped JSON (%s)',
    (result) => {
      const message: INodeInspectionMessage = {
        attemptId,
        kind: 'reader-response',
        requestId: 0,
        result,
      };
      expect(decodeInspectionMessage(encodeInspectionMessage(message))).toStrictEqual(message);
    },
  );

  test('admits the exact frame boundary and refuses one additional byte before serialization', () => {
    const message: INodeInspectionMessage = {
      attemptId,
      kind: 'reader-response',
      requestId: 0,
      result: '',
    };
    const overhead = Buffer.byteLength(JSON.stringify(message));
    message.result = 'x'.repeat(NODE_INSPECTION_MESSAGE_BYTES - overhead);
    expect(Buffer.byteLength(encodeInspectionMessage(message))).toBe(NODE_INSPECTION_MESSAGE_BYTES);
    message.result = 'x'.repeat(NODE_INSPECTION_MESSAGE_BYTES - overhead + 1);
    expect(() => encodeInspectionMessage(message)).toThrow(CoreOperationException);
    expect(() => encodeInspectionMessage(message)).toThrow('A Core resource limit was exceeded.');
  });

  test.each([
    null,
    {},
    { attemptId, kind: 'run', extra: true },
    { attemptId: 'wrong', kind: 'run' },
    { attemptId, kind: 'unknown' },
    {
      attemptId,
      kind: 'reader-request',
      requestId: 0,
      request: { method: 'readFilePage', path: '/file.ts', maxBytes: 65_537, offset: 0 },
    },
    {
      attemptId,
      kind: 'reader-request',
      requestId: 0,
      request: { method: 'getEntry', path: '/../../outside' },
    },
  ])('refuses a malformed closed message (%o)', (message) => {
    expect(() => decodeInspectionMessage(JSON.stringify(message))).toThrow(
      'The isolated project inspection failed.',
    );
  });

  test('refuses an oversized incoming frame before JSON parsing', () => {
    expect(() => decodeInspectionMessage(' '.repeat(NODE_INSPECTION_MESSAGE_BYTES + 1))).toThrow(
      'The isolated project inspection failed.',
    );
  });

  test('refuses cyclic producer input without attempting serialization', () => {
    const result: Record<string, unknown> = {};
    result['self'] = result;
    expect(() =>
      encodeInspectionMessage({ attemptId, kind: 'reader-response', requestId: 0, result }),
    ).toThrow('The isolated project inspection failed.');
  });
});

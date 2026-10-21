// @vitest-environment node
import { expectToThrowCode } from 'jg-exception/testing';
import { ERRORS } from 'jg-utilities';
import { describe, expect, test } from 'vitest';

import { serializeMoldeaCliJsonEnvelope } from './document.js';

/** Serializes one envelope around a result. */
const serializeResult = (result: unknown): string =>
  serializeMoldeaCliJsonEnvelope({
    cliVersion: '13.0.0',
    command: 'validate',
    error: null,
    result,
    status: 'valid',
  });

describe('serializeMoldeaCliJsonEnvelope', () => {
  test('orders every object key by UTF-16 code unit, as RFC 8785 does', () => {
    expect(
      serializeResult({
        '': 'private-use',
        '\u{10000}': 'astral',
        nested: { '2': 'two', '10': 'ten', a: true },
        array: [{ z: 2, a: 1 }, null],
      }),
    ).toBe(
      '{"cliVersion":"13.0.0","command":"validate","error":null,"result":{"array":[{"a":1,"z":2},null],"nested":{"10":"ten","2":"two","a":true},"\u{10000}":"astral","\ue000":"private-use"},"schemaVersion":7,"status":"valid"}\n',
    );
  });

  test('writes negative zero as zero and escapes strings as JSON does', () => {
    expect(serializeResult({ negativeZero: -0, text: 'line\n"quoted"\\end' })).toBe(
      '{"cliVersion":"13.0.0","command":"validate","error":null,"result":{"negativeZero":0,"text":"line\\n\\"quoted\\"\\\\end"},"schemaVersion":7,"status":"valid"}\n',
    );
  });

  test.each([
    undefined,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    1n,
    Symbol('unsupported'),
    () => undefined,
    new Date(0),
    new Map(),
    new Array(1),
  ])('refuses the result value %s instead of changing its shape', (value) => {
    expectToThrowCode(() => serializeResult({ value }), ERRORS.UNABLE_TO_SERIALIZE_JSON);
  });

  test('refuses cycles and symbol keys', () => {
    const cyclicRecord: Record<string, unknown> = {};
    cyclicRecord['self'] = cyclicRecord;
    const symbolRecord = { ordinary: true };
    Object.defineProperty(symbolRecord, Symbol('private'), { enumerable: true, value: true });

    expectToThrowCode(() => serializeResult(cyclicRecord), ERRORS.UNABLE_TO_SERIALIZE_JSON);
    expectToThrowCode(() => serializeResult(symbolRecord), ERRORS.UNABLE_TO_SERIALIZE_JSON);
  });
});

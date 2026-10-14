// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { assertRecordedOutput, createRecordedOutput } from './index.ts';

describe('complete recorded output', () => {
  test('rejects absent responses and fields that JSON would silently omit', () => {
    expect(() => createRecordedOutput([])).toThrow('must contain an executed response');
    expect(() => createRecordedOutput([{ lost: undefined }])).toThrow(
      'must contain only JSON values',
    );
  });

  test('redacts an array element while rejecting its non-JSON length property', () => {
    const response = { entries: [{ path: '/private/synthetic' }] };
    const output = createRecordedOutput([response], 'response', [
      { responseIndex: 0, pointer: '/entries/0/path', reason: 'host path' },
    ]);
    expect(output.responses).toStrictEqual([{ entries: [{ path: '[redacted: host path]' }] }]);
    expect(() =>
      createRecordedOutput([response], 'response', [
        { responseIndex: 0, pointer: '/entries/length', reason: 'host path' },
      ]),
    ).toThrow('target does not exist');
  });

  test('retains every nested field and each page in execution order', () => {
    const responses = [
      { page: { records: [{ code: 'MISSING', extra: true }], cursor: 'next' } },
      { page: { records: [], cursor: null } },
    ];
    const output = createRecordedOutput(responses);
    expect(output.responses).toStrictEqual(responses);
    expect(() => assertRecordedOutput(responses, output)).not.toThrow();
    output.responses.reverse();
    expect(() => assertRecordedOutput(responses, output)).toThrow('complete executed response');
  });

  test('rejects a missing non-redacted field', () => {
    const responses = [{ valid: false, counts: { errors: 1, warnings: 2 } }];
    const output = createRecordedOutput(responses);
    output.responses = [{ valid: false, counts: { errors: 1 } }];
    expect(() => assertRecordedOutput(responses, output)).toThrow('complete executed response');
  });

  test('replaces only the declared field without mutating its executed source', () => {
    const responses = [
      { source: { root: '/private/synthetic', kind: 'fixture' }, 'a/b': { '~key': 'hidden' } },
    ];
    const output = createRecordedOutput(responses, 'response', [
      { responseIndex: 0, pointer: '/source/root', reason: 'host path' },
      { responseIndex: 0, pointer: '/a~1b/~0key', reason: 'private field' },
    ]);
    expect(output.responses).toStrictEqual([
      {
        source: { root: '[redacted: host path]', kind: 'fixture' },
        'a/b': { '~key': '[redacted: private field]' },
      },
    ]);
    expect(responses[0]?.source.root).toBe('/private/synthetic');
    expect(() => assertRecordedOutput(responses, output)).not.toThrow();
  });

  test.each([
    { responseIndex: 0, pointer: '/absent', reason: 'host path' },
    { responseIndex: 1, pointer: '/source', reason: 'host path' },
    { responseIndex: 0, pointer: '/source~2', reason: 'host path' },
    { responseIndex: 0, pointer: '/source', reason: '' },
  ])('rejects an invalid redaction %o', (redaction) => {
    expect(() => createRecordedOutput([{ source: 'fixture' }], 'response', [redaction])).toThrow();
  });
});

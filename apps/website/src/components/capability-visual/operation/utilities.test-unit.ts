// @vitest-environment node
import { expect, test } from 'vitest';
import { getOperationRows } from './utilities.ts';

test('keeps canonical text and byte boundaries together', () => {
  expect(
    getOperationRows({ chunks: [{ byteStart: 3, byteEnd: 7, content: 'é r', isComplete: false }] }),
  ).toStrictEqual([
    { label: 'Bytes 3 to 7', entries: ['é r'], detail: 'Continues at the next byte offset' },
  ]);
  expect(() => getOperationRows({ chunks: [{ content: 'invented range' }] })).toThrow(
    'actual byte ranges',
  );
});

test('shows actual page records and continuation without claiming validation success', () => {
  expect(
    getOperationRows({
      pages: [{ entries: [{ path: '/policy.md', type: 'file' }], hasContinuation: true }],
    }),
  ).toStrictEqual([
    { label: 'Page 1', entries: ['/policy.md (file)'], detail: 'More pages follow' },
  ]);
  expect(() => getOperationRows({ pages: [{ records: [{}], hasContinuation: false }] })).toThrow(
    'record identity',
  );
});

test('keeps range bytes literal and reports refusal facts', () => {
  expect(
    getOperationRows({ firstRange: { offset: 0, bytes: [51, 48], totalBytes: 8 } }),
  ).toStrictEqual([
    {
      label: 'First Range',
      entries: ['Offset 0; 2 of 8 bytes', '33 30'],
      detail: 'Returned bytes in hexadecimal',
    },
  ]);
  expect(getOperationRows({ code: 'ABORTED', retryable: false })).toStrictEqual([
    { label: 'Code', entries: ['ABORTED'], detail: '' },
    { label: 'Retryable', entries: ['No'], detail: '' },
  ]);
  expect(() => getOperationRows({ range: { offset: 0, bytes: [256], totalBytes: 1 } })).toThrow(
    'actual bytes',
  );
});

test('refuses to invent pagination or selection facts', () => {
  expect(() => getOperationRows({ pages: [{ records: [{ path: '/policy.md' }] }] })).toThrow(
    'actual continuation',
  );
  expect(() => getOperationRows({ selected: [{}] })).toThrow('actual paths');
  expect(() => getOperationRows({ chunks: [{ byteStart: 0, byteEnd: 1, content: 'a' }] })).toThrow(
    'actual byte ranges',
  );
});

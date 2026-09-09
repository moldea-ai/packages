// @vitest-environment node
import { expect, test } from 'vitest';

import { CliCollectionResult } from './types.ts';
import { parseCliExecution } from './validations.ts';

const envelope = {
  cliVersion: '7.0.1',
  command: 'validate',
  schemaVersion: 4,
  status: 'valid',
  error: null,
  result: { valid: true },
};

test.each([
  ['valid', 0, false],
  ['invalid', 1, false],
  ['error', 2, true],
  ['error', 3, true],
])('parseCliExecution(%s, %d) -> accepted', (status, exitStatus, isError) => {
  const output = {
    ...envelope,
    status,
    result: isError ? null : { valid: status === 'valid' },
    error: isError
      ? {
          source: 'cli',
          code: 'CONTENT_PATH_INVALID',
          message: 'The content path must identify one canonical moldea text asset.',
          path: null,
          retryable: false,
        }
      : null,
  };
  expect(
    parseCliExecution({ stdout: JSON.stringify(output), exitStatus }, 'validate', '7.0.1'),
  ).toStrictEqual(output);
});

test.each([
  [{ schemaVersion: 3 }, 0],
  [{ status: 'invalid' }, 0],
  [{ status: 'valid' }, 1],
  [{ command: 'scope' }, 0],
  [{ cliVersion: '0.0.0' }, 0],
  [{ result: null }, 0],
  [{ status: 'error', result: null }, 3],
  [{ result: { content: 'Unrequested body' } }, 0],
])('parseCliExecution(%o, %d) -> rejected', (changes, exitStatus) => {
  expect(() =>
    parseCliExecution(
      { stdout: JSON.stringify({ ...envelope, ...changes }), exitStatus },
      'validate',
      '7.0.1',
    ),
  ).toThrow();
});

test('refuses partial success alongside an operational error', () => {
  expect(() =>
    parseCliExecution(
      {
        stdout: JSON.stringify({
          ...envelope,
          status: 'error',
          error: {
            source: 'cli',
            code: 'CONTENT_PATH_INVALID',
            message: 'The content path must identify one canonical moldea text asset.',
            path: null,
            retryable: false,
          },
        }),
        exitStatus: 3,
      },
      'validate',
      '7.0.1',
    ),
  ).toThrow('unexpected facts');
});

test('retains selected command facts and strips unknown host/process fields', () => {
  expect(
    CliCollectionResult.parse({
      valid: true,
      counts: { matchedPaths: 1, processId: 123 },
      hostPath: 'not-for-publication',
      page: {
        cursor: null,
        records: [
          { kind: 'metadata', path: '/moldea/project.md', hostPath: 'not-for-publication' },
        ],
      },
    }),
  ).toStrictEqual({
    valid: true,
    counts: { matchedPaths: 1 },
    page: { cursor: null, records: [{ kind: 'metadata', path: '/moldea/project.md' }] },
  });
});

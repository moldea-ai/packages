// @vitest-environment node
import { expect, test } from 'vitest';

import type { ICapabilityFact } from '../index.ts';

import { CliCollectionResult } from './types.ts';
import { assertCliResultExcerpt, parseCliExecution } from './validations.ts';

const envelope = {
  cliVersion: '9.0.0',
  command: 'validate',
  schemaVersion: 5,
  status: 'valid',
  error: null,
  result: { valid: true },
};

test('accepts only true fields and prefix records from an executed CLI result', () => {
  const result = { valid: true, page: { records: [{ kind: 'diagnostic', code: 'A' }] } };
  expect(() =>
    assertCliResultExcerpt(result, {
      valid: true,
      page: { records: [{ kind: 'diagnostic' }] },
    }),
  ).not.toThrow();
  const invalidExcerpts: ICapabilityFact[] = [
    { valid: true, diagnostics: [] },
    { valid: true, page: { records: [{ code: 'B' }] } },
    { valid: true, page: { records: [{ code: 'A' }, { code: 'B' }] } },
  ];
  for (const excerpt of invalidExcerpts) {
    expect(() => assertCliResultExcerpt(result, excerpt)).toThrow(
      'does not match the executed response',
    );
  }
});

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
    parseCliExecution({ stdout: JSON.stringify(output), exitStatus }, 'validate', '9.0.0'),
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
      '9.0.0',
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
      '9.0.0',
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

const warningRecord = {
  code: 'ANTHROPIC_RUNTIME_RELATIONSHIP_UNVERIFIED',
  details: {
    boundaryVersion: '1.2.3',
    declaredRange: null,
    packageName: '@anthropic-ai/sdk',
    reason: 'version-dependent-behavior',
    relationship: 'instruction-loader',
  },
  entity: { agentId: 'support' },
  key: 'warning-1',
  kind: 'diagnostic',
  message: 'The declared runtime relationship could not be verified.',
  path: '/src/agent.ts',
  pointer: null,
  range: null,
  severity: 'warning',
  source: 'anthropic',
};

test('accepts the closed warning record and complete validation counts', () => {
  expect(
    CliCollectionResult.parse({
      valid: true,
      diagnosticCount: 1,
      errorCount: 0,
      warningCount: 1,
      page: { cursor: null, records: [warningRecord] },
    }),
  ).toMatchObject({
    valid: true,
    errorCount: 0,
    warningCount: 1,
    page: { records: [warningRecord] },
  });
});

test.each([
  ['missing severity', { severity: undefined }],
  ['error severity with warning details', { severity: 'error' }],
  ['missing warning details', { details: undefined }],
  ['extra warning detail', { details: { ...warningRecord.details, sourceText: 'private' } }],
  ['unknown relationship', { details: { ...warningRecord.details, relationship: 'provider-run' } }],
])('rejects a diagnostic record with %s', (_description, changes) => {
  expect(() =>
    CliCollectionResult.parse({
      valid: true,
      page: { cursor: null, records: [{ ...warningRecord, ...changes }] },
    }),
  ).toThrow();
});

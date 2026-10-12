// @vitest-environment node
import { expect, test } from 'vitest';

import type { ICapabilityFact } from '../index.ts';

import { CliCollectionResult } from './types.ts';
import { assertCliResultExcerpt, parseCliExecution } from './validations.ts';

const envelope = {
  cliVersion: '11.0.0',
  command: 'validate',
  schemaVersion: 7,
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
    parseCliExecution({ stdout: JSON.stringify(output), exitStatus }, 'validate', '11.0.0'),
  ).toStrictEqual(output);
});

test.each([
  [{ schemaVersion: 6 }, 0],
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
      '11.0.0',
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
      '11.0.0',
    ),
  ).toThrow('unexpected facts');
});

test('retains selected command facts and rejects unknown collection fields', () => {
  const metadata = {
    agentId: null,
    byteLength: 16,
    canonicalDigest: null,
    decisionId: null,
    digest: 'abc123',
    key: 'metadata-1',
    kind: 'metadata',
    metadataKind: 'project',
    path: '/moldea/project.md',
    scalarLength: 16,
  };
  const result = {
    valid: true,
    counts: { matchedPaths: 1 },
    page: { cursor: null, records: [metadata] },
  };
  expect(CliCollectionResult.parse(result)).toStrictEqual(result);
  expect(
    CliCollectionResult.safeParse({ ...result, hostPath: 'not-for-publication' }).success,
  ).toBe(false);
  expect(
    CliCollectionResult.safeParse({ ...result, counts: { matchedPaths: 1, processId: 123 } })
      .success,
  ).toBe(false);
  expect(
    CliCollectionResult.safeParse({
      ...result,
      page: { cursor: null, records: [{ ...metadata, hostPath: 'not-for-publication' }] },
    }).success,
  ).toBe(false);
});

const warningRecord = {
  code: 'MOLDEA_IMPACT_PATTERN_UNMATCHED',
  group: 'references',
  subject: '/moldea/project.md',
  qualifier: '/src/future/**',
  acceptable: true,
  accepted: false,
  reason: null,
  entity: { contextPath: '/moldea/project.md' },
  key: 'warning-1',
  kind: 'diagnostic',
  message: 'The impact pattern matches no files.',
  path: '/moldea/moldea.yaml',
  pointer: null,
  range: null,
  severity: 'warning',
  source: 'core',
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
  ['error severity with warning fields', { severity: 'error' }],
  ['missing subject', { subject: undefined }],
  ['extra private field', { sourceText: 'private' }],
  ['unknown group', { group: 'provider-run' }],
])('rejects a diagnostic record with %s', (_description, changes) => {
  expect(() =>
    CliCollectionResult.parse({
      valid: true,
      page: { cursor: null, records: [{ ...warningRecord, ...changes }] },
    }),
  ).toThrow();
});

test('validates complete schema 7 coverage records without dropping fields', () => {
  const coverage = {
    entity: { contextPath: '/moldea/project.md' },
    relationship: 'context-binding',
    kind: 'coverage',
    key: 'coverage-1',
    path: '/src/returns/policy.ts',
    symbol: 'checkEligibility',
    fileCheck: 'passed',
    exportCheck: 'failed',
  };
  const collection = {
    valid: false,
    coverageCounts: {
      bindings: 1,
      exportsPassed: 0,
      exportsFailed: 1,
      exportsNotChecked: 0,
    },
    page: { cursor: null, records: [coverage] },
  };
  expect(CliCollectionResult.parse(collection).page.records).toStrictEqual([coverage]);
  expect(
    CliCollectionResult.safeParse({
      ...collection,
      page: { cursor: null, records: [{ ...coverage, hostPath: '/private/source.ts' }] },
    }).success,
  ).toBe(false);
  expect(
    CliCollectionResult.safeParse({
      ...collection,
      page: { cursor: null, records: [{ ...coverage, exportCheck: 'not-checked' }] },
    }).success,
  ).toBe(false);
});

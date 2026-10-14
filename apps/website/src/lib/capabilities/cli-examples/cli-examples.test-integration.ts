// @vitest-environment node
import { fileURLToPath } from 'node:url';

import { beforeAll, expect, test } from 'vitest';

import { discoverPublicPackages } from '../../generation/generation.ts';
import type { IPublicPackage } from '../../model/types.ts';
import type { ICapabilityCase } from '../index.ts';

import { createCliExamples } from './cli-examples.ts';
import { CliCollectionResult, CliEnvelope } from './types.ts';

const repositoryRoot = fileURLToPath(new URL('../../../../../../', import.meta.url));
let packages: IPublicPackage[];
let examples: ICapabilityCase[];
beforeAll(async () => {
  packages = discoverPublicPackages(repositoryRoot);
  examples = await createCliExamples(repositoryRoot, packages);
});

test('executes every public command with actual schema 7 status and process outcomes', () => {
  expect(examples).toHaveLength(11);
  expect(
    examples.map(({ result }) =>
      result.kind === 'cli' ? [result.schemaVersion, result.status, result.exitStatus] : null,
    ),
  ).toStrictEqual([
    [7, 'valid', 0],
    [7, 'valid', 0],
    [7, 'valid', 0],
    [7, 'valid', 0],
    [7, 'valid', 0],
    [7, 'valid', 0],
    [7, 'error', 3],
    [7, 'valid', 0],
    [7, 'invalid', 1],
    [7, 'valid', 0],
    [7, 'valid', 0],
  ]);
});

test.each([
  ['cli-pattern-warning', 1, 0],
  ['cli-accepted-warning', 0, 1],
])(
  'publishes %s with a successful exit and separate warning counts',
  (id, warningCount, acceptedWarningCount) => {
    expect(examples.find((example) => example.id === id)?.result).toMatchObject({
      kind: 'cli',
      schemaVersion: 7,
      status: 'valid',
      exitStatus: 0,
      facts: {
        valid: true,
        diagnosticCount: 1,
        errorCount: 0,
        warningCount,
        acceptedWarningCount,
        diagnostics: [
          {
            code: 'MOLDEA_IMPACT_PATTERN_UNMATCHED',
            group: 'references',
            subject: '/moldea/project.md',
            qualifier: '/src/future/**',
            acceptable: true,
            accepted: acceptedWarningCount === 1,
          },
        ],
      },
    });
  },
);
test('distinguishes a failed check from an operational refusal', () => {
  expect(examples.find(({ id }) => id === 'cli-invalid-project')?.result).toMatchObject({
    kind: 'cli',
    status: 'invalid',
    exitStatus: 1,
    facts: {
      valid: false,
      coverageCounts: { bindings: 1, exportsPassed: 0, exportsFailed: 1, exportsNotChecked: 0 },
      coverage: {
        path: '/src/returns/policy.ts',
        symbol: 'checkEligibility',
        exportCheck: 'failed',
      },
      diagnostics: [{ code: 'MOLDEA_REFERENCE_EXPORT_MISSING' }],
    },
  });
});

test('retains all native envelope keys and full diagnostic/coverage records', () => {
  const example = examples.find(({ id }) => id === 'cli-invalid-project')!;
  const envelope = CliEnvelope.parse(example.output.responses[0]);
  expect(Object.keys(envelope).sort()).toStrictEqual([
    'cliVersion',
    'command',
    'error',
    'result',
    'schemaVersion',
    'status',
  ]);
  expect(envelope).toMatchObject({
    schemaVersion: 7,
    command: 'validate',
    status: 'invalid',
    error: null,
    result: {
      coverageCounts: { bindings: 1, exportsPassed: 0, exportsFailed: 1, exportsNotChecked: 0 },
      page: {
        cursor: null,
        records: [
          {
            kind: 'diagnostic',
            code: 'MOLDEA_REFERENCE_EXPORT_MISSING',
            severity: 'error',
            message: 'The referenced export is missing.',
          },
          {
            kind: 'coverage',
            exportCheck: 'failed',
            fileCheck: 'passed',
            symbol: 'checkEligibility',
          },
        ],
      },
    },
  });
});

test('rejects misplaced coverage totals in the CLI collection schema', () => {
  const result = {
    valid: false,
    counts: { coverage: 1 },
    coverageCounts: { bindings: 1, exportsPassed: 0, exportsFailed: 1, exportsNotChecked: 0 },
    page: { cursor: null, records: [] },
  };
  expect(CliCollectionResult.safeParse(result).success).toBe(true);
  expect(
    CliCollectionResult.safeParse({ ...result, counts: { ...result.counts, exportsFailed: 1 } })
      .success,
  ).toBe(false);
  expect(CliCollectionResult.safeParse({ ...result, unknownField: true }).success).toBe(false);
});

test('exercises both changed-path inputs and Git selection without exposing document bodies', () => {
  expect(examples.find(({ id }) => id === 'cli-scope-path')?.result).toMatchObject({
    kind: 'cli',
    facts: { relevant: true, counts: { inputPaths: 1, matchedPaths: 1 } },
  });
  expect(examples.find(({ id }) => id === 'cli-scope-stdin')?.result).toMatchObject({
    kind: 'cli',
    facts: { relevant: true, counts: { inputPaths: 2, matchedPaths: 1 } },
  });
  expect(examples.find(({ id }) => id === 'cli-inspect-selection')?.result).toMatchObject({
    kind: 'cli',
    facts: {
      paths: [
        '/moldea/context/long-policy.md',
        '/moldea/context/tracked.md',
        '/moldea/context/untracked.md',
        '/moldea/moldea.yaml',
        '/moldea/project.md',
      ],
    },
  });
  for (const example of examples.filter(({ operation }) => operation !== 'content'))
    expect(JSON.stringify(example.result)).not.toMatch(/"content":/u);
});

test('reconstructs bounded content, checks installed composition, and leaves Git/files untouched on every run', async () => {
  const repeated = await createCliExamples(repositoryRoot, packages);
  expect(repeated).toStrictEqual(examples);
  expect(examples.find(({ id }) => id === 'cli-content-continuation')?.result).toMatchObject({
    kind: 'cli',
    facts: {
      chunks: [
        { byteStart: 0, byteEnd: 2048, totalBytes: 7040, hasContinuation: true },
        { byteStart: 2048, byteEnd: 4096, totalBytes: 7040, hasContinuation: true },
        { byteStart: 4096, byteEnd: 6144, totalBytes: 7040, hasContinuation: true },
        { byteStart: 6144, byteEnd: 7040, totalBytes: 7040, hasContinuation: false },
      ],
    },
  });
  const serialized = JSON.stringify(repeated);
  expect(serialized).not.toContain(repositoryRoot);
  expect(serialized).not.toMatch(/moldea-capabilities-|"processId":/u);
});

test('fails before running fixture commands when the public CLI package is absent', async () => {
  await expect(
    createCliExamples(
      repositoryRoot,
      packages.filter(({ name }) => name !== '@moldea.ai/cli'),
    ),
  ).rejects.toThrow('CLI capability package is unavailable');
});

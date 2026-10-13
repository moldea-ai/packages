// @vitest-environment node
import { expect, test } from 'vitest';

import { createRecordedOutput, type ICapabilityCase } from '../../../lib/capabilities/index.ts';

import { getCapabilityInspectionView } from './index.ts';

const diagnostic = {
  code: 'MOLDEA_REFERENCE_MISSING' as const,
  severity: 'error' as const,
  group: 'references' as const,
  source: 'core' as const,
  message: 'The referenced repository path does not exist.',
  path: '/moldea/moldea.yaml',
  pointer: '/context/policy/bindings/0',
  details: { referencedPath: '/src/missing.ts' },
};
const example: ICapabilityCase = {
  id: 'fixture',
  groupId: 'command-line',
  title: 'Check a declared connection',
  description: 'A synthetic check.',
  limitation: 'A structural check.',
  packageName: '@moldea.ai/cli',
  operation: 'validate',
  sourcePaths: [],
  files: [
    {
      path: '/moldea/moldea.yaml',
      language: 'yaml',
      content: 'version: 1\n',
      isExcerpt: false,
      representation: 'source',
    },
  ],
  result: {
    kind: 'cli',
    command: 'moldea validate --json',
    schemaVersion: 7,
    status: 'invalid',
    exitStatus: 1,
    facts: {},
  },
  output: createRecordedOutput([
    {
      cliVersion: '11.0.2',
      schemaVersion: 7,
      command: 'validate',
      status: 'invalid',
      error: null,
      result: {
        valid: false,
        diagnosticCount: 1,
        page: { cursor: null, records: [{ kind: 'diagnostic', ...diagnostic }] },
      },
    },
  ]),
};

test('retains the complete native response and keeps CLI process context outside it', () => {
  const view = getCapabilityInspectionView(example);
  expect(JSON.parse(view.output)).toStrictEqual(example.output.responses[0]);
  expect(JSON.parse(view.output)).not.toHaveProperty('exitStatus');
  expect(view).toMatchObject({
    command: 'moldea validate --json',
    exitStatus: 1,
    label: 'Invalid',
    tone: 'danger',
  });
  expect(view.findings).toHaveLength(1);
  expect(view.findings[0]).toMatchObject({
    code: diagnostic.code,
    message: diagnostic.message,
    severity: 'error',
    group: 'references',
  });
});

test('shows source evidence without inventing content for an unavailable target', () => {
  const view = getCapabilityInspectionView({
    ...example,
    result: { kind: 'inspection', facts: {} },
    output: createRecordedOutput([
      { page: { records: [{ item: { kind: 'diagnostic', diagnostic } }] } },
    ]),
  });
  expect(view.findings[0]?.evidence).toStrictEqual([
    { path: '/moldea/moldea.yaml', content: 'version: 1\n', language: 'yaml', isExcerpt: false },
    { path: '/src/missing.ts', label: 'Referenced target', language: 'text' },
  ]);
});

test('keeps paginated errors, accepted warnings and their reasons in source order', () => {
  const warning = {
    ...diagnostic,
    code: 'MOLDEA_IMPACT_PATTERN_UNMATCHED',
    severity: 'warning',
    accepted: true,
    reason: 'The planned module is intentionally absent.',
  };
  const responses = [diagnostic, warning].map((record) => ({
    counts: { diagnostics: 2 },
    page: { records: [{ item: { kind: 'diagnostic', diagnostic: record } }] },
  }));
  const view = getCapabilityInspectionView({
    ...example,
    result: { kind: 'inspection', facts: {} },
    output: createRecordedOutput(responses),
  });
  expect(
    view.findings.map(({ code, severity, accepted, reason }) => ({
      code,
      severity,
      accepted,
      reason,
    })),
  ).toStrictEqual([
    { code: diagnostic.code, severity: 'error', accepted: undefined, reason: undefined },
    { code: warning.code, severity: 'warning', accepted: true, reason: warning.reason },
  ]);
  expect(JSON.parse(view.output)).toStrictEqual(responses);
});

test('keeps an operational refusal neutral about whether the project passed inspection', () => {
  const facts = { code: 'RESOURCE_LIMIT_EXCEEDED' };
  const view = getCapabilityInspectionView({
    ...example,
    result: { kind: 'reader', facts },
    output: createRecordedOutput([facts], 'execution-facts'),
  });
  expect(view).toMatchObject({
    label: 'Refused',
    tone: 'warning',
    findings: [],
    outputLabel: 'Execution facts',
  });
});

test('rejects unsupported diagnostic groups instead of guessing a category', () => {
  expect(() =>
    getCapabilityInspectionView({
      ...example,
      output: createRecordedOutput([
        {
          result: { page: { records: [{ kind: 'diagnostic', ...diagnostic, group: 'provider' }] } },
        },
      ]),
    }),
  ).toThrow();
});

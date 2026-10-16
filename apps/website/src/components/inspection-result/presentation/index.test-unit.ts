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
    label: 'Blocking',
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
    {
      path: '/src/missing.ts',
      label: 'Referenced target',
      language: 'text',
      isMissing: true,
      issueLabel: 'Missing target',
    },
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
    code: 'RESOURCE_LIMIT_EXCEEDED',
    outputLabel: 'Execution facts',
  });
});

test('gives a CLI refusal the native error code from its envelope', () => {
  const error = { code: 'CONTENT_PATH_INVALID', message: 'Not a knowledge document.' };
  const view = getCapabilityInspectionView({
    ...example,
    result: {
      kind: 'cli',
      command: 'moldea content --path /src/returns/policy.ts --json',
      schemaVersion: 7,
      status: 'error',
      exitStatus: 2,
      facts: { error },
    },
    output: createRecordedOutput([
      {
        cliVersion: '11.0.2',
        schemaVersion: 7,
        command: 'content',
        status: 'error',
        error,
        result: null,
      },
    ]),
  });
  expect(view).toMatchObject({ label: 'Refused', findings: [], code: 'CONTENT_PATH_INVALID' });
});

test('keeps a result code off outcomes that report findings or completed work', () => {
  expect(getCapabilityInspectionView(example)).not.toHaveProperty('code');
  expect(
    getCapabilityInspectionView({
      ...example,
      result: { kind: 'reader', facts: { entryCount: 2 } },
    }),
  ).not.toHaveProperty('code');
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

test('does not mark an unprovided source missing when validation only reports an absent export', () => {
  const exportDiagnostic = {
    ...diagnostic,
    code: 'MOLDEA_REFERENCE_EXPORT_MISSING',
    message: 'The referenced export is missing.',
  };
  const view = getCapabilityInspectionView({
    ...example,
    output: createRecordedOutput([
      { result: { page: { records: [{ kind: 'diagnostic', ...exportDiagnostic }] } } },
    ]),
  });
  expect(view.findings[0]?.evidence[1]).toStrictEqual({
    path: '/src/missing.ts',
    label: 'Referenced target',
    language: 'text',
    isMissing: false,
    issueLabel: 'Missing export',
  });
});

test('marks the implementation with a missing export while keeping its declaration neutral', () => {
  const view = getCapabilityInspectionView({
    ...example,
    files: [
      ...example.files,
      {
        path: '/src/missing.ts',
        language: 'typescript',
        content: 'export const otherRule = () => true;',
        isExcerpt: false,
        representation: 'source',
      },
    ],
    output: createRecordedOutput([
      {
        result: {
          page: {
            records: [
              { kind: 'diagnostic', ...diagnostic, code: 'MOLDEA_REFERENCE_EXPORT_MISSING' },
            ],
          },
        },
      },
    ]),
  });
  expect(view.findings[0]?.path).toBe('/moldea/moldea.yaml');
  expect(view.findings[0]?.evidence[0]).not.toHaveProperty('issueLabel');
  expect(view.findings[0]?.evidence[1]).toMatchObject({
    path: '/src/missing.ts',
    issueLabel: 'Missing export',
    content: 'export const otherRule = () => true;',
  });
});

test('locates the CLI missing export using its separately captured failed coverage record', () => {
  const record = {
    code: diagnostic.code,
    source: diagnostic.source,
    group: diagnostic.group,
    severity: diagnostic.severity,
    message: diagnostic.message,
    path: diagnostic.path,
    pointer: diagnostic.pointer,
  };
  const view = getCapabilityInspectionView({
    ...example,
    result: {
      ...example.result,
      kind: 'cli',
      command: 'moldea validate --json',
      schemaVersion: 7,
      status: 'invalid',
      exitStatus: 1,
      facts: {
        coverage: { path: '/src/missing.ts', symbol: 'checkEligibility', exportCheck: 'failed' },
      },
    },
    files: [
      ...example.files,
      {
        path: '/src/missing.ts',
        language: 'typescript',
        content: 'export const otherRule = () => true;',
        isExcerpt: false,
        representation: 'source',
      },
    ],
    output: createRecordedOutput([
      {
        result: {
          page: {
            records: [{ kind: 'diagnostic', ...record, code: 'MOLDEA_REFERENCE_EXPORT_MISSING' }],
          },
        },
      },
    ]),
  });
  expect(view.findings[0]?.evidence[0]).not.toHaveProperty('issueLabel');
  expect(view.findings[0]?.evidence[1]).toMatchObject({
    path: '/src/missing.ts',
    issueLabel: 'Missing export',
  });
});

test('does not assign one coverage target to several missing-export diagnostics', () => {
  const record = {
    code: diagnostic.code,
    source: diagnostic.source,
    group: diagnostic.group,
    severity: diagnostic.severity,
    message: diagnostic.message,
    path: diagnostic.path,
    pointer: diagnostic.pointer,
  };
  const view = getCapabilityInspectionView({
    ...example,
    result: {
      ...example.result,
      kind: 'cli',
      command: 'moldea validate --json',
      schemaVersion: 7,
      status: 'invalid',
      exitStatus: 1,
      facts: { coverage: { path: '/src/missing.ts', exportCheck: 'failed' } },
    },
    output: createRecordedOutput([
      {
        result: {
          page: {
            records: [0, 1].map((index) => ({
              kind: 'diagnostic',
              ...record,
              code: 'MOLDEA_REFERENCE_EXPORT_MISSING',
              pointer: `/context/policy/bindings/${index}`,
            })),
          },
        },
      },
    ]),
  });
  expect(view.findings).toHaveLength(2);
  expect(
    view.findings
      .flatMap((finding) => finding.evidence)
      .some((file) => file.issueLabel !== undefined),
  ).toBe(false);
});

test('does not mark supporting skill files as the issue when the managed block is stale', () => {
  const view = getCapabilityInspectionView({
    ...example,
    files: [
      ...example.files,
      {
        path: '/AGENTS.md',
        language: 'markdown',
        content: 'Stale managed block.',
        isExcerpt: false,
        representation: 'source',
      },
    ],
    output: createRecordedOutput([
      {
        result: {
          page: {
            records: [
              {
                kind: 'diagnostic',
                ...diagnostic,
                code: 'MOLDEA_INTEGRATION_BLOCK_STALE',
                severity: 'warning',
                group: 'integration',
                path: '/AGENTS.md',
                details: { referencedPath: '/.agents/skills/moldea' },
              },
            ],
          },
        },
      },
    ]),
  });
  expect(view.findings[0]?.evidence.filter((file) => file.issueLabel !== undefined)).toStrictEqual([
    {
      path: '/AGENTS.md',
      language: 'markdown',
      content: 'Stale managed block.',
      isExcerpt: false,
      issueLabel: 'Needs attention',
    },
  ]);
});

test('distinguishes a missing implementation from a target that exists as a directory', () => {
  const view = getCapabilityInspectionView({
    ...example,
    output: createRecordedOutput([
      {
        result: {
          page: {
            records: [
              {
                kind: 'diagnostic',
                ...diagnostic,
                code: 'MOLDEA_TOOL_IMPLEMENTATION_MISSING',
                details: {
                  referencedPath: '/src/missing.ts',
                  actualType: 'directory',
                  reason: 'not-file',
                },
              },
            ],
          },
        },
      },
    ]),
  });
  expect(view.findings[0]?.evidence[1]).toMatchObject({
    isMissing: false,
    issueLabel: 'Needs correction',
  });
});

test('identifies the proven missing skill file rather than its existing parent directory', () => {
  const view = getCapabilityInspectionView({
    ...example,
    output: createRecordedOutput([
      {
        result: {
          page: {
            records: [
              {
                kind: 'diagnostic',
                ...diagnostic,
                code: 'MOLDEA_INTEGRATION_SKILL_MISSING',
                details: {
                  referencedPath: '/.agents/skills/moldea',
                  missingFile: '/.agents/skills/moldea/SKILL.md',
                  entryKind: 'missing',
                },
              },
            ],
          },
        },
      },
    ]),
  });
  expect(view.findings[0]?.evidence[1]).toMatchObject({
    path: '/.agents/skills/moldea/SKILL.md',
    isMissing: true,
    issueLabel: 'Missing target',
  });
});

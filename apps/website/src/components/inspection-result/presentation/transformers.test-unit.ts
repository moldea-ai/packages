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

test('retains the native diagnostic record without projecting its CLI envelope into the view', () => {
  const view = getCapabilityInspectionView(example);
  expect(view).toMatchObject({
    label: 'Blocking',
    tone: 'danger',
  });
  expect(view.findings).toHaveLength(1);
  expect(view.findings[0]?.record).toStrictEqual({ kind: 'diagnostic', ...diagnostic });
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
  expect(view.findings[0]?.declaration).toStrictEqual({
    path: '/moldea/moldea.yaml',
    label: 'Declared in',
    content: 'version: 1',
    language: 'yaml',
    isExcerpt: false,
    startingLineNumber: 1,
    highlightedLines: [],
  });
  expect(view.findings[0]?.evidence).toStrictEqual([
    {
      path: '/src/missing.ts',
      label: 'Referenced file',
      language: 'text',
      isMissing: true,
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
  expect(view.findings.map(({ record }) => record)).toStrictEqual([diagnostic, warning]);
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
  expect(view.findings[0]?.evidence[0]).toStrictEqual({
    path: '/src/missing.ts',
    label: 'Referenced file',
    language: 'text',
    isMissing: false,
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
  expect(view.findings[0]?.declaration?.path).toBe('/moldea/moldea.yaml');
  expect(view.findings[0]?.target?.value).toBe('src/missing.ts');
  expect(view.findings[0]?.evidence[0]).toMatchObject({
    path: '/src/missing.ts',
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
  expect(view.findings[0]?.declaration?.path).toBe('/moldea/moldea.yaml');
  expect(view.findings[0]?.target?.value).toBe('src/missing.ts');
  expect(view.findings[0]?.evidence[0]).toMatchObject({
    path: '/src/missing.ts',
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
  expect(view.findings.map((finding) => finding.target)).toStrictEqual(
    [0, 1].map(() => ({
      label: 'Project declaration',
      value: 'moldea/moldea.yaml',
      icon: 'declaration',
    })),
  );
  expect(view.findings.map((finding) => finding.evidence)).toStrictEqual([[], []]);
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
  expect(view.findings[0]?.declaration).toMatchObject({
    path: '/AGENTS.md',
    label: 'Declared in',
    content: 'Stale managed block.',
  });
  expect(view.findings[0]?.evidence).toContainEqual({
    path: '/.agents/skills/moldea',
    label: 'Referenced file',
    language: 'text',
    isMissing: false,
  });
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
  expect(view.findings[0]?.evidence[0]).toMatchObject({
    isMissing: false,
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
  expect(view.findings[0]?.evidence[0]).toMatchObject({
    path: '/.agents/skills/moldea/SKILL.md',
    isMissing: true,
  });
});

test('retains additive native Core fields separately from its validated display projection', () => {
  const projected = { ...diagnostic, path: null, entity: null, range: null };
  const native = { ...projected, retainedFact: { id: 'native-record', count: 4 } };
  const response = { valid: false, diagnostics: [native], coverage: [] };
  const view = getCapabilityInspectionView({
    ...example,
    result: { kind: 'validation', valid: false, diagnostics: [projected] },
    output: createRecordedOutput([response]),
  });
  expect(view.findings[0]).toMatchObject({ kind: 'structural', record: native });
  expect(view.findings[0]?.record).toStrictEqual(native);
  expect(projected).not.toHaveProperty('retainedFact');
});

test.each([
  ['discovery', 'discovery-and-text'],
  ['manifest', 'yaml-and-manifest-values'],
  ['references', 'references-context-and-decisions'],
  ['agents', 'agents-and-capabilities'],
  ['mirrors', 'mirrors'],
  ['integration', 'coding-agent-integration'],
])('links %s findings to Core guidance under a non-root base', (group, fragment) => {
  const record = { kind: 'diagnostic', ...diagnostic, group };
  const view = getCapabilityInspectionView(
    { ...example, output: createRecordedOutput([{ result: { page: { records: [record] } } }]) },
    '/preview/',
  );
  expect(view.findings[0]).toHaveProperty(
    'guidanceHref',
    `/preview/packages/core/diagnostics/#${fragment}`,
  );
  expect(view.findings[0]).toHaveProperty('record', record);
});

test.each([
  [undefined, []],
  [null, []],
  ['', ['Document root']],
  ['/', ['']],
  ['/a~1b/~0name//tail', ['a/b', '~name', '', 'tail']],
  ['/a~01b', ['a~1b']],
])('decodes native field %s without losing root or empty segments', (pointer, field) => {
  const view = getCapabilityInspectionView({
    ...example,
    output: createRecordedOutput([
      {
        result: {
          page: { records: [{ kind: 'diagnostic', ...diagnostic, pointer: pointer ?? null }] },
        },
      },
    ]),
  });
  expect(view.findings[0]).toHaveProperty('field', field);
});

test('retains the native CLI record without adding inferred export evidence to it', () => {
  const record = {
    kind: 'diagnostic',
    key: 'native-cli-key',
    code: 'MOLDEA_REFERENCE_EXPORT_MISSING',
    severity: 'error',
    group: 'references',
    message: 'The declared export is missing.',
    path: '/moldea/moldea.yaml',
    pointer: '/context/policy/bindings/0',
    additive: { kept: true },
  };
  const view = getCapabilityInspectionView({
    ...example,
    result: {
      kind: 'cli',
      command: 'moldea validate --json',
      schemaVersion: 7,
      status: 'invalid',
      exitStatus: 1,
      facts: {
        coverage: { path: '/src/missing.ts', symbol: 'checkEligibility', exportCheck: 'failed' },
      },
    },
    output: createRecordedOutput([{ result: { page: { records: [record] } } }]),
  });
  expect(view.findings[0]).toMatchObject({
    record,
    target: { label: 'Referenced file', value: 'src/missing.ts', icon: 'file' },
    related: { label: 'Export', value: 'checkEligibility', icon: 'export' },
  });
  expect(record).not.toHaveProperty('details');
  expect(view.bindings).toStrictEqual([]);
});

test('uses native warning identity and preserves accepted reasons without offering a new snippet', () => {
  const warning = {
    kind: 'diagnostic',
    ...diagnostic,
    code: 'MOLDEA_IMPACT_PATTERN_UNMATCHED',
    severity: 'warning',
    subject: 'a "quoted" path\nwith a newline',
    qualifier: null,
    acceptable: true,
  };
  const view = getCapabilityInspectionView({
    ...example,
    output: createRecordedOutput([{ result: { page: { records: [warning] } } }]),
  });
  expect(view.findings[0]).toHaveProperty(
    'acceptance',
    'acceptedWarnings:\n  - code: "MOLDEA_IMPACT_PATTERN_UNMATCHED"\n    subject: "a \\"quoted\\" path\\nwith a newline"\n    qualifier: null\n    reason:\n    # Required: explain why this warning is accepted.',
  );
  const accepted = {
    ...warning,
    accepted: true,
    reason: 'The planned module arrives during the release build.',
  };
  const acceptedView = getCapabilityInspectionView({
    ...example,
    output: createRecordedOutput([{ result: { page: { records: [accepted] } } }]),
  });
  expect(acceptedView.findings[0]).toMatchObject({
    record: accepted,
    accepted: true,
    reason: accepted.reason,
  });
  expect(acceptedView.findings[0]).not.toHaveProperty('acceptance');
  const ineligible = getCapabilityInspectionView({
    ...example,
    output: createRecordedOutput([
      { result: { page: { records: [{ ...warning, acceptable: false }] } } },
    ]),
  });
  expect(ineligible.findings[0]).not.toHaveProperty('acceptance');
});

test('trims declaration edges while retaining original source numbers and bounded highlights', () => {
  const record = {
    kind: 'diagnostic',
    ...diagnostic,
    range: { start: { line: 3, column: 1 }, end: { line: 999999999, column: 1 } },
  };
  const view = getCapabilityInspectionView({
    ...example,
    files: [{ ...example.files[0], content: '\r\n  \r\n  name: example\r\n  next: value\r\n\r\n' }],
    output: createRecordedOutput([{ result: { page: { records: [record] } } }]),
  });
  expect(view.findings[0]?.declaration).toStrictEqual({
    path: '/moldea/moldea.yaml',
    label: 'Declared in',
    language: 'yaml',
    content: '  name: example\n  next: value',
    isExcerpt: false,
    startingLineNumber: 3,
    highlightedLines: [3, 4],
  });
});

test.each([
  [1, [2]],
  [2, [2, 3]],
])('respects an exclusive range ending at column %d', (column, highlightedLines) => {
  const record = {
    kind: 'diagnostic',
    ...diagnostic,
    range: { start: { line: 2, column: 1 }, end: { line: 3, column } },
  };
  const view = getCapabilityInspectionView({
    ...example,
    files: [{ ...example.files[0], content: 'one: 1\ntwo: 2\nthree: 3\n' }],
    output: createRecordedOutput([{ result: { page: { records: [record] } } }]),
  });
  expect(view.findings[0]?.declaration?.highlightedLines).toStrictEqual(highlightedLines);
});

test.each(['bytes', 'json-string'] as const)(
  'keeps %s evidence unnumbered rather than claiming source coordinates',
  (representation) => {
    const file = {
      ...example.files[0],
      representation,
      language: 'text',
      content: representation === 'bytes' ? 'Bytes: ff 00' : '"\\u0000"',
    };
    const view = getCapabilityInspectionView({ ...example, files: [file] });
    expect(view.findings[0]?.declaration).toBeUndefined();
    expect(view.findings[0]?.evidence[0]).toStrictEqual({
      path: file.path,
      label: representation === 'bytes' ? 'Byte representation' : 'JSON string representation',
      language: 'text',
      content: file.content,
      isExcerpt: false,
    });
  },
);

test('labels a captured prefix that does not contain the reported range', () => {
  const view = getCapabilityInspectionView({
    ...example,
    files: [{ ...example.files[0], isExcerpt: true }],
    output: createRecordedOutput([
      {
        result: {
          page: {
            records: [
              {
                kind: 'diagnostic',
                ...diagnostic,
                range: { start: { line: 32, column: 1 }, end: { line: 33, column: 1 } },
              },
            ],
          },
        },
      },
    ]),
  });
  expect(view.findings[0]?.declaration).toMatchObject({
    startingLineNumber: 1,
    highlightedLines: [],
    isExcerpt: true,
    notice: 'The reported lines are outside this captured excerpt.',
  });
});

test('renders only existing-file native coverage with platform outcome and owner facts', () => {
  const coverage = {
    kind: 'coverage',
    key: 'binding',
    relationship: 'instruction-loader',
    path: '/src/policy.ts',
    symbol: 'loadPolicy',
    fileCheck: 'passed',
    exportCheck: 'not-checked',
    exportNotCheckedReason: 'resource-limit',
    entity: { agentId: 'support' },
  };
  const view = getCapabilityInspectionView({
    ...example,
    output: createRecordedOutput([{ result: { page: { records: [coverage] } } }]),
  });
  expect(view.bindings).toStrictEqual([
    {
      relationship: 'instruction-loader',
      path: '/src/policy.ts',
      symbol: 'loadPolicy',
      outcome: 'not-checked',
      reason: 'The export check reached an inspection resource limit.',
      owner: { label: 'Agent', value: 'support', icon: 'agent' },
    },
  ]);
  expect(view.findings).toStrictEqual([]);
});

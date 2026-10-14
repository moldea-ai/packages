// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { parseRepositoryPath } from '@moldea.ai/repository';

import {
  getCapabilityFactRows,
  getCapabilityVisualFamily,
  getCapabilityOutcome,
  getCapabilityShowcase,
} from './presentation.ts';
import { CAPABILITY_GROUPS } from './catalog.ts';
import type { ICapabilityCase, ICapabilityResult } from './types.ts';

const example: ICapabilityCase = {
  id: 'example',
  groupId: 'structure',
  title: 'Example',
  description: 'Executed example.',
  limitation: 'Structural only.',
  packageName: '@moldea.ai/core',
  operation: 'validateProject',
  sourcePaths: [],
  files: [],
  output: {
    kind: 'execution-facts',
    responses: [{ valid: true, diagnostics: [] }],
    redactions: [],
  },
  result: { kind: 'validation', valid: true, diagnostics: [] },
};
test('orders every case once with four featured cases per category', () => {
  const groups = CAPABILITY_GROUPS;
  const featured = groups.flatMap((group) =>
    group.featuredExampleIds.map((id) => ({ ...example, id, groupId: group.id })),
  );
  const extra = { ...example, id: 'extra', groupId: groups[0].id };
  const cases = [extra, ...featured].reverse();
  const result = getCapabilityShowcase({ groups, cases });
  expect(result.flatMap(({ examples }) => examples)).toHaveLength(cases.length);
  for (const { group, examples } of result)
    expect(examples.slice(0, 4).map(({ id }) => id)).toStrictEqual(group.featuredExampleIds);
  expect(result[0].examples.at(-1)).toStrictEqual(extra);
  expect(() =>
    getCapabilityShowcase({ groups, cases: cases.filter(({ id }) => id !== 'mirror-stale') }),
  ).toThrow('Missing capability illustration for agents: mirror-stale');
  expect(() => getCapabilityShowcase({ groups, cases: [...cases, cases[0]] })).toThrow(
    'Repeated capability case',
  );
  expect(() =>
    getCapabilityShowcase({
      groups,
      cases: cases.map((entry) => ({ ...entry, groupId: 'agents' })),
    }),
  ).toThrow('Missing capability illustration');
  expect(() =>
    getCapabilityShowcase({
      cases,
      groups: groups.map((group) => ({
        ...group,
        featuredExampleIds: [
          group.featuredExampleIds[0],
          group.featuredExampleIds[0],
          group.featuredExampleIds[2],
          group.featuredExampleIds[3],
        ],
      })),
    }),
  ).toThrow('Repeated capability illustration');
});

test.each([
  ['policy-reference-connected', 'validation', 'files'],
  ['manifest-duplicate-key', 'validation', 'source'],
  ['decision-relationship-accepted', 'validation', 'source'],
  ['mirror-stale', 'validation', 'agents'],
  ['reader-invalid-cursor', 'reader', 'operation'],
  ['reader-entry-pages', 'reader', 'operation'],
  ['snapshot-comparison', 'reader', 'records'],
  ['canonical-content-pages', 'inspection', 'operation'],
] as const)('selects a truthful visual family for %s (%s) -> %s', (id, kind, family) => {
  const result: ICapabilityResult =
    kind === 'validation' ? { kind, valid: true, diagnostics: [] } : { kind, facts: {} };
  expect(getCapabilityVisualFamily({ ...example, id, result })).toBe(family);
});

describe('getCapabilityOutcome', () => {
  test('keeps a paginated warning distinct from a confirmed error', () => {
    expect(
      getCapabilityOutcome({
        ...example,
        id: 'inspection-mixed-diagnostics',
        result: {
          kind: 'inspection',
          facts: { counts: { diagnostics: 3, errors: 1, warnings: 2 } },
        },
      }),
    ).toMatchObject({
      title: '1 blocking finding and 2 warnings across three pages',
      label: 'Blocking',
      tone: 'danger',
    });
  });

  test('distinguishes warnings, accepted warnings, and unchecked exports', () => {
    const warning = {
      code: 'MOLDEA_INTEGRATION_BLOCK_MISSING' as const,
      group: 'integration' as const,
      severity: 'warning' as const,
      source: 'core' as const,
      message: 'The AGENTS.md moldea block is missing.',
      path: parseRepositoryPath('/AGENTS.md'),
      subject: parseRepositoryPath('/AGENTS.md'),
      qualifier: null,
      acceptable: true,
      pointer: null,
      range: null,
      entity: null,
      details: {},
    };
    expect(
      getCapabilityOutcome({
        ...example,
        result: { kind: 'validation', valid: true, warningCount: 1, diagnostics: [warning] },
      }),
    ).toMatchObject({ label: 'Warning', title: '1 warning', tone: 'warning' });
    expect(
      getCapabilityOutcome({
        ...example,
        result: {
          kind: 'validation',
          valid: true,
          warningCount: 0,
          acceptedWarningCount: 1,
          diagnostics: [{ ...warning, accepted: true, reason: 'Synthetic hosted repository.' }],
        },
      }),
    ).toMatchObject({ label: 'Accepted', tone: 'info' });
    expect(
      getCapabilityOutcome({
        ...example,
        result: {
          kind: 'validation',
          valid: true,
          diagnostics: [],
          coverageCounts: { bindings: 1, exportsPassed: 0, exportsFailed: 0, exportsNotChecked: 1 },
        },
      }),
    ).toMatchObject({ label: 'Not checked', tone: 'neutral' });
  });

  test('shows a successful CLI warning without labelling it fully verified', () => {
    expect(
      getCapabilityOutcome({
        ...example,
        result: {
          kind: 'cli',
          status: 'valid',
          schemaVersion: 7,
          exitStatus: 0,
          command: 'moldea validate --json',
          facts: { warningCount: 1 },
        },
      }),
    ).toMatchObject({
      label: 'Warning',
      title: '1 warning',
      tone: 'warning',
    });
  });

  test('labels a completed CLI validation as passed while keeping other operations distinct', () => {
    const validation: ICapabilityCase = {
      ...example,
      operation: 'validate',
      result: {
        kind: 'cli',
        status: 'valid',
        schemaVersion: 7,
        exitStatus: 0,
        command: 'moldea validate --json',
        facts: { valid: true, warningCount: 0, acceptedWarningCount: 0 },
      },
    };
    expect(getCapabilityOutcome(validation)).toMatchObject({ label: 'Passed', tone: 'success' });
    expect(getCapabilityOutcome({ ...validation, operation: 'inspect' })).toMatchObject({
      label: 'Completed',
      tone: 'info',
    });
  });

  test.each([
    [{ kind: 'validation', valid: true, diagnostics: [] }, 'Passed', 'success'],
    [{ kind: 'validation', valid: false, diagnostics: [] }, 'Blocking', 'danger'],
    [{ kind: 'reader', facts: { code: 'SNAPSHOT_CHANGED' } }, 'Refused', 'warning'],
    [{ kind: 'inspection', facts: { code: 'RESOURCE_LIMIT_EXCEEDED' } }, 'Refused', 'warning'],
    [{ kind: 'inspection', facts: { valid: true, relevant: false } }, 'Returned', 'info'],
    [
      {
        kind: 'cli',
        status: 'valid',
        schemaVersion: 7,
        exitStatus: 0,
        command: 'moldea inspect --json',
        facts: {},
      },
      'Completed',
      'info',
    ],
    [
      {
        kind: 'cli',
        status: 'invalid',
        schemaVersion: 7,
        exitStatus: 1,
        command: 'moldea validate --json',
        facts: {},
      },
      'Blocking',
      'danger',
    ],
    [
      {
        kind: 'cli',
        status: 'error',
        schemaVersion: 7,
        exitStatus: 3,
        command: 'moldea content --json',
        facts: {},
      },
      'Refused',
      'warning',
    ],
  ] satisfies [ICapabilityResult, string, string][])(
    'getCapabilityOutcome(%o) -> %s',
    (result, label, tone) => {
      expect(getCapabilityOutcome({ ...example, result })).toMatchObject({
        label,
        tone,
        description: example.description,
      });
    },
  );
});

test.each([null, 'invalid', [null], [true], [[]]])(
  'getCapabilityFactRows(%o) rejects unusable diagram facts',
  (fact) => {
    expect(() => getCapabilityFactRows(fact)).toThrow('Capability diagram requires');
  },
);

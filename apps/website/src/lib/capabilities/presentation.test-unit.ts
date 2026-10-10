// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { parseRepositoryPath } from '@moldea.ai/repository';

import {
  getCapabilityFactRows,
  getCapabilityVisualFamily,
  getCapabilityOutcome,
  getCapabilityShowcase,
  getCapabilityResultExcerpt,
} from './presentation.ts';
import { CAPABILITY_GROUPS } from './catalog.ts';
import type { ICapabilities, ICapabilityCase, ICapabilityResult } from './types.ts';

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
  result: { kind: 'validation', valid: true, diagnostics: [] },
};
const catalog: Pick<ICapabilities, 'runtimeTargets'> = { runtimeTargets: [] };
const noDiagnostics = { errorCount: 0, warningCount: 0 };
const cliEnvelopeExcerpt = (
  status: Extract<ICapabilityResult, { kind: 'cli' }>['status'],
  command: string,
) => ({
  cliVersion: '10.0.0',
  command,
  error: null,
  result: {},
  schemaVersion: 6 as const,
  status,
});

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
  ['example', 'adapter', 'runtime'],
] as const)('selects a truthful visual family for %s (%s) -> %s', (id, kind, family) => {
  const result: ICapabilityResult =
    kind === 'validation'
      ? { kind, valid: true, diagnostics: [] }
      : kind === 'adapter'
        ? { kind, valid: true, ...noDiagnostics, diagnostics: [], evidence: [] }
        : { kind, facts: {} };
  expect(getCapabilityVisualFamily({ ...example, id, result })).toBe(family);
});

describe('getCapabilityOutcome', () => {
  test('keeps a paginated warning distinct from a confirmed error', () => {
    expect(
      getCapabilityOutcome(
        {
          ...example,
          id: 'inspection-mixed-diagnostics',
          result: {
            kind: 'inspection',
            facts: { counts: { diagnostics: 3, errors: 1, warnings: 2 } },
          },
        },
        catalog,
      ),
    ).toMatchObject({
      title: '2 warnings and 1 error across three pages',
      label: 'Mixed results',
      tone: 'danger',
    });
  });

  test('shows a valid runtime result with an unverified relationship as a warning', () => {
    const result: ICapabilityResult = {
      kind: 'adapter',
      valid: true,
      errorCount: 0,
      warningCount: 1,
      diagnostics: [
        {
          code: 'ANTHROPIC_RUNTIME_RELATIONSHIP_UNVERIFIED',
          details: { relationship: 'instruction-loader', reason: 'dynamic-source-pattern' },
          entity: { agentId: 'support' },
          message: 'The declared runtime relationship could not be verified.',
          path: parseRepositoryPath('/src/agent.ts'),
          pointer: null,
          range: null,
          severity: 'warning',
          source: 'anthropic',
        },
      ],
      evidence: [],
    };

    expect(getCapabilityOutcome({ ...example, result }, catalog)).toMatchObject({
      label: 'Warnings',
      title: '1 runtime relationship unverified',
      tone: 'warning',
    });
  });

  test('shows a successful CLI warning without labelling it fully verified', () => {
    expect(
      getCapabilityOutcome(
        {
          ...example,
          result: {
            kind: 'cli',
            status: 'valid',
            schemaVersion: 6,
            exitStatus: 0,
            command: 'moldea validate --json',
            facts: { warningCount: 1 },
            envelopeExcerpt: cliEnvelopeExcerpt('valid', 'validate'),
          },
        },
        catalog,
      ),
    ).toMatchObject({
      label: 'Warnings',
      title: '1 runtime relationship unverified',
      tone: 'warning',
    });
  });

  test.each([
    [{ kind: 'validation', valid: true, diagnostics: [] }, 'Valid', 'success'],
    [{ kind: 'validation', valid: false, diagnostics: [] }, 'Invalid', 'danger'],
    [
      { kind: 'adapter', valid: true, ...noDiagnostics, diagnostics: [], evidence: [] },
      'Inspected',
      'info',
    ],
    [{ kind: 'reader', facts: { code: 'SNAPSHOT_CHANGED' } }, 'Refused', 'warning'],
    [{ kind: 'inspection', facts: { code: 'RESOURCE_LIMIT_EXCEEDED' } }, 'Refused', 'warning'],
    [{ kind: 'inspection', facts: { valid: true, relevant: false } }, 'Returned', 'info'],
    [
      {
        kind: 'cli',
        status: 'valid',
        schemaVersion: 6,
        exitStatus: 0,
        command: 'moldea inspect --json',
        facts: {},
        envelopeExcerpt: cliEnvelopeExcerpt('valid', 'inspect'),
      },
      'Completed',
      'info',
    ],
    [
      {
        kind: 'cli',
        status: 'invalid',
        schemaVersion: 6,
        exitStatus: 1,
        command: 'moldea validate --json',
        facts: {},
        envelopeExcerpt: cliEnvelopeExcerpt('invalid', 'validate'),
      },
      'Invalid',
      'danger',
    ],
    [
      {
        kind: 'cli',
        status: 'error',
        schemaVersion: 6,
        exitStatus: 3,
        command: 'moldea content --json',
        facts: {},
        envelopeExcerpt: cliEnvelopeExcerpt('error', 'content'),
      },
      'Refused',
      'warning',
    ],
  ] satisfies [ICapabilityResult, string, string][])(
    'getCapabilityOutcome(%o) -> %s',
    (result, label, tone) => {
      expect(getCapabilityOutcome({ ...example, result }, catalog)).toMatchObject({
        label,
        tone,
        description: example.description,
      });
    },
  );

  test('does not equate a valid adapter result with an established connection', () => {
    const withAbsence: Pick<ICapabilities, 'runtimeTargets'> = {
      runtimeTargets: [
        {
          adapterId: 'custom',
          scopeRoute: '/adapters/custom/',
          target: {
            id: 'custom',
            kind: 'custom',
            language: 'any',
            maturity: 'supported',
            lastVerifiedAt: '2026-09-01',
            qualificationEvidence: { url: 'https://example.com/evidence/' },
          },
          patterns: [
            {
              id: 'example',
              proofs: [
                {
                  caseId: 'example',
                  source: { path: '/src/agent.ts', contains: 'prepareCall' },
                  witness: {
                    kind: 'absence',
                    agentId: 'support',
                    evidenceKind: 'instruction-loader',
                  },
                },
              ],
            },
          ],
        },
      ],
    };
    expect(
      getCapabilityOutcome(
        {
          ...example,
          result: { kind: 'adapter', valid: true, ...noDiagnostics, diagnostics: [], evidence: [] },
        },
        withAbsence,
      ),
    ).toMatchObject({ label: 'Not established', tone: 'warning' });
    expect(
      getCapabilityOutcome(
        {
          ...example,
          id: 'different',
          result: { kind: 'adapter', valid: true, ...noDiagnostics, diagnostics: [], evidence: [] },
        },
        withAbsence,
      ).label,
    ).toBe('Inspected');
    expect(
      getCapabilityOutcome(
        {
          ...example,
          result: {
            kind: 'adapter',
            valid: false,
            errorCount: 1,
            warningCount: 0,
            diagnostics: [],
            evidence: [],
          },
        },
        withAbsence,
      ).label,
    ).toBe('Invalid');
    expect(
      getCapabilityOutcome(
        {
          ...example,
          id: 'vercel-dynamic-preparation',
          result: { kind: 'adapter', valid: true, ...noDiagnostics, diagnostics: [], evidence: [] },
        },
        catalog,
      ).label,
    ).toBe('Not established');
  });
});

test('selects bounded evidence without mutating the recorded result', () => {
  const result: Extract<ICapabilityResult, { kind: 'adapter' }> = {
    kind: 'adapter',
    valid: true,
    ...noDiagnostics,
    diagnostics: [],
    evidence: Array.from({ length: 8 }, (_, index) => ({
      source: 'custom',
      kind: 'language',
      agentId: `agent-${index}`,
      capabilityId: null,
      capabilityKind: null,
      runtimeName: null,
      references: [{ path: parseRepositoryPath('/src/agent.ts') }],
      details: { language: 'typescript' },
    })),
  };
  const before = structuredClone(result);
  expect(getCapabilityResultExcerpt(result)).toStrictEqual({
    valid: true,
    ...noDiagnostics,
    diagnostics: [],
    evidence: result.evidence.slice(0, 4).map(({ kind, agentId, runtimeName, references }) => ({
      kind,
      agentId,
      runtimeName,
      references,
    })),
  });
  expect(result).toStrictEqual(before);
  expect(getCapabilityResultExcerpt({ kind: 'reader', facts: { code: 'ABORTED' } })).toStrictEqual({
    code: 'ABORTED',
  });
});

test.each([null, 'invalid', [null], [true], [[]]])(
  'getCapabilityFactRows(%o) rejects unusable diagram facts',
  (fact) => {
    expect(() => getCapabilityFactRows(fact)).toThrow('Capability diagram requires');
  },
);

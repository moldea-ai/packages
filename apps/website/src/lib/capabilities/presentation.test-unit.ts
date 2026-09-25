// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { parseRepositoryPath } from '@moldea.ai/repository';

import {
  getCapabilityFactRows,
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

test('resolves selected illustrations in section order independently of case order', () => {
  const groups = CAPABILITY_GROUPS;
  const cases = groups.flatMap((group) =>
    group.exampleIds.map((id) => ({ ...example, id, groupId: group.id })),
  );
  const complete = { groups, cases };
  expect(getCapabilityShowcase({ ...complete, cases: [...cases].reverse() })).toStrictEqual(
    groups.map((group) => ({
      group,
      examples: group.exampleIds.map((id) => cases.find((entry) => entry.id === id)),
    })),
  );
  expect(() => getCapabilityShowcase({ ...complete, cases: cases.slice(1) })).toThrow(
    'Missing capability illustration',
  );
  expect(() =>
    getCapabilityShowcase({
      ...complete,
      cases: cases.map((entry) => ({ ...entry, groupId: 'agents' })),
    }),
  ).toThrow('Missing capability illustration');
  expect(() =>
    getCapabilityShowcase({
      ...complete,
      cases: cases.filter(({ id }) => id !== 'mirror-stale'),
    }),
  ).toThrow('Missing capability illustration for agents: mirror-stale');
  expect(() =>
    getCapabilityShowcase({
      ...complete,
      groups: groups.map((group) => ({
        ...group,
        exampleIds: [...group.exampleIds, group.exampleIds[0]],
      })),
    }),
  ).toThrow('Repeated capability illustration');
});

describe('getCapabilityOutcome', () => {
  test('shows a valid runtime result with an unverified relationship as a warning', () => {
    const result: ICapabilityResult = {
      kind: 'adapter',
      valid: true,
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

  test.each([
    [{ kind: 'validation', valid: true, diagnostics: [] }, 'Valid', 'success'],
    [{ kind: 'validation', valid: false, diagnostics: [] }, 'Invalid', 'danger'],
    [{ kind: 'adapter', valid: true, diagnostics: [], evidence: [] }, 'Inspected', 'info'],
    [{ kind: 'reader', facts: { code: 'SNAPSHOT_CHANGED' } }, 'Refused', 'warning'],
    [{ kind: 'inspection', facts: { code: 'RESOURCE_LIMIT_EXCEEDED' } }, 'Refused', 'warning'],
    [{ kind: 'inspection', facts: { valid: true, relevant: false } }, 'Returned', 'info'],
    [
      {
        kind: 'cli',
        status: 'valid',
        schemaVersion: 5,
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
        schemaVersion: 5,
        exitStatus: 1,
        command: 'moldea validate --json',
        facts: {},
      },
      'Invalid',
      'danger',
    ],
    [
      {
        kind: 'cli',
        status: 'error',
        schemaVersion: 5,
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
        { ...example, result: { kind: 'adapter', valid: true, diagnostics: [], evidence: [] } },
        withAbsence,
      ),
    ).toMatchObject({ label: 'Not established', tone: 'warning' });
    expect(
      getCapabilityOutcome(
        {
          ...example,
          id: 'different',
          result: { kind: 'adapter', valid: true, diagnostics: [], evidence: [] },
        },
        withAbsence,
      ).label,
    ).toBe('Inspected');
    expect(
      getCapabilityOutcome(
        { ...example, result: { kind: 'adapter', valid: false, diagnostics: [], evidence: [] } },
        withAbsence,
      ).label,
    ).toBe('Invalid');
    expect(
      getCapabilityOutcome(
        {
          ...example,
          id: 'vercel-dynamic-preparation',
          result: { kind: 'adapter', valid: true, diagnostics: [], evidence: [] },
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
    diagnostics: [],
    evidenceCount: 8,
    evidenceExcerpt: result.evidence
      .slice(0, 4)
      .map(({ kind, agentId, runtimeName, references }) => ({
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

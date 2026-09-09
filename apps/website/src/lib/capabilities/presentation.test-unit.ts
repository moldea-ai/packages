// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { parseRepositoryPath } from '@moldea.ai/repository';

import {
  getCapabilityFactRows,
  getCapabilityOutcome,
  getCapabilityResultExcerpt,
  getCapabilityVisualFiles,
} from './presentation.ts';
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

describe('getCapabilityOutcome', () => {
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
        schemaVersion: 4,
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
        schemaVersion: 4,
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
        schemaVersion: 4,
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

test('selects only real source files and rejects a missing visual source', () => {
  const instruction = {
    path: '/moldea/agents/support/instruction.md',
    language: 'markdown',
    content: 'Actual instruction',
    isExcerpt: false,
    representation: 'source' as const,
  };
  const mirror = { ...instruction, path: '/instructions/support.md', content: 'Actual mirror' };
  const unrelated = { ...instruction, path: '/unrelated.md' };
  expect(
    getCapabilityVisualFiles({
      ...example,
      id: 'mirror-stale',
      files: [instruction, unrelated, mirror],
    }),
  ).toStrictEqual([instruction, mirror]);
  expect(() => getCapabilityVisualFiles({ ...example, files: [unrelated] })).toThrow(
    'Capability illustration has no selected source',
  );
  expect(getCapabilityFactRows([{ path: '/policy.md' }])).toStrictEqual([{ path: '/policy.md' }]);
});

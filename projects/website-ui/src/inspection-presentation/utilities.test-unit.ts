// @vitest-environment node
import { expect, test, vi } from 'vitest';
import type { IInspectionFindingView } from './types.js';
import {
  getInspectionImpact,
  getInspectionRelationship,
  groupInspectionFindings,
} from './utilities.js';

vi.mock('@lucide/astro', async () => {
  const { createInspectionIconMocks } = await import('./icons.test-fixtures.js');
  return createInspectionIconMocks();
});

const finding = (
  id: string,
  severity: 'error' | 'warning',
  group: 'references' | 'manifest',
  accepted = false,
): IInspectionFindingView => ({
  id,
  kind: 'structural',
  severity,
  group,
  accepted,
  code: 'NATIVE_CODE',
  message: 'Native finding.',
  record: { id },
  field: [],
  facts: [],
  guidanceHref: '/diagnostics/',
  evidence: [],
});

test('groups blocking subjects first and keeps accepted warnings and native records in source order', () => {
  const input = [
    finding('warning', 'warning', 'references'),
    finding('accepted', 'warning', 'manifest', true),
    finding('error', 'error', 'references'),
    finding('other-error', 'error', 'manifest'),
    finding('later-warning', 'warning', 'references'),
  ];
  const grouped = groupInspectionFindings(input);
  expect(
    grouped.groups.map((group) => ({
      label: group.label,
      ids: group.findings.map((item) => item.id),
    })),
  ).toStrictEqual([
    { label: 'References errors', ids: ['error'] },
    { label: 'Manifest errors', ids: ['other-error'] },
    { label: 'References warnings', ids: ['warning', 'later-warning'] },
  ]);
  expect(grouped.accepted).toStrictEqual([input[1]]);
  expect(input.map((item) => item.id)).toStrictEqual([
    'warning',
    'accepted',
    'error',
    'other-error',
    'later-warning',
  ]);
  expect(grouped.groups[0]?.findings[0]).toBe(input[2]);
});

test('keeps accepted warnings green without accepting an error with an unrelated additive flag', () => {
  expect(getInspectionImpact(finding('accepted', 'warning', 'references', true))).toMatchObject({
    label: 'Accepted',
    tone: 'success',
  });
  expect(getInspectionImpact(finding('error', 'error', 'references', true))).toMatchObject({
    label: 'Blocking',
    tone: 'danger',
  });
  expect(
    groupInspectionFindings([finding('error', 'error', 'references', true)]).accepted,
  ).toStrictEqual([]);
});

test('does not treat inherited object names as known binding relationships', () => {
  expect(getInspectionRelationship('instruction-loader').label).toBe('Instruction loader');
  expect(getInspectionRelationship('tool-registration').label).toBe('Tool registration');
  expect(getInspectionRelationship('constructor').label).toBe('Constructor');
});

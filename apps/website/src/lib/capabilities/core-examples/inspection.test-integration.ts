// @vitest-environment node
import { beforeAll, expect, test } from 'vitest';

import type { ICapabilityCase } from '../index.ts';

import { createCoreInspectionExamples } from './inspection.ts';

let examples: ICapabilityCase[];
beforeAll(async () => {
  examples = await createCoreInspectionExamples();
});

test('keeps normalization, digests, three inspection views, content, and scope repeatable', async () => {
  expect(examples).toHaveLength(9);
  expect(await createCoreInspectionExamples()).toStrictEqual(examples);
  expect(examples.every(({ result }) => result.kind === 'inspection')).toBe(true);
});

test.each([
  ['metadata', 5],
  ['diagnostics', 1],
  ['evidence', 5],
])('inspection(%s) -> %d complete records', (view, total) => {
  const result = examples.find(({ id }) => id === `inspection-${view}`)?.result;
  expect(result?.kind).toBe('inspection');
  if (result?.kind !== 'inspection') return;
  expect(result.facts.totalItems).toBe(total);
  expect(JSON.stringify(result.facts)).not.toMatch(/"(?:content|nextCursor|snapshotIdentity)":/u);
});

test('keeps Unicode-safe content and operational refusal distinct from a failed check', () => {
  const serialized = JSON.stringify(examples.find(({ id }) => id === 'canonical-content-pages'));
  expect(serialized).not.toContain('\uFFFD');
  const refusal = examples.find(({ id }) => id === 'canonical-content-refusal')?.result;
  expect(refusal).toMatchObject({
    kind: 'inspection',
    facts: { code: 'INVALID_ARGUMENT', source: 'core' },
  });
  expect(refusal).not.toHaveProperty('valid');
  expect(examples.find(({ id }) => id === 'manifest-change-relevance')?.result).toMatchObject({
    kind: 'inspection',
    facts: {
      counts: { declarations: 3, inputPaths: 3, matchedOwners: 2, matchedPaths: 2, matches: 4 },
    },
  });
});

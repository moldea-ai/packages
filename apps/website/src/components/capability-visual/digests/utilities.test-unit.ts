// @vitest-environment node
import { expect, test } from 'vitest';

import type { ICapabilityCase } from '../../../lib/capabilities/index.ts';
import { getDigestIllustration } from './utilities.ts';

const originalDigest = `sha256:${'a'.repeat(64)}`;
const changedDigest = `sha256:${'a'.repeat(63)}b`;
const facts = {
  originalDigest,
  normalizedCopyDigest: originalDigest,
  changedDigest,
  inputs: [
    '# Policy\n\nReturns within 30 days.\n',
    '\uFEFF# Policy\r\n\r\nReturns within 30 days.\r\n',
    '# Policy\n\nReturns within 60 days.\n',
  ],
};
const example: ICapabilityCase = {
  id: 'normalized-digests',
  groupId: 'repository-access',
  title: 'Text fingerprints',
  description: 'Compare normalized text.',
  packageName: '@moldea.ai/core',
  operation: 'calculateContentDigest',
  limitation: 'Not a semantic evaluation.',
  sourcePaths: [],
  files: [],
  result: { kind: 'inspection', facts },
};

test('projects exact excerpts and compares full digests even when their prefixes agree', () => {
  const before = structuredClone(example);
  expect(getDigestIllustration(example)).toStrictEqual([
    { label: 'Original text', before: 'Returns within ', days: '30', after: '.', isSame: true },
    {
      label: 'Same text, different line endings',
      before: 'Returns within ',
      days: '30',
      after: '.',
      isSame: true,
    },
    { label: 'Edited text', before: 'Returns within ', days: '60', after: '.', isSame: false },
  ]);
  expect(example).toStrictEqual(before);
  expect(
    getDigestIllustration({
      ...example,
      result: { kind: 'inspection', facts: { ...facts, changedDigest: originalDigest } },
    })[2].isSame,
  ).toBe(true);
});

test('rejects missing inputs and unrecognized excerpts instead of drawing an invented comparison', () => {
  expect(() =>
    getDigestIllustration({
      ...example,
      result: { kind: 'inspection', facts: { ...facts, inputs: [] } },
    }),
  ).toThrow();
  expect(() =>
    getDigestIllustration({
      ...example,
      result: {
        kind: 'inspection',
        facts: { ...facts, inputs: ['No return window.', ...facts.inputs.slice(1)] },
      },
    }),
  ).toThrow('Digest illustration requires its return-window excerpt.');
  expect(() => getDigestIllustration({ ...example, result: { kind: 'reader', facts } })).toThrow(
    'Digest illustration requires an inspection result.',
  );
});

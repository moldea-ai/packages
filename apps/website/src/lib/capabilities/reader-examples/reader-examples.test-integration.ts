// @vitest-environment node
import { beforeAll, expect, test } from 'vitest';

import type { ICapabilityCase } from '../index.ts';

import { createReaderExamples } from './reader-examples.ts';

let examples: ICapabilityCase[];
beforeAll(async () => {
  examples = await createReaderExamples();
});

test('publishes the same logical facts from different temporary workspace locations', async () => {
  expect(examples).toHaveLength(10);
  expect(await createReaderExamples()).toStrictEqual(examples);
  expect(JSON.stringify(examples)).not.toMatch(
    /"(?:cursor|nextCursor|contentIdentity|snapshotIdentity)":|moldea-capabilities-/u,
  );
});

test('verifies detached bytes, first/final pages, exact boundaries, and an empty listing', () => {
  expect(examples.find(({ id }) => id === 'memory-immutable-ranges')?.result).toMatchObject({
    kind: 'reader',
    facts: {
      firstRange: { bytes: [51, 48], isComplete: false, nextOffset: 2 },
      finalRange: { isComplete: true, nextOffset: null },
    },
  });
  expect(examples.find(({ id }) => id === 'reader-entry-pages')?.result).toMatchObject({
    kind: 'reader',
    facts: {
      empty: { entries: [], isComplete: true },
      exactBoundaryComplete: true,
    },
  });
  const comparison = examples.find(({ id }) => id === 'snapshot-comparison');
  for (const kind of ['added', 'deleted', 'modified', 'type-changed'])
    expect(JSON.stringify(comparison)).toContain(`"kind":"${kind}"`);
  expect(JSON.stringify(comparison?.result)).not.toContain('/shared.md');
});

test.each([
  ['reader-invalid-cursor', 'INVALID_PAGE_REQUEST'],
  ['reader-snapshot-cursor', 'INVALID_PAGE_REQUEST'],
  ['reader-cancellation', 'ABORTED'],
  ['filesystem-changed-snapshot', 'SNAPSHOT_CHANGED'],
  ['filesystem-resource-boundary', 'RESOURCE_LIMIT_EXCEEDED'],
])('reader refusal(%s) -> %s without a validation verdict', (id, code) => {
  const result = examples.find((example) => example.id === id)?.result;
  expect(result).toMatchObject({ kind: 'reader', facts: { code, source: 'repository' } });
  expect(result).not.toHaveProperty('valid');
});

test('exact filesystem selection excludes dependencies and generated files from the same workspace', () => {
  const result = examples.find(({ id }) => id === 'filesystem-selection')?.result;
  expect(result?.kind).toBe('reader');
  if (result?.kind !== 'reader') throw new Error('Missing reader facts.');
  const explicit = result.facts.explicit;
  expect(explicit).toBeInstanceOf(Array);
  expect(JSON.stringify(explicit)).toContain('/moldea/moldea.yaml');
  expect(JSON.stringify(explicit)).toContain('/moldea/project.md');
  expect(JSON.stringify(explicit)).toContain('/src/returns/policy.ts');
  expect(JSON.stringify(explicit)).not.toMatch(/node_modules|dist/);
  expect(JSON.stringify(result.facts.directory)).toContain('/node_modules/left-pad/index.js');
  expect(JSON.stringify(result.facts.directory)).toContain('/dist/bundle.js');
});

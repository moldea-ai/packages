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

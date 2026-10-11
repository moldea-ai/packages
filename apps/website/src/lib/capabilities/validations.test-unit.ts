// @vitest-environment node
import { expect, test } from 'vitest';

import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';

import { assertCapabilityFacts, captureOperationalRefusal } from './validations.ts';

test('requires exact facts, including additional diagnostics or unexpected properties', () => {
  expect(() =>
    assertCapabilityFacts({ valid: true, diagnostics: [] }, { valid: true, diagnostics: [] }),
  ).not.toThrow();
  expect(() =>
    assertCapabilityFacts(
      { valid: true, diagnostics: [], extra: true },
      { valid: true, diagnostics: [] },
    ),
  ).toThrow('unexpected facts');
});

test('captures an expected public refusal but preserves unexpected failures', async () => {
  const repository = createMemoryRepositoryReader([]);
  expect(
    await captureOperationalRefusal(
      () => repository.listEntriesPage({ maxEntries: 2, cursor: 'invalid' }),
      'INVALID_PAGE_REQUEST',
    ),
  ).toMatchObject({ source: 'repository', code: 'INVALID_PAGE_REQUEST' });
  const unexpected = new Error('Unexpected fixture failure.');
  await expect(captureOperationalRefusal(() => Promise.reject(unexpected), 'ABORTED')).rejects.toBe(
    unexpected,
  );
  await expect(captureOperationalRefusal(() => Promise.resolve(null), 'ABORTED')).rejects.toThrow(
    'did not produce its expected operational refusal',
  );
});

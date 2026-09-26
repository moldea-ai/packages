// @vitest-environment node
import { expect, test } from 'vitest';

import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';

import { RUNTIME_PATTERN_PROOFS } from './coverage.ts';
import { RUNTIME_EXAMPLES } from './runtime-examples/index.ts';
import type { ICapabilityCase, IRuntimePatternProof } from './types.ts';
import {
  assertCapabilityFacts,
  captureOperationalRefusal,
  validateRuntimeSourceProofs,
  validateRuntimeWitness,
} from './validations.ts';

const example: ICapabilityCase = {
  id: 'source-proof',
  groupId: 'runtime-wiring',
  title: 'Source proof',
  description: 'A synthetic relationship.',
  limitation: 'Static evidence only.',
  packageName: '@moldea.ai/adapter-openai',
  operation: 'validateProject',
  sourcePaths: [],
  files: [],
  result: {
    kind: 'adapter',
    valid: true,
    errorCount: 0,
    warningCount: 0,
    diagnostics: [],
    evidence: [],
  },
};
const absence: IRuntimePatternProof = {
  caseId: example.id,
  source: { path: '/src/agent.ts', contains: 'prepareCall' },
  witness: { kind: 'absence', evidenceKind: 'instruction-loader', agentId: 'support' },
};

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

test('distinguishes an established relationship from a valid absence of evidence', () => {
  expect(() => validateRuntimeWitness(absence, example)).not.toThrow();
  expect(() =>
    validateRuntimeWitness(
      {
        ...absence,
        witness: { kind: 'evidence', evidenceKind: 'instruction-loader', agentId: 'support' },
      },
      example,
    ),
  ).toThrow('unexpected facts');
  expect(() =>
    validateRuntimeWitness(absence, { ...example, result: { kind: 'reader', facts: {} } }),
  ).toThrow('wrong result family');
});

test('requires the exact source form associated with the claimed pattern', () => {
  const definition = RUNTIME_EXAMPLES.find(({ id }) => id === 'openai-responses');
  expect(definition).toBeDefined();
  if (definition === undefined) return;
  expect(() => validateRuntimeSourceProofs(definition.id, definition.files)).not.toThrow();
  expect(() => validateRuntimeSourceProofs(definition.id, [])).toThrow('no longer demonstrates');
  expect(
    Object.values(RUNTIME_PATTERN_PROOFS)
      .flatMap(Object.values)
      .flat()
      .some(({ caseId }) => caseId === definition.id),
  ).toBe(true);
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

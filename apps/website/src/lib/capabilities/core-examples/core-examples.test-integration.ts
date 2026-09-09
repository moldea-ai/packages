// @vitest-environment node
import { beforeAll, expect, test } from 'vitest';

import type { ICapabilityCase } from '../index.ts';

import { CORE_EXAMPLES, createCoreExamples } from './core-examples.ts';
import { CORE_EXPECTED_RESULTS } from './expected-results.ts';

let examples: ICapabilityCase[];
beforeAll(async () => {
  examples = await createCoreExamples();
});

test('executes every authored Core case with its complete reviewed diagnostics', () => {
  expect(examples.map(({ id }) => id)).toStrictEqual(CORE_EXAMPLES.map(({ id }) => id));
  for (const example of examples) {
    expect(example.result).toStrictEqual({
      kind: 'validation',
      ...CORE_EXPECTED_RESULTS[example.id],
    });
  }
});

test('rejects a repaired failure instead of continuing to publish an invalid result', async () => {
  const definition = structuredClone(
    CORE_EXAMPLES.find(({ id }) => id === 'tool-implementation-missing'),
  );
  expect(definition).toBeDefined();
  if (definition === undefined) return;
  definition.entries.push({
    path: '/src/returns.ts',
    type: 'file',
    content: 'export const explainReturns = () => "30 days";\n',
  });
  await expect(createCoreExamples([definition])).rejects.toThrow('unexpected Core results');
});

test('rejects an additional diagnostic instead of hiding it in projection', async () => {
  const definition = structuredClone(CORE_EXAMPLES.find(({ id }) => id === 'agent-valid'));
  expect(definition).toBeDefined();
  if (definition === undefined) return;
  definition.entries = definition.entries.filter(({ path }) => !path.endsWith('/description.md'));
  await expect(createCoreExamples([definition])).rejects.toThrow('unexpected Core results');
});

test('is repeatable independently of synthetic source enumeration', async () => {
  const reversed = CORE_EXAMPLES.map((example) => ({
    ...example,
    entries: [...example.entries].reverse(),
  }));
  const repeated = await createCoreExamples(reversed);
  expect(repeated.map(({ id, result }) => ({ id, result }))).toStrictEqual(
    examples.map(({ id, result }) => ({ id, result })),
  );
});

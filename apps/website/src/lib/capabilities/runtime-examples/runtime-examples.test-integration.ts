// @vitest-environment node
import { beforeAll, expect, test } from 'vitest';

import type { ICapabilityCase } from '../index.ts';

import { RUNTIME_EXAMPLES } from './fixtures.ts';
import { RUNTIME_EXPECTED_RESULTS } from './expected-results.ts';
import { createRuntimeExamples } from './runtime-examples.ts';

let examples: ICapabilityCase[];
beforeAll(async () => {
  examples = await createRuntimeExamples();
});

test('executes all ten adapters and matches every complete evidence record and diagnostic', () => {
  expect(examples).toHaveLength(30);
  expect(new Set(examples.map(({ packageName }) => packageName)).size).toBe(10);
  for (const { id, result } of examples) {
    const expected = RUNTIME_EXPECTED_RESULTS[id];
    expect(expected).toBeDefined();
    expect(result).toStrictEqual({
      kind: 'adapter',
      valid: expected?.valid,
      diagnostics: expected?.diagnostics,
      evidence: expected?.evidence,
    });
  }
});

test('rejects a removed declared relationship even if remaining diagnostics are unchanged', async () => {
  const original = RUNTIME_EXAMPLES.find(({ id }) => id === 'openai-responses');
  expect(original).toBeDefined();
  if (original === undefined) return;
  const files = structuredClone(original.files).map((file) =>
    file.path === '/moldea/moldea.yaml' && file.type === 'file' && typeof file.content === 'string'
      ? {
          ...file,
          content: file.content.replace(
            '      instructionLoader:\n        path: /src/instructions.ts\n        symbol: loadInstruction\n',
            '',
          ),
        }
      : file,
  );
  expect(files).not.toStrictEqual(original.files);
  await expect(createRuntimeExamples([{ ...original, files }])).rejects.toThrow(
    'unexpected results',
  );
});

test('rejects disconnected positive evidence without executing the illustrated program', async () => {
  const original = RUNTIME_EXAMPLES.find(({ id }) => id === 'openai-responses');
  expect(original).toBeDefined();
  if (original === undefined) return;
  const files = structuredClone(original.files).map((file) =>
    file.path === '/src/agent.ts' && file.type === 'file' && typeof file.content === 'string'
      ? { ...file, content: file.content.replace('readInstruction()', '"Answer the customer"') }
      : file,
  );
  await expect(createRuntimeExamples([{ ...original, files }])).rejects.toThrow();
});

test('does not label an unestablished dynamic relationship invalid or supported', () => {
  const result = examples.find(({ id }) => id === 'vercel-dynamic-preparation')?.result;
  expect(result?.kind).toBe('adapter');
  if (result?.kind !== 'adapter') return;
  expect(result.valid).toBe(true);
  expect(result.diagnostics).toStrictEqual([]);
  expect(
    result.evidence.filter(
      ({ agentId, kind }) => agentId === 'support' && kind === 'instruction-loader',
    ),
  ).toStrictEqual([]);
});

test('retains deterministic outcomes when input file enumeration changes', async () => {
  const repeated = await createRuntimeExamples(
    RUNTIME_EXAMPLES.map((example) => ({ ...example, files: [...example.files].reverse() })),
  );
  expect(repeated.map(({ id, result }) => ({ id, result }))).toStrictEqual(
    examples.map(({ id, result }) => ({ id, result })),
  );
});

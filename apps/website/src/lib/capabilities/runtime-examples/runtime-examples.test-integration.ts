// @vitest-environment node
import { beforeAll, expect, test } from 'vitest';

import { anthropicAdapter } from '@moldea.ai/adapter-anthropic';
import { createCore } from '@moldea.ai/core';
import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';

import type { ICapabilityCase } from '../index.ts';

import { ANTHROPIC_FILES } from './anthropic.ts';
import { RUNTIME_EXAMPLES } from './fixtures.ts';
import { RUNTIME_EXPECTED_RESULTS } from './expected-results.ts';
import { createRuntimeExamples } from './runtime-examples.ts';

let examples: ICapabilityCase[];
beforeAll(async () => {
  examples = await createRuntimeExamples();
});

test('executes all ten adapters and matches every complete evidence record and diagnostic', () => {
  expect(examples).toHaveLength(33);
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

test('keeps warning, confirmed failure, and mixed paginated outcomes distinct', async () => {
  const createRepository = (instruction: string, tools: string) =>
    createMemoryRepositoryReader(
      ANTHROPIC_FILES.map((file) =>
        file.path === '/src/agent.ts' && file.type === 'file' && typeof file.content === 'string'
          ? {
              ...file,
              content: file.content
                .replace('system: readInstruction()', `system: ${instruction}`)
                .replace('tools: [registeredFindOrder]', `tools: ${tools}`),
            }
          : file,
      ),
    );
  const core = createCore({ adapters: [anthropicAdapter] });
  const warning = await core.validateProject({
    repository: createRepository('dynamicSystem', '[registeredFindOrder]'),
  });
  expect([warning.valid, warning.errorCount, warning.warningCount]).toStrictEqual([true, 0, 1]);
  expect(warning.diagnostics).toMatchObject([
    {
      code: 'ANTHROPIC_RUNTIME_RELATIONSHIP_UNVERIFIED',
      details: { reason: 'dynamic-source-pattern', relationship: 'instruction-loader' },
      severity: 'warning',
    },
  ]);
  expect(warning.evidence.some(({ kind }) => kind === 'instruction-loader')).toBe(false);

  const confirmed = await core.validateProject({
    repository: createRepository("'Other instruction.'", '[registeredFindOrder]'),
  });
  expect([confirmed.valid, confirmed.errorCount, confirmed.warningCount]).toStrictEqual([
    false,
    1,
    0,
  ]);
  expect(confirmed.diagnostics).toMatchObject([
    { code: 'ANTHROPIC_INSTRUCTION_LOADER_NOT_WIRED', severity: 'error' },
  ]);

  const inspection = await core.createProjectInspection({
    repository: createRepository('dynamicSystem', '[]'),
  });
  const first = inspection.readPage({ maxItems: 1, view: 'diagnostics' });
  expect(first.page.nextCursor).not.toBeNull();
  const second = inspection.readPage({
    cursor: first.page.nextCursor ?? '',
    maxItems: 1,
    view: 'diagnostics',
  });
  expect(first.counts).toMatchObject({ diagnostics: 2, errors: 1, warnings: 1 });
  expect(second.counts).toStrictEqual(first.counts);
  expect(second.page.nextCursor).toBeNull();
  expect(
    [...first.page.records, ...second.page.records].map(({ item }) =>
      item.kind === 'diagnostic' ? item.diagnostic.severity : null,
    ),
  ).toStrictEqual(['warning', 'error']);
});

test('retains deterministic outcomes when input file enumeration changes', async () => {
  const repeated = await createRuntimeExamples(
    RUNTIME_EXAMPLES.map((example) => ({ ...example, files: [...example.files].reverse() })),
  );
  expect(repeated.map(({ id, result }) => ({ id, result }))).toStrictEqual(
    examples.map(({ id, result }) => ({ id, result })),
  );
});

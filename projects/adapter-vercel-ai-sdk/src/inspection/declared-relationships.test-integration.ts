// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { createCore } from '@moldea.ai/core';
import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';

import { vercelAiSdkAdapter } from '../adapter/index.js';

const sourcePath = '/src/declared.ts';
const reference = (symbol: string) => ({ path: sourcePath, symbol });
const declaration = {
  runtime: { id: 'vercel-ai-sdk' },
  bindings: {
    runtimeAgent: reference('runtimeBinding'),
    instructionLoader: reference('loadInstructions'),
    inputSchema: reference('AgentInput'),
    outputSchema: reference('AgentOutput'),
    variableProviders: { REGION: reference('regionProvider') },
  },
  variables: { REGION: { description: 'The deployment region.' } },
  tools: {
    audit: {
      name: 'audit',
      description: 'Audits records.',
      implementation: reference('runTool'),
      registration: reference('toolRegistration'),
      inputSchema: reference('ToolInput'),
      outputSchema: reference('ToolOutput'),
    },
  },
  skills: {
    triage: {
      name: 'triage',
      description: 'Triages records.',
      implementation: reference('runSkill'),
      registration: reference('skillRegistration'),
    },
  },
};
const relationships = [
  ['runtime-agent', 'runtimeBinding', 'VERCEL_AI_SDK_RUNTIME_AGENT_SYMBOL_NOT_FOUND'],
  ['instruction-loader', 'loadInstructions', 'VERCEL_AI_SDK_INSTRUCTION_LOADER_SYMBOL_NOT_FOUND'],
  ['agent-input-schema', 'AgentInput', 'VERCEL_AI_SDK_AGENT_INPUT_SCHEMA_SYMBOL_NOT_FOUND'],
  ['agent-output-schema', 'AgentOutput', 'VERCEL_AI_SDK_AGENT_OUTPUT_SCHEMA_SYMBOL_NOT_FOUND'],
  ['tool-implementation', 'runTool', 'VERCEL_AI_SDK_TOOL_IMPLEMENTATION_SYMBOL_NOT_FOUND'],
  ['tool-registration', 'toolRegistration', 'VERCEL_AI_SDK_TOOL_REGISTRATION_SYMBOL_NOT_FOUND'],
  ['tool-input-schema', 'ToolInput', 'VERCEL_AI_SDK_TOOL_INPUT_SCHEMA_SYMBOL_NOT_FOUND'],
  ['tool-output-schema', 'ToolOutput', 'VERCEL_AI_SDK_TOOL_OUTPUT_SCHEMA_SYMBOL_NOT_FOUND'],
  ['skill-implementation', 'runSkill', 'VERCEL_AI_SDK_SKILL_IMPLEMENTATION_SYMBOL_NOT_FOUND'],
  ['skill-registration', 'skillRegistration', 'VERCEL_AI_SDK_SKILL_REGISTRATION_SYMBOL_NOT_FOUND'],
  ['variable-provider', 'regionProvider', 'VERCEL_AI_SDK_VARIABLE_PROVIDER_SYMBOL_NOT_FOUND'],
] as const;
const declarationSource = (symbol: string) =>
  `export const ${symbol} = ${symbol === 'runtimeBinding' ? '{ unsupported: true }' : '{}'};`;
const source = relationships.map(([, symbol]) => declarationSource(symbol)).join('\n');
const inspect = (text: string) =>
  createCore({ adapters: [vercelAiSdkAdapter] }).validateProject({
    repository: createMemoryRepositoryReader([
      {
        path: '/moldea/moldea.yaml',
        type: 'file',
        content: JSON.stringify({ version: 1, agents: { support: declaration } }),
      },
      { path: '/moldea/project.md', type: 'file', content: '# Audit support\n' },
      { path: '/moldea/agents/support/description.md', type: 'file', content: 'Audits records.\n' },
      {
        path: '/moldea/agents/support/instruction.md',
        type: 'file',
        content: 'You are the `support` agent.\nAudit in {{REGION}}.\n',
      },
      { path: sourcePath, type: 'file', content: text },
    ]),
  });

describe('independent declarations and unsupported runtime accounting', () => {
  test('accounts for every applicable declaration when the runtime shape is unsupported', async () => {
    const result = await inspect(source);
    expect(result.valid).toBe(true);
    expect(result.runtimeInspection).toBe('incomplete');
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(11);
    expect(result.evidence.filter((record) => record.kind !== 'language')).toStrictEqual([]);
    expect(
      result.diagnostics.map((diagnostic) => diagnostic.details['relationship']).sort(),
    ).toStrictEqual(relationships.map(([relationship]) => relationship).sort());
    expect(
      result.diagnostics.every(
        (diagnostic) =>
          diagnostic.severity === 'warning' && diagnostic.entity?.agentId === 'support',
      ),
    ).toBe(true);
    expect(
      result.diagnostics.find(
        (diagnostic) => diagnostic.details['relationship'] === 'variable-provider',
      )?.entity?.variableId,
    ).toBe('REGION');
  });

  test.each(relationships)(
    'detects a missing %s export independently (%s)',
    async (relationship, symbol, code) => {
      const result = await inspect(source.replace(declarationSource(symbol), ''));
      expect(result.valid).toBe(false);
      expect(result.runtimeInspection).toBe('incomplete');
      expect(result.errorCount).toBe(1);
      expect(result.warningCount).toBe(10);
      expect(
        result.diagnostics
          .filter((diagnostic) => diagnostic.severity === 'error')
          .map((diagnostic) => ({
            code: diagnostic.code,
            path: diagnostic.path,
            agentId: diagnostic.entity?.agentId,
          })),
      ).toStrictEqual([{ code, path: sourcePath, agentId: 'support' }]);
      expect(
        result.diagnostics
          .filter((diagnostic) => diagnostic.severity === 'warning')
          .map((diagnostic) => diagnostic.details['relationship'])
          .sort(),
      ).toStrictEqual(
        relationships
          .filter(([candidate]) => candidate !== relationship)
          .map(([candidate]) => candidate)
          .sort(),
      );
    },
  );

  test.each(relationships)(
    'does not invent absence through an unresolved wildcard (%s, %s)',
    async (_relationship, symbol) => {
      const result = await inspect(
        source.replace(declarationSource(symbol), "export * from './external.js';"),
      );
      expect(result.valid).toBe(true);
      expect(result.errorCount).toBe(0);
      expect(result.runtimeInspection).toBe('incomplete');
      expect(result.warningCount).toBe(11);
      expect(result.diagnostics.every((diagnostic) => diagnostic.severity === 'warning')).toBe(
        true,
      );
    },
  );
});

// provenance remains independently checkable even when the runtime definition is unsupported
test.each([
  ["export const loadInstructions = () => 'wrong instruction policy';", 1, 10],
  [
    "import { readFileSync } from 'node:fs'; export const loadInstructions = () => readFileSync(new URL('./other.md', import.meta.url), 'utf8');",
    1,
    10,
  ],
  [
    "export const loadInstructions = () => 'You are the `support` agent.\\nAudit in {{REGION}}.\\n';",
    0,
    11,
  ],
  ['export const loadInstructions = () => transformInstructions();', 0, 11],
])('accounts for canonical instruction provenance (%s)', async (loader, errors, warnings) => {
  const result = await inspect(source.replace(declarationSource('loadInstructions'), loader));
  expect(result.valid).toBe(errors === 0);
  expect(result.runtimeInspection).toBe('incomplete');
  expect(result.errorCount).toBe(errors);
  expect(result.warningCount).toBe(warnings);
  expect(result.evidence.some((record) => record.kind === 'instruction-loader')).toBe(false);
  expect(
    result.diagnostics
      .filter((diagnostic) => diagnostic.severity === 'error')
      .map((diagnostic) => diagnostic.code),
  ).toStrictEqual(errors === 0 ? [] : ['VERCEL_AI_SDK_INSTRUCTION_SOURCE_MISMATCH']);
});

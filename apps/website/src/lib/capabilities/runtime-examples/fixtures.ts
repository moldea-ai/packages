import { anthropicAdapter } from '@moldea.ai/adapter-anthropic';
import { claudeAgentSdkAdapter } from '@moldea.ai/adapter-claude-agent-sdk';
import { cloudflareAgentsAdapter } from '@moldea.ai/adapter-cloudflare-agents';
import { eveAdapter } from '@moldea.ai/adapter-eve';
import { googleGenAiAdapter } from '@moldea.ai/adapter-google-genai';
import { langChainAdapter } from '@moldea.ai/adapter-langchain';
import { langGraphAdapter } from '@moldea.ai/adapter-langgraph';
import { openAiAdapter } from '@moldea.ai/adapter-openai';
import { openAiAgentsSdkAdapter } from '@moldea.ai/adapter-openai-agents-sdk';
import { vercelAiSdkAdapter } from '@moldea.ai/adapter-vercel-ai-sdk';
import type { IMemoryRepositoryEntry } from '@moldea.ai/repository/memory';

import { ANTHROPIC_FILES } from './anthropic.ts';
import { CLAUDE_AGENT_SDK_FILES } from './claude-agent-sdk.ts';
import { CLOUDFLARE_AGENTS_FILES } from './cloudflare-agents.ts';
import { EVE_FILES } from './eve.ts';
import { GOOGLE_GENAI_FILES } from './google-genai.ts';
import { LANGCHAIN_FILES } from './langchain.ts';
import { LANGGRAPH_FILES } from './langgraph.ts';
import { OPENAI_FILES } from './openai.ts';
import { OPENAI_AGENTS_SDK_FILES } from './openai-agents-sdk.ts';
import { VERCEL_AI_SDK_FILES } from './vercel-ai-sdk.ts';
import type { IRuntimeExampleDefinition } from './types.ts';

/** Reads only an explicitly selected website-owned source string. */
const source = (files: IMemoryRepositoryEntry[], path: string): string => {
  const entry = files.find((entry) => entry.path === path);
  if (entry?.type !== 'file' || typeof entry.content !== 'string') {
    throw new Error('A runtime capability fixture source is missing.');
  }
  return entry.content;
};

/** Applies an explicit file substitution, addition, or removal to a synthetic snapshot. */
const overrideFiles = (
  files: IMemoryRepositoryEntry[],
  replacements: Record<string, string | null>,
): IMemoryRepositoryEntry[] => [
  ...files.filter(({ path }) => !Object.hasOwn(replacements, path)),
  ...Object.entries(replacements).flatMap(([path, content]): IMemoryRepositoryEntry[] =>
    content === null ? [] : [{ path, content, type: 'file' }],
  ),
];

const eveManifest = source(EVE_FILES, '/moldea/moldea.yaml');
const markdownInstructionManifest = eveManifest.replace(
  'path: /agent/loaders.ts\n        symbol: loadInstruction',
  'path: /agent/instructions.md',
);

// direct source forms with positive package evidence; provider source is never imported
export const RUNTIME_EXAMPLES: IRuntimeExampleDefinition[] = [
  {
    id: 'anthropic-messages',
    adapter: anthropicAdapter,
    title: 'A Messages request connected to its tools',
    description:
      'The direct request, system loader, client tool array, and input schema are inspectable.',
    files: ANTHROPIC_FILES,
  },
  {
    id: 'anthropic-parse-output',
    adapter: anthropicAdapter,
    title: 'A parsed Messages request with a bound output schema',
    description:
      'The direct output format and transport-only options preserve the instruction and tool relationships.',
    files: overrideFiles(ANTHROPIC_FILES, {
      '/moldea/moldea.yaml': source(ANTHROPIC_FILES, '/moldea/moldea.yaml').replace(
        '      instructionLoader:',
        '      outputSchema:\n        path: /src/contracts.ts\n        symbol: SupportOutput\n      instructionLoader:',
      ),
      '/src/contracts.ts': `${source(ANTHROPIC_FILES, '/src/contracts.ts')}\nexport const SupportOutput = { type: 'object', properties: { answer: { type: 'string' } }, required: ['answer'], additionalProperties: false } as const;\n`,
      '/src/agent.ts': source(ANTHROPIC_FILES, '/src/agent.ts')
        .replace('import { FindOrderInput }', 'import { FindOrderInput, SupportOutput }')
        .replace('client.messages.create({', 'client.messages.parse({')
        .replace(
          '    tools: [registeredFindOrder],',
          "    tools: [registeredFindOrder],\n    output_config: { format: { type: 'json_schema', schema: SupportOutput } },",
        )
        .replace('  });', '  }, { timeout: 1000 });'),
    }),
  },
  {
    id: 'claude-query',
    adapter: claudeAgentSdkAdapter,
    title: 'A query that can delegate',
    description:
      'Inspect the programmatic subagent, routing description, query output, and mounted MCP tool.',
    files: CLAUDE_AGENT_SDK_FILES,
  },
  {
    id: 'cloudflare-agents',
    adapter: cloudflareAgentsAdapter,
    title: 'Think and AIChatAgent source connections',
    description:
      'Inspect supported class methods, direct generation, schemas, and closed tool maps.',
    files: CLOUDFLARE_AGENTS_FILES,
  },
  {
    id: 'eve-filesystem',
    adapter: eveAdapter,
    title: 'The filesystem describes the agent',
    description:
      'Inspect the nested agent, instruction loader, tool, TypeScript skill, and directory-local subagent.',
    files: EVE_FILES,
  },
  {
    id: 'google-generate-content',
    adapter: googleGenAiAdapter,
    title: 'A generate-content request with declared functions',
    description:
      'Inspect the system instruction and closed function declarations with their parameter schemas.',
    files: GOOGLE_GENAI_FILES,
  },
  {
    id: 'google-mixed-generation',
    adapter: googleGenAiAdapter,
    title: 'Generate content and stream from the same agent',
    description:
      'Both direct model methods retain the declared instruction and function relationships.',
    files: overrideFiles(GOOGLE_GENAI_FILES, {
      '/src/agent.ts': source(GOOGLE_GENAI_FILES, '/src/agent.ts')
        .replace(
          'export const supportAgent = async () =>\n  client.models.generateContent(',
          'export const supportAgent = async () => {\n  const initial = client.models.generateContent(',
        )
        .replace(
          '  });\n',
          "  });\n  const streamed = client.models.generateContentStream({ model: 'gemini-2.5-flash', contents: 'Help the customer.', config: { systemInstruction: await readInstruction(), tools: [{ functionDeclarations: [registeredFindOrder] }] } });\n  return [initial, streamed];\n};\n",
        ),
    }),
  },
  {
    id: 'langchain-create-agent',
    adapter: langChainAdapter,
    title: 'A createAgent definition with closed relationships',
    description:
      'Inspect the primary package boundary, system prompt, structured-output strategy, and tools.',
    files: LANGCHAIN_FILES,
  },
  {
    id: 'langchain-direct-schema',
    adapter: langChainAdapter,
    title: 'A direct response schema',
    description: 'The output schema can be connected directly, without a strategy helper.',
    files: overrideFiles(LANGCHAIN_FILES, {
      '/src/agent.ts': source(LANGCHAIN_FILES, '/src/agent.ts').replace(
        'providerStrategy({ schema: SupportOutputSchema, strict: true })',
        'SupportOutputSchema',
      ),
    }),
  },
  {
    id: 'langchain-tool-strategy',
    adapter: langChainAdapter,
    title: 'A tool-based structured-output strategy',
    description: 'The supported strategy helper retains the declared output-schema connection.',
    files: overrideFiles(LANGCHAIN_FILES, {
      '/src/agent.ts': source(LANGCHAIN_FILES, '/src/agent.ts')
        .replace('createAgent, providerStrategy,', 'createAgent, toolStrategy,')
        .replace(
          'providerStrategy({ schema: SupportOutputSchema, strict: true })',
          'toolStrategy(SupportOutputSchema)',
        ),
    }),
  },
  {
    id: 'langgraph-workflows',
    adapter: langGraphAdapter,
    title: 'A graph and a functional workflow',
    description:
      'Inspect graph nodes, edges, schemas, compile identity, tasks, interrupts, and saved-state calls.',
    files: LANGGRAPH_FILES,
  },
  {
    id: 'openai-responses',
    adapter: openAiAdapter,
    title: 'Find the instructions and tools a request uses',
    description:
      'The source connects this request to an instruction loader and an order-lookup tool.',
    files: OPENAI_FILES,
  },
  {
    id: 'openai-parse-output',
    adapter: openAiAdapter,
    title: 'A parsed Responses request with a bound output schema',
    description:
      'The direct Zod helper and effective options body retain the instruction, output, and tool bindings.',
    files: overrideFiles(OPENAI_FILES, {
      '/package.json': source(OPENAI_FILES, '/package.json').replace(
        '"openai": "^7.4.0"',
        '"openai": "^7.4.0",\n    "zod": "^4.3.6"',
      ),
      '/moldea/moldea.yaml': source(OPENAI_FILES, '/moldea/moldea.yaml').replace(
        '      instructionLoader:',
        '      outputSchema:\n        path: /src/contracts.ts\n        symbol: SupportOutput\n      instructionLoader:',
      ),
      '/src/contracts.ts': `import { z } from 'zod';\n\n${source(OPENAI_FILES, '/src/contracts.ts')}\nexport const SupportOutput = z.object({ answer: z.string() });\n`,
      '/src/agent.ts': source(OPENAI_FILES, '/src/agent.ts')
        .replace(
          "import OpenAIClient from 'openai';",
          "import { OpenAI as OpenAIClient } from 'openai';\nimport { zodTextFormat } from 'openai/helpers/zod';",
        )
        .replace('import { FindOrderInput }', 'import { FindOrderInput, SupportOutput }')
        .replace('client.responses.create({', 'client.responses.parse({')
        .replace(
          '  });',
          "  }, { body: { model: 'gpt-5', input: 'Help the customer.', instructions: readInstruction(), tools: [registeredFindOrder], text: { format: zodTextFormat(SupportOutput, 'support') } } });",
        ),
    }),
  },
  {
    id: 'openai-agent-handoffs',
    adapter: openAiAgentsSdkAdapter,
    title: 'An agent with two explicit handoff forms',
    description:
      'Inspect Agent construction, Agent.create, the closed tool list, direct and configured handoffs, and routing descriptions.',
    files: OPENAI_AGENTS_SDK_FILES,
  },
  {
    id: 'vercel-agent-and-stream',
    adapter: vercelAiSdkAdapter,
    title: 'An agent and a direct text stream',
    description:
      'Inspect ToolLoopAgent call options, instruction loaders, object output, and function-tool connections.',
    files: VERCEL_AI_SDK_FILES,
  },
  {
    id: 'claude-preset',
    adapter: claudeAgentSdkAdapter,
    title: 'A preset prompt with an explicit addition',
    description:
      'The supported preset-append form retains the declared instruction-loader relationship.',
    files: overrideFiles(CLAUDE_AGENT_SDK_FILES, {
      '/src/runtime.ts': source(CLAUDE_AGENT_SDK_FILES, '/src/runtime.ts').replace(
        'systemPrompt: await loadTriageInstruction(),',
        "systemPrompt: { type: 'preset', preset: 'claude_code', append: await loadTriageInstruction() },",
      ),
    }),
  },
  {
    id: 'claude-inherited-tools',
    adapter: claudeAgentSdkAdapter,
    title: 'A subagent inherits available tools',
    description:
      'Omitting the subagent tool list uses the supported query-level inheritance rules.',
    files: overrideFiles(CLAUDE_AGENT_SDK_FILES, {
      '/src/agents.ts': source(CLAUDE_AGENT_SDK_FILES, '/src/agents.ts').replace(
        "  tools: ['mcp__support__find_order'],\n",
        '',
      ),
    }),
  },
  {
    id: 'langgraph-inline',
    adapter: langGraphAdapter,
    title: 'An inline graph builder',
    description:
      'A direct builder chain establishes the compiled graph without executing its nodes.',
    files: overrideFiles(LANGGRAPH_FILES, {
      '/src/graph.ts': source(LANGGRAPH_FILES, '/src/graph.ts')
        .replace('const builder = new StateGraph', 'export const supportGraph = new StateGraph')
        .replaceAll(';\nbuilder.', '\n.')
        .replace(';\nexport const supportGraph = builder.compile', '\n.compile'),
    }),
  },
  {
    id: 'vercel-generate',
    adapter: vercelAiSdkAdapter,
    title: 'The non-streaming generation form',
    description: 'The same closed relationships can be inspected in a direct generateText call.',
    files: overrideFiles(VERCEL_AI_SDK_FILES, {
      '/src/agents.ts': source(VERCEL_AI_SDK_FILES, '/src/agents.ts').replace(
        'async () => streamText(',
        'async () => generateText(',
      ),
    }),
  },
  {
    id: 'vercel-instruction-precedence',
    adapter: vercelAiSdkAdapter,
    title: 'The explicit instruction takes precedence',
    description:
      'When both fields are present, the supported instructions field owns the loader relationship.',
    files: overrideFiles(VERCEL_AI_SDK_FILES, {
      '/src/agents.ts': source(VERCEL_AI_SDK_FILES, '/src/agents.ts').replace(
        'instructions: await loadSummaryInstruction(),',
        "system: 'A fallback instruction.', instructions: await loadSummaryInstruction(),",
      ),
    }),
  },
  {
    id: 'vercel-system-fallback',
    adapter: vercelAiSdkAdapter,
    title: 'The system fallback owns the instruction',
    description:
      'Without instructions, the supported system field supplies the declared loader connection.',
    files: overrideFiles(VERCEL_AI_SDK_FILES, {
      '/src/agents.ts': source(VERCEL_AI_SDK_FILES, '/src/agents.ts').replace(
        'instructions: await loadSummaryInstruction(),',
        'system: await loadSummaryInstruction(),',
      ),
    }),
  },
  {
    id: 'vercel-dynamic-preparation',
    adapter: vercelAiSdkAdapter,
    title: 'Preparation can replace the visible wiring',
    description:
      'The construction-time instruction, output, and tools are not established when prepareCall can replace them.',
    files: overrideFiles(VERCEL_AI_SDK_FILES, {
      '/src/agents.ts': source(VERCEL_AI_SDK_FILES, '/src/agents.ts').replace(
        "id: 'support-runtime',",
        "id: 'support-runtime', prepareCall: async (options) => options,",
      ),
    }),
  },
  {
    id: 'eve-flat-root',
    adapter: eveAdapter,
    title: 'An agent at the package root',
    description: 'The supported flat layout retains the same explicit source relationships.',
    files: EVE_FILES.map((entry) => ({
      ...entry,
      path: entry.path.replace(/^\/agent\//u, '/'),
      ...(entry.type === 'file' && typeof entry.content === 'string'
        ? { content: entry.content.replaceAll('/agent/', '/') }
        : {}),
    })),
  },
  {
    id: 'eve-markdown-instruction',
    adapter: eveAdapter,
    title: 'A single Markdown instruction slot',
    description:
      'An exclusive lowercase instructions.md file establishes the declared instruction path.',
    files: overrideFiles(EVE_FILES, {
      '/moldea/moldea.yaml': markdownInstructionManifest,
      '/agent/instructions.ts': null,
      '/agent/instructions.md': 'Support customers with order and delivery questions.\n',
    }),
  },
  {
    id: 'eve-case-varied-instruction',
    adapter: eveAdapter,
    title: 'A case-varied instruction is not a complete proof',
    description:
      'The candidate participates in precedence analysis without positive complete-instruction evidence.',
    files: overrideFiles(EVE_FILES, {
      '/agent/instructions.ts': null,
      '/agent/Instructions.md': 'Support customers.\n',
    }),
  },
  {
    id: 'eve-system-instruction',
    adapter: eveAdapter,
    title: 'An alternative instruction file is not proof',
    description:
      'The presence of system.md does not establish the declared canonical instruction connection.',
    files: overrideFiles(EVE_FILES, {
      '/agent/instructions.ts': null,
      '/agent/system.md': 'Support customers.\n',
    }),
  },
  {
    id: 'eve-nested-tool',
    adapter: eveAdapter,
    title: 'A nested tool gets a flattened name',
    description: 'The path orders/search.ts establishes the runtime name orders-search.',
    files: overrideFiles(EVE_FILES, {
      '/moldea/moldea.yaml': eveManifest
        .replace('name: search', 'name: orders-search')
        .replaceAll('/agent/tools/search.ts', '/agent/tools/orders/search.ts'),
      '/agent/tools/search.ts': null,
      '/agent/tools/orders/search.ts': source(EVE_FILES, '/agent/tools/search.ts').replaceAll(
        "'../",
        "'../../",
      ),
    }),
  },
  {
    id: 'eve-tool-name-collision',
    adapter: eveAdapter,
    title: 'Two tool paths produce the same name',
    description:
      'orders-search.ts and orders/search.ts collide after filesystem name normalization.',
    files: overrideFiles(EVE_FILES, {
      '/moldea/moldea.yaml': eveManifest
        .replace('name: search', 'name: orders-search')
        .replaceAll('/agent/tools/search.ts', '/agent/tools/orders-search.ts'),
      '/agent/tools/search.ts': null,
      '/agent/tools/orders-search.ts': source(EVE_FILES, '/agent/tools/search.ts'),
      '/agent/tools/orders/search.ts': source(EVE_FILES, '/agent/tools/search.ts').replaceAll(
        "'../",
        "'../../",
      ),
    }),
  },
  ...(['flat', 'packaged'] as const).map((layout): IRuntimeExampleDefinition => {
    const path = layout === 'flat' ? '/agent/skills/analyze.md' : '/agent/skills/analyze/SKILL.md';
    return {
      id: `eve-${layout}-skill`,
      adapter: eveAdapter,
      title:
        layout === 'flat'
          ? 'A Markdown skill implementation path'
          : 'A packaged skill implementation path',
      description:
        'The implementation path is inspectable, but Markdown acceptance and runtime registration are not established.',
      files: overrideFiles(EVE_FILES, {
        '/moldea/moldea.yaml': eveManifest.replaceAll(
          'path: /agent/skills/analyze.ts\n          symbol: default',
          `path: ${path}`,
        ),
        '/agent/skills/analyze.ts': null,
        [path]: '# Analyze\n\nSummarize the supplied source material.\n',
      }),
    };
  }),
  {
    id: 'eve-single-file-subagent',
    adapter: eveAdapter,
    title: 'A single-file subagent is only a candidate',
    description:
      'The candidate participates in namespace preflight without positive agent-definition or handoff evidence.',
    files: overrideFiles(EVE_FILES, {
      '/moldea/moldea.yaml': eveManifest.replaceAll(
        '/agent/subagents/summary/agent.ts',
        '/agent/subagents/summary.ts',
      ),
      '/agent/subagents/summary/agent.ts': null,
      '/agent/subagents/summary.ts': source(EVE_FILES, '/agent/subagents/summary/agent.ts'),
    }),
  },
  {
    id: 'eve-framework-namespace',
    adapter: eveAdapter,
    title: 'A subagent collides with a framework tool',
    description:
      'The static namespace prevents claiming a handoff named glob. This does not establish turn-time tool availability.',
    files: EVE_FILES.map((entry) => ({
      ...entry,
      path: entry.path.replaceAll('summary', 'glob'),
      ...(entry.type === 'file' && typeof entry.content === 'string'
        ? { content: entry.content.replaceAll('summary', 'glob') }
        : {}),
    })),
  },
  {
    id: 'openai-loader-disconnected',
    adapter: openAiAdapter,
    title: 'The instruction file exists, but is not connected',
    description: 'The request uses hard-coded text instead of its declared instruction loader.',
    files: overrideFiles(OPENAI_FILES, {
      '/src/agent.ts': source(OPENAI_FILES, '/src/agent.ts').replace(
        'instructions: readInstruction(),',
        "instructions: 'Help customers track their orders.',",
      ),
    }),
  },
];

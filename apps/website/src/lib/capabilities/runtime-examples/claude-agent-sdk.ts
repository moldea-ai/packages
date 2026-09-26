import type { IMemoryRepositoryEntry } from '@moldea.ai/repository/memory';

// synthetic source relationships, adapted from the package conformance inputs; never executed
export const CLAUDE_AGENT_SDK_FILES: IMemoryRepositoryEntry[] = [
  {
    path: '/moldea/moldea.yaml',
    type: 'file',
    content:
      'version: 1\nagents:\n  billing:\n    runtime:\n      id: claude-agent-sdk\n    bindings:\n      runtimeAgent:\n        path: /src/agents.ts\n        symbol: billingAgent\n      instructionLoader:\n        path: /src/instructions.ts\n        symbol: loadBillingInstruction\n    tools:\n      find-order:\n        name: mcp__support__find_order\n        description: Retrieves one order by its identifier.\n        implementation:\n          path: /src/find-order.ts\n          symbol: findOrder\n        registration:\n          path: /src/tools.ts\n          symbol: findOrderTool\n        inputSchema:\n          path: /src/contracts.ts\n          symbol: FindOrderInputSchema\n  triage:\n    runtime:\n      id: claude-agent-sdk\n    bindings:\n      runtimeAgent:\n        path: /src/runtime.ts\n        symbol: triageAgent\n      instructionLoader:\n        path: /src/instructions.ts\n        symbol: loadTriageInstruction\n      outputSchema:\n        path: /src/contracts.ts\n        symbol: TriageOutputSchema\n    tools:\n      find-order:\n        name: mcp__support__find_order\n        description: Retrieves one order by its identifier.\n        implementation:\n          path: /src/find-order.ts\n          symbol: findOrder\n        registration:\n          path: /src/tools.ts\n          symbol: findOrderTool\n        inputSchema:\n          path: /src/contracts.ts\n          symbol: FindOrderInputSchema\n',
  },
  {
    path: '/moldea/project.md',
    type: 'file',
    content: '# Customer support\n\nHelp customers find orders and route specialist requests.\n',
  },
  {
    path: '/moldea/agents/billing/description.md',
    type: 'file',
    content: 'Handles customer billing requests.\n',
  },
  {
    path: '/moldea/agents/billing/handoff-description.md',
    type: 'file',
    content: 'Route billing questions and payment issues here.\n',
  },
  {
    path: '/moldea/agents/billing/instruction.md',
    type: 'file',
    content: 'You are the `billing` agent.\n',
  },
  {
    path: '/moldea/agents/triage/description.md',
    type: 'file',
    content: 'Routes customer support requests.\n',
  },
  {
    path: '/moldea/agents/triage/instruction.md',
    type: 'file',
    content: 'You are the `triage` agent.\n',
  },
  {
    path: '/package.json',
    type: 'file',
    content:
      '{\n  "dependencies": {\n    "@anthropic-ai/claude-agent-sdk": "^0.3.234",\n    "zod": "4.3.6"\n  }\n}\n',
  },
  {
    path: '/src/agents.ts',
    type: 'file',
    content:
      "import { loadBillingInstruction } from './instructions.js';\n\nexport const billingAgent = {\n  description: 'Route billing questions and payment issues here.',\n  prompt: loadBillingInstruction(),\n  tools: ['mcp__support__find_order'],\n};\n",
  },
  {
    path: '/src/contracts.ts',
    type: 'file',
    content:
      "import { z } from 'zod';\n\nexport const TriageOutputSchema = { type: 'object' } as const;\nexport const FindOrderInputSchema = { orderId: z.string() };\n",
  },
  {
    path: '/src/find-order.ts',
    type: 'file',
    content:
      "export const findOrder = async (input: { orderId: string }) => ({ content: [{ type: 'text' as const, text: input.orderId }] });\n",
  },
  {
    path: '/src/instructions.ts',
    type: 'file',
    content:
      "export const loadBillingInstruction = async (): Promise<string> => 'Resolve billing requests.';\nexport const loadTriageInstruction = async (): Promise<string> => 'Route the request.';\n",
  },
  {
    path: '/src/runtime.ts',
    type: 'file',
    content:
      "import { query } from '@anthropic-ai/claude-agent-sdk';\n\nimport { billingAgent } from './agents.js';\nimport { TriageOutputSchema } from './contracts.js';\nimport { loadTriageInstruction } from './instructions.js';\nimport { supportServer } from './tools.js';\n\nexport const triageAgent = async (prompt: string) =>\n  query({\n    prompt,\n    options: {\n      systemPrompt: await loadTriageInstruction(),\n      outputFormat: { type: 'json_schema', schema: TriageOutputSchema },\n      agents: { billing: billingAgent },\n      tools: ['Agent'],\n      mcpServers: { support: supportServer },\n    },\n  });\n",
  },
  {
    path: '/src/tools.ts',
    type: 'file',
    content:
      "import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';\n\nimport { FindOrderInputSchema } from './contracts.js';\nimport { findOrder } from './find-order.js';\n\nexport const findOrderTool = tool(\n  'find_order',\n  'Retrieves one order by its identifier.',\n  FindOrderInputSchema,\n  findOrder,\n);\n\nexport const supportServer = createSdkMcpServer({\n  name: 'support-tools',\n  version: '1.0.0',\n  tools: [findOrderTool],\n});\n",
  },
];

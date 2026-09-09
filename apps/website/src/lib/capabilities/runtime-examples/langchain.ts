import type { IMemoryRepositoryEntry } from '@moldea.ai/repository/memory';

// synthetic source relationships, adapted from the package conformance inputs; never executed
export const LANGCHAIN_FILES: IMemoryRepositoryEntry[] = [
  {
    path: '/moldea/moldea.yaml',
    type: 'file',
    content:
      'version: 1\nagents:\n  support:\n    runtime:\n      id: langchain\n    bindings:\n      runtimeAgent:\n        path: /src/agent.ts\n        symbol: supportAgent\n      instructionLoader:\n        path: /src/instructions.ts\n        symbol: loadSupportInstruction\n      outputSchema:\n        path: /src/contracts.ts\n        symbol: SupportOutputSchema\n    tools:\n      find-order:\n        name: find_order\n        description: Finds an order.\n        implementation:\n          path: /src/implementations.ts\n          symbol: findOrder\n        registration:\n          path: /src/tools.ts\n          symbol: findOrderTool\n        inputSchema:\n          path: /src/contracts.ts\n          symbol: FindOrderInputSchema\n',
  },
  {
    path: '/package.json',
    type: 'file',
    content: '{"dependencies":{"@langchain/core":"~1.2.8","langchain":"~1.5.9"}}',
  },
  {
    path: '/moldea/project.md',
    type: 'file',
    content: '# Customer support\n\nHelp customers find orders and route specialist requests.\n',
  },
  {
    path: '/moldea/agents/support/description.md',
    type: 'file',
    content: 'Supports customers.\n',
  },
  {
    path: '/moldea/agents/support/instruction.md',
    type: 'file',
    content: 'You are the `support` agent.\n',
  },
  {
    path: '/src/contracts.ts',
    type: 'file',
    content: 'export const SupportOutputSchema = {};\nexport const FindOrderInputSchema = {};\n',
  },
  {
    path: '/src/instructions.ts',
    type: 'file',
    content: "export const loadSupportInstruction = () => 'support';\n",
  },
  {
    path: '/src/implementations.ts',
    type: 'file',
    content: "export const findOrder = async () => ({ id: '1' });\n",
  },
  {
    path: '/src/tools.ts',
    type: 'file',
    content:
      "import { tool } from '@langchain/core/tools';\nimport { FindOrderInputSchema } from './contracts.js';\nimport { findOrder } from './implementations.js';\nexport const findOrderTool = tool(findOrder, { name: 'find_order', description: 'Finds an order.', schema: FindOrderInputSchema });\n",
  },
  {
    path: '/src/agent.ts',
    type: 'file',
    content:
      "import { createAgent, providerStrategy, SystemMessage } from 'langchain';\nimport { SupportOutputSchema } from './contracts.js';\nimport { loadSupportInstruction } from './instructions.js';\nimport { findOrderTool } from './tools.js';\nconst MIDDLEWARE = [];\nconst TOOLS = [findOrderTool];\nexport const supportAgent = createAgent({ model: 'openai:gpt-4o', name: 'support-runtime', systemPrompt: new SystemMessage(loadSupportInstruction()), responseFormat: providerStrategy({ schema: SupportOutputSchema, strict: true }), middleware: MIDDLEWARE, tools: TOOLS });\n",
  },
];

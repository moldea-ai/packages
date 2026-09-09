import type { IMemoryRepositoryEntry } from '@moldea.ai/repository/memory';

// synthetic source relationships, adapted from the package conformance inputs; never executed
export const VERCEL_AI_SDK_FILES: IMemoryRepositoryEntry[] = [
  {
    path: '/moldea/moldea.yaml',
    type: 'file',
    content:
      'version: 1\nagents:\n  support:\n    runtime:\n      id: vercel-ai-sdk\n    bindings:\n      runtimeAgent:\n        path: /src/agents.ts\n        symbol: supportAgent\n      instructionLoader:\n        path: /src/instructions.ts\n        symbol: loadSupportInstruction\n      inputSchema:\n        path: /src/contracts.ts\n        symbol: SupportInputSchema\n      outputSchema:\n        path: /src/contracts.ts\n        symbol: SupportOutputSchema\n    tools:\n      find-order:\n        name: find_order\n        description: Finds an order.\n        implementation:\n          path: /src/implementations.ts\n          symbol: findOrder\n        registration:\n          path: /src/tools.ts\n          symbol: findOrderTool\n        inputSchema:\n          path: /src/contracts.ts\n          symbol: FindOrderInputSchema\n        outputSchema:\n          path: /src/contracts.ts\n          symbol: FindOrderOutputSchema\n  summary:\n    runtime:\n      id: vercel-ai-sdk\n    bindings:\n      runtimeAgent:\n        path: /src/agents.ts\n        symbol: summaryAgent\n      instructionLoader:\n        path: /src/instructions.ts\n        symbol: loadSummaryInstruction\n      outputSchema:\n        path: /src/contracts.ts\n        symbol: SummaryOutputSchema\n    tools:\n      find-order:\n        name: find_order\n        description: Finds an order.\n        implementation:\n          path: /src/implementations.ts\n          symbol: findOrder\n        registration:\n          path: /src/tools.ts\n          symbol: findOrderTool\n        inputSchema:\n          path: /src/contracts.ts\n          symbol: FindOrderInputSchema\n        outputSchema:\n          path: /src/contracts.ts\n          symbol: FindOrderOutputSchema\n',
  },
  {
    path: '/package.json',
    type: 'file',
    content: '{"dependencies":{"ai":"^7.0.66"}}',
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
    path: '/moldea/agents/summary/description.md',
    type: 'file',
    content: 'Summarizes requests.\n',
  },
  {
    path: '/moldea/agents/summary/instruction.md',
    type: 'file',
    content: 'You are the `summary` agent.\n',
  },
  {
    path: '/src/contracts.ts',
    type: 'file',
    content:
      'export const SupportInputSchema = {};\nexport const SupportOutputSchema = {};\nexport const SummaryOutputSchema = {};\nexport const FindOrderInputSchema = {};\nexport const FindOrderOutputSchema = {};\n',
  },
  {
    path: '/src/instructions.ts',
    type: 'file',
    content:
      "export const loadSupportInstruction = () => 'support';\nexport const loadSummaryInstruction = () => 'summary';\n",
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
      "import { tool } from 'ai';\nimport { FindOrderInputSchema, FindOrderOutputSchema } from './contracts.js';\nimport { findOrder } from './implementations.js';\nexport const findOrderTool = tool({ inputSchema: FindOrderInputSchema, outputSchema: FindOrderOutputSchema, execute: findOrder });\n",
  },
  {
    path: '/src/agents.ts',
    type: 'file',
    content:
      "import { generateText, Output, streamText, ToolLoopAgent } from 'ai';\nimport { FindOrderInputSchema, SupportInputSchema, SupportOutputSchema, SummaryOutputSchema } from './contracts.js';\nimport { loadSummaryInstruction, loadSupportInstruction } from './instructions.js';\nimport { findOrderTool } from './tools.js';\nexport const supportAgent = new ToolLoopAgent({ id: 'support-runtime', instructions: loadSupportInstruction(), callOptionsSchema: SupportInputSchema, output: Output.object({ schema: SupportOutputSchema }), tools: { find_order: findOrderTool } });\nexport const summaryAgent = async () => streamText({ instructions: await loadSummaryInstruction(), output: Output.object({ schema: SummaryOutputSchema }), tools: { find_order: findOrderTool } });\nvoid generateText;\nvoid FindOrderInputSchema;\n",
  },
];

import type { IMemoryRepositoryEntry } from '@moldea.ai/repository/memory';

// synthetic source relationships, adapted from the package conformance inputs; never executed
export const CLOUDFLARE_AGENTS_FILES: IMemoryRepositoryEntry[] = [
  {
    path: '/moldea/moldea.yaml',
    type: 'file',
    content:
      'version: 1\nagents:\n  support:\n    runtime:\n      id: cloudflare-agents\n    bindings:\n      runtimeAgent:\n        path: /src/agents.ts\n        symbol: SupportAgent\n      instructionLoader:\n        path: /src/instructions.ts\n        symbol: loadSupportInstruction\n    tools:\n      find-order:\n        name: find_order\n        description: Finds an order.\n        implementation:\n          path: /src/implementations.ts\n          symbol: findOrder\n        registration:\n          path: /src/tools.ts\n          symbol: findOrderTool\n        inputSchema:\n          path: /src/contracts.ts\n          symbol: FindOrderInputSchema\n        outputSchema:\n          path: /src/contracts.ts\n          symbol: FindOrderOutputSchema\n  summary:\n    runtime:\n      id: cloudflare-agents\n    bindings:\n      runtimeAgent:\n        path: /src/agents.ts\n        symbol: SummaryAgent\n      instructionLoader:\n        path: /src/instructions.ts\n        symbol: loadSummaryInstruction\n      outputSchema:\n        path: /src/contracts.ts\n        symbol: SummaryOutputSchema\n    tools:\n      find-order:\n        name: find_order\n        description: Finds an order.\n        implementation:\n          path: /src/implementations.ts\n          symbol: findOrder\n        registration:\n          path: /src/tools.ts\n          symbol: findOrderTool\n        inputSchema:\n          path: /src/contracts.ts\n          symbol: FindOrderInputSchema\n        outputSchema:\n          path: /src/contracts.ts\n          symbol: FindOrderOutputSchema\n',
  },
  {
    path: '/package.json',
    type: 'file',
    content:
      '{"dependencies":{"@cloudflare/think":"^0.16.0","@cloudflare/ai-chat":"^0.10.2","agents":"^0.21.0","ai":"^7.0.0"}}',
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
    path: '/moldea/agents/summary/handoff-description.md',
    type: 'file',
    content: 'Summarizes a support request.\n',
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
      'export const SummaryOutputSchema = {};\nexport const FindOrderInputSchema = {};\nexport const FindOrderOutputSchema = {};\n',
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
    content: `import { agentTool } from 'agents/agent-tools';
import { tool } from 'ai';
import { SummaryAgent } from './agents.js';
import { FindOrderInputSchema, FindOrderOutputSchema } from './contracts.js';
import { findOrder } from './implementations.js';

export const findOrderTool = tool({
  inputSchema: FindOrderInputSchema,
  outputSchema: FindOrderOutputSchema,
  execute: findOrder,
});
export const summaryHandoffTool = agentTool(SummaryAgent, {
  description: 'Summarizes a support request.',
});
`,
  },
  {
    path: '/src/agents.ts',
    type: 'file',
    content: `import { AIChatAgent } from '@cloudflare/ai-chat';
import { Think } from '@cloudflare/think';
import { Output, streamText } from 'ai';
import { SummaryOutputSchema } from './contracts.js';
import { loadSummaryInstruction, loadSupportInstruction } from './instructions.js';
import { findOrderTool, summaryHandoffTool } from './tools.js';

export class SupportAgent extends Think {
  getSystemPrompt() {
    return loadSupportInstruction();
  }

  getTools() {
    return {
      find_order: findOrderTool,
      summarize: summaryHandoffTool,
    };
  }
}

export class SummaryAgent extends AIChatAgent {
  onChatMessage(onFinish, options?) {
    return streamText({
      instructions: loadSummaryInstruction(),
      output: Output.object({ schema: SummaryOutputSchema }),
      tools: { find_order: findOrderTool },
    });
  }
}
`,
  },
];

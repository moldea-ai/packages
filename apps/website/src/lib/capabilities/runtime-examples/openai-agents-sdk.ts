import type { IMemoryRepositoryEntry } from '@moldea.ai/repository/memory';

// synthetic source relationships, adapted from the package conformance inputs; never executed
export const OPENAI_AGENTS_SDK_FILES: IMemoryRepositoryEntry[] = [
  {
    path: '/moldea/moldea.yaml',
    type: 'file',
    content:
      'version: 1\nagents:\n  billing:\n    runtime:\n      id: openai-agents-sdk\n    bindings:\n      runtimeAgent:\n        path: /src/agents.ts\n        symbol: billingAgent\n  triage:\n    runtime:\n      id: openai-agents-sdk\n    bindings:\n      runtimeAgent:\n        path: /src/agents.ts\n        symbol: triageAgent\n      instructionLoader:\n        path: /src/instructions.ts\n        symbol: loadTriageInstruction\n      outputSchema:\n        path: /src/contracts.ts\n        symbol: TriageOutputSchema\n    tools:\n      find-order:\n        name: find_order\n        description: Retrieves one order by its identifier.\n        implementation:\n          path: /src/find-order.ts\n          symbol: findOrder\n        registration:\n          path: /src/tools.ts\n          symbol: findOrderTool\n        inputSchema:\n          path: /src/contracts.ts\n          symbol: FindOrderInputSchema\n        outputSchema:\n          path: /src/contracts.ts\n          symbol: FindOrderOutputSchema\n',
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
    content: '{\n  "dependencies": {\n    "@openai/agents": "^0.16.1"\n  }\n}\n',
  },
  {
    path: '/src/agents.ts',
    type: 'file',
    content:
      "import { Agent, handoff } from '@openai/agents';\n\nimport { TriageOutputSchema } from './contracts.js';\nimport { loadTriageInstruction } from './instructions.js';\nimport { billingRoutingDescription } from './metadata.js';\nimport { findOrderTool } from './tools.js';\n\nexport const billingAgent = new Agent({\n  name: 'billing',\n  instructions: 'Resolve billing requests.',\n  handoffDescription: billingRoutingDescription,\n});\n\nconst configuredBillingHandoff = handoff(billingAgent, {\n  toolNameOverride: 'route_billing',\n  toolDescriptionOverride: billingRoutingDescription,\n});\nconst triageTools = [findOrderTool];\nconst triageHandoffs = [billingAgent, configuredBillingHandoff];\n\nexport const triageAgent = Agent.create({\n  name: 'triage',\n  instructions: async (context) => {\n    return await loadTriageInstruction(context);\n  },\n  outputType: TriageOutputSchema,\n  tools: triageTools,\n  handoffs: triageHandoffs,\n});\n",
  },
  {
    path: '/src/contracts.ts',
    type: 'file',
    content:
      "export const TriageOutputSchema = { type: 'object' } as const;\nexport const FindOrderInputSchema = { type: 'object' } as const;\nexport const FindOrderOutputSchema = { type: 'object' } as const;\n",
  },
  {
    path: '/src/find-order.ts',
    type: 'file',
    content:
      'export const findOrder = async (input: { orderId: string }) => ({ orderId: input.orderId });\n',
  },
  {
    path: '/src/instructions.ts',
    type: 'file',
    content:
      "export const loadTriageInstruction = async (): Promise<string> => 'Route the request.';\n",
  },
  {
    path: '/src/metadata.ts',
    type: 'file',
    content:
      "export const billingRoutingDescription = 'Route billing questions and payment issues here.';\n",
  },
  {
    path: '/src/tools.ts',
    type: 'file',
    content:
      "import { tool } from '@openai/agents';\n\nimport { FindOrderInputSchema, FindOrderOutputSchema } from './contracts.js';\nimport { findOrder } from './find-order.js';\n\nexport const findOrderTool = tool({\n  name: 'find_order',\n  description: 'Retrieves one order by its identifier.',\n  parameters: FindOrderInputSchema,\n  outputSchema: FindOrderOutputSchema,\n  execute: findOrder,\n});\n",
  },
];

import type { IMemoryRepositoryEntry } from '@moldea.ai/repository/memory';

// synthetic source relationships, adapted from the package conformance inputs; never executed
export const GOOGLE_GENAI_FILES: IMemoryRepositoryEntry[] = [
  {
    path: '/moldea/moldea.yaml',
    type: 'file',
    content:
      'version: 1\nagents:\n  support:\n    runtime:\n      id: google-genai\n    bindings:\n      runtimeAgent:\n        path: /src/agent.ts\n        symbol: supportAgent\n      instructionLoader:\n        path: /src/instructions.ts\n        symbol: loadInstruction\n    tools:\n      find-order:\n        name: find_order\n        description: Retrieves one order by its identifier.\n        implementation:\n          path: /src/find-order.ts\n          symbol: findOrder\n        registration:\n          path: /src/find-order.ts\n          symbol: findOrderDeclaration\n        inputSchema:\n          path: /src/contracts.ts\n          symbol: FindOrderInput\n',
  },
  {
    path: '/moldea/project.md',
    type: 'file',
    content: '# Customer support\n\nHelp customers find orders and route specialist requests.\n',
  },
  {
    path: '/moldea/agents/support/description.md',
    type: 'file',
    content: 'Support agent.\n',
  },
  {
    path: '/moldea/agents/support/instruction.md',
    type: 'file',
    content: 'You are the `support` agent.\n',
  },
  {
    path: '/package.json',
    type: 'file',
    content: '{\n  "dependencies": {\n    "@google/genai": "^2.17.1"\n  }\n}\n',
  },
  {
    path: '/src/agent.ts',
    type: 'file',
    content:
      "import { GoogleGenAI as GenAi } from '@google/genai';\n\nimport { findOrderDeclaration as registeredFindOrder } from './find-order.js';\nimport { loadInstruction as readInstruction } from './instructions.js';\n\nconst client = new GenAi({ apiKey: process.env['GEMINI_API_KEY'] });\n\nexport const supportAgent = async () =>\n  client.models.generateContent({\n    model: 'gemini-2.5-flash',\n    contents: 'Help the customer.',\n    config: {\n      systemInstruction: await readInstruction(),\n      tools: [\n        {\n          functionDeclarations: [registeredFindOrder],\n        },\n      ],\n    },\n  });\n",
  },
  {
    path: '/src/contracts.ts',
    type: 'file',
    content:
      "export const FindOrderInput = {\n  additionalProperties: false,\n  properties: { orderId: { type: 'string' } },\n  required: ['orderId'],\n  type: 'object',\n} as const;\n",
  },
  {
    path: '/src/find-order.ts',
    type: 'file',
    content:
      "import { FindOrderInput } from './contracts.js';\n\nexport const findOrder = async (orderId: string) => ({ orderId });\n\nexport const findOrderDeclaration = {\n  name: 'find_order',\n  description: 'Retrieves one order by its identifier.',\n  parametersJsonSchema: FindOrderInput,\n} as const;\n",
  },
  {
    path: '/src/instructions.ts',
    type: 'file',
    content: "export const loadInstruction = (): string => 'Follow the canonical instruction.';\n",
  },
];

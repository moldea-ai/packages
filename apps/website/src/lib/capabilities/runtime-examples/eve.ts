import type { IMemoryRepositoryEntry } from '@moldea.ai/repository/memory';

// synthetic source relationships, adapted from the package conformance inputs; never executed
export const EVE_FILES: IMemoryRepositoryEntry[] = [
  {
    path: '/moldea/moldea.yaml',
    type: 'file',
    content:
      'version: 1\nagents:\n  support:\n    runtime:\n      id: eve\n    bindings:\n      runtimeAgent:\n        path: /agent/agent.ts\n        symbol: default\n      instructionLoader:\n        path: /agent/loaders.ts\n        symbol: loadInstruction\n      outputSchema:\n        path: /agent/contracts.ts\n        symbol: SupportOutputSchema\n    tools:\n      search:\n        name: search\n        description: Searches the knowledge base.\n        implementation:\n          path: /agent/implementations.ts\n          symbol: searchKnowledge\n        registration:\n          path: /agent/tools/search.ts\n          symbol: default\n        inputSchema:\n          path: /agent/contracts.ts\n          symbol: SearchInputSchema\n        outputSchema:\n          path: /agent/contracts.ts\n          symbol: SearchOutputSchema\n    skills:\n      analyze:\n        name: analyze\n        description: Analyzes source material.\n        implementation:\n          path: /agent/skills/analyze.ts\n          symbol: default\n        registration:\n          path: /agent/skills/analyze.ts\n          symbol: default\n  summary:\n    runtime:\n      id: eve\n    bindings:\n      runtimeAgent:\n        path: /agent/subagents/summary/agent.ts\n        symbol: default\n',
  },
  {
    path: '/package.json',
    type: 'file',
    content: '{"name":"@acme/support-app","dependencies":{"eve":"^0.39.1"}}',
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
    content: 'Summarizes support requests.\n',
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
    path: '/agent/agent.ts',
    type: 'file',
    content:
      "import { defineAgent } from 'eve';\nimport { SupportOutputSchema } from './contracts.js';\nconst MODEL = 'provider/model';\nexport default defineAgent({ description: 'Supports customers.', model: MODEL, outputSchema: SupportOutputSchema });\n",
  },
  {
    path: '/agent/contracts.ts',
    type: 'file',
    content:
      'export const SupportOutputSchema = {};\nexport const SearchInputSchema = {};\nexport const SearchOutputSchema = {};\n',
  },
  {
    path: '/agent/loaders.ts',
    type: 'file',
    content: "export const loadInstruction = () => 'Support customers.';\n",
  },
  {
    path: '/agent/instructions.ts',
    type: 'file',
    content:
      "import { defineInstructions } from 'eve/instructions';\nimport { loadInstruction } from './loaders.js';\nexport default defineInstructions({ content: loadInstruction(), role: 'system' });\n",
  },
  {
    path: '/agent/implementations.ts',
    type: 'file',
    content: 'export const searchKnowledge = async () => ({ matches: [] });\n',
  },
  {
    path: '/agent/tools/search.ts',
    type: 'file',
    content:
      "import { defineTool } from 'eve/tools';\nimport { SearchInputSchema, SearchOutputSchema } from '../contracts.js';\nimport { searchKnowledge } from '../implementations.js';\nexport default defineTool({ description: 'Searches the knowledge base.', inputSchema: SearchInputSchema, outputSchema: SearchOutputSchema, execute: searchKnowledge });\n",
  },
  {
    path: '/agent/skills/analyze.ts',
    type: 'file',
    content:
      "import { defineSkill } from 'eve/skills';\nexport default defineSkill({ description: 'Analyzes source material.', markdown: '# Analyze\\n', license: 'MIT', metadata: { owner: 'support' }, files: { 'reference.md': '# Reference\\n' } });\n",
  },
  {
    path: '/agent/subagents/summary/agent.ts',
    type: 'file',
    content:
      "import { defineAgent } from 'eve';\nexport default defineAgent({ description: 'Summarizes a support request.', model: 'provider/model' });\n",
  },
];

import type { IMemoryRepositoryEntry } from '@moldea.ai/repository/memory';

// synthetic source relationships, adapted from the package conformance inputs; never executed
export const LANGGRAPH_FILES: IMemoryRepositoryEntry[] = [
  {
    path: '/moldea/moldea.yaml',
    type: 'file',
    content:
      'version: 1\nagents:\n  graph:\n    runtime:\n      id: langgraph\n    bindings:\n      runtimeAgent:\n        path: /src/graph.ts\n        symbol: supportGraph\n      inputSchema:\n        path: /src/contracts.ts\n        symbol: GraphInputSchema\n      outputSchema:\n        path: /src/contracts.ts\n        symbol: GraphOutputSchema\n  functional:\n    runtime:\n      id: langgraph\n    bindings:\n      runtimeAgent:\n        path: /src/functional.ts\n        symbol: supportWorkflow\n',
  },
  {
    path: '/package.json',
    type: 'file',
    content: '{"dependencies":{"@langchain/core":"~1.2.9","@langchain/langgraph":"~1.4.12"}}',
  },
  {
    path: '/moldea/project.md',
    type: 'file',
    content: '# Customer support\n\nHelp customers find orders and route specialist requests.\n',
  },
  {
    path: '/moldea/agents/graph/description.md',
    type: 'file',
    content: 'Runs a customer-support graph.\n',
  },
  {
    path: '/moldea/agents/graph/instruction.md',
    type: 'file',
    content: 'You are the `graph` agent.\n',
  },
  {
    path: '/moldea/agents/functional/description.md',
    type: 'file',
    content: 'Runs a customer-support workflow.\n',
  },
  {
    path: '/moldea/agents/functional/instruction.md',
    type: 'file',
    content: 'You are the `functional` agent.\n',
  },
  {
    path: '/src/contracts.ts',
    type: 'file',
    content:
      'const createSchema = () => ({ parse: (value: unknown) => value });\nexport const GraphStateSchema = createSchema();\nexport const GraphInputSchema = createSchema();\nexport const GraphOutputSchema = createSchema();\n',
  },
  {
    path: '/src/graph.ts',
    type: 'file',
    content:
      "import { END, START, StateGraph } from '@langchain/langgraph';\nimport { GraphInputSchema, GraphOutputSchema, GraphStateSchema } from './contracts.js';\nconst prepare = async (state: unknown) => state;\nconst respond = async (state: unknown) => state;\nconst route = () => 'done';\nconst builder = new StateGraph({ state: GraphStateSchema, input: GraphInputSchema, output: GraphOutputSchema });\nbuilder.addNode('prepare', prepare);\nbuilder.addNode('respond', respond, { timeout: 1000 });\nbuilder.addEdge(START, 'prepare');\nbuilder.addEdge('prepare', 'respond');\nbuilder.addConditionalEdges('respond', route, { done: END });\nexport const supportGraph = builder.compile({ name: 'support_graph' });\n",
  },
  {
    path: '/src/functional.ts',
    type: 'file',
    content:
      "import { entrypoint, getPreviousState, interrupt, task } from '@langchain/langgraph';\nconst prepare = task('prepare_task', async (input: unknown) => input);\nexport const supportWorkflow = entrypoint({ name: 'support_workflow' }, async (input: unknown) => {\n  const prepared = await prepare(input);\n  interrupt({ prepared });\n  const previous = getPreviousState<unknown>();\n  return entrypoint.final<unknown, unknown>({ value: prepared, save: previous });\n});\n",
  },
];

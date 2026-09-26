import { jsonSchema, tool, toolSearch, ToolLoopAgent } from 'ai';

const findOrder = tool({
  inputSchema: jsonSchema<{ orderId: string }>({
    type: 'object',
    properties: { orderId: { type: 'string' } },
    required: ['orderId'],
  }),
  deferLoading: true,
  execute: async ({ orderId }) => ({ orderId }),
});

export const supportAgent = new ToolLoopAgent({
  model: 'openai/gpt-5',
  tools: { find_order: findOrder, search: toolSearch() },
});

import { SystemMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { createAgent, providerStrategy, toolStrategy } from 'langchain';
import { z } from 'zod';

const OutputSchema = z.object({ answer: z.string() });
const FindOrderInput = z.object({ orderId: z.string() });
const findOrder = tool(async ({ orderId }) => `Order ${orderId}`, {
  name: 'find_order',
  description: 'Find an order.',
  schema: FindOrderInput,
});

export const supportAgent = createAgent({
  model: 'openai:gpt-4o',
  name: 'support',
  systemPrompt: new SystemMessage('Answer support questions.'),
  tools: [findOrder],
  middleware: [],
  responseFormat: providerStrategy(OutputSchema),
});

export const toolOutputAgent = createAgent({
  model: 'openai:gpt-4o',
  tools: [findOrder],
  responseFormat: toolStrategy(OutputSchema),
});

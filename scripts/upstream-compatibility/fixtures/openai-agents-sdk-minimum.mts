import { Agent, handoff, tool } from '@openai/agents';
import { z } from 'zod';

const FindOrderInput = z.object({ orderId: z.string() });
const FindOrderOutput = z.object({ orderId: z.string() });
const AgentOutput = z.object({ answer: z.string() });

export const findOrder = tool({
  name: 'find_order',
  description: 'Find an order.',
  parameters: FindOrderInput,
  outputSchema: FindOrderOutput,
  execute: async ({ orderId }) => ({ orderId }),
});

export const billingAgent = new Agent({
  name: 'billing',
  instructions: 'Answer billing questions.',
  handoffDescription: 'Handles billing questions.',
  outputType: AgentOutput,
});

export const supportAgent = Agent.create({
  name: 'support',
  instructions: 'Route support questions.',
  tools: [findOrder],
  handoffs: [
    handoff(billingAgent, {
      toolNameOverride: 'send_to_billing',
      toolDescriptionOverride: 'Handles billing questions.',
    }),
  ],
});

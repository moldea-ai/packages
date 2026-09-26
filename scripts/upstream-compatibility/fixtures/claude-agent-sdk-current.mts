import { createSdkMcpServer, query, tool } from '@anthropic-ai/claude-agent-sdk/core';
import { z } from 'zod';

const findOrder = tool('find_order', 'Finds an order.', { id: z.string() }, async () => ({
  content: [{ type: 'text', text: 'Found.' }],
}));
const supportServer = createSdkMcpServer({
  name: 'support',
  version: '1.0.0',
  tools: [findOrder],
});

void query({
  prompt: 'Handle the request.',
  options: {
    agents: {
      billing: {
        description: 'Handles billing questions.',
        omitClaudeMd: true,
        prompt: 'Answer billing questions.',
      },
    },
    mcpServers: { support: supportServer },
    systemPrompt: { type: 'custom', prompt: 'Be concise.', snapshot: false },
    tools: ['Agent'],
    verbatimPrompts: true,
  },
});

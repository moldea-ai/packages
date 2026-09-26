import { defineAgent } from 'eve';
import { defineTool } from 'eve/tools';
import { z } from 'zod';

export const agent = defineAgent({ description: 'Supports requests.', model: 'openai/gpt-4.1' });
export const tool = defineTool({
  availableInSubagents: false,
  description: 'Returns a result.',
  inputSchema: z.object({}),
  async execute() {
    return { ok: true };
  },
});

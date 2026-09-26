import { defineAgent, defineWorkspaceAgent } from 'eve';
import { defineWorkflowTool } from 'eve/tools';
import { z } from 'zod';

export const agent = defineAgent({
  defaultTools: false,
  description: 'Supports requests.',
  model: 'openai/gpt-4.1',
  tool: false,
});
export const peer = defineWorkspaceAgent({ name: 'research', tool: false });
export const workflowTool = defineWorkflowTool({
  availableInSubagents: false,
  description: 'Returns a result.',
  execution: 'background',
  inputSchema: z.object({}),
  async execute() {
    'use workflow';
    return { ok: true };
  },
});

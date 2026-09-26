import { defineAgent, defineWorkspaceAgent } from 'eve';

export const agent = defineAgent({
  description: 'Handles a delegated request.',
  model: 'openai/gpt-4.1',
  tool: false,
});
export const peer = defineWorkspaceAgent({ name: 'research', tool: false });

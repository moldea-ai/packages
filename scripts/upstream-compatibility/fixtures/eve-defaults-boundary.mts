import { defineAgent } from 'eve';

export const agent = defineAgent({
  defaultTools: false,
  description: 'Supports requests.',
  model: 'openai/gpt-4.1',
  tool: false,
});

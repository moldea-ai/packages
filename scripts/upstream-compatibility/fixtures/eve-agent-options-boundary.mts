import { defineAgent } from 'eve';

export const agent = defineAgent({
  defaultTools: false,
  model: 'openai/gpt-4.1',
});

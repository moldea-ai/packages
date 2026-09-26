import { defineAgent } from 'eve';
import { z } from 'zod';

export const agent = defineAgent({
  model: 'openai/gpt-4.1',
  outputSchema: z.object({ answer: z.string() }),
});

import { query } from '@anthropic-ai/claude-agent-sdk';

void query({
  prompt: 'Handle the request.',
  options: {
    agents: {
      billing: {
        description: 'Handles billing questions.',
        prompt: 'Answer billing questions.',
      },
    },
    systemPrompt: { type: 'preset', preset: 'claude_code', append: 'Be concise.' },
    tools: ['Agent'],
  },
});

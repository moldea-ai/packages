import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

const client = new Anthropic({ apiKey: 'test-only' });

void client.messages.create(
  {
    max_tokens: 1,
    messages: [{ role: 'user', content: 'test' }],
    model: 'claude-test',
    system: 'first',
  },
  { body: { system: 'second' }, timeout: 1000 },
);

const schema = z.object({ answer: z.string() });
const parsedRequest = {
  max_tokens: 1,
  messages: [{ role: 'user' as const, content: 'test' }],
  model: 'claude-test',
  output_config: { format: zodOutputFormat(schema) },
};

void client.messages.parse(parsedRequest);
void client.messages.stream(parsedRequest);

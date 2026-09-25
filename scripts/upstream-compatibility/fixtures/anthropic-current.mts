import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

const client = new Anthropic({ apiKey: 'test-only' });
const schema = z.object({ answer: z.string() });
const request = {
  max_tokens: 1,
  messages: [{ role: 'user' as const, content: 'test' }],
  model: 'claude-test',
  output_config: { format: zodOutputFormat(schema) },
};

void client.messages.create(request);
void client.messages.parse(request);
void client.messages.stream(request);
void client.messages.parse(request, { body: request });

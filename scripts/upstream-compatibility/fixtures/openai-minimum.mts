import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';

const client = new OpenAI({ apiKey: 'test-only' });

void client.responses.create(
  { model: 'gpt-test', input: 'test', instructions: 'first' },
  { body: { model: 'gpt-test', input: 'test', instructions: 'second' }, timeout: 1000 },
);

const schema = z.object({ answer: z.string() });
const parsedRequest = {
  model: 'gpt-test',
  input: 'test',
  text: { format: zodTextFormat(schema, 'answer') },
};

void client.responses.parse(parsedRequest);
void client.responses.stream(parsedRequest);

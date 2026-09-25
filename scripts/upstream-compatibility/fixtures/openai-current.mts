import { OpenAI } from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';

const client = new OpenAI({ apiKey: 'test-only' });
const schema = z.object({ answer: z.string() });
const request = {
  model: 'gpt-test',
  input: 'test',
  text: { format: zodTextFormat(schema, 'answer') },
};

void client.responses.create(request);
void client.responses.parse(request);
void client.responses.stream(request);
void client.responses.parse(request, { body: request });

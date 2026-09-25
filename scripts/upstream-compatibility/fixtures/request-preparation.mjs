const family = process.argv[2];
let capturedBody = null;

const fetch = async (input, init) => {
  const request = new Request(input, init);
  capturedBody = await request.text();
  throw new Error('transport-stopped');
};

try {
  if (family === 'anthropic') {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({
      apiKey: 'test-only',
      baseURL: 'http://127.0.0.1:1',
      fetch,
      maxRetries: 0,
    });
    await client.messages.create(
      {
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }],
        model: 'claude-test',
        system: 'first',
      },
      {
        body: {
          max_tokens: 1,
          messages: [{ role: 'user', content: 'test' }],
          model: 'claude-test',
          system: 'second',
        },
      },
    );
  } else if (family === 'openai') {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({
      apiKey: 'test-only',
      baseURL: 'http://127.0.0.1:1',
      fetch,
      maxRetries: 0,
    });
    await client.responses.create(
      { model: 'gpt-test', input: 'test', instructions: 'first' },
      { body: { model: 'gpt-test', input: 'test', instructions: 'second' } },
    );
  } else {
    throw new Error('Unsupported request-preparation family.');
  }
} catch {
  if (capturedBody === null) {
    throw new Error('The SDK did not reach the controlled transport.');
  }
}

if (
  JSON.parse(capturedBody).system !== 'second' &&
  JSON.parse(capturedBody).instructions !== 'second'
) {
  throw new Error('The SDK did not apply the options body override.');
}

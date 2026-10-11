// @vitest-environment node
import { expect, test } from 'vitest';

import { RETIRED_RUNTIME_ROUTES } from './constants.ts';

test('retains every published adapter and compatibility route', () => {
  const expectedRoutes = new Set(['/adapters/', '/adapters/custom/', '/compatibility/']);
  for (const id of [
    'anthropic',
    'claude-agent-sdk',
    'cloudflare-agents',
    'eve',
    'google-genai',
    'langchain',
    'langgraph',
    'openai',
    'openai-agents-sdk',
    'vercel-ai-sdk',
  ]) {
    for (const suffix of [
      '',
      'index/',
      'binding-example/',
      'evidence-and-diagnostics/',
      'limitations/',
      'api/',
    ]) {
      expectedRoutes.add(`/adapters/${id}/${suffix}`);
    }
    expectedRoutes.add(
      `/adapters/${id}/${id === 'cloudflare-agents' ? 'verified-targets' : 'verified-target'}/`,
    );
  }
  expect(RETIRED_RUNTIME_ROUTES).toHaveLength(73);
  expect(new Set(RETIRED_RUNTIME_ROUTES)).toStrictEqual(expectedRoutes);
  expect(RETIRED_RUNTIME_ROUTES).not.toContain('/compatibility/runtimes.json');
});

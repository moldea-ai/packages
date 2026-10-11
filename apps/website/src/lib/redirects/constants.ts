// retired public routes are fixed release inputs, independent of installed packages
const RETIRED_ADAPTER_IDS = [
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
];
export const RETIRED_RUNTIME_ROUTES = [
  '/adapters/',
  '/adapters/custom/',
  '/compatibility/',
  ...RETIRED_ADAPTER_IDS.flatMap((id) => [
    `/adapters/${id}/`,
    ...[
      'index',
      'binding-example',
      'evidence-and-diagnostics',
      'limitations',
      id === 'cloudflare-agents' ? 'verified-targets' : 'verified-target',
      'api',
    ].map((slug) => `/adapters/${id}/${slug}/`),
  ]),
];

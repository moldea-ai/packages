// exact first-class package identities required by every CLI release
export const MOLDEA_CLI_FOUNDATIONAL_PACKAGE_NAMES = Object.freeze([
  '@moldea.ai/core',
  '@moldea.ai/repository',
  '@moldea.ai/repository-fs',
] as const);

// stable package and adapter identities used by runtime composition validation
export const MOLDEA_CLI_ADAPTER_PACKAGE_PREFIX = '@moldea.ai/adapter-';
export const MOLDEA_CLI_CUSTOM_ADAPTER_ID = 'custom';

// compatible first-class package lines accepted by CLI 10
export const MOLDEA_CLI_FIRST_CLASS_PACKAGE_RANGES = Object.freeze({
  '@moldea.ai/adapter-anthropic': '^6.0.0',
  '@moldea.ai/adapter-claude-agent-sdk': '^5.0.0',
  '@moldea.ai/adapter-cloudflare-agents': '^5.0.0',
  '@moldea.ai/adapter-eve': '^5.0.0',
  '@moldea.ai/adapter-google-genai': '^5.0.0',
  '@moldea.ai/adapter-langchain': '^5.0.0',
  '@moldea.ai/adapter-langgraph': '^5.0.0',
  '@moldea.ai/adapter-openai': '^6.0.0',
  '@moldea.ai/adapter-openai-agents-sdk': '^5.0.0',
  '@moldea.ai/adapter-vercel-ai-sdk': '^5.0.0',
  '@moldea.ai/core': '^6.0.0',
  '@moldea.ai/repository': '^2.0.0',
  '@moldea.ai/repository-fs': '^2.0.3',
} as const);

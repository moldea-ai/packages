import type { IRuntimeCatalogEntry } from './types.js';

// runtime labels select guidance; logos do not imply compatibility or endorsement
export const RUNTIME_CATALOG = [
  {
    id: 'amazon-bedrock',
    displayName: 'Amazon Bedrock',
    logoPath: '@moldea.ai/website-ui/runtime-logos/amazon.svg',
  },
  {
    id: 'anthropic',
    displayName: 'Anthropic',
    logoPath: '@moldea.ai/website-ui/runtime-logos/anthropic.svg',
  },
  {
    id: 'cerebras',
    displayName: 'Cerebras',
    logoPath: '@moldea.ai/website-ui/runtime-logos/cerebras.svg',
  },
  {
    id: 'claude-agent-sdk',
    displayName: 'Claude Agent SDK',
    logoPath: '@moldea.ai/website-ui/runtime-logos/claude.svg',
  },
  {
    id: 'cloudflare-agents',
    displayName: 'Cloudflare Agents',
    logoPath: '@moldea.ai/website-ui/runtime-logos/cloudflare.svg',
  },
  {
    id: 'cohere',
    displayName: 'Cohere',
    logoPath: '@moldea.ai/website-ui/runtime-logos/cohere.svg',
  },
  {
    id: 'convex-agent',
    displayName: 'Convex Agent',
    logoPath: '@moldea.ai/website-ui/runtime-logos/convex.svg',
    darkLogoPath: '@moldea.ai/website-ui/runtime-logos/convex-dark.svg',
  },
  {
    id: 'cursor-sdk',
    displayName: 'Cursor SDK',
    logoPath: '@moldea.ai/website-ui/runtime-logos/cursor.svg',
  },
  {
    id: 'deep-agents',
    displayName: 'Deep Agents',
    logoPath: '@moldea.ai/website-ui/runtime-logos/langchain.svg',
  },
  {
    id: 'eve',
    displayName: 'eve',
    logoPath: '@moldea.ai/website-ui/runtime-logos/eve.svg',
  },
  {
    id: 'genkit',
    displayName: 'Genkit',
    logoPath: '@moldea.ai/website-ui/runtime-logos/fallback.svg',
  },
  {
    id: 'github-copilot-sdk',
    displayName: 'GitHub Copilot SDK',
    logoPath: '@moldea.ai/website-ui/runtime-logos/github.svg',
  },
  {
    id: 'google-adk',
    displayName: 'Google ADK',
    logoPath: '@moldea.ai/website-ui/runtime-logos/google.svg',
    darkLogoPath: '@moldea.ai/website-ui/runtime-logos/google-dark.svg',
  },
  {
    id: 'google-genai',
    displayName: 'Google Gen AI',
    logoPath: '@moldea.ai/website-ui/runtime-logos/google.svg',
    darkLogoPath: '@moldea.ai/website-ui/runtime-logos/google-dark.svg',
  },
  {
    id: 'groq',
    displayName: 'Groq',
    logoPath: '@moldea.ai/website-ui/runtime-logos/groq.svg',
  },
  {
    id: 'hugging-face',
    displayName: 'Hugging Face',
    logoPath: '@moldea.ai/website-ui/runtime-logos/hugging-face.svg',
  },
  {
    id: 'ibm-watsonx-ai',
    displayName: 'IBM watsonx.ai',
    logoPath: '@moldea.ai/website-ui/runtime-logos/ibm.svg',
  },
  {
    id: 'langchain',
    displayName: 'LangChain',
    logoPath: '@moldea.ai/website-ui/runtime-logos/langchain.svg',
  },
  {
    id: 'langgraph',
    displayName: 'LangGraph',
    logoPath: '@moldea.ai/website-ui/runtime-logos/langchain.svg',
  },
  {
    id: 'livekit-agents',
    displayName: 'LiveKit Agents',
    logoPath: '@moldea.ai/website-ui/runtime-logos/livekit.svg',
  },
  {
    id: 'mastra',
    displayName: 'Mastra',
    logoPath: '@moldea.ai/website-ui/runtime-logos/mastra.svg',
  },
  {
    id: 'microsoft-foundry',
    displayName: 'Microsoft Foundry',
    logoPath: '@moldea.ai/website-ui/runtime-logos/fallback.svg',
  },
  {
    id: 'mistral',
    displayName: 'Mistral AI',
    logoPath: '@moldea.ai/website-ui/runtime-logos/mistral.svg',
  },
  {
    id: 'node-llama-cpp',
    displayName: 'node-llama-cpp',
    logoPath: '@moldea.ai/website-ui/runtime-logos/node-llama-cpp.svg',
  },
  {
    id: 'ollama',
    displayName: 'Ollama',
    logoPath: '@moldea.ai/website-ui/runtime-logos/ollama.svg',
    darkLogoPath: '@moldea.ai/website-ui/runtime-logos/ollama-dark.svg',
  },
  {
    id: 'openai',
    displayName: 'OpenAI',
    logoPath: '@moldea.ai/website-ui/runtime-logos/openai.svg',
    darkLogoPath: '@moldea.ai/website-ui/runtime-logos/openai-dark.svg',
  },
  {
    id: 'openai-agents-sdk',
    displayName: 'OpenAI Agents SDK',
    logoPath: '@moldea.ai/website-ui/runtime-logos/openai.svg',
    darkLogoPath: '@moldea.ai/website-ui/runtime-logos/openai-dark.svg',
  },
  {
    id: 'openai-codex',
    displayName: 'OpenAI Codex',
    logoPath: '@moldea.ai/website-ui/runtime-logos/openai.svg',
    darkLogoPath: '@moldea.ai/website-ui/runtime-logos/openai-dark.svg',
  },
  {
    id: 'opencode-sdk',
    displayName: 'OpenCode SDK',
    logoPath: '@moldea.ai/website-ui/runtime-logos/opencode.svg',
    darkLogoPath: '@moldea.ai/website-ui/runtime-logos/opencode-dark.svg',
  },
  {
    id: 'openrouter',
    displayName: 'OpenRouter',
    logoPath: '@moldea.ai/website-ui/runtime-logos/fallback.svg',
  },
  {
    id: 'pi-agent',
    displayName: 'Pi Agent',
    logoPath: '@moldea.ai/website-ui/runtime-logos/pi.svg',
  },
  {
    id: 'strands-agents',
    displayName: 'Strands Agents',
    logoPath: '@moldea.ai/website-ui/runtime-logos/strands-dark.svg',
    darkLogoPath: '@moldea.ai/website-ui/runtime-logos/strands.svg',
  },
  {
    id: 'tanstack-ai',
    displayName: 'TanStack AI',
    logoPath: '@moldea.ai/website-ui/runtime-logos/tanstack.svg',
    darkLogoPath: '@moldea.ai/website-ui/runtime-logos/tanstack-dark.svg',
  },
  {
    id: 'vercel-ai-sdk',
    displayName: 'Vercel AI SDK',
    logoPath: '@moldea.ai/website-ui/runtime-logos/vercel.svg',
  },
  {
    id: 'voltagent',
    displayName: 'VoltAgent',
    logoPath: '@moldea.ai/website-ui/runtime-logos/voltagent.svg',
  },
] as const satisfies IRuntimeCatalogEntry[];

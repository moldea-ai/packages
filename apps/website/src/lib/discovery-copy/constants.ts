import type { IDiscoveryCopy } from './types.ts';

// authored labels are validated against every generated package, adapter, and target ID
export const DISCOVERY_COPY: IDiscoveryCopy = {
  packages: {
    '@moldea.ai/cli': {
      name: 'Check a local repository',
      description:
        'Run structural checks from your terminal. The usual starting point once a repository has adopted moldea.',
    },
    '@moldea.ai/core': {
      name: 'Build checks into your tools',
      description:
        'Interpret project structure and validate declared connections through a source-neutral TypeScript API.',
    },
    '@moldea.ai/repository': {
      name: 'Supply repository content',
      description:
        'Use shared read-only contracts and an in-memory reader for content your application already has.',
    },
    '@moldea.ai/repository-fs': {
      name: 'Read a local filesystem',
      description:
        'Give Core a coherent, read-only view of an explicitly selected repository directory.',
    },
    '@moldea.ai/adapter-anthropic': {
      name: 'Anthropic integration',
      description: 'Extract structural evidence from supported Anthropic Messages API patterns.',
    },
    '@moldea.ai/adapter-claude-agent-sdk': {
      name: 'Claude Agent SDK integration',
      description: 'Inspect supported query and subagent declarations.',
    },
    '@moldea.ai/adapter-cloudflare-agents': {
      name: 'Cloudflare Agents integration',
      description: 'Inspect supported AIChatAgent and Think agent patterns.',
    },
    '@moldea.ai/adapter-eve': {
      name: 'Eve integration',
      description: 'Inspect supported filesystem-based agent declarations.',
    },
    '@moldea.ai/adapter-google-genai': {
      name: 'Google Gen AI integration',
      description: 'Extract structural evidence from supported generateContent calls.',
    },
    '@moldea.ai/adapter-langchain': {
      name: 'LangChain integration',
      description: 'Inspect supported createAgent declarations.',
    },
    '@moldea.ai/adapter-langgraph': {
      name: 'LangGraph integration',
      description: 'Inspect supported Functional API and StateGraph workflows.',
    },
    '@moldea.ai/adapter-openai': {
      name: 'OpenAI integration',
      description: 'Extract structural evidence from supported Responses API patterns.',
    },
    '@moldea.ai/adapter-openai-agents-sdk': {
      name: 'OpenAI Agents SDK integration',
      description: 'Inspect supported agent and handoff declarations.',
    },
    '@moldea.ai/adapter-vercel-ai-sdk': {
      name: 'Vercel AI SDK integration',
      description: 'Inspect supported text generation and tool-loop agent patterns.',
    },
  },
  adapters: {
    anthropic: {
      name: 'Anthropic',
      description: 'Direct Messages API integrations.',
      targets: { 'typescript-messages-api-0-117': 'Messages API' },
    },
    'claude-agent-sdk': {
      name: 'Claude Agent SDK',
      description: 'Query and subagent integrations.',
      targets: { 'typescript-query-subagents-0-3': 'Query and subagents' },
    },
    'cloudflare-agents': {
      name: 'Cloudflare Agents',
      description: 'AIChatAgent and Think integrations.',
      targets: {
        'typescript-ai-chat-agent-0-10-ai-sdk-7': 'AIChatAgent',
        'typescript-think-0-16-ai-sdk-7': 'Think agents',
      },
    },
    custom: {
      name: 'Custom runtime',
      description: 'The runtime-neutral path built into Core, without a separate adapter package.',
      targets: { custom: 'Custom runtime declarations' },
    },
    eve: {
      name: 'Eve',
      description: 'Filesystem-based agents.',
      targets: { 'typescript-filesystem-agent-0-39': 'Filesystem agents' },
    },
    'google-genai': {
      name: 'Google Gen AI',
      description: 'Direct content generation integrations.',
      targets: { 'typescript-models-generate-content-2': 'Generate content' },
    },
    langchain: {
      name: 'LangChain',
      description: 'Agent declarations through createAgent.',
      targets: { 'typescript-create-agent-1-5': 'Create agent' },
    },
    langgraph: {
      name: 'LangGraph',
      description: 'Functional and graph-based workflows.',
      targets: {
        'typescript-functional-api-1-4': 'Functional API',
        'typescript-state-graph-1-4': 'StateGraph',
      },
    },
    openai: {
      name: 'OpenAI',
      description: 'Direct Responses API integrations.',
      targets: { 'typescript-responses-api-7': 'Responses API' },
    },
    'openai-agents-sdk': {
      name: 'OpenAI Agents SDK',
      description: 'Agent and handoff integrations.',
      targets: { 'typescript-agent-handoffs-0-16': 'Agents and handoffs' },
    },
    'vercel-ai-sdk': {
      name: 'Vercel AI SDK',
      description: 'Text generation and tool-loop agents.',
      targets: {
        'typescript-generate-stream-text-7': 'Generate and stream text',
        'typescript-tool-loop-agent-7': 'Tool-loop agents',
      },
    },
  },
};

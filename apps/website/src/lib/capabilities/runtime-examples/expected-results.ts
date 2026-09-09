import type { IDiagnostic, IRuntimeAdapterEvidence } from '@moldea.ai/core';

// complete reviewed results; manifest identity pins declarations even when evidence is intentionally absent
export const RUNTIME_EXPECTED_RESULTS: Record<
  string,
  {
    valid: boolean;
    manifestDigest: string | null;
    diagnostics: (Omit<IDiagnostic, 'path'> & { path: string | null })[];
    evidence: (Omit<IRuntimeAdapterEvidence, 'references'> & {
      references: { path: string; symbol?: string }[];
    })[];
  }
> = {
  'anthropic-messages': {
    valid: true,
    diagnostics: [],
    evidence: [
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          requestProperty: 'system',
        },
        kind: 'instruction-loader',
        references: [
          {
            path: '/src/agent.ts',
          },
          {
            path: '/src/instructions.ts',
            symbol: 'loadInstruction',
          },
        ],
        runtimeName: 'loadInstruction',
        source: 'anthropic',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/src/agent.ts',
            symbol: 'supportAgent',
          },
        ],
        runtimeName: null,
        source: 'anthropic',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          compatibility: 'supported',
          declaredRange: '^0.117.1',
          dependencyKind: 'dependencies',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: '@anthropic-ai/sdk',
        source: 'anthropic',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          api: 'messages',
        },
        kind: 'runtime-pattern',
        references: [
          {
            path: '/src/agent.ts',
            symbol: 'supportAgent',
          },
        ],
        runtimeName: 'messages.create',
        source: 'anthropic',
      },
      {
        agentId: 'support',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          requestProperty: 'input_schema',
          schemaRole: 'input',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderInput',
          },
          {
            path: '/src/find-order.ts',
          },
        ],
        runtimeName: 'FindOrderInput',
        source: 'anthropic',
      },
      {
        agentId: 'support',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          toolType: 'client',
        },
        kind: 'tool-registration',
        references: [
          {
            path: '/src/agent.ts',
          },
          {
            path: '/src/find-order.ts',
            symbol: 'findOrderTool',
          },
        ],
        runtimeName: 'find_order',
        source: 'anthropic',
      },
    ],
    manifestDigest: 'sha256:9b1b91e86f651188117f35779da3cf38dafc30e626120acfb6cf1e54e26628e9',
  },
  'claude-query': {
    valid: true,
    diagnostics: [],
    evidence: [
      {
        agentId: 'billing',
        capabilityId: null,
        capabilityKind: null,
        details: {
          patternId: 'programmatic-agent-definition',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'billingAgent',
          },
        ],
        runtimeName: 'billingAgent',
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'triage',
        capabilityId: null,
        capabilityKind: null,
        details: {
          delegationAvailabilitySource: 'explicit-built-in-tools',
          delegationTool: 'Agent',
          registrationKind: 'programmatic-subagent',
          registrationScope: 'query-session',
          targetAgentId: 'billing',
          targetRuntimeName: 'billing',
        },
        kind: 'handoff-registration',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'billingAgent',
          },
          {
            path: '/src/runtime.ts',
          },
        ],
        runtimeName: 'billing',
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'billing',
        capabilityId: null,
        capabilityKind: null,
        details: {
          role: 'subagent-prompt',
        },
        kind: 'instruction-loader',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/instructions.ts',
            symbol: 'loadBillingInstruction',
          },
        ],
        runtimeName: 'loadBillingInstruction',
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'triage',
        capabilityId: null,
        capabilityKind: null,
        details: {
          role: 'query-system-prompt',
        },
        kind: 'instruction-loader',
        references: [
          {
            path: '/src/instructions.ts',
            symbol: 'loadTriageInstruction',
          },
          {
            path: '/src/runtime.ts',
          },
        ],
        runtimeName: 'loadTriageInstruction',
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'billing',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'billingAgent',
          },
        ],
        runtimeName: null,
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'triage',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/src/runtime.ts',
            symbol: 'triageAgent',
          },
        ],
        runtimeName: null,
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'billing',
        capabilityId: null,
        capabilityKind: null,
        details: {
          compatibility: 'supported',
          declaredRange: '^0.3.234',
          dependencyKind: 'dependencies',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: '@anthropic-ai/claude-agent-sdk',
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'triage',
        capabilityId: null,
        capabilityKind: null,
        details: {
          compatibility: 'supported',
          declaredRange: '^0.3.234',
          dependencyKind: 'dependencies',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: '@anthropic-ai/claude-agent-sdk',
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'triage',
        capabilityId: null,
        capabilityKind: null,
        details: {
          call: 'query',
          patternId: 'direct-query-wrapper',
        },
        kind: 'runtime-pattern',
        references: [
          {
            path: '/src/runtime.ts',
            symbol: 'triageAgent',
          },
        ],
        runtimeName: 'triageAgent',
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'billing',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          role: 'tool-input',
          schemaKind: 'sdk-tool-input',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderInputSchema',
          },
          {
            path: '/src/tools.ts',
          },
        ],
        runtimeName: 'FindOrderInputSchema',
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'triage',
        capabilityId: null,
        capabilityKind: null,
        details: {
          role: 'agent-output',
          schemaKind: 'json-schema',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'TriageOutputSchema',
          },
          {
            path: '/src/runtime.ts',
          },
        ],
        runtimeName: 'TriageOutputSchema',
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'triage',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          role: 'tool-input',
          schemaKind: 'sdk-tool-input',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderInputSchema',
          },
          {
            path: '/src/tools.ts',
          },
        ],
        runtimeName: 'FindOrderInputSchema',
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'billing',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          availabilitySource: 'explicit-subagent-tools',
          registrationKind: 'sdk-mcp-tool',
          serverKey: 'support',
          underlyingToolName: 'find_order',
        },
        kind: 'tool-registration',
        references: [
          {
            path: '/src/find-order.ts',
            symbol: 'findOrder',
          },
          {
            path: '/src/runtime.ts',
          },
          {
            path: '/src/tools.ts',
            symbol: 'findOrderTool',
          },
        ],
        runtimeName: 'mcp__support__find_order',
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'triage',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          availabilitySource: 'query',
          registrationKind: 'sdk-mcp-tool',
          serverKey: 'support',
          underlyingToolName: 'find_order',
        },
        kind: 'tool-registration',
        references: [
          {
            path: '/src/find-order.ts',
            symbol: 'findOrder',
          },
          {
            path: '/src/runtime.ts',
          },
          {
            path: '/src/tools.ts',
            symbol: 'findOrderTool',
          },
        ],
        runtimeName: 'mcp__support__find_order',
        source: 'claude-agent-sdk',
      },
    ],
    manifestDigest: 'sha256:b8fbde1a7799082e7ad95bd4b74b4530de771e2b26e4b968d17d1a2264966260',
  },
  'cloudflare-agents': {
    valid: true,
    diagnostics: [],
    evidence: [
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          targetId: 'typescript-ai-chat-agent-0-10-ai-sdk-7',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'SummaryAgent',
          },
        ],
        runtimeName: 'SummaryAgent',
        source: 'cloudflare-agents',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          targetId: 'typescript-think-0-16-ai-sdk-7',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'SupportAgent',
          },
        ],
        runtimeName: 'SupportAgent',
        source: 'cloudflare-agents',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          targetAgentId: 'summary',
          toolName: 'summarize',
        },
        kind: 'handoff-registration',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'SummaryAgent',
          },
          {
            path: '/src/tools.ts',
            symbol: 'summaryHandoffTool',
          },
        ],
        runtimeName: 'summarize',
        source: 'cloudflare-agents',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {},
        kind: 'instruction-loader',
        references: [
          {
            path: '/src/instructions.ts',
            symbol: 'loadSummaryInstruction',
          },
        ],
        runtimeName: 'loadSummaryInstruction',
        source: 'cloudflare-agents',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {},
        kind: 'instruction-loader',
        references: [
          {
            path: '/src/instructions.ts',
            symbol: 'loadSupportInstruction',
          },
        ],
        runtimeName: 'loadSupportInstruction',
        source: 'cloudflare-agents',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'SummaryAgent',
          },
        ],
        runtimeName: null,
        source: 'cloudflare-agents',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'SupportAgent',
          },
        ],
        runtimeName: null,
        source: 'cloudflare-agents',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          compatibility: 'supported',
          declaredRange: '^0.10.2',
          dependencyKind: 'dependencies',
          targetId: 'typescript-ai-chat-agent-0-10-ai-sdk-7',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: '@cloudflare/ai-chat',
        source: 'cloudflare-agents',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          compatibility: 'supported',
          declaredRange: '^0.21.0',
          dependencyKind: 'dependencies',
          targetId: 'typescript-ai-chat-agent-0-10-ai-sdk-7',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: 'agents',
        source: 'cloudflare-agents',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          compatibility: 'supported',
          declaredRange: '^7.0.0',
          dependencyKind: 'dependencies',
          targetId: 'typescript-ai-chat-agent-0-10-ai-sdk-7',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: 'ai',
        source: 'cloudflare-agents',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          compatibility: 'supported',
          declaredRange: '^0.16.0',
          dependencyKind: 'dependencies',
          targetId: 'typescript-think-0-16-ai-sdk-7',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: '@cloudflare/think',
        source: 'cloudflare-agents',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          compatibility: 'supported',
          declaredRange: '^0.21.0',
          dependencyKind: 'dependencies',
          targetId: 'typescript-think-0-16-ai-sdk-7',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: 'agents',
        source: 'cloudflare-agents',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          compatibility: 'supported',
          declaredRange: '^7.0.0',
          dependencyKind: 'dependencies',
          targetId: 'typescript-think-0-16-ai-sdk-7',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: 'ai',
        source: 'cloudflare-agents',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          calls: 'streamText',
        },
        kind: 'runtime-pattern',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'SummaryAgent',
          },
        ],
        runtimeName: 'SummaryAgent',
        source: 'cloudflare-agents',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          schemaRole: 'agent-output',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'SummaryOutputSchema',
          },
        ],
        runtimeName: 'SummaryOutputSchema',
        source: 'cloudflare-agents',
      },
      {
        agentId: 'summary',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          schemaRole: 'tool-input',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderInputSchema',
          },
        ],
        runtimeName: 'FindOrderInputSchema',
        source: 'cloudflare-agents',
      },
      {
        agentId: 'summary',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          schemaRole: 'tool-output',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderOutputSchema',
          },
        ],
        runtimeName: 'FindOrderOutputSchema',
        source: 'cloudflare-agents',
      },
      {
        agentId: 'support',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          schemaRole: 'tool-input',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderInputSchema',
          },
        ],
        runtimeName: 'FindOrderInputSchema',
        source: 'cloudflare-agents',
      },
      {
        agentId: 'support',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          schemaRole: 'tool-output',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderOutputSchema',
          },
        ],
        runtimeName: 'FindOrderOutputSchema',
        source: 'cloudflare-agents',
      },
      {
        agentId: 'summary',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          toolName: 'find_order',
        },
        kind: 'tool-registration',
        references: [
          {
            path: '/src/implementations.ts',
            symbol: 'findOrder',
          },
          {
            path: '/src/tools.ts',
            symbol: 'findOrderTool',
          },
        ],
        runtimeName: 'find_order',
        source: 'cloudflare-agents',
      },
      {
        agentId: 'support',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          toolName: 'find_order',
        },
        kind: 'tool-registration',
        references: [
          {
            path: '/src/implementations.ts',
            symbol: 'findOrder',
          },
          {
            path: '/src/tools.ts',
            symbol: 'findOrderTool',
          },
        ],
        runtimeName: 'find_order',
        source: 'cloudflare-agents',
      },
    ],
    manifestDigest: 'sha256:fbd9fe860cdf7766a5b6c51e94dd6a64f52e04982c386b819169afbd9245a785',
  },
  'eve-filesystem': {
    valid: true,
    diagnostics: [],
    evidence: [
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          agentKind: 'local-subagent',
          agentRoot: '/agent/subagents/summary',
          layout: 'nested',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/agent/subagents/summary/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: 'summary',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          agentKind: 'root',
          agentRoot: '/agent',
          layout: 'nested',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/agent/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: 'support-app',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          registrationKind: 'local-subagent-package',
          routingDescriptionSource: 'handoff-description',
          routingDescriptionWired: true,
          targetAgentId: 'summary',
          targetRuntimeName: 'summary',
        },
        kind: 'handoff-registration',
        references: [
          {
            path: '/agent/agent.ts',
            symbol: 'default',
          },
          {
            path: '/agent/subagents/summary/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: 'summary',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {},
        kind: 'instruction-loader',
        references: [
          {
            path: '/agent/loaders.ts',
            symbol: 'loadInstruction',
          },
        ],
        runtimeName: 'loadInstruction',
        source: 'eve',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/agent/subagents/summary/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/agent/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          declaredRange: '^0.39.1',
          dependencyKind: 'dependencies',
          packageClassification: 'supported',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          declaredRange: '^0.39.1',
          dependencyKind: 'dependencies',
          packageClassification: 'supported',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          schemaRole: 'agent-output',
        },
        kind: 'schema',
        references: [
          {
            path: '/agent/contracts.ts',
            symbol: 'SupportOutputSchema',
          },
        ],
        runtimeName: 'SupportOutputSchema',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'search',
        capabilityKind: 'tool',
        details: {
          schemaRole: 'tool-input',
        },
        kind: 'schema',
        references: [
          {
            path: '/agent/contracts.ts',
            symbol: 'SearchInputSchema',
          },
        ],
        runtimeName: 'SearchInputSchema',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'search',
        capabilityKind: 'tool',
        details: {
          schemaRole: 'tool-output',
        },
        kind: 'schema',
        references: [
          {
            path: '/agent/contracts.ts',
            symbol: 'SearchOutputSchema',
          },
        ],
        runtimeName: 'SearchOutputSchema',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'analyze',
        capabilityKind: 'skill',
        details: {
          registrationKind: 'typescript',
        },
        kind: 'skill-registration',
        references: [
          {
            path: '/agent/skills/analyze.ts',
          },
        ],
        runtimeName: 'analyze',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'search',
        capabilityKind: 'tool',
        details: {
          implementationKind: 'bound-function',
          pathDepth: 1,
          registrationKind: 'filesystem-tool',
        },
        kind: 'tool-registration',
        references: [
          {
            path: '/agent/implementations.ts',
            symbol: 'searchKnowledge',
          },
          {
            path: '/agent/tools/search.ts',
          },
        ],
        runtimeName: 'search',
        source: 'eve',
      },
    ],
    manifestDigest: 'sha256:57c6acbd72e25c90e7cb04c126f069abff050b56cc5ba117ea0ce1fd6dc8e421',
  },
  'google-generate-content': {
    valid: true,
    diagnostics: [],
    evidence: [
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          requestProperty: 'config.systemInstruction',
        },
        kind: 'instruction-loader',
        references: [
          {
            path: '/src/agent.ts',
          },
          {
            path: '/src/instructions.ts',
            symbol: 'loadInstruction',
          },
        ],
        runtimeName: 'loadInstruction',
        source: 'google-genai',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/src/agent.ts',
            symbol: 'supportAgent',
          },
        ],
        runtimeName: null,
        source: 'google-genai',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          compatibility: 'supported',
          declaredRange: '^2.17.1',
          dependencyKind: 'dependencies',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: '@google/genai',
        source: 'google-genai',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          api: 'models',
        },
        kind: 'runtime-pattern',
        references: [
          {
            path: '/src/agent.ts',
            symbol: 'supportAgent',
          },
        ],
        runtimeName: 'models.generateContent',
        source: 'google-genai',
      },
      {
        agentId: 'support',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          requestProperty: 'parametersJsonSchema',
          schemaRole: 'input',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderInput',
          },
          {
            path: '/src/find-order.ts',
          },
        ],
        runtimeName: 'FindOrderInput',
        source: 'google-genai',
      },
      {
        agentId: 'support',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          toolType: 'function-declaration',
        },
        kind: 'tool-registration',
        references: [
          {
            path: '/src/agent.ts',
          },
          {
            path: '/src/find-order.ts',
            symbol: 'findOrderDeclaration',
          },
        ],
        runtimeName: 'find_order',
        source: 'google-genai',
      },
    ],
    manifestDigest: 'sha256:7a7801f5eee21d5b1ce17232bde3918ce2e62eb376467aa4c25de51607db9a31',
  },
  'langchain-create-agent': {
    valid: true,
    diagnostics: [],
    evidence: [
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          targetId: 'typescript-create-agent-1-5',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/src/agent.ts',
            symbol: 'supportAgent',
          },
        ],
        runtimeName: 'support-runtime',
        source: 'langchain',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          instructionForm: 'system-message',
          property: 'systemPrompt',
          targetId: 'typescript-create-agent-1-5',
        },
        kind: 'instruction-loader',
        references: [
          {
            path: '/src/agent.ts',
            symbol: 'supportAgent',
          },
          {
            path: '/src/instructions.ts',
            symbol: 'loadSupportInstruction',
          },
        ],
        runtimeName: 'loadSupportInstruction',
        source: 'langchain',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/src/agent.ts',
            symbol: 'supportAgent',
          },
        ],
        runtimeName: null,
        source: 'langchain',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          classification: 'supported',
          declaredRange: '~1.2.8',
          dependencyKind: 'dependencies',
          packageName: '@langchain/core',
          packageRole: 'companion',
          targetClassification: 'supported',
          targetId: 'typescript-create-agent-1-5',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: '@langchain/core',
        source: 'langchain',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          classification: 'supported',
          declaredRange: '~1.5.9',
          dependencyKind: 'dependencies',
          packageName: 'langchain',
          packageRole: 'primary',
          targetClassification: 'supported',
          targetId: 'typescript-create-agent-1-5',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: 'langchain',
        source: 'langchain',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          property: 'responseFormat',
          schemaRole: 'agent-output',
          schemaStrategy: 'provider-strategy',
          targetId: 'typescript-create-agent-1-5',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/agent.ts',
            symbol: 'supportAgent',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'SupportOutputSchema',
          },
        ],
        runtimeName: 'SupportOutputSchema',
        source: 'langchain',
      },
      {
        agentId: 'support',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          property: 'schema',
          schemaRole: 'tool-input',
          targetId: 'typescript-create-agent-1-5',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderInputSchema',
          },
          {
            path: '/src/tools.ts',
            symbol: 'findOrderTool',
          },
        ],
        runtimeName: 'FindOrderInputSchema',
        source: 'langchain',
      },
      {
        agentId: 'support',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          helperSource: '@langchain/core/tools',
          registrationForm: 'normal-function-tool',
          targetId: 'typescript-create-agent-1-5',
        },
        kind: 'tool-registration',
        references: [
          {
            path: '/src/agent.ts',
            symbol: 'supportAgent',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderInputSchema',
          },
          {
            path: '/src/implementations.ts',
            symbol: 'findOrder',
          },
          {
            path: '/src/tools.ts',
            symbol: 'findOrderTool',
          },
        ],
        runtimeName: 'find_order',
        source: 'langchain',
      },
    ],
    manifestDigest: 'sha256:67a328d86a3c99a4010d51551c609adb79c938abf1858a56bc9e74c01a3ab374',
  },
  'langchain-direct-schema': {
    valid: true,
    diagnostics: [],
    evidence: [
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          targetId: 'typescript-create-agent-1-5',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/src/agent.ts',
            symbol: 'supportAgent',
          },
        ],
        runtimeName: 'support-runtime',
        source: 'langchain',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          instructionForm: 'system-message',
          property: 'systemPrompt',
          targetId: 'typescript-create-agent-1-5',
        },
        kind: 'instruction-loader',
        references: [
          {
            path: '/src/agent.ts',
            symbol: 'supportAgent',
          },
          {
            path: '/src/instructions.ts',
            symbol: 'loadSupportInstruction',
          },
        ],
        runtimeName: 'loadSupportInstruction',
        source: 'langchain',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/src/agent.ts',
            symbol: 'supportAgent',
          },
        ],
        runtimeName: null,
        source: 'langchain',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          classification: 'supported',
          declaredRange: '~1.2.8',
          dependencyKind: 'dependencies',
          packageName: '@langchain/core',
          packageRole: 'companion',
          targetClassification: 'supported',
          targetId: 'typescript-create-agent-1-5',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: '@langchain/core',
        source: 'langchain',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          classification: 'supported',
          declaredRange: '~1.5.9',
          dependencyKind: 'dependencies',
          packageName: 'langchain',
          packageRole: 'primary',
          targetClassification: 'supported',
          targetId: 'typescript-create-agent-1-5',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: 'langchain',
        source: 'langchain',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          property: 'responseFormat',
          schemaRole: 'agent-output',
          schemaStrategy: 'direct',
          targetId: 'typescript-create-agent-1-5',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/agent.ts',
            symbol: 'supportAgent',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'SupportOutputSchema',
          },
        ],
        runtimeName: 'SupportOutputSchema',
        source: 'langchain',
      },
      {
        agentId: 'support',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          property: 'schema',
          schemaRole: 'tool-input',
          targetId: 'typescript-create-agent-1-5',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderInputSchema',
          },
          {
            path: '/src/tools.ts',
            symbol: 'findOrderTool',
          },
        ],
        runtimeName: 'FindOrderInputSchema',
        source: 'langchain',
      },
      {
        agentId: 'support',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          helperSource: '@langchain/core/tools',
          registrationForm: 'normal-function-tool',
          targetId: 'typescript-create-agent-1-5',
        },
        kind: 'tool-registration',
        references: [
          {
            path: '/src/agent.ts',
            symbol: 'supportAgent',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderInputSchema',
          },
          {
            path: '/src/implementations.ts',
            symbol: 'findOrder',
          },
          {
            path: '/src/tools.ts',
            symbol: 'findOrderTool',
          },
        ],
        runtimeName: 'find_order',
        source: 'langchain',
      },
    ],
    manifestDigest: 'sha256:67a328d86a3c99a4010d51551c609adb79c938abf1858a56bc9e74c01a3ab374',
  },
  'langchain-tool-strategy': {
    valid: true,
    diagnostics: [],
    evidence: [
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          targetId: 'typescript-create-agent-1-5',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/src/agent.ts',
            symbol: 'supportAgent',
          },
        ],
        runtimeName: 'support-runtime',
        source: 'langchain',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          instructionForm: 'system-message',
          property: 'systemPrompt',
          targetId: 'typescript-create-agent-1-5',
        },
        kind: 'instruction-loader',
        references: [
          {
            path: '/src/agent.ts',
            symbol: 'supportAgent',
          },
          {
            path: '/src/instructions.ts',
            symbol: 'loadSupportInstruction',
          },
        ],
        runtimeName: 'loadSupportInstruction',
        source: 'langchain',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/src/agent.ts',
            symbol: 'supportAgent',
          },
        ],
        runtimeName: null,
        source: 'langchain',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          classification: 'supported',
          declaredRange: '~1.2.8',
          dependencyKind: 'dependencies',
          packageName: '@langchain/core',
          packageRole: 'companion',
          targetClassification: 'supported',
          targetId: 'typescript-create-agent-1-5',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: '@langchain/core',
        source: 'langchain',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          classification: 'supported',
          declaredRange: '~1.5.9',
          dependencyKind: 'dependencies',
          packageName: 'langchain',
          packageRole: 'primary',
          targetClassification: 'supported',
          targetId: 'typescript-create-agent-1-5',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: 'langchain',
        source: 'langchain',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          property: 'responseFormat',
          schemaRole: 'agent-output',
          schemaStrategy: 'tool-strategy',
          targetId: 'typescript-create-agent-1-5',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/agent.ts',
            symbol: 'supportAgent',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'SupportOutputSchema',
          },
        ],
        runtimeName: 'SupportOutputSchema',
        source: 'langchain',
      },
      {
        agentId: 'support',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          property: 'schema',
          schemaRole: 'tool-input',
          targetId: 'typescript-create-agent-1-5',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderInputSchema',
          },
          {
            path: '/src/tools.ts',
            symbol: 'findOrderTool',
          },
        ],
        runtimeName: 'FindOrderInputSchema',
        source: 'langchain',
      },
      {
        agentId: 'support',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          helperSource: '@langchain/core/tools',
          registrationForm: 'normal-function-tool',
          targetId: 'typescript-create-agent-1-5',
        },
        kind: 'tool-registration',
        references: [
          {
            path: '/src/agent.ts',
            symbol: 'supportAgent',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderInputSchema',
          },
          {
            path: '/src/implementations.ts',
            symbol: 'findOrder',
          },
          {
            path: '/src/tools.ts',
            symbol: 'findOrderTool',
          },
        ],
        runtimeName: 'find_order',
        source: 'langchain',
      },
    ],
    manifestDigest: 'sha256:67a328d86a3c99a4010d51551c609adb79c938abf1858a56bc9e74c01a3ab374',
  },
  'langgraph-workflows': {
    valid: true,
    diagnostics: [],
    evidence: [
      {
        agentId: 'functional',
        capabilityId: null,
        capabilityKind: null,
        details: {
          apiKind: 'functional',
          targetId: 'typescript-functional-api-1-4',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/src/functional.ts',
            symbol: 'supportWorkflow',
          },
        ],
        runtimeName: 'support_workflow',
        source: 'langgraph',
      },
      {
        agentId: 'graph',
        capabilityId: null,
        capabilityKind: null,
        details: {
          apiKind: 'state-graph',
          builderForm: 'module-local',
          targetId: 'typescript-state-graph-1-4',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/src/graph.ts',
            symbol: 'supportGraph',
          },
        ],
        runtimeName: 'support_graph',
        source: 'langgraph',
      },
      {
        agentId: 'functional',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
          moduleKind: 'esm',
        },
        kind: 'language',
        references: [
          {
            path: '/src/functional.ts',
            symbol: 'supportWorkflow',
          },
        ],
        runtimeName: null,
        source: 'langgraph',
      },
      {
        agentId: 'graph',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
          moduleKind: 'esm',
        },
        kind: 'language',
        references: [
          {
            path: '/src/graph.ts',
            symbol: 'supportGraph',
          },
        ],
        runtimeName: null,
        source: 'langgraph',
      },
      {
        agentId: 'functional',
        capabilityId: null,
        capabilityKind: null,
        details: {
          classification: 'supported',
          declaredRange: '~1.2.9',
          dependencyKind: 'dependencies',
          packageName: '@langchain/core',
          packageRole: 'companion',
          targetClassification: 'supported',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: '@langchain/core',
        source: 'langgraph',
      },
      {
        agentId: 'functional',
        capabilityId: null,
        capabilityKind: null,
        details: {
          classification: 'supported',
          declaredRange: '~1.4.12',
          dependencyKind: 'dependencies',
          packageName: '@langchain/langgraph',
          packageRole: 'primary',
          targetClassification: 'supported',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: '@langchain/langgraph',
        source: 'langgraph',
      },
      {
        agentId: 'graph',
        capabilityId: null,
        capabilityKind: null,
        details: {
          classification: 'supported',
          declaredRange: '~1.2.9',
          dependencyKind: 'dependencies',
          packageName: '@langchain/core',
          packageRole: 'companion',
          targetClassification: 'supported',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: '@langchain/core',
        source: 'langgraph',
      },
      {
        agentId: 'graph',
        capabilityId: null,
        capabilityKind: null,
        details: {
          classification: 'supported',
          declaredRange: '~1.4.12',
          dependencyKind: 'dependencies',
          packageName: '@langchain/langgraph',
          packageRole: 'primary',
          targetClassification: 'supported',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: '@langchain/langgraph',
        source: 'langgraph',
      },
      {
        agentId: 'functional',
        capabilityId: null,
        capabilityKind: null,
        details: {
          apiKind: 'functional',
          patternId: 'functional-final-state',
          targetId: 'typescript-functional-api-1-4',
        },
        kind: 'runtime-pattern',
        references: [
          {
            path: '/src/functional.ts',
          },
        ],
        runtimeName: null,
        source: 'langgraph',
      },
      {
        agentId: 'functional',
        capabilityId: null,
        capabilityKind: null,
        details: {
          apiKind: 'functional',
          patternId: 'functional-interrupt',
          targetId: 'typescript-functional-api-1-4',
        },
        kind: 'runtime-pattern',
        references: [
          {
            path: '/src/functional.ts',
          },
        ],
        runtimeName: null,
        source: 'langgraph',
      },
      {
        agentId: 'functional',
        capabilityId: null,
        capabilityKind: null,
        details: {
          apiKind: 'functional',
          patternId: 'functional-previous-state',
          targetId: 'typescript-functional-api-1-4',
        },
        kind: 'runtime-pattern',
        references: [
          {
            path: '/src/functional.ts',
          },
        ],
        runtimeName: null,
        source: 'langgraph',
      },
      {
        agentId: 'functional',
        capabilityId: null,
        capabilityKind: null,
        details: {
          apiKind: 'functional',
          patternId: 'functional-task',
          targetId: 'typescript-functional-api-1-4',
          taskForm: 'module-local',
          taskName: 'prepare_task',
        },
        kind: 'runtime-pattern',
        references: [
          {
            path: '/src/functional.ts',
          },
        ],
        runtimeName: 'prepare_task',
        source: 'langgraph',
      },
      {
        agentId: 'graph',
        capabilityId: null,
        capabilityKind: null,
        details: {
          graphOperation: 'addConditionalEdges',
          patternId: 'state-graph-conditional-edge',
          sourceName: 'respond',
          targetId: 'typescript-state-graph-1-4',
        },
        kind: 'runtime-pattern',
        references: [
          {
            path: '/src/graph.ts',
          },
          {
            path: '/src/graph.ts',
            symbol: 'route',
          },
        ],
        runtimeName: null,
        source: 'langgraph',
      },
      {
        agentId: 'graph',
        capabilityId: null,
        capabilityKind: null,
        details: {
          edgeKind: 'direct',
          graphOperation: 'addEdge',
          patternId: 'state-graph-edge',
          sourceName: '__start__',
          targetId: 'typescript-state-graph-1-4',
          targetName: 'prepare',
        },
        kind: 'runtime-pattern',
        references: [
          {
            path: '/src/graph.ts',
          },
        ],
        runtimeName: null,
        source: 'langgraph',
      },
      {
        agentId: 'graph',
        capabilityId: null,
        capabilityKind: null,
        details: {
          edgeKind: 'direct',
          graphOperation: 'addEdge',
          patternId: 'state-graph-edge',
          sourceName: 'prepare',
          targetId: 'typescript-state-graph-1-4',
          targetName: 'respond',
        },
        kind: 'runtime-pattern',
        references: [
          {
            path: '/src/graph.ts',
          },
        ],
        runtimeName: null,
        source: 'langgraph',
      },
      {
        agentId: 'graph',
        capabilityId: null,
        capabilityKind: null,
        details: {
          graphOperation: 'addNode',
          patternId: 'state-graph-node',
          targetId: 'typescript-state-graph-1-4',
        },
        kind: 'runtime-pattern',
        references: [
          {
            path: '/src/graph.ts',
          },
          {
            path: '/src/graph.ts',
            symbol: 'prepare',
          },
        ],
        runtimeName: 'prepare',
        source: 'langgraph',
      },
      {
        agentId: 'graph',
        capabilityId: null,
        capabilityKind: null,
        details: {
          graphOperation: 'addNode',
          patternId: 'state-graph-node',
          targetId: 'typescript-state-graph-1-4',
        },
        kind: 'runtime-pattern',
        references: [
          {
            path: '/src/graph.ts',
          },
          {
            path: '/src/graph.ts',
            symbol: 'respond',
          },
        ],
        runtimeName: 'respond',
        source: 'langgraph',
      },
      {
        agentId: 'graph',
        capabilityId: null,
        capabilityKind: null,
        details: {
          schemaRole: 'agent-input',
          schemaSource: 'explicit-input',
          targetId: 'typescript-state-graph-1-4',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'GraphInputSchema',
          },
          {
            path: '/src/graph.ts',
            symbol: 'supportGraph',
          },
        ],
        runtimeName: null,
        source: 'langgraph',
      },
      {
        agentId: 'graph',
        capabilityId: null,
        capabilityKind: null,
        details: {
          schemaRole: 'agent-output',
          schemaSource: 'explicit-output',
          targetId: 'typescript-state-graph-1-4',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'GraphOutputSchema',
          },
          {
            path: '/src/graph.ts',
            symbol: 'supportGraph',
          },
        ],
        runtimeName: null,
        source: 'langgraph',
      },
    ],
    manifestDigest: 'sha256:aec312d47d55e765369cd174ad53a2f8c48e484edc85d84d5fc5c10c6c02f568',
  },
  'openai-responses': {
    valid: true,
    diagnostics: [],
    evidence: [
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          requestProperty: 'instructions',
        },
        kind: 'instruction-loader',
        references: [
          {
            path: '/src/agent.ts',
          },
          {
            path: '/src/instructions.ts',
            symbol: 'loadInstruction',
          },
        ],
        runtimeName: 'loadInstruction',
        source: 'openai',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/src/agent.ts',
            symbol: 'supportAgent',
          },
        ],
        runtimeName: null,
        source: 'openai',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          compatibility: 'supported',
          declaredRange: '^7.4.0',
          dependencyKind: 'dependencies',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: 'openai',
        source: 'openai',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          api: 'responses',
        },
        kind: 'runtime-pattern',
        references: [
          {
            path: '/src/agent.ts',
            symbol: 'supportAgent',
          },
        ],
        runtimeName: 'responses.create',
        source: 'openai',
      },
      {
        agentId: 'support',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          requestProperty: 'parameters',
          schemaRole: 'input',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderInput',
          },
          {
            path: '/src/find-order.ts',
          },
        ],
        runtimeName: 'FindOrderInput',
        source: 'openai',
      },
      {
        agentId: 'support',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          toolType: 'function',
        },
        kind: 'tool-registration',
        references: [
          {
            path: '/src/agent.ts',
          },
          {
            path: '/src/find-order.ts',
            symbol: 'findOrderTool',
          },
        ],
        runtimeName: 'find_order',
        source: 'openai',
      },
    ],
    manifestDigest: 'sha256:a2f1308a6155dedf12282c0f09b308472e74b620490c721eb0135f55c694b32a',
  },
  'openai-agent-handoffs': {
    valid: true,
    diagnostics: [],
    evidence: [
      {
        agentId: 'billing',
        capabilityId: null,
        capabilityKind: null,
        details: {
          definitionKind: 'agent',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'billingAgent',
          },
        ],
        runtimeName: 'billing',
        source: 'openai-agents-sdk',
      },
      {
        agentId: 'triage',
        capabilityId: null,
        capabilityKind: null,
        details: {
          definitionKind: 'agent',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'triageAgent',
          },
        ],
        runtimeName: 'triage',
        source: 'openai-agents-sdk',
      },
      {
        agentId: 'triage',
        capabilityId: null,
        capabilityKind: null,
        details: {
          registrationKind: 'agent',
          routingDescriptionSource: 'target',
          targetAgentId: 'billing',
          targetRuntimeName: 'billing',
        },
        kind: 'handoff-registration',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/agents.ts',
            symbol: 'billingAgent',
          },
        ],
        runtimeName: null,
        source: 'openai-agents-sdk',
      },
      {
        agentId: 'triage',
        capabilityId: null,
        capabilityKind: null,
        details: {
          registrationKind: 'handoff',
          routingDescriptionSource: 'override',
          targetAgentId: 'billing',
          targetRuntimeName: 'billing',
        },
        kind: 'handoff-registration',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/agents.ts',
            symbol: 'billingAgent',
          },
        ],
        runtimeName: 'route_billing',
        source: 'openai-agents-sdk',
      },
      {
        agentId: 'triage',
        capabilityId: null,
        capabilityKind: null,
        details: {
          configurationProperty: 'instructions',
        },
        kind: 'instruction-loader',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/instructions.ts',
            symbol: 'loadTriageInstruction',
          },
        ],
        runtimeName: 'loadTriageInstruction',
        source: 'openai-agents-sdk',
      },
      {
        agentId: 'billing',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'billingAgent',
          },
        ],
        runtimeName: null,
        source: 'openai-agents-sdk',
      },
      {
        agentId: 'triage',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'triageAgent',
          },
        ],
        runtimeName: null,
        source: 'openai-agents-sdk',
      },
      {
        agentId: 'billing',
        capabilityId: null,
        capabilityKind: null,
        details: {
          compatibility: 'supported',
          declaredRange: '^0.16.1',
          dependencyKind: 'dependencies',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: '@openai/agents',
        source: 'openai-agents-sdk',
      },
      {
        agentId: 'triage',
        capabilityId: null,
        capabilityKind: null,
        details: {
          compatibility: 'supported',
          declaredRange: '^0.16.1',
          dependencyKind: 'dependencies',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: '@openai/agents',
        source: 'openai-agents-sdk',
      },
      {
        agentId: 'triage',
        capabilityId: null,
        capabilityKind: null,
        details: {
          configurationProperty: 'outputType',
          schemaRole: 'agent-output',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'TriageOutputSchema',
          },
        ],
        runtimeName: 'TriageOutputSchema',
        source: 'openai-agents-sdk',
      },
      {
        agentId: 'triage',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          configurationProperty: 'parameters',
          schemaRole: 'tool-input',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderInputSchema',
          },
          {
            path: '/src/tools.ts',
          },
        ],
        runtimeName: 'FindOrderInputSchema',
        source: 'openai-agents-sdk',
      },
      {
        agentId: 'triage',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          configurationProperty: 'outputSchema',
          schemaRole: 'tool-output',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderOutputSchema',
          },
          {
            path: '/src/tools.ts',
          },
        ],
        runtimeName: 'FindOrderOutputSchema',
        source: 'openai-agents-sdk',
      },
      {
        agentId: 'triage',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          toolType: 'function',
        },
        kind: 'tool-registration',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/find-order.ts',
            symbol: 'findOrder',
          },
          {
            path: '/src/tools.ts',
            symbol: 'findOrderTool',
          },
        ],
        runtimeName: 'find_order',
        source: 'openai-agents-sdk',
      },
    ],
    manifestDigest: 'sha256:5e3d971d534ccbdce461a409fbd29d1a3e3aad67b6ef599f78779d80579dbe06',
  },
  'vercel-agent-and-stream': {
    valid: true,
    diagnostics: [],
    evidence: [
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          targetId: 'typescript-tool-loop-agent-7',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'supportAgent',
          },
        ],
        runtimeName: 'support-runtime',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          targetId: 'typescript-generate-stream-text-7',
        },
        kind: 'instruction-loader',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/instructions.ts',
            symbol: 'loadSummaryInstruction',
          },
        ],
        runtimeName: 'loadSummaryInstruction',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          targetId: 'typescript-tool-loop-agent-7',
        },
        kind: 'instruction-loader',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/instructions.ts',
            symbol: 'loadSupportInstruction',
          },
        ],
        runtimeName: 'loadSupportInstruction',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'summaryAgent',
          },
        ],
        runtimeName: null,
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'supportAgent',
          },
        ],
        runtimeName: null,
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          compatibility: 'supported',
          declaredRange: '^7.0.66',
          dependencyKind: 'dependencies',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: 'ai',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          compatibility: 'supported',
          declaredRange: '^7.0.66',
          dependencyKind: 'dependencies',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: 'ai',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          calls: 'streamText',
          targetId: 'typescript-generate-stream-text-7',
        },
        kind: 'runtime-pattern',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'summaryAgent',
          },
        ],
        runtimeName: 'summaryAgent',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          schemaRole: 'agent-output',
          targetId: 'typescript-generate-stream-text-7',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'SummaryOutputSchema',
          },
        ],
        runtimeName: 'SummaryOutputSchema',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          configurationProperty: 'inputSchema',
          schemaRole: 'tool-input',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderInputSchema',
          },
          {
            path: '/src/tools.ts',
          },
        ],
        runtimeName: 'FindOrderInputSchema',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          configurationProperty: 'outputSchema',
          schemaRole: 'tool-output',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderOutputSchema',
          },
          {
            path: '/src/tools.ts',
          },
        ],
        runtimeName: 'FindOrderOutputSchema',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          configurationProperty: 'callOptionsSchema',
          schemaRole: 'agent-input',
          targetId: 'typescript-tool-loop-agent-7',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'SupportInputSchema',
          },
        ],
        runtimeName: 'SupportInputSchema',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          schemaRole: 'agent-output',
          targetId: 'typescript-tool-loop-agent-7',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'SupportOutputSchema',
          },
        ],
        runtimeName: 'SupportOutputSchema',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'support',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          configurationProperty: 'inputSchema',
          schemaRole: 'tool-input',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderInputSchema',
          },
          {
            path: '/src/tools.ts',
          },
        ],
        runtimeName: 'FindOrderInputSchema',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'support',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          configurationProperty: 'outputSchema',
          schemaRole: 'tool-output',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderOutputSchema',
          },
          {
            path: '/src/tools.ts',
          },
        ],
        runtimeName: 'FindOrderOutputSchema',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          targetId: 'typescript-generate-stream-text-7',
          toolType: 'function',
        },
        kind: 'tool-registration',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderInputSchema',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderOutputSchema',
          },
          {
            path: '/src/implementations.ts',
            symbol: 'findOrder',
          },
          {
            path: '/src/tools.ts',
            symbol: 'findOrderTool',
          },
        ],
        runtimeName: 'find_order',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'support',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          targetId: 'typescript-tool-loop-agent-7',
          toolType: 'function',
        },
        kind: 'tool-registration',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderInputSchema',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderOutputSchema',
          },
          {
            path: '/src/implementations.ts',
            symbol: 'findOrder',
          },
          {
            path: '/src/tools.ts',
            symbol: 'findOrderTool',
          },
        ],
        runtimeName: 'find_order',
        source: 'vercel-ai-sdk',
      },
    ],
    manifestDigest: 'sha256:c63073ab346cd09e5ce3771ac2b4e7ffd9f9d313f2551030bada323225091939',
  },
  'claude-preset': {
    valid: true,
    diagnostics: [],
    evidence: [
      {
        agentId: 'billing',
        capabilityId: null,
        capabilityKind: null,
        details: {
          patternId: 'programmatic-agent-definition',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'billingAgent',
          },
        ],
        runtimeName: 'billingAgent',
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'triage',
        capabilityId: null,
        capabilityKind: null,
        details: {
          delegationAvailabilitySource: 'explicit-built-in-tools',
          delegationTool: 'Agent',
          registrationKind: 'programmatic-subagent',
          registrationScope: 'query-session',
          targetAgentId: 'billing',
          targetRuntimeName: 'billing',
        },
        kind: 'handoff-registration',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'billingAgent',
          },
          {
            path: '/src/runtime.ts',
          },
        ],
        runtimeName: 'billing',
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'billing',
        capabilityId: null,
        capabilityKind: null,
        details: {
          role: 'subagent-prompt',
        },
        kind: 'instruction-loader',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/instructions.ts',
            symbol: 'loadBillingInstruction',
          },
        ],
        runtimeName: 'loadBillingInstruction',
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'triage',
        capabilityId: null,
        capabilityKind: null,
        details: {
          role: 'query-preset-append',
        },
        kind: 'instruction-loader',
        references: [
          {
            path: '/src/instructions.ts',
            symbol: 'loadTriageInstruction',
          },
          {
            path: '/src/runtime.ts',
          },
        ],
        runtimeName: 'loadTriageInstruction',
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'billing',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'billingAgent',
          },
        ],
        runtimeName: null,
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'triage',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/src/runtime.ts',
            symbol: 'triageAgent',
          },
        ],
        runtimeName: null,
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'billing',
        capabilityId: null,
        capabilityKind: null,
        details: {
          compatibility: 'supported',
          declaredRange: '^0.3.234',
          dependencyKind: 'dependencies',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: '@anthropic-ai/claude-agent-sdk',
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'triage',
        capabilityId: null,
        capabilityKind: null,
        details: {
          compatibility: 'supported',
          declaredRange: '^0.3.234',
          dependencyKind: 'dependencies',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: '@anthropic-ai/claude-agent-sdk',
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'triage',
        capabilityId: null,
        capabilityKind: null,
        details: {
          call: 'query',
          patternId: 'direct-query-wrapper',
        },
        kind: 'runtime-pattern',
        references: [
          {
            path: '/src/runtime.ts',
            symbol: 'triageAgent',
          },
        ],
        runtimeName: 'triageAgent',
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'billing',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          role: 'tool-input',
          schemaKind: 'sdk-tool-input',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderInputSchema',
          },
          {
            path: '/src/tools.ts',
          },
        ],
        runtimeName: 'FindOrderInputSchema',
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'triage',
        capabilityId: null,
        capabilityKind: null,
        details: {
          role: 'agent-output',
          schemaKind: 'json-schema',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'TriageOutputSchema',
          },
          {
            path: '/src/runtime.ts',
          },
        ],
        runtimeName: 'TriageOutputSchema',
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'triage',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          role: 'tool-input',
          schemaKind: 'sdk-tool-input',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderInputSchema',
          },
          {
            path: '/src/tools.ts',
          },
        ],
        runtimeName: 'FindOrderInputSchema',
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'billing',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          availabilitySource: 'explicit-subagent-tools',
          registrationKind: 'sdk-mcp-tool',
          serverKey: 'support',
          underlyingToolName: 'find_order',
        },
        kind: 'tool-registration',
        references: [
          {
            path: '/src/find-order.ts',
            symbol: 'findOrder',
          },
          {
            path: '/src/runtime.ts',
          },
          {
            path: '/src/tools.ts',
            symbol: 'findOrderTool',
          },
        ],
        runtimeName: 'mcp__support__find_order',
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'triage',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          availabilitySource: 'query',
          registrationKind: 'sdk-mcp-tool',
          serverKey: 'support',
          underlyingToolName: 'find_order',
        },
        kind: 'tool-registration',
        references: [
          {
            path: '/src/find-order.ts',
            symbol: 'findOrder',
          },
          {
            path: '/src/runtime.ts',
          },
          {
            path: '/src/tools.ts',
            symbol: 'findOrderTool',
          },
        ],
        runtimeName: 'mcp__support__find_order',
        source: 'claude-agent-sdk',
      },
    ],
    manifestDigest: 'sha256:b8fbde1a7799082e7ad95bd4b74b4530de771e2b26e4b968d17d1a2264966260',
  },
  'claude-inherited-tools': {
    valid: true,
    diagnostics: [],
    evidence: [
      {
        agentId: 'billing',
        capabilityId: null,
        capabilityKind: null,
        details: {
          patternId: 'programmatic-agent-definition',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'billingAgent',
          },
        ],
        runtimeName: 'billingAgent',
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'triage',
        capabilityId: null,
        capabilityKind: null,
        details: {
          delegationAvailabilitySource: 'explicit-built-in-tools',
          delegationTool: 'Agent',
          registrationKind: 'programmatic-subagent',
          registrationScope: 'query-session',
          targetAgentId: 'billing',
          targetRuntimeName: 'billing',
        },
        kind: 'handoff-registration',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'billingAgent',
          },
          {
            path: '/src/runtime.ts',
          },
        ],
        runtimeName: 'billing',
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'billing',
        capabilityId: null,
        capabilityKind: null,
        details: {
          role: 'subagent-prompt',
        },
        kind: 'instruction-loader',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/instructions.ts',
            symbol: 'loadBillingInstruction',
          },
        ],
        runtimeName: 'loadBillingInstruction',
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'triage',
        capabilityId: null,
        capabilityKind: null,
        details: {
          role: 'query-system-prompt',
        },
        kind: 'instruction-loader',
        references: [
          {
            path: '/src/instructions.ts',
            symbol: 'loadTriageInstruction',
          },
          {
            path: '/src/runtime.ts',
          },
        ],
        runtimeName: 'loadTriageInstruction',
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'billing',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'billingAgent',
          },
        ],
        runtimeName: null,
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'triage',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/src/runtime.ts',
            symbol: 'triageAgent',
          },
        ],
        runtimeName: null,
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'billing',
        capabilityId: null,
        capabilityKind: null,
        details: {
          compatibility: 'supported',
          declaredRange: '^0.3.234',
          dependencyKind: 'dependencies',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: '@anthropic-ai/claude-agent-sdk',
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'triage',
        capabilityId: null,
        capabilityKind: null,
        details: {
          compatibility: 'supported',
          declaredRange: '^0.3.234',
          dependencyKind: 'dependencies',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: '@anthropic-ai/claude-agent-sdk',
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'triage',
        capabilityId: null,
        capabilityKind: null,
        details: {
          call: 'query',
          patternId: 'direct-query-wrapper',
        },
        kind: 'runtime-pattern',
        references: [
          {
            path: '/src/runtime.ts',
            symbol: 'triageAgent',
          },
        ],
        runtimeName: 'triageAgent',
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'billing',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          role: 'tool-input',
          schemaKind: 'sdk-tool-input',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderInputSchema',
          },
          {
            path: '/src/tools.ts',
          },
        ],
        runtimeName: 'FindOrderInputSchema',
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'triage',
        capabilityId: null,
        capabilityKind: null,
        details: {
          role: 'agent-output',
          schemaKind: 'json-schema',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'TriageOutputSchema',
          },
          {
            path: '/src/runtime.ts',
          },
        ],
        runtimeName: 'TriageOutputSchema',
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'triage',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          role: 'tool-input',
          schemaKind: 'sdk-tool-input',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderInputSchema',
          },
          {
            path: '/src/tools.ts',
          },
        ],
        runtimeName: 'FindOrderInputSchema',
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'billing',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          availabilitySource: 'inherited-subagent-tools',
          registrationKind: 'sdk-mcp-tool',
          serverKey: 'support',
          underlyingToolName: 'find_order',
        },
        kind: 'tool-registration',
        references: [
          {
            path: '/src/find-order.ts',
            symbol: 'findOrder',
          },
          {
            path: '/src/runtime.ts',
          },
          {
            path: '/src/tools.ts',
            symbol: 'findOrderTool',
          },
        ],
        runtimeName: 'mcp__support__find_order',
        source: 'claude-agent-sdk',
      },
      {
        agentId: 'triage',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          availabilitySource: 'query',
          registrationKind: 'sdk-mcp-tool',
          serverKey: 'support',
          underlyingToolName: 'find_order',
        },
        kind: 'tool-registration',
        references: [
          {
            path: '/src/find-order.ts',
            symbol: 'findOrder',
          },
          {
            path: '/src/runtime.ts',
          },
          {
            path: '/src/tools.ts',
            symbol: 'findOrderTool',
          },
        ],
        runtimeName: 'mcp__support__find_order',
        source: 'claude-agent-sdk',
      },
    ],
    manifestDigest: 'sha256:b8fbde1a7799082e7ad95bd4b74b4530de771e2b26e4b968d17d1a2264966260',
  },
  'langgraph-inline': {
    valid: true,
    diagnostics: [],
    evidence: [
      {
        agentId: 'functional',
        capabilityId: null,
        capabilityKind: null,
        details: {
          apiKind: 'functional',
          targetId: 'typescript-functional-api-1-4',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/src/functional.ts',
            symbol: 'supportWorkflow',
          },
        ],
        runtimeName: 'support_workflow',
        source: 'langgraph',
      },
      {
        agentId: 'graph',
        capabilityId: null,
        capabilityKind: null,
        details: {
          apiKind: 'state-graph',
          builderForm: 'inline-fluent',
          targetId: 'typescript-state-graph-1-4',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/src/graph.ts',
            symbol: 'supportGraph',
          },
        ],
        runtimeName: 'support_graph',
        source: 'langgraph',
      },
      {
        agentId: 'functional',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
          moduleKind: 'esm',
        },
        kind: 'language',
        references: [
          {
            path: '/src/functional.ts',
            symbol: 'supportWorkflow',
          },
        ],
        runtimeName: null,
        source: 'langgraph',
      },
      {
        agentId: 'graph',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
          moduleKind: 'esm',
        },
        kind: 'language',
        references: [
          {
            path: '/src/graph.ts',
            symbol: 'supportGraph',
          },
        ],
        runtimeName: null,
        source: 'langgraph',
      },
      {
        agentId: 'functional',
        capabilityId: null,
        capabilityKind: null,
        details: {
          classification: 'supported',
          declaredRange: '~1.2.9',
          dependencyKind: 'dependencies',
          packageName: '@langchain/core',
          packageRole: 'companion',
          targetClassification: 'supported',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: '@langchain/core',
        source: 'langgraph',
      },
      {
        agentId: 'functional',
        capabilityId: null,
        capabilityKind: null,
        details: {
          classification: 'supported',
          declaredRange: '~1.4.12',
          dependencyKind: 'dependencies',
          packageName: '@langchain/langgraph',
          packageRole: 'primary',
          targetClassification: 'supported',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: '@langchain/langgraph',
        source: 'langgraph',
      },
      {
        agentId: 'graph',
        capabilityId: null,
        capabilityKind: null,
        details: {
          classification: 'supported',
          declaredRange: '~1.2.9',
          dependencyKind: 'dependencies',
          packageName: '@langchain/core',
          packageRole: 'companion',
          targetClassification: 'supported',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: '@langchain/core',
        source: 'langgraph',
      },
      {
        agentId: 'graph',
        capabilityId: null,
        capabilityKind: null,
        details: {
          classification: 'supported',
          declaredRange: '~1.4.12',
          dependencyKind: 'dependencies',
          packageName: '@langchain/langgraph',
          packageRole: 'primary',
          targetClassification: 'supported',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: '@langchain/langgraph',
        source: 'langgraph',
      },
      {
        agentId: 'functional',
        capabilityId: null,
        capabilityKind: null,
        details: {
          apiKind: 'functional',
          patternId: 'functional-final-state',
          targetId: 'typescript-functional-api-1-4',
        },
        kind: 'runtime-pattern',
        references: [
          {
            path: '/src/functional.ts',
          },
        ],
        runtimeName: null,
        source: 'langgraph',
      },
      {
        agentId: 'functional',
        capabilityId: null,
        capabilityKind: null,
        details: {
          apiKind: 'functional',
          patternId: 'functional-interrupt',
          targetId: 'typescript-functional-api-1-4',
        },
        kind: 'runtime-pattern',
        references: [
          {
            path: '/src/functional.ts',
          },
        ],
        runtimeName: null,
        source: 'langgraph',
      },
      {
        agentId: 'functional',
        capabilityId: null,
        capabilityKind: null,
        details: {
          apiKind: 'functional',
          patternId: 'functional-previous-state',
          targetId: 'typescript-functional-api-1-4',
        },
        kind: 'runtime-pattern',
        references: [
          {
            path: '/src/functional.ts',
          },
        ],
        runtimeName: null,
        source: 'langgraph',
      },
      {
        agentId: 'functional',
        capabilityId: null,
        capabilityKind: null,
        details: {
          apiKind: 'functional',
          patternId: 'functional-task',
          targetId: 'typescript-functional-api-1-4',
          taskForm: 'module-local',
          taskName: 'prepare_task',
        },
        kind: 'runtime-pattern',
        references: [
          {
            path: '/src/functional.ts',
          },
        ],
        runtimeName: 'prepare_task',
        source: 'langgraph',
      },
      {
        agentId: 'graph',
        capabilityId: null,
        capabilityKind: null,
        details: {
          graphOperation: 'addConditionalEdges',
          patternId: 'state-graph-conditional-edge',
          sourceName: 'respond',
          targetId: 'typescript-state-graph-1-4',
        },
        kind: 'runtime-pattern',
        references: [
          {
            path: '/src/graph.ts',
          },
          {
            path: '/src/graph.ts',
            symbol: 'route',
          },
        ],
        runtimeName: null,
        source: 'langgraph',
      },
      {
        agentId: 'graph',
        capabilityId: null,
        capabilityKind: null,
        details: {
          edgeKind: 'direct',
          graphOperation: 'addEdge',
          patternId: 'state-graph-edge',
          sourceName: '__start__',
          targetId: 'typescript-state-graph-1-4',
          targetName: 'prepare',
        },
        kind: 'runtime-pattern',
        references: [
          {
            path: '/src/graph.ts',
          },
        ],
        runtimeName: null,
        source: 'langgraph',
      },
      {
        agentId: 'graph',
        capabilityId: null,
        capabilityKind: null,
        details: {
          edgeKind: 'direct',
          graphOperation: 'addEdge',
          patternId: 'state-graph-edge',
          sourceName: 'prepare',
          targetId: 'typescript-state-graph-1-4',
          targetName: 'respond',
        },
        kind: 'runtime-pattern',
        references: [
          {
            path: '/src/graph.ts',
          },
        ],
        runtimeName: null,
        source: 'langgraph',
      },
      {
        agentId: 'graph',
        capabilityId: null,
        capabilityKind: null,
        details: {
          graphOperation: 'addNode',
          patternId: 'state-graph-node',
          targetId: 'typescript-state-graph-1-4',
        },
        kind: 'runtime-pattern',
        references: [
          {
            path: '/src/graph.ts',
          },
          {
            path: '/src/graph.ts',
            symbol: 'prepare',
          },
        ],
        runtimeName: 'prepare',
        source: 'langgraph',
      },
      {
        agentId: 'graph',
        capabilityId: null,
        capabilityKind: null,
        details: {
          graphOperation: 'addNode',
          patternId: 'state-graph-node',
          targetId: 'typescript-state-graph-1-4',
        },
        kind: 'runtime-pattern',
        references: [
          {
            path: '/src/graph.ts',
          },
          {
            path: '/src/graph.ts',
            symbol: 'respond',
          },
        ],
        runtimeName: 'respond',
        source: 'langgraph',
      },
      {
        agentId: 'graph',
        capabilityId: null,
        capabilityKind: null,
        details: {
          schemaRole: 'agent-input',
          schemaSource: 'explicit-input',
          targetId: 'typescript-state-graph-1-4',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'GraphInputSchema',
          },
          {
            path: '/src/graph.ts',
            symbol: 'supportGraph',
          },
        ],
        runtimeName: null,
        source: 'langgraph',
      },
      {
        agentId: 'graph',
        capabilityId: null,
        capabilityKind: null,
        details: {
          schemaRole: 'agent-output',
          schemaSource: 'explicit-output',
          targetId: 'typescript-state-graph-1-4',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'GraphOutputSchema',
          },
          {
            path: '/src/graph.ts',
            symbol: 'supportGraph',
          },
        ],
        runtimeName: null,
        source: 'langgraph',
      },
    ],
    manifestDigest: 'sha256:aec312d47d55e765369cd174ad53a2f8c48e484edc85d84d5fc5c10c6c02f568',
  },
  'vercel-generate': {
    valid: true,
    diagnostics: [],
    evidence: [
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          targetId: 'typescript-tool-loop-agent-7',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'supportAgent',
          },
        ],
        runtimeName: 'support-runtime',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          targetId: 'typescript-generate-stream-text-7',
        },
        kind: 'instruction-loader',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/instructions.ts',
            symbol: 'loadSummaryInstruction',
          },
        ],
        runtimeName: 'loadSummaryInstruction',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          targetId: 'typescript-tool-loop-agent-7',
        },
        kind: 'instruction-loader',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/instructions.ts',
            symbol: 'loadSupportInstruction',
          },
        ],
        runtimeName: 'loadSupportInstruction',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'summaryAgent',
          },
        ],
        runtimeName: null,
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'supportAgent',
          },
        ],
        runtimeName: null,
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          compatibility: 'supported',
          declaredRange: '^7.0.66',
          dependencyKind: 'dependencies',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: 'ai',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          compatibility: 'supported',
          declaredRange: '^7.0.66',
          dependencyKind: 'dependencies',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: 'ai',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          calls: 'generateText',
          targetId: 'typescript-generate-stream-text-7',
        },
        kind: 'runtime-pattern',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'summaryAgent',
          },
        ],
        runtimeName: 'summaryAgent',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          schemaRole: 'agent-output',
          targetId: 'typescript-generate-stream-text-7',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'SummaryOutputSchema',
          },
        ],
        runtimeName: 'SummaryOutputSchema',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          configurationProperty: 'inputSchema',
          schemaRole: 'tool-input',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderInputSchema',
          },
          {
            path: '/src/tools.ts',
          },
        ],
        runtimeName: 'FindOrderInputSchema',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          configurationProperty: 'outputSchema',
          schemaRole: 'tool-output',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderOutputSchema',
          },
          {
            path: '/src/tools.ts',
          },
        ],
        runtimeName: 'FindOrderOutputSchema',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          configurationProperty: 'callOptionsSchema',
          schemaRole: 'agent-input',
          targetId: 'typescript-tool-loop-agent-7',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'SupportInputSchema',
          },
        ],
        runtimeName: 'SupportInputSchema',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          schemaRole: 'agent-output',
          targetId: 'typescript-tool-loop-agent-7',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'SupportOutputSchema',
          },
        ],
        runtimeName: 'SupportOutputSchema',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'support',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          configurationProperty: 'inputSchema',
          schemaRole: 'tool-input',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderInputSchema',
          },
          {
            path: '/src/tools.ts',
          },
        ],
        runtimeName: 'FindOrderInputSchema',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'support',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          configurationProperty: 'outputSchema',
          schemaRole: 'tool-output',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderOutputSchema',
          },
          {
            path: '/src/tools.ts',
          },
        ],
        runtimeName: 'FindOrderOutputSchema',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          targetId: 'typescript-generate-stream-text-7',
          toolType: 'function',
        },
        kind: 'tool-registration',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderInputSchema',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderOutputSchema',
          },
          {
            path: '/src/implementations.ts',
            symbol: 'findOrder',
          },
          {
            path: '/src/tools.ts',
            symbol: 'findOrderTool',
          },
        ],
        runtimeName: 'find_order',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'support',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          targetId: 'typescript-tool-loop-agent-7',
          toolType: 'function',
        },
        kind: 'tool-registration',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderInputSchema',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderOutputSchema',
          },
          {
            path: '/src/implementations.ts',
            symbol: 'findOrder',
          },
          {
            path: '/src/tools.ts',
            symbol: 'findOrderTool',
          },
        ],
        runtimeName: 'find_order',
        source: 'vercel-ai-sdk',
      },
    ],
    manifestDigest: 'sha256:c63073ab346cd09e5ce3771ac2b4e7ffd9f9d313f2551030bada323225091939',
  },
  'vercel-instruction-precedence': {
    valid: true,
    diagnostics: [],
    evidence: [
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          targetId: 'typescript-tool-loop-agent-7',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'supportAgent',
          },
        ],
        runtimeName: 'support-runtime',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          targetId: 'typescript-generate-stream-text-7',
        },
        kind: 'instruction-loader',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/instructions.ts',
            symbol: 'loadSummaryInstruction',
          },
        ],
        runtimeName: 'loadSummaryInstruction',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          targetId: 'typescript-tool-loop-agent-7',
        },
        kind: 'instruction-loader',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/instructions.ts',
            symbol: 'loadSupportInstruction',
          },
        ],
        runtimeName: 'loadSupportInstruction',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'summaryAgent',
          },
        ],
        runtimeName: null,
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'supportAgent',
          },
        ],
        runtimeName: null,
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          compatibility: 'supported',
          declaredRange: '^7.0.66',
          dependencyKind: 'dependencies',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: 'ai',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          compatibility: 'supported',
          declaredRange: '^7.0.66',
          dependencyKind: 'dependencies',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: 'ai',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          calls: 'streamText',
          targetId: 'typescript-generate-stream-text-7',
        },
        kind: 'runtime-pattern',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'summaryAgent',
          },
        ],
        runtimeName: 'summaryAgent',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          schemaRole: 'agent-output',
          targetId: 'typescript-generate-stream-text-7',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'SummaryOutputSchema',
          },
        ],
        runtimeName: 'SummaryOutputSchema',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          configurationProperty: 'inputSchema',
          schemaRole: 'tool-input',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderInputSchema',
          },
          {
            path: '/src/tools.ts',
          },
        ],
        runtimeName: 'FindOrderInputSchema',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          configurationProperty: 'outputSchema',
          schemaRole: 'tool-output',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderOutputSchema',
          },
          {
            path: '/src/tools.ts',
          },
        ],
        runtimeName: 'FindOrderOutputSchema',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          configurationProperty: 'callOptionsSchema',
          schemaRole: 'agent-input',
          targetId: 'typescript-tool-loop-agent-7',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'SupportInputSchema',
          },
        ],
        runtimeName: 'SupportInputSchema',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          schemaRole: 'agent-output',
          targetId: 'typescript-tool-loop-agent-7',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'SupportOutputSchema',
          },
        ],
        runtimeName: 'SupportOutputSchema',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'support',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          configurationProperty: 'inputSchema',
          schemaRole: 'tool-input',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderInputSchema',
          },
          {
            path: '/src/tools.ts',
          },
        ],
        runtimeName: 'FindOrderInputSchema',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'support',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          configurationProperty: 'outputSchema',
          schemaRole: 'tool-output',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderOutputSchema',
          },
          {
            path: '/src/tools.ts',
          },
        ],
        runtimeName: 'FindOrderOutputSchema',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          targetId: 'typescript-generate-stream-text-7',
          toolType: 'function',
        },
        kind: 'tool-registration',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderInputSchema',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderOutputSchema',
          },
          {
            path: '/src/implementations.ts',
            symbol: 'findOrder',
          },
          {
            path: '/src/tools.ts',
            symbol: 'findOrderTool',
          },
        ],
        runtimeName: 'find_order',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'support',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          targetId: 'typescript-tool-loop-agent-7',
          toolType: 'function',
        },
        kind: 'tool-registration',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderInputSchema',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderOutputSchema',
          },
          {
            path: '/src/implementations.ts',
            symbol: 'findOrder',
          },
          {
            path: '/src/tools.ts',
            symbol: 'findOrderTool',
          },
        ],
        runtimeName: 'find_order',
        source: 'vercel-ai-sdk',
      },
    ],
    manifestDigest: 'sha256:c63073ab346cd09e5ce3771ac2b4e7ffd9f9d313f2551030bada323225091939',
  },
  'vercel-system-fallback': {
    valid: true,
    diagnostics: [],
    evidence: [
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          targetId: 'typescript-tool-loop-agent-7',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'supportAgent',
          },
        ],
        runtimeName: 'support-runtime',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          targetId: 'typescript-generate-stream-text-7',
        },
        kind: 'instruction-loader',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/instructions.ts',
            symbol: 'loadSummaryInstruction',
          },
        ],
        runtimeName: 'loadSummaryInstruction',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          targetId: 'typescript-tool-loop-agent-7',
        },
        kind: 'instruction-loader',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/instructions.ts',
            symbol: 'loadSupportInstruction',
          },
        ],
        runtimeName: 'loadSupportInstruction',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'summaryAgent',
          },
        ],
        runtimeName: null,
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'supportAgent',
          },
        ],
        runtimeName: null,
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          compatibility: 'supported',
          declaredRange: '^7.0.66',
          dependencyKind: 'dependencies',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: 'ai',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          compatibility: 'supported',
          declaredRange: '^7.0.66',
          dependencyKind: 'dependencies',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: 'ai',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          calls: 'streamText',
          targetId: 'typescript-generate-stream-text-7',
        },
        kind: 'runtime-pattern',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'summaryAgent',
          },
        ],
        runtimeName: 'summaryAgent',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          schemaRole: 'agent-output',
          targetId: 'typescript-generate-stream-text-7',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'SummaryOutputSchema',
          },
        ],
        runtimeName: 'SummaryOutputSchema',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          configurationProperty: 'inputSchema',
          schemaRole: 'tool-input',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderInputSchema',
          },
          {
            path: '/src/tools.ts',
          },
        ],
        runtimeName: 'FindOrderInputSchema',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          configurationProperty: 'outputSchema',
          schemaRole: 'tool-output',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderOutputSchema',
          },
          {
            path: '/src/tools.ts',
          },
        ],
        runtimeName: 'FindOrderOutputSchema',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          configurationProperty: 'callOptionsSchema',
          schemaRole: 'agent-input',
          targetId: 'typescript-tool-loop-agent-7',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'SupportInputSchema',
          },
        ],
        runtimeName: 'SupportInputSchema',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          schemaRole: 'agent-output',
          targetId: 'typescript-tool-loop-agent-7',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'SupportOutputSchema',
          },
        ],
        runtimeName: 'SupportOutputSchema',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'support',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          configurationProperty: 'inputSchema',
          schemaRole: 'tool-input',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderInputSchema',
          },
          {
            path: '/src/tools.ts',
          },
        ],
        runtimeName: 'FindOrderInputSchema',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'support',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          configurationProperty: 'outputSchema',
          schemaRole: 'tool-output',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderOutputSchema',
          },
          {
            path: '/src/tools.ts',
          },
        ],
        runtimeName: 'FindOrderOutputSchema',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          targetId: 'typescript-generate-stream-text-7',
          toolType: 'function',
        },
        kind: 'tool-registration',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderInputSchema',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderOutputSchema',
          },
          {
            path: '/src/implementations.ts',
            symbol: 'findOrder',
          },
          {
            path: '/src/tools.ts',
            symbol: 'findOrderTool',
          },
        ],
        runtimeName: 'find_order',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'support',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          targetId: 'typescript-tool-loop-agent-7',
          toolType: 'function',
        },
        kind: 'tool-registration',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderInputSchema',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderOutputSchema',
          },
          {
            path: '/src/implementations.ts',
            symbol: 'findOrder',
          },
          {
            path: '/src/tools.ts',
            symbol: 'findOrderTool',
          },
        ],
        runtimeName: 'find_order',
        source: 'vercel-ai-sdk',
      },
    ],
    manifestDigest: 'sha256:c63073ab346cd09e5ce3771ac2b4e7ffd9f9d313f2551030bada323225091939',
  },
  'vercel-dynamic-preparation': {
    valid: true,
    diagnostics: [],
    evidence: [
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          targetId: 'typescript-tool-loop-agent-7',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'supportAgent',
          },
        ],
        runtimeName: 'support-runtime',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          targetId: 'typescript-generate-stream-text-7',
        },
        kind: 'instruction-loader',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/instructions.ts',
            symbol: 'loadSummaryInstruction',
          },
        ],
        runtimeName: 'loadSummaryInstruction',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'summaryAgent',
          },
        ],
        runtimeName: null,
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'supportAgent',
          },
        ],
        runtimeName: null,
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          compatibility: 'supported',
          declaredRange: '^7.0.66',
          dependencyKind: 'dependencies',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: 'ai',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          compatibility: 'supported',
          declaredRange: '^7.0.66',
          dependencyKind: 'dependencies',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: 'ai',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          calls: 'streamText',
          targetId: 'typescript-generate-stream-text-7',
        },
        kind: 'runtime-pattern',
        references: [
          {
            path: '/src/agents.ts',
            symbol: 'summaryAgent',
          },
        ],
        runtimeName: 'summaryAgent',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          schemaRole: 'agent-output',
          targetId: 'typescript-generate-stream-text-7',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'SummaryOutputSchema',
          },
        ],
        runtimeName: 'SummaryOutputSchema',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          configurationProperty: 'inputSchema',
          schemaRole: 'tool-input',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderInputSchema',
          },
          {
            path: '/src/tools.ts',
          },
        ],
        runtimeName: 'FindOrderInputSchema',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          configurationProperty: 'outputSchema',
          schemaRole: 'tool-output',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderOutputSchema',
          },
          {
            path: '/src/tools.ts',
          },
        ],
        runtimeName: 'FindOrderOutputSchema',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          configurationProperty: 'callOptionsSchema',
          schemaRole: 'agent-input',
          targetId: 'typescript-tool-loop-agent-7',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'SupportInputSchema',
          },
        ],
        runtimeName: 'SupportInputSchema',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'support',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          configurationProperty: 'inputSchema',
          schemaRole: 'tool-input',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderInputSchema',
          },
          {
            path: '/src/tools.ts',
          },
        ],
        runtimeName: 'FindOrderInputSchema',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'support',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          configurationProperty: 'outputSchema',
          schemaRole: 'tool-output',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderOutputSchema',
          },
          {
            path: '/src/tools.ts',
          },
        ],
        runtimeName: 'FindOrderOutputSchema',
        source: 'vercel-ai-sdk',
      },
      {
        agentId: 'summary',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          targetId: 'typescript-generate-stream-text-7',
          toolType: 'function',
        },
        kind: 'tool-registration',
        references: [
          {
            path: '/src/agents.ts',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderInputSchema',
          },
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderOutputSchema',
          },
          {
            path: '/src/implementations.ts',
            symbol: 'findOrder',
          },
          {
            path: '/src/tools.ts',
            symbol: 'findOrderTool',
          },
        ],
        runtimeName: 'find_order',
        source: 'vercel-ai-sdk',
      },
    ],
    manifestDigest: 'sha256:c63073ab346cd09e5ce3771ac2b4e7ffd9f9d313f2551030bada323225091939',
  },
  'eve-flat-root': {
    valid: true,
    diagnostics: [],
    evidence: [
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          agentKind: 'local-subagent',
          agentRoot: '/subagents/summary',
          layout: 'flat',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/subagents/summary/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: 'summary',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          agentKind: 'root',
          agentRoot: '/',
          layout: 'flat',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: 'support-app',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          registrationKind: 'local-subagent-package',
          routingDescriptionSource: 'handoff-description',
          routingDescriptionWired: true,
          targetAgentId: 'summary',
          targetRuntimeName: 'summary',
        },
        kind: 'handoff-registration',
        references: [
          {
            path: '/agent.ts',
            symbol: 'default',
          },
          {
            path: '/subagents/summary/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: 'summary',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {},
        kind: 'instruction-loader',
        references: [
          {
            path: '/loaders.ts',
            symbol: 'loadInstruction',
          },
        ],
        runtimeName: 'loadInstruction',
        source: 'eve',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/subagents/summary/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          declaredRange: '^0.39.1',
          dependencyKind: 'dependencies',
          packageClassification: 'supported',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          declaredRange: '^0.39.1',
          dependencyKind: 'dependencies',
          packageClassification: 'supported',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          schemaRole: 'agent-output',
        },
        kind: 'schema',
        references: [
          {
            path: '/contracts.ts',
            symbol: 'SupportOutputSchema',
          },
        ],
        runtimeName: 'SupportOutputSchema',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'search',
        capabilityKind: 'tool',
        details: {
          schemaRole: 'tool-input',
        },
        kind: 'schema',
        references: [
          {
            path: '/contracts.ts',
            symbol: 'SearchInputSchema',
          },
        ],
        runtimeName: 'SearchInputSchema',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'search',
        capabilityKind: 'tool',
        details: {
          schemaRole: 'tool-output',
        },
        kind: 'schema',
        references: [
          {
            path: '/contracts.ts',
            symbol: 'SearchOutputSchema',
          },
        ],
        runtimeName: 'SearchOutputSchema',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'analyze',
        capabilityKind: 'skill',
        details: {
          registrationKind: 'typescript',
        },
        kind: 'skill-registration',
        references: [
          {
            path: '/skills/analyze.ts',
          },
        ],
        runtimeName: 'analyze',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'search',
        capabilityKind: 'tool',
        details: {
          implementationKind: 'bound-function',
          pathDepth: 1,
          registrationKind: 'filesystem-tool',
        },
        kind: 'tool-registration',
        references: [
          {
            path: '/implementations.ts',
            symbol: 'searchKnowledge',
          },
          {
            path: '/tools/search.ts',
          },
        ],
        runtimeName: 'search',
        source: 'eve',
      },
    ],
    manifestDigest: 'sha256:f7ba073375405ba2caf5c2d5b5f10005133dce2957372a40def851e66545cfb4',
  },
  'eve-markdown-instruction': {
    valid: true,
    diagnostics: [],
    evidence: [
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          agentKind: 'local-subagent',
          agentRoot: '/agent/subagents/summary',
          layout: 'nested',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/agent/subagents/summary/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: 'summary',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          agentKind: 'root',
          agentRoot: '/agent',
          layout: 'nested',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/agent/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: 'support-app',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          registrationKind: 'local-subagent-package',
          routingDescriptionSource: 'handoff-description',
          routingDescriptionWired: true,
          targetAgentId: 'summary',
          targetRuntimeName: 'summary',
        },
        kind: 'handoff-registration',
        references: [
          {
            path: '/agent/agent.ts',
            symbol: 'default',
          },
          {
            path: '/agent/subagents/summary/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: 'summary',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {},
        kind: 'instruction-loader',
        references: [
          {
            path: '/agent/instructions.md',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/agent/subagents/summary/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/agent/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          declaredRange: '^0.39.1',
          dependencyKind: 'dependencies',
          packageClassification: 'supported',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          declaredRange: '^0.39.1',
          dependencyKind: 'dependencies',
          packageClassification: 'supported',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          schemaRole: 'agent-output',
        },
        kind: 'schema',
        references: [
          {
            path: '/agent/contracts.ts',
            symbol: 'SupportOutputSchema',
          },
        ],
        runtimeName: 'SupportOutputSchema',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'search',
        capabilityKind: 'tool',
        details: {
          schemaRole: 'tool-input',
        },
        kind: 'schema',
        references: [
          {
            path: '/agent/contracts.ts',
            symbol: 'SearchInputSchema',
          },
        ],
        runtimeName: 'SearchInputSchema',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'search',
        capabilityKind: 'tool',
        details: {
          schemaRole: 'tool-output',
        },
        kind: 'schema',
        references: [
          {
            path: '/agent/contracts.ts',
            symbol: 'SearchOutputSchema',
          },
        ],
        runtimeName: 'SearchOutputSchema',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'analyze',
        capabilityKind: 'skill',
        details: {
          registrationKind: 'typescript',
        },
        kind: 'skill-registration',
        references: [
          {
            path: '/agent/skills/analyze.ts',
          },
        ],
        runtimeName: 'analyze',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'search',
        capabilityKind: 'tool',
        details: {
          implementationKind: 'bound-function',
          pathDepth: 1,
          registrationKind: 'filesystem-tool',
        },
        kind: 'tool-registration',
        references: [
          {
            path: '/agent/implementations.ts',
            symbol: 'searchKnowledge',
          },
          {
            path: '/agent/tools/search.ts',
          },
        ],
        runtimeName: 'search',
        source: 'eve',
      },
    ],
    manifestDigest: 'sha256:70f00a3afe08fbb1c0df208a32ce79790ad079d6c4973765b95186bf007e5270',
  },
  'eve-case-varied-instruction': {
    valid: true,
    diagnostics: [],
    evidence: [
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          agentKind: 'local-subagent',
          agentRoot: '/agent/subagents/summary',
          layout: 'nested',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/agent/subagents/summary/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: 'summary',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          agentKind: 'root',
          agentRoot: '/agent',
          layout: 'nested',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/agent/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: 'support-app',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          registrationKind: 'local-subagent-package',
          routingDescriptionSource: 'handoff-description',
          routingDescriptionWired: true,
          targetAgentId: 'summary',
          targetRuntimeName: 'summary',
        },
        kind: 'handoff-registration',
        references: [
          {
            path: '/agent/agent.ts',
            symbol: 'default',
          },
          {
            path: '/agent/subagents/summary/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: 'summary',
        source: 'eve',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/agent/subagents/summary/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/agent/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          declaredRange: '^0.39.1',
          dependencyKind: 'dependencies',
          packageClassification: 'supported',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          declaredRange: '^0.39.1',
          dependencyKind: 'dependencies',
          packageClassification: 'supported',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          schemaRole: 'agent-output',
        },
        kind: 'schema',
        references: [
          {
            path: '/agent/contracts.ts',
            symbol: 'SupportOutputSchema',
          },
        ],
        runtimeName: 'SupportOutputSchema',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'search',
        capabilityKind: 'tool',
        details: {
          schemaRole: 'tool-input',
        },
        kind: 'schema',
        references: [
          {
            path: '/agent/contracts.ts',
            symbol: 'SearchInputSchema',
          },
        ],
        runtimeName: 'SearchInputSchema',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'search',
        capabilityKind: 'tool',
        details: {
          schemaRole: 'tool-output',
        },
        kind: 'schema',
        references: [
          {
            path: '/agent/contracts.ts',
            symbol: 'SearchOutputSchema',
          },
        ],
        runtimeName: 'SearchOutputSchema',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'analyze',
        capabilityKind: 'skill',
        details: {
          registrationKind: 'typescript',
        },
        kind: 'skill-registration',
        references: [
          {
            path: '/agent/skills/analyze.ts',
          },
        ],
        runtimeName: 'analyze',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'search',
        capabilityKind: 'tool',
        details: {
          implementationKind: 'bound-function',
          pathDepth: 1,
          registrationKind: 'filesystem-tool',
        },
        kind: 'tool-registration',
        references: [
          {
            path: '/agent/implementations.ts',
            symbol: 'searchKnowledge',
          },
          {
            path: '/agent/tools/search.ts',
          },
        ],
        runtimeName: 'search',
        source: 'eve',
      },
    ],
    manifestDigest: 'sha256:57c6acbd72e25c90e7cb04c126f069abff050b56cc5ba117ea0ce1fd6dc8e421',
  },
  'eve-system-instruction': {
    valid: true,
    diagnostics: [],
    evidence: [
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          agentKind: 'local-subagent',
          agentRoot: '/agent/subagents/summary',
          layout: 'nested',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/agent/subagents/summary/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: 'summary',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          agentKind: 'root',
          agentRoot: '/agent',
          layout: 'nested',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/agent/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: 'support-app',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          registrationKind: 'local-subagent-package',
          routingDescriptionSource: 'handoff-description',
          routingDescriptionWired: true,
          targetAgentId: 'summary',
          targetRuntimeName: 'summary',
        },
        kind: 'handoff-registration',
        references: [
          {
            path: '/agent/agent.ts',
            symbol: 'default',
          },
          {
            path: '/agent/subagents/summary/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: 'summary',
        source: 'eve',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/agent/subagents/summary/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/agent/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          declaredRange: '^0.39.1',
          dependencyKind: 'dependencies',
          packageClassification: 'supported',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          declaredRange: '^0.39.1',
          dependencyKind: 'dependencies',
          packageClassification: 'supported',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          schemaRole: 'agent-output',
        },
        kind: 'schema',
        references: [
          {
            path: '/agent/contracts.ts',
            symbol: 'SupportOutputSchema',
          },
        ],
        runtimeName: 'SupportOutputSchema',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'search',
        capabilityKind: 'tool',
        details: {
          schemaRole: 'tool-input',
        },
        kind: 'schema',
        references: [
          {
            path: '/agent/contracts.ts',
            symbol: 'SearchInputSchema',
          },
        ],
        runtimeName: 'SearchInputSchema',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'search',
        capabilityKind: 'tool',
        details: {
          schemaRole: 'tool-output',
        },
        kind: 'schema',
        references: [
          {
            path: '/agent/contracts.ts',
            symbol: 'SearchOutputSchema',
          },
        ],
        runtimeName: 'SearchOutputSchema',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'analyze',
        capabilityKind: 'skill',
        details: {
          registrationKind: 'typescript',
        },
        kind: 'skill-registration',
        references: [
          {
            path: '/agent/skills/analyze.ts',
          },
        ],
        runtimeName: 'analyze',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'search',
        capabilityKind: 'tool',
        details: {
          implementationKind: 'bound-function',
          pathDepth: 1,
          registrationKind: 'filesystem-tool',
        },
        kind: 'tool-registration',
        references: [
          {
            path: '/agent/implementations.ts',
            symbol: 'searchKnowledge',
          },
          {
            path: '/agent/tools/search.ts',
          },
        ],
        runtimeName: 'search',
        source: 'eve',
      },
    ],
    manifestDigest: 'sha256:57c6acbd72e25c90e7cb04c126f069abff050b56cc5ba117ea0ce1fd6dc8e421',
  },
  'eve-nested-tool': {
    valid: true,
    diagnostics: [],
    evidence: [
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          agentKind: 'local-subagent',
          agentRoot: '/agent/subagents/summary',
          layout: 'nested',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/agent/subagents/summary/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: 'summary',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          agentKind: 'root',
          agentRoot: '/agent',
          layout: 'nested',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/agent/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: 'support-app',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          registrationKind: 'local-subagent-package',
          routingDescriptionSource: 'handoff-description',
          routingDescriptionWired: true,
          targetAgentId: 'summary',
          targetRuntimeName: 'summary',
        },
        kind: 'handoff-registration',
        references: [
          {
            path: '/agent/agent.ts',
            symbol: 'default',
          },
          {
            path: '/agent/subagents/summary/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: 'summary',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {},
        kind: 'instruction-loader',
        references: [
          {
            path: '/agent/loaders.ts',
            symbol: 'loadInstruction',
          },
        ],
        runtimeName: 'loadInstruction',
        source: 'eve',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/agent/subagents/summary/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/agent/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          declaredRange: '^0.39.1',
          dependencyKind: 'dependencies',
          packageClassification: 'supported',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          declaredRange: '^0.39.1',
          dependencyKind: 'dependencies',
          packageClassification: 'supported',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          schemaRole: 'agent-output',
        },
        kind: 'schema',
        references: [
          {
            path: '/agent/contracts.ts',
            symbol: 'SupportOutputSchema',
          },
        ],
        runtimeName: 'SupportOutputSchema',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'search',
        capabilityKind: 'tool',
        details: {
          schemaRole: 'tool-input',
        },
        kind: 'schema',
        references: [
          {
            path: '/agent/contracts.ts',
            symbol: 'SearchInputSchema',
          },
        ],
        runtimeName: 'SearchInputSchema',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'search',
        capabilityKind: 'tool',
        details: {
          schemaRole: 'tool-output',
        },
        kind: 'schema',
        references: [
          {
            path: '/agent/contracts.ts',
            symbol: 'SearchOutputSchema',
          },
        ],
        runtimeName: 'SearchOutputSchema',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'analyze',
        capabilityKind: 'skill',
        details: {
          registrationKind: 'typescript',
        },
        kind: 'skill-registration',
        references: [
          {
            path: '/agent/skills/analyze.ts',
          },
        ],
        runtimeName: 'analyze',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'search',
        capabilityKind: 'tool',
        details: {
          implementationKind: 'bound-function',
          pathDepth: 2,
          registrationKind: 'filesystem-tool',
        },
        kind: 'tool-registration',
        references: [
          {
            path: '/agent/implementations.ts',
            symbol: 'searchKnowledge',
          },
          {
            path: '/agent/tools/orders/search.ts',
          },
        ],
        runtimeName: 'orders-search',
        source: 'eve',
      },
    ],
    manifestDigest: 'sha256:1ac513a494a51751080cba39eb6c1c631754cf31d393e23ef301f958ae96009d',
  },
  'eve-tool-name-collision': {
    valid: false,
    diagnostics: [
      {
        code: 'EVE_TOOL_RUNTIME_NAME_COLLISION',
        details: {
          conflictingPaths: '/agent/tools/orders-search.ts,/agent/tools/orders/search.ts',
        },
        entity: {
          agentId: 'support',
          adapterId: 'eve',
        },
        message: 'Multiple Eve tool sources resolve to the same runtime tool name.',
        path: '/agent/tools/orders-search.ts',
        pointer: null,
        range: null,
        source: 'eve',
      },
    ],
    evidence: [
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          agentKind: 'local-subagent',
          agentRoot: '/agent/subagents/summary',
          layout: 'nested',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/agent/subagents/summary/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: 'summary',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          agentKind: 'root',
          agentRoot: '/agent',
          layout: 'nested',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/agent/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: 'support-app',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          registrationKind: 'local-subagent-package',
          routingDescriptionSource: 'handoff-description',
          routingDescriptionWired: true,
          targetAgentId: 'summary',
          targetRuntimeName: 'summary',
        },
        kind: 'handoff-registration',
        references: [
          {
            path: '/agent/agent.ts',
            symbol: 'default',
          },
          {
            path: '/agent/subagents/summary/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: 'summary',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {},
        kind: 'instruction-loader',
        references: [
          {
            path: '/agent/loaders.ts',
            symbol: 'loadInstruction',
          },
        ],
        runtimeName: 'loadInstruction',
        source: 'eve',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/agent/subagents/summary/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/agent/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          declaredRange: '^0.39.1',
          dependencyKind: 'dependencies',
          packageClassification: 'supported',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          declaredRange: '^0.39.1',
          dependencyKind: 'dependencies',
          packageClassification: 'supported',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          schemaRole: 'agent-output',
        },
        kind: 'schema',
        references: [
          {
            path: '/agent/contracts.ts',
            symbol: 'SupportOutputSchema',
          },
        ],
        runtimeName: 'SupportOutputSchema',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'search',
        capabilityKind: 'tool',
        details: {
          schemaRole: 'tool-input',
        },
        kind: 'schema',
        references: [
          {
            path: '/agent/contracts.ts',
            symbol: 'SearchInputSchema',
          },
        ],
        runtimeName: 'SearchInputSchema',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'search',
        capabilityKind: 'tool',
        details: {
          schemaRole: 'tool-output',
        },
        kind: 'schema',
        references: [
          {
            path: '/agent/contracts.ts',
            symbol: 'SearchOutputSchema',
          },
        ],
        runtimeName: 'SearchOutputSchema',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'analyze',
        capabilityKind: 'skill',
        details: {
          registrationKind: 'typescript',
        },
        kind: 'skill-registration',
        references: [
          {
            path: '/agent/skills/analyze.ts',
          },
        ],
        runtimeName: 'analyze',
        source: 'eve',
      },
    ],
    manifestDigest: 'sha256:e3a671fbea5a22e57ba7d312a98b035faca483b641157b81a4131a0c1f8de2ef',
  },
  'eve-flat-skill': {
    valid: true,
    diagnostics: [],
    evidence: [
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          agentKind: 'local-subagent',
          agentRoot: '/agent/subagents/summary',
          layout: 'nested',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/agent/subagents/summary/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: 'summary',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          agentKind: 'root',
          agentRoot: '/agent',
          layout: 'nested',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/agent/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: 'support-app',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          registrationKind: 'local-subagent-package',
          routingDescriptionSource: 'handoff-description',
          routingDescriptionWired: true,
          targetAgentId: 'summary',
          targetRuntimeName: 'summary',
        },
        kind: 'handoff-registration',
        references: [
          {
            path: '/agent/agent.ts',
            symbol: 'default',
          },
          {
            path: '/agent/subagents/summary/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: 'summary',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {},
        kind: 'instruction-loader',
        references: [
          {
            path: '/agent/loaders.ts',
            symbol: 'loadInstruction',
          },
        ],
        runtimeName: 'loadInstruction',
        source: 'eve',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/agent/subagents/summary/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/agent/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          declaredRange: '^0.39.1',
          dependencyKind: 'dependencies',
          packageClassification: 'supported',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          declaredRange: '^0.39.1',
          dependencyKind: 'dependencies',
          packageClassification: 'supported',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          schemaRole: 'agent-output',
        },
        kind: 'schema',
        references: [
          {
            path: '/agent/contracts.ts',
            symbol: 'SupportOutputSchema',
          },
        ],
        runtimeName: 'SupportOutputSchema',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'search',
        capabilityKind: 'tool',
        details: {
          schemaRole: 'tool-input',
        },
        kind: 'schema',
        references: [
          {
            path: '/agent/contracts.ts',
            symbol: 'SearchInputSchema',
          },
        ],
        runtimeName: 'SearchInputSchema',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'search',
        capabilityKind: 'tool',
        details: {
          schemaRole: 'tool-output',
        },
        kind: 'schema',
        references: [
          {
            path: '/agent/contracts.ts',
            symbol: 'SearchOutputSchema',
          },
        ],
        runtimeName: 'SearchOutputSchema',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'search',
        capabilityKind: 'tool',
        details: {
          implementationKind: 'bound-function',
          pathDepth: 1,
          registrationKind: 'filesystem-tool',
        },
        kind: 'tool-registration',
        references: [
          {
            path: '/agent/implementations.ts',
            symbol: 'searchKnowledge',
          },
          {
            path: '/agent/tools/search.ts',
          },
        ],
        runtimeName: 'search',
        source: 'eve',
      },
    ],
    manifestDigest: 'sha256:b0d1d0f01830be98a4538a6802d0acc9fafa30a4090368508d46a44be77e4444',
  },
  'eve-packaged-skill': {
    valid: true,
    diagnostics: [],
    evidence: [
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          agentKind: 'local-subagent',
          agentRoot: '/agent/subagents/summary',
          layout: 'nested',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/agent/subagents/summary/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: 'summary',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          agentKind: 'root',
          agentRoot: '/agent',
          layout: 'nested',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/agent/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: 'support-app',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          registrationKind: 'local-subagent-package',
          routingDescriptionSource: 'handoff-description',
          routingDescriptionWired: true,
          targetAgentId: 'summary',
          targetRuntimeName: 'summary',
        },
        kind: 'handoff-registration',
        references: [
          {
            path: '/agent/agent.ts',
            symbol: 'default',
          },
          {
            path: '/agent/subagents/summary/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: 'summary',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {},
        kind: 'instruction-loader',
        references: [
          {
            path: '/agent/loaders.ts',
            symbol: 'loadInstruction',
          },
        ],
        runtimeName: 'loadInstruction',
        source: 'eve',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/agent/subagents/summary/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/agent/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'summary',
        capabilityId: null,
        capabilityKind: null,
        details: {
          declaredRange: '^0.39.1',
          dependencyKind: 'dependencies',
          packageClassification: 'supported',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          declaredRange: '^0.39.1',
          dependencyKind: 'dependencies',
          packageClassification: 'supported',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          schemaRole: 'agent-output',
        },
        kind: 'schema',
        references: [
          {
            path: '/agent/contracts.ts',
            symbol: 'SupportOutputSchema',
          },
        ],
        runtimeName: 'SupportOutputSchema',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'search',
        capabilityKind: 'tool',
        details: {
          schemaRole: 'tool-input',
        },
        kind: 'schema',
        references: [
          {
            path: '/agent/contracts.ts',
            symbol: 'SearchInputSchema',
          },
        ],
        runtimeName: 'SearchInputSchema',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'search',
        capabilityKind: 'tool',
        details: {
          schemaRole: 'tool-output',
        },
        kind: 'schema',
        references: [
          {
            path: '/agent/contracts.ts',
            symbol: 'SearchOutputSchema',
          },
        ],
        runtimeName: 'SearchOutputSchema',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'search',
        capabilityKind: 'tool',
        details: {
          implementationKind: 'bound-function',
          pathDepth: 1,
          registrationKind: 'filesystem-tool',
        },
        kind: 'tool-registration',
        references: [
          {
            path: '/agent/implementations.ts',
            symbol: 'searchKnowledge',
          },
          {
            path: '/agent/tools/search.ts',
          },
        ],
        runtimeName: 'search',
        source: 'eve',
      },
    ],
    manifestDigest: 'sha256:a9c32b94a363e7313e1b5d866539fd60eff4064afb121e4114da35a4c19c2643',
  },
  'eve-single-file-subagent': {
    valid: true,
    diagnostics: [],
    evidence: [
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          agentKind: 'root',
          agentRoot: '/agent',
          layout: 'nested',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/agent/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: 'support-app',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {},
        kind: 'instruction-loader',
        references: [
          {
            path: '/agent/loaders.ts',
            symbol: 'loadInstruction',
          },
        ],
        runtimeName: 'loadInstruction',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/agent/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          declaredRange: '^0.39.1',
          dependencyKind: 'dependencies',
          packageClassification: 'supported',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          schemaRole: 'agent-output',
        },
        kind: 'schema',
        references: [
          {
            path: '/agent/contracts.ts',
            symbol: 'SupportOutputSchema',
          },
        ],
        runtimeName: 'SupportOutputSchema',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'search',
        capabilityKind: 'tool',
        details: {
          schemaRole: 'tool-input',
        },
        kind: 'schema',
        references: [
          {
            path: '/agent/contracts.ts',
            symbol: 'SearchInputSchema',
          },
        ],
        runtimeName: 'SearchInputSchema',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'search',
        capabilityKind: 'tool',
        details: {
          schemaRole: 'tool-output',
        },
        kind: 'schema',
        references: [
          {
            path: '/agent/contracts.ts',
            symbol: 'SearchOutputSchema',
          },
        ],
        runtimeName: 'SearchOutputSchema',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'analyze',
        capabilityKind: 'skill',
        details: {
          registrationKind: 'typescript',
        },
        kind: 'skill-registration',
        references: [
          {
            path: '/agent/skills/analyze.ts',
          },
        ],
        runtimeName: 'analyze',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'search',
        capabilityKind: 'tool',
        details: {
          implementationKind: 'bound-function',
          pathDepth: 1,
          registrationKind: 'filesystem-tool',
        },
        kind: 'tool-registration',
        references: [
          {
            path: '/agent/implementations.ts',
            symbol: 'searchKnowledge',
          },
          {
            path: '/agent/tools/search.ts',
          },
        ],
        runtimeName: 'search',
        source: 'eve',
      },
    ],
    manifestDigest: 'sha256:e7dfcadc5a465282c58453653012ae795e1d00c0185faa31237075a6c5fba35b',
  },
  'eve-framework-namespace': {
    valid: false,
    diagnostics: [
      {
        code: 'EVE_TOOL_SUBAGENT_NAME_COLLISION',
        details: {
          collisionKind: 'runtime-tool',
        },
        entity: {
          agentId: 'glob',
          adapterId: 'eve',
        },
        message: 'The Eve tool and local subagent use the same runtime tool name.',
        path: '/agent/subagents/glob/agent.ts',
        pointer: null,
        range: null,
        source: 'eve',
      },
    ],
    evidence: [
      {
        agentId: 'glob',
        capabilityId: null,
        capabilityKind: null,
        details: {
          agentKind: 'local-subagent',
          agentRoot: '/agent/subagents/glob',
          layout: 'nested',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/agent/subagents/glob/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: 'glob',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          agentKind: 'root',
          agentRoot: '/agent',
          layout: 'nested',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'agent-definition',
        references: [
          {
            path: '/agent/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: 'support-app',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {},
        kind: 'instruction-loader',
        references: [
          {
            path: '/agent/loaders.ts',
            symbol: 'loadInstruction',
          },
        ],
        runtimeName: 'loadInstruction',
        source: 'eve',
      },
      {
        agentId: 'glob',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/agent/subagents/glob/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/agent/agent.ts',
            symbol: 'default',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'glob',
        capabilityId: null,
        capabilityKind: null,
        details: {
          declaredRange: '^0.39.1',
          dependencyKind: 'dependencies',
          packageClassification: 'supported',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          declaredRange: '^0.39.1',
          dependencyKind: 'dependencies',
          packageClassification: 'supported',
          targetId: 'typescript-filesystem-agent-0-39',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: null,
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          schemaRole: 'agent-output',
        },
        kind: 'schema',
        references: [
          {
            path: '/agent/contracts.ts',
            symbol: 'SupportOutputSchema',
          },
        ],
        runtimeName: 'SupportOutputSchema',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'search',
        capabilityKind: 'tool',
        details: {
          schemaRole: 'tool-input',
        },
        kind: 'schema',
        references: [
          {
            path: '/agent/contracts.ts',
            symbol: 'SearchInputSchema',
          },
        ],
        runtimeName: 'SearchInputSchema',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'search',
        capabilityKind: 'tool',
        details: {
          schemaRole: 'tool-output',
        },
        kind: 'schema',
        references: [
          {
            path: '/agent/contracts.ts',
            symbol: 'SearchOutputSchema',
          },
        ],
        runtimeName: 'SearchOutputSchema',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'analyze',
        capabilityKind: 'skill',
        details: {
          registrationKind: 'typescript',
        },
        kind: 'skill-registration',
        references: [
          {
            path: '/agent/skills/analyze.ts',
          },
        ],
        runtimeName: 'analyze',
        source: 'eve',
      },
      {
        agentId: 'support',
        capabilityId: 'search',
        capabilityKind: 'tool',
        details: {
          implementationKind: 'bound-function',
          pathDepth: 1,
          registrationKind: 'filesystem-tool',
        },
        kind: 'tool-registration',
        references: [
          {
            path: '/agent/implementations.ts',
            symbol: 'searchKnowledge',
          },
          {
            path: '/agent/tools/search.ts',
          },
        ],
        runtimeName: 'search',
        source: 'eve',
      },
    ],
    manifestDigest: 'sha256:2ae04b86367f7f0871cee1d672e358e3dd789ff297a249049dca0b57e0b9b336',
  },
  'openai-loader-disconnected': {
    valid: false,
    diagnostics: [
      {
        code: 'OPENAI_INSTRUCTION_LOADER_NOT_WIRED',
        details: {},
        entity: {
          agentId: 'support',
          adapterId: 'openai',
        },
        message: 'The declared instruction loader is not wired to the detected Responses API call.',
        path: '/src/agent.ts',
        pointer: null,
        range: {
          end: {
            column: 57,
            line: 12,
            offset: 410,
          },
          start: {
            column: 19,
            line: 12,
            offset: 372,
          },
        },
        source: 'openai',
      },
    ],
    evidence: [
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          language: 'typescript',
        },
        kind: 'language',
        references: [
          {
            path: '/src/agent.ts',
            symbol: 'supportAgent',
          },
        ],
        runtimeName: null,
        source: 'openai',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          compatibility: 'supported',
          declaredRange: '^7.4.0',
          dependencyKind: 'dependencies',
        },
        kind: 'runtime-package',
        references: [
          {
            path: '/package.json',
          },
        ],
        runtimeName: 'openai',
        source: 'openai',
      },
      {
        agentId: 'support',
        capabilityId: null,
        capabilityKind: null,
        details: {
          api: 'responses',
        },
        kind: 'runtime-pattern',
        references: [
          {
            path: '/src/agent.ts',
            symbol: 'supportAgent',
          },
        ],
        runtimeName: 'responses.create',
        source: 'openai',
      },
      {
        agentId: 'support',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          requestProperty: 'parameters',
          schemaRole: 'input',
        },
        kind: 'schema',
        references: [
          {
            path: '/src/contracts.ts',
            symbol: 'FindOrderInput',
          },
          {
            path: '/src/find-order.ts',
          },
        ],
        runtimeName: 'FindOrderInput',
        source: 'openai',
      },
      {
        agentId: 'support',
        capabilityId: 'find-order',
        capabilityKind: 'tool',
        details: {
          toolType: 'function',
        },
        kind: 'tool-registration',
        references: [
          {
            path: '/src/agent.ts',
          },
          {
            path: '/src/find-order.ts',
            symbol: 'findOrderTool',
          },
        ],
        runtimeName: 'find_order',
        source: 'openai',
      },
    ],
    manifestDigest: 'sha256:a2f1308a6155dedf12282c0f09b308472e74b620490c721eb0135f55c694b32a',
  },
};

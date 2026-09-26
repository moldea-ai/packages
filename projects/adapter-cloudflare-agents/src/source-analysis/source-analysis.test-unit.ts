// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { parseRepositoryPath } from '@moldea.ai/repository';

import type { ICloudflareAgentsSourceAnalysis } from '../contracts/index.js';
import {
  analyzeCloudflareAgentsSource,
  getCloudflareAgentsAiChatRequests,
  getCloudflareAgentsClassDefinition,
  getCloudflareAgentsThinkChannelTools,
  getCloudflareAgentsThinkContextSources,
  getCloudflareAgentsThinkSessionInstructions,
  getCloudflareAgentsThinkSystemPrompt,
  getCloudflareAgentsThinkTools,
} from './index.js';

const analyze = (source: string): ICloudflareAgentsSourceAnalysis => {
  const result = analyzeCloudflareAgentsSource(
    parseRepositoryPath('/src/agent.ts'),
    new TextEncoder().encode(source),
  );

  if (result.kind !== 'valid') {
    throw new TypeError('The source fixture must be valid.');
  }

  return result.analysis;
};

describe('Cloudflare Agents source analysis', () => {
  test('recognizes an aliased Think class and its closed instruction and tools methods', () => {
    const analysis = analyze(
      [
        "import { Think as ThinkBase } from '@cloudflare/think';",
        'export class SupportAgent extends ThinkBase {',
        '  getSystemPrompt() { return loadInstruction(); }',
        '  getTools() { return { find_order: findOrderTool }; }',
        '}',
      ].join('\n'),
    );
    const result = getCloudflareAgentsClassDefinition(analysis, 'SupportAgent');

    expect(result.kind).toBe('present-supported');

    if (result.kind === 'present-supported') {
      expect(getCloudflareAgentsThinkSystemPrompt(result.definition).kind).toBe('present');
      expect(getCloudflareAgentsThinkTools(result.definition).kind).toBe('present');
    }
  });

  test('keeps unsupported instruction override signatures unresolved', () => {
    const analysis = analyze(
      [
        "import { Think } from '@cloudflare/think';",
        'export class Agent extends Think {',
        '  getSystemPrompt(unexpected) { return load(); }',
        '  configureContext(unexpected) { return []; }',
        '  configureSession() { return this.session; }',
        '}',
      ].join('\n'),
    );
    const result = getCloudflareAgentsClassDefinition(analysis, 'Agent');

    if (result.kind !== 'present-supported') {
      throw new TypeError('The Think fixture must be supported.');
    }

    expect(getCloudflareAgentsThinkSystemPrompt(result.definition).kind).toBe('unresolved');
    expect(getCloudflareAgentsThinkContextSources(result.definition).kind).toBe('unresolved');
    expect(getCloudflareAgentsThinkSessionInstructions(result.definition).kind).toBe('unresolved');
  });

  test('recognizes the closed Think session-builder chain', () => {
    const analysis = analyze(
      [
        "import { Think } from '@cloudflare/think';",
        'export class Agent extends Think {',
        '  configureSession(session) {',
        "    return session.forSession('support').withContext('soul', { provider: { get: () => load() } }).compactAfter(8);",
        '  }',
        '}',
      ].join('\n'),
    );
    const result = getCloudflareAgentsClassDefinition(analysis, 'Agent');

    if (result.kind !== 'present-supported') {
      throw new TypeError('The Think fixture must be supported.');
    }

    expect(getCloudflareAgentsThinkSessionInstructions(result.definition)).toMatchObject({
      contexts: [{ label: 'soul', relationship: { kind: 'present' } }],
      kind: 'closed',
    });
  });

  test.each([
    ['inert custom prompt store', '{ get: () => load(), set: async (prompt) => {} }', 'present'],
    ['provider without a setter', '{ get: () => load() }', 'unresolved'],
    [
      'provider with a mutating setter',
      '{ get: () => load(), set: async (prompt) => { state.prompt = prompt; } }',
      'unresolved',
    ],
    [
      'provider with init',
      '{ get: () => load(), set: async (prompt) => {}, init: () => {} }',
      'unresolved',
    ],
  ])('classifies %s conservatively', (_description, provider, expectedKind) => {
    const analysis = analyze(
      [
        "import { Think } from '@cloudflare/think';",
        'export class Agent extends Think {',
        `  configureSession(session) { return session.withCachedPrompt(${provider}); }`,
        '}',
      ].join('\n'),
    );
    const result = getCloudflareAgentsClassDefinition(analysis, 'Agent');

    if (result.kind !== 'present-supported') {
      throw new TypeError('The Think fixture must be supported.');
    }

    expect(getCloudflareAgentsThinkSessionInstructions(result.definition)).toMatchObject({
      cachedPrompt: { kind: expectedKind },
      kind: 'closed',
    });
  });

  test('keeps retained onCompaction callbacks unresolved', () => {
    const analysis = analyze(
      [
        "import { Think } from '@cloudflare/think';",
        'export class Agent extends Think {',
        '  configureSession(session) { return session.onCompaction(() => load()); }',
        '}',
      ].join('\n'),
    );
    const result = getCloudflareAgentsClassDefinition(analysis, 'Agent');

    if (result.kind !== 'present-supported') {
      throw new TypeError('The Think fixture must be supported.');
    }

    expect(getCloudflareAgentsThinkSessionInstructions(result.definition).kind).toBe('unresolved');
  });

  test('treats a malformed compactAfter call as unresolved', () => {
    const analysis = analyze(
      [
        "import { Think } from '@cloudflare/think';",
        'export class Agent extends Think {',
        '  configureSession(session) {',
        '    return session.withInstructions(load()).compactAfter();',
        '  }',
        '}',
      ].join('\n'),
    );
    const result = getCloudflareAgentsClassDefinition(analysis, 'Agent');

    if (result.kind !== 'present-supported') {
      throw new TypeError('The Think fixture must be supported.');
    }

    expect(getCloudflareAgentsThinkSessionInstructions(result.definition).kind).toBe('unresolved');
  });

  test('retains configureContext and session context blocks in declared order', () => {
    const analysis = analyze(
      [
        "import { Think } from '@cloudflare/think';",
        'export class Agent extends Think {',
        "  configureContext() { return [{ label: 'soul', provider: { get: () => loadFirst() } }, { label: 'memory' }]; }",
        "  configureSession(session) { return session.withContext('memory', { provider: { get: () => loadSecond() } }); }",
        '}',
      ].join('\n'),
    );
    const result = getCloudflareAgentsClassDefinition(analysis, 'Agent');

    if (result.kind !== 'present-supported') {
      throw new TypeError('The Think context fixture must be supported.');
    }

    expect(getCloudflareAgentsThinkContextSources(result.definition)).toMatchObject({
      contexts: [
        { label: 'soul', relationship: { kind: 'present' } },
        { label: 'memory', relationship: { kind: 'absent' } },
      ],
      kind: 'closed',
    });
    expect(getCloudflareAgentsThinkSessionInstructions(result.definition)).toMatchObject({
      contexts: [{ label: 'memory', relationship: { kind: 'present' } }],
      kind: 'closed',
    });
  });

  test.each([
    [
      'configured context',
      "configureContext() { return [{ label: 'soul', provider: { get: () => load() }, extra: mutate() }]; }",
      'context',
      'unresolved',
    ],
    [
      'session context',
      "configureSession(session) { return session.withContext('soul', { provider: { get: () => load() }, extra: mutate() }); }",
      'session',
      'unresolved',
    ],
    [
      'provider with init',
      "configureContext() { return [{ label: 'soul', provider: { get: () => load(), init: () => mutate() } }]; }",
      'context',
      'closed',
    ],
  ] as const)(
    'leaves unsupported %s source unresolved',
    (_description, method, owner, expectedKind) => {
      const analysis = analyze(
        [
          "import { Think } from '@cloudflare/think';",
          `export class Agent extends Think { ${method} }`,
        ].join('\n'),
      );
      const result = getCloudflareAgentsClassDefinition(analysis, 'Agent');

      if (result.kind !== 'present-supported') {
        throw new TypeError('The Think fixture must be supported.');
      }

      if (owner === 'context') {
        const context = getCloudflareAgentsThinkContextSources(result.definition);
        expect(context.kind).toBe(expectedKind);

        if (expectedKind === 'closed') {
          expect(context).toMatchObject({
            contexts: [{ relationship: { kind: 'unresolved' } }],
          });
        }
      } else {
        expect(getCloudflareAgentsThinkSessionInstructions(result.definition).kind).toBe(
          expectedKind,
        );
      }
    },
  );

  test.each([
    [
      'closed tool-free channels',
      "return { web: { kind: 'web', ingress: { transport: 'websocket' } } };",
      'absent',
    ],
    ['a channel tools policy', 'return { web: { tools: (all) => all } };', 'unresolved'],
    ['a dynamic channel definition', 'return { web: webChannel };', 'unresolved'],
  ])('classifies %s as %s', (_description, channelReturn, expectedKind) => {
    const analysis = analyze(
      [
        "import { Think } from '@cloudflare/think';",
        'export class Agent extends Think {',
        `  configureChannels() { ${channelReturn} }`,
        '}',
      ].join('\n'),
    );
    const result = getCloudflareAgentsClassDefinition(analysis, 'Agent');

    if (result.kind !== 'present-supported') {
      throw new TypeError('The Think fixture must be supported.');
    }

    expect(getCloudflareAgentsThinkChannelTools(result.definition).kind).toBe(expectedKind);
  });

  test('recognizes direct AIChatAgent requests and applies instructions precedence', () => {
    const analysis = analyze(
      [
        "import { AIChatAgent } from '@cloudflare/ai-chat';",
        "import { streamText } from 'ai';",
        'export class ChatAgent extends AIChatAgent {',
        '  onChatMessage(onFinish, options?) {',
        '    return streamText({ instructions: load(), system: ignored(), tools, output });',
        '  }',
        '}',
      ].join('\n'),
    );
    const result = getCloudflareAgentsClassDefinition(analysis, 'ChatAgent');

    if (result.kind !== 'present-supported') {
      throw new TypeError('The AIChatAgent fixture must be supported.');
    }

    expect(getCloudflareAgentsAiChatRequests(result.definition, analysis)).toMatchObject([
      { call: 'streamText', instructions: { kind: 'present' } },
    ]);
  });

  test.each([
    [
      'executable field',
      "import { Think } from '@cloudflare/think'; export class Agent extends Think { value = load(); }",
    ],
    [
      'computed method',
      "import { Think } from '@cloudflare/think'; export class Agent extends Think { [name]() {} }",
    ],
    [
      'non-pass-through constructor',
      "import { Think } from '@cloudflare/think'; export class Agent extends Think { constructor(a, b) { super(a, create(b)); } }",
    ],
  ])('suppresses method-derived analysis for an unsupported %s', (_description, source) => {
    expect(getCloudflareAgentsClassDefinition(analyze(source), 'Agent').kind).toBe(
      'present-unsupported',
    );
  });
});

// @vitest-environment node
import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'vitest';

import { createCore } from '@moldea.ai/core';
import {
  createMemoryRepositoryReader,
  type IMemoryRepositoryEntry,
} from '@moldea.ai/repository/memory';

import { cloudflareAgentsAdapter } from '../adapter/index.js';
import { CLOUDFLARE_AGENTS_ADAPTER_DIAGNOSTICS } from '../diagnostics/index.js';

interface ICloudflareAgentsFixture {
  readonly entries: readonly {
    readonly path: string;
    readonly text: string;
    readonly type: 'file';
  }[];
  readonly manifest: string;
}

interface IExpectedEvidence {
  readonly agentId: string | null;
  readonly capabilityId: string | null;
  readonly kind: string;
  readonly details: Readonly<Record<string, unknown>>;
}

type IFixtureReplacement = string | Uint8Array;

const fixture = JSON.parse(
  readFileSync(
    new URL('../../../../fixtures/adapter-cloudflare-agents/cases.json', import.meta.url),
    'utf8',
  ),
) as ICloudflareAgentsFixture;
const expectedEvidence = JSON.parse(
  readFileSync(
    new URL(
      '../../../../fixtures/adapter-cloudflare-agents/evidence.expected.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as readonly IExpectedEvidence[];
const expectedDiagnostics = JSON.parse(
  readFileSync(
    new URL(
      '../../../../fixtures/adapter-cloudflare-agents/diagnostics.expected.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as readonly { readonly code: string; readonly message: string }[];

const createEntries = (
  replacements: Readonly<Record<string, IFixtureReplacement>> = {},
): readonly IMemoryRepositoryEntry[] => {
  const fixturePaths = new Set(fixture.entries.map(({ path }) => path));

  return [
    {
      content: replacements['/moldea/moldea.yaml'] ?? fixture.manifest,
      path: '/moldea/moldea.yaml',
      type: 'file',
    },
    ...fixture.entries.map((entry): IMemoryRepositoryEntry => ({
      content: replacements[entry.path] ?? entry.text,
      path: entry.path,
      type: 'file',
    })),
    ...Object.entries(replacements)
      .filter(([path]) => path !== '/moldea/moldea.yaml' && !fixturePaths.has(path))
      .map(([path, content]): IMemoryRepositoryEntry => ({ content, path, type: 'file' })),
  ];
};

const inspect = async (replacements: Readonly<Record<string, IFixtureReplacement>> = {}) =>
  createCore({ adapters: [cloudflareAgentsAdapter] }).validateProject({
    repository: createMemoryRepositoryReader(createEntries(replacements)),
  });

/** Finds the unique fixture source containing the requested text. */
const getFixtureEntry = (text: string): ICloudflareAgentsFixture['entries'][number] => {
  const entries = fixture.entries.filter((entry) => entry.text.includes(text));

  if (entries.length !== 1 || entries[0] === undefined) {
    throw new TypeError(
      `Exactly one fixture entry containing ${JSON.stringify(text)} is required.`,
    );
  }

  return entries[0];
};

/** Replaces a required source fragment without allowing a silent fixture no-op. */
const replaceFixtureText = (text: string, search: string | RegExp, replacement: string): string => {
  const nextText = text.replace(search, replacement);

  if (nextText === text) {
    throw new TypeError(`The fixture replacement ${String(search)} did not match.`);
  }

  return nextText;
};

describe('cloudflareAgentsAdapter Core integration', () => {
  test('keeps the diagnostic catalog synchronized with its conformance golden', () => {
    expect(
      Object.entries(CLOUDFLARE_AGENTS_ADAPTER_DIAGNOSTICS)
        .map(([code, definition]) => ({ code, ...definition }))
        .sort((left, right) => (left.code < right.code ? -1 : left.code > right.code ? 1 : 0)),
    ).toStrictEqual(expectedDiagnostics);
  });

  test('emits the complete normalized evidence for both supported targets', async () => {
    const result = await inspect();

    expect(result.diagnostics).toStrictEqual([]);
    expect(result.valid).toBe(true);
    expect(result.evidence).toEqual(expectedEvidence);
    expect(result.summary).not.toBeNull();
  });

  test('accepts later stable provider majors through minimum-only ranges', async () => {
    const result = await inspect({
      '/package.json': JSON.stringify({
        dependencies: {
          '@cloudflare/ai-chat': '1.0.0',
          '@cloudflare/think': '1.0.0',
          agents: '1.0.0',
          ai: '8.0.0',
        },
      }),
    });

    expect(result.diagnostics).toStrictEqual([]);
    expect(result.valid).toBe(true);
  });

  test.each([
    ['0.17.0', 'error'],
    ['0.18.0', 'evidence'],
    ['>=0.17.0', 'warning'],
  ] as const)('classifies configureContext with Think %s as %s', async (version, expected) => {
    const packageEntry = getFixtureEntry('"@cloudflare/think"');
    const agentEntry = getFixtureEntry('class SupportAgent');
    const result = await inspect({
      [packageEntry.path]: replaceFixtureText(packageEntry.text, '^0.16.0', version),
      [agentEntry.path]: replaceFixtureText(
        agentEntry.text,
        'getSystemPrompt() { return loadSupportInstruction(); }',
        "configureContext() { return [{ label: 'soul', provider: { get: () => loadSupportInstruction() } }]; }",
      ),
    });
    const instructionEvidence = result.evidence.filter(
      ({ agentId, kind }) => agentId === 'support' && kind === 'instruction-loader',
    );
    const instructionDiagnostics = result.diagnostics.filter(
      ({ entity }) => entity?.agentId === 'support',
    );

    if (expected === 'evidence') {
      expect(result.valid).toBe(true);
      expect(instructionEvidence).toHaveLength(1);
      expect(instructionDiagnostics).toStrictEqual([]);
    } else if (expected === 'warning') {
      expect(result.valid).toBe(true);
      expect(instructionEvidence).toHaveLength(0);
      expect(instructionDiagnostics).toMatchObject([
        {
          code: 'CLOUDFLARE_AGENTS_RUNTIME_RELATIONSHIP_UNVERIFIED',
          details: {
            boundaryVersion: '0.18.0',
            declaredRange: '>=0.17.0',
            packageName: '@cloudflare/think',
            reason: 'version-dependent-behavior',
            relationship: 'instruction-loader',
          },
          severity: 'warning',
        },
      ]);
      expect(
        result.evidence.filter(
          ({ agentId, kind }) => agentId === 'support' && kind === 'tool-registration',
        ),
      ).toHaveLength(1);
    } else {
      expect(result.valid).toBe(false);
      expect(instructionEvidence).toHaveLength(0);
      expect(instructionDiagnostics.map(({ code }) => code)).toContain(
        'CLOUDFLARE_AGENTS_INSTRUCTION_LOADER_NOT_WIRED',
      );
    }
  });

  test.each(['0.17.0', '0.18.0', '>=0.17.0'])(
    'retains the shared withContext loader with Think %s',
    async (version) => {
      const packageEntry = getFixtureEntry('"@cloudflare/think"');
      const agentEntry = getFixtureEntry('class SupportAgent');
      const result = await inspect({
        [packageEntry.path]: replaceFixtureText(packageEntry.text, '^0.16.0', version),
        [agentEntry.path]: replaceFixtureText(
          agentEntry.text,
          'getSystemPrompt() { return loadSupportInstruction(); }',
          "configureSession(session) { return session.withContext('soul', { provider: { get: () => loadSupportInstruction() } }); }",
        ),
      });

      expect(result.valid).toBe(true);
      expect(result.diagnostics).toStrictEqual([]);
      expect(
        result.evidence.filter(
          ({ agentId, kind }) => agentId === 'support' && kind === 'instruction-loader',
        ),
      ).toHaveLength(1);
    },
  );

  test('does not infer Think behavior from a non-SemVer declaration', async () => {
    const packageEntry = getFixtureEntry('"@cloudflare/think"');
    const agentEntry = getFixtureEntry('class SupportAgent');
    const result = await inspect({
      [packageEntry.path]: replaceFixtureText(packageEntry.text, '^0.16.0', 'latest'),
      [agentEntry.path]: replaceFixtureText(
        agentEntry.text,
        'getSystemPrompt() { return loadSupportInstruction(); }',
        "configureContext() { return [{ label: 'soul', provider: { get: () => loadSupportInstruction() } }]; }",
      ),
    });

    expect(
      result.evidence.some(
        ({ agentId, kind }) => agentId === 'support' && kind === 'instruction-loader',
      ),
    ).toBe(false);
    expect(result.diagnostics).toMatchObject([
      {
        code: 'CLOUDFLARE_AGENTS_RUNTIME_RELATIONSHIP_UNVERIFIED',
        details: { declaredRange: null, reason: 'version-dependent-behavior' },
        severity: 'warning',
      },
    ]);
  });

  test('retains prerelease ineligibility before relationship interpretation', async () => {
    const packageEntry = getFixtureEntry('"@cloudflare/think"');
    const result = await inspect({
      [packageEntry.path]: replaceFixtureText(packageEntry.text, '^0.16.0', '0.18.0-rc.1'),
    });

    expect(result.valid).toBe(false);
    expect(result.diagnostics).toMatchObject([
      {
        code: 'CLOUDFLARE_AGENTS_RUNTIME_VERSION_UNSUPPORTED',
        details: { declaredRange: '0.18.0-rc.1' },
        severity: 'error',
      },
    ]);
  });

  test('does not infer Think behavior from conflicting declarations', async () => {
    const packageEntry = getFixtureEntry('"@cloudflare/think"');
    const agentEntry = getFixtureEntry('class SupportAgent');
    const manifest = JSON.parse(packageEntry.text) as { dependencies: Record<string, string> };
    manifest.dependencies['@cloudflare/think'] = '0.17.0';
    const result = await inspect({
      [packageEntry.path]: JSON.stringify({
        ...manifest,
        devDependencies: { '@cloudflare/think': '0.18.0' },
      }),
      [agentEntry.path]: replaceFixtureText(
        agentEntry.text,
        'getSystemPrompt() { return loadSupportInstruction(); }',
        "configureContext() { return [{ label: 'soul', provider: { get: () => loadSupportInstruction() } }]; }",
      ),
    });

    expect(result.valid).toBe(true);
    expect(result.warningCount).toBe(1);
    expect(result.diagnostics).toMatchObject([
      {
        code: 'CLOUDFLARE_AGENTS_RUNTIME_RELATIONSHIP_UNVERIFIED',
        details: { declaredRange: null, reason: 'version-dependent-behavior' },
      },
    ]);
  });

  test('uses the later session context for a duplicate label', async () => {
    const packageEntry = getFixtureEntry('"@cloudflare/think"');
    const agentEntry = getFixtureEntry('class SupportAgent');
    const result = await inspect({
      [packageEntry.path]: replaceFixtureText(packageEntry.text, '^0.16.0', '0.18.0'),
      [agentEntry.path]: replaceFixtureText(
        agentEntry.text,
        'getSystemPrompt() { return loadSupportInstruction(); }',
        "configureContext() { return [{ label: 'soul', provider: { get: () => loadSupportInstruction() } }]; } configureSession(session) { return session.withContext('soul', { provider: { get: () => loadSummaryInstruction() } }); }",
      ),
    });

    expect(result.valid).toBe(false);
    expect(
      result.evidence.filter(
        ({ agentId, kind }) => agentId === 'support' && kind === 'instruction-loader',
      ),
    ).toHaveLength(0);
    expect(result.diagnostics.map(({ code }) => code)).toContain(
      'CLOUDFLARE_AGENTS_INSTRUCTION_LOADER_NOT_WIRED',
    );
  });

  test('retains configured getSystemPrompt evidence with a default-backed context block', async () => {
    const packageEntry = getFixtureEntry('"@cloudflare/think"');
    const agentEntry = getFixtureEntry('class SupportAgent');
    const result = await inspect({
      [packageEntry.path]: replaceFixtureText(packageEntry.text, '^0.16.0', '0.18.0'),
      [agentEntry.path]: replaceFixtureText(
        agentEntry.text,
        'getSystemPrompt() { return loadSupportInstruction(); }',
        "getSystemPrompt() { return loadSupportInstruction(); } configureContext() { return [{ label: 'soul' }]; }",
      ),
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toStrictEqual([]);
    expect(
      result.evidence.filter(
        ({ agentId, kind }) => agentId === 'support' && kind === 'instruction-loader',
      ),
    ).toHaveLength(1);
  });

  test('retains configured getSystemPrompt evidence when a Session callback is unresolved', async () => {
    const agentEntry = getFixtureEntry('class SupportAgent');
    const result = await inspect({
      [agentEntry.path]: replaceFixtureText(
        agentEntry.text,
        'getSystemPrompt() { return loadSupportInstruction(); }',
        'getSystemPrompt() { return loadSupportInstruction(); } configureSession(session) { return session.onCompaction(() => loadSummaryInstruction()); }',
      ),
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toStrictEqual([]);
    expect(
      result.evidence.filter(
        ({ agentId, kind }) => agentId === 'support' && kind === 'instruction-loader',
      ),
    ).toHaveLength(1);
  });

  test('does not credit configured context when an unresolved Session can replace it', async () => {
    const packageEntry = getFixtureEntry('"@cloudflare/think"');
    const agentEntry = getFixtureEntry('class SupportAgent');
    const result = await inspect({
      [packageEntry.path]: replaceFixtureText(packageEntry.text, '^0.16.0', '0.18.0'),
      [agentEntry.path]: replaceFixtureText(
        agentEntry.text,
        'getSystemPrompt() { return loadSupportInstruction(); }',
        "configureContext() { return [{ label: 'soul', provider: { get: () => loadSupportInstruction() } }]; } configureSession(session) { return session.onCompaction(() => loadSummaryInstruction()); }",
      ),
    });

    expect(result.valid).toBe(true);
    expect(
      result.evidence.some(
        ({ agentId, kind }) => agentId === 'support' && kind === 'instruction-loader',
      ),
    ).toBe(false);
    expect(result.diagnostics).toMatchObject([
      {
        code: 'CLOUDFLARE_AGENTS_RUNTIME_RELATIONSHIP_UNVERIFIED',
        details: { reason: 'dynamic-source-pattern', relationship: 'instruction-loader' },
        severity: 'warning',
      },
    ]);
  });

  test('retains a closed Session context when prompt-store selection repeats', async () => {
    const agentEntry = getFixtureEntry('class SupportAgent');
    const result = await inspect({
      [agentEntry.path]: replaceFixtureText(
        agentEntry.text,
        'getSystemPrompt() { return loadSupportInstruction(); }',
        "configureSession(session) { return session.withCachedPrompt().withContext('soul', { provider: { get: () => loadSupportInstruction() } }).withCachedPrompt(); }",
      ),
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toStrictEqual([]);
    expect(
      result.evidence.filter(
        ({ agentId, kind }) => agentId === 'support' && kind === 'instruction-loader',
      ),
    ).toHaveLength(1);
  });

  test.each([
    ['inert setter', '{ get: () => loadSupportInstruction(), set: async (prompt) => {} }', true],
    ['direct getter reference', '{ get: loadSupportInstruction, set: async (prompt) => {} }', true],
    [
      'mutating setter',
      '{ get: () => loadSupportInstruction(), set: async (prompt) => { state.prompt = prompt; } }',
      false,
    ],
  ] as const)(
    'classifies a custom prompt store with %s',
    async (_description, provider, isWired) => {
      const agentEntry = getFixtureEntry('class SupportAgent');
      const result = await inspect({
        [agentEntry.path]: replaceFixtureText(
          agentEntry.text,
          'getSystemPrompt() { return loadSupportInstruction(); }',
          `configureSession(session) { return session.withCachedPrompt(${provider}); }`,
        ),
      });

      expect(result.valid).toBe(true);
      expect(
        result.evidence.some(
          ({ agentId, kind }) => agentId === 'support' && kind === 'instruction-loader',
        ),
      ).toBe(isWired);
      expect(
        result.diagnostics.some(
          ({ code }) => code === 'CLOUDFLARE_AGENTS_INSTRUCTION_LOADER_NOT_WIRED',
        ),
      ).toBe(false);
    },
  );

  test.each([
    ['true', 'enabled'],
    ['false', 'disabled'],
    ['deferLoading', 'unknown'],
  ] as const)('reports declared deferred loading %s as %s', async (option, expected) => {
    const toolEntry = getFixtureEntry('export const findOrderTool');
    const result = await inspect({
      [toolEntry.path]: replaceFixtureText(
        toolEntry.text,
        'inputSchema: FindOrderInputSchema,',
        `inputSchema: FindOrderInputSchema, deferLoading: ${option},`,
      ),
    });

    expect(result.valid).toBe(true);
    expect(result.diagnostics).toStrictEqual([]);
    expect(
      result.evidence
        .filter(
          ({ kind, capabilityId }) => kind === 'tool-registration' && capabilityId === 'find-order',
        )
        .map(({ details }) => details['declaredDeferredLoading']),
    ).toStrictEqual([expected, expected]);
  });

  test('produces deterministic evidence for reversed entries and concurrent inspections', async () => {
    const reversed = await createCore({ adapters: [cloudflareAgentsAdapter] }).validateProject({
      repository: createMemoryRepositoryReader([...createEntries()].reverse()),
    });
    const concurrent = await Promise.all([inspect(), inspect(), inspect(), inspect()]);

    expect(reversed.evidence).toEqual(expectedEvidence);
    expect(concurrent.every(({ valid }) => valid)).toBe(true);
    expect(concurrent.map(({ evidence }) => evidence)).toEqual([
      expectedEvidence,
      expectedEvidence,
      expectedEvidence,
      expectedEvidence,
    ]);
  });

  test.each([
    ['CLOUDFLARE_AGENTS_PACKAGE_MANIFEST_INVALID', '/package.json', '{'],
    [
      'CLOUDFLARE_AGENTS_RUNTIME_VERSION_UNSUPPORTED',
      '/package.json',
      JSON.stringify({
        dependencies: {
          '@cloudflare/ai-chat': '0.9.0',
          '@cloudflare/think': '0.15.0',
          agents: '0.20.0',
          ai: '6.0.0',
        },
      }),
    ],
  ])('emits %s for an invalid package boundary', async (code, path, replacement) => {
    const result = await inspect({ [path]: replacement });

    expect(result.diagnostics.some((diagnostic) => diagnostic.code === code)).toBe(true);
  });

  test.each([
    ['CLOUDFLARE_AGENTS_SOURCE_TEXT_INVALID', Uint8Array.from([0xff])],
    ['CLOUDFLARE_AGENTS_SOURCE_SYNTAX_INVALID', 'export const agent = (;'],
  ])('emits %s for invalid runtime source', async (code, replacement) => {
    const runtimeSource = getFixtureEntry('export class SupportAgent');
    const result = await inspect({ [runtimeSource.path]: replacement });

    expect(result.diagnostics.some((diagnostic) => diagnostic.code === code)).toBe(true);
  });

  test('emits a symbol diagnostic when a configured runtime export is absent', async () => {
    const runtimeSource = getFixtureEntry('export class SupportAgent');
    const replacement = replaceFixtureText(
      runtimeSource.text,
      'export class SupportAgent',
      'export class AnotherSupportAgent',
    );
    const result = await inspect({ [runtimeSource.path]: replacement });

    expect(
      result.diagnostics.some(
        ({ code }) => code === 'CLOUDFLARE_AGENTS_RUNTIME_AGENT_SYMBOL_NOT_FOUND',
      ),
    ).toBe(true);
  });

  test('preserves package, language, and agent evidence for an unsupported class closure', async () => {
    const runtimeSource = getFixtureEntry('export class SupportAgent');
    const replacement = replaceFixtureText(
      runtimeSource.text,
      /export class SupportAgent extends Think\s*\{/,
      'export class SupportAgent extends Think { static {}',
    );
    const result = await inspect({ [runtimeSource.path]: replacement });
    const agentId = expectedEvidence.find(
      ({ details, kind }) =>
        kind === 'agent-definition' && details['targetId'] === 'typescript-think-0-16-ai-sdk-7',
    )?.agentId;
    const agentEvidence = result.evidence.filter((evidence) => evidence.agentId === agentId);

    expect(agentEvidence.map(({ kind }) => kind)).toStrictEqual([
      'agent-definition',
      'language',
      'runtime-package',
      'runtime-package',
      'runtime-package',
    ]);
  });

  test('suppresses tool and handoff evidence when a tools map is open', async () => {
    const runtimeSource = getFixtureEntry('getTools');
    const replacement = replaceFixtureText(
      runtimeSource.text,
      /(getTools\([^)]*\)[^{]*\{\s*return\s*\{)/,
      '$1\n      ...externalTools,',
    );
    const result = await inspect({ [runtimeSource.path]: replacement });
    const agentId = expectedEvidence.find(
      ({ details, kind }) =>
        kind === 'agent-definition' && details['targetId'] === 'typescript-think-0-16-ai-sdk-7',
    )?.agentId;

    expect(
      result.evidence.some(
        ({ agentId: evidenceAgentId, kind }) =>
          evidenceAgentId === agentId &&
          (kind === 'tool-registration' || kind === 'handoff-registration'),
      ),
    ).toBe(false);
  });

  test('suppresses AI Chat tool evidence when any request tools map is unresolved', async () => {
    const runtimeSource = getFixtureEntry('onChatMessage');
    const replacement = replaceFixtureText(
      runtimeSource.text,
      'return streamText(',
      'streamText({ tools: externalTools });\n    return streamText(',
    );
    const result = await inspect({ [runtimeSource.path]: replacement });
    const agentId = expectedEvidence.find(
      ({ details, kind }) => kind === 'tool-registration' && details['toolName'] === 'find_order',
    )?.agentId;

    expect(
      result.evidence.some(
        ({ agentId: evidenceAgentId, kind }) =>
          evidenceAgentId === agentId && kind === 'tool-registration',
      ),
    ).toBe(false);
  });

  test('suppresses Think tool and handoff evidence when channels can replace tools', async () => {
    const runtimeSource = getFixtureEntry('getTools');
    const replacement = replaceFixtureText(
      runtimeSource.text,
      /export class SupportAgent extends Think\s*\{/,
      [
        'export class SupportAgent extends Think {',
        '  configureChannels() { return { web: { tools: channelTools } }; }',
      ].join('\n'),
    );
    const result = await inspect({ [runtimeSource.path]: replacement });
    const agentId = expectedEvidence.find(
      ({ details, kind }) =>
        kind === 'agent-definition' && details['targetId'] === 'typescript-think-0-16-ai-sdk-7',
    )?.agentId;

    expect(
      result.evidence.some(
        ({ agentId: evidenceAgentId, kind }) =>
          evidenceAgentId === agentId &&
          (kind === 'tool-registration' || kind === 'handoff-registration'),
      ),
    ).toBe(false);
  });

  test('preserves Think tool evidence for closed tool-free channels', async () => {
    const runtimeSource = getFixtureEntry('getTools');
    const replacement = replaceFixtureText(
      runtimeSource.text,
      /export class SupportAgent extends Think\s*\{/,
      [
        'export class SupportAgent extends Think {',
        "  configureChannels() { return { web: { kind: 'web', ingress: { transport: 'websocket' } } }; }",
      ].join('\n'),
    );
    const result = await inspect({ [runtimeSource.path]: replacement });
    const agentId = expectedEvidence.find(
      ({ details, kind }) =>
        kind === 'agent-definition' && details['targetId'] === 'typescript-think-0-16-ai-sdk-7',
    )?.agentId;

    expect(
      result.evidence.some(
        ({ agentId: evidenceAgentId, kind }) =>
          evidenceAgentId === agentId && kind === 'tool-registration',
      ),
    ).toBe(true);
  });

  test('suppresses handoff evidence for a target that fails Cloudflare agent inspection', async () => {
    const runtimeSource = getFixtureEntry('export class SupportAgent');
    const replacement = replaceFixtureText(
      runtimeSource.text,
      /export class SummaryAgent extends AIChatAgent\s*\{/,
      'export class SummaryAgent extends AIChatAgent { static {}',
    );
    const result = await inspect({ [runtimeSource.path]: replacement });
    const agentId = expectedEvidence.find(
      ({ details, kind }) =>
        kind === 'agent-definition' && details['targetId'] === 'typescript-think-0-16-ai-sdk-7',
    )?.agentId;

    expect(
      result.evidence.some(
        ({ agentId: evidenceAgentId, kind }) =>
          evidenceAgentId === agentId && kind === 'handoff-registration',
      ),
    ).toBe(false);
  });

  test('rejects a function-tool implementation symbol mismatch', async () => {
    const implementationSource = getFixtureEntry('export const findOrder = async');
    const replacement = replaceFixtureText(
      implementationSource.text,
      'export const findOrder',
      'export const anotherImplementation',
    );
    const result = await inspect({ [implementationSource.path]: replacement });

    expect(
      result.diagnostics.some(
        ({ code }) => code === 'CLOUDFLARE_AGENTS_TOOL_IMPLEMENTATION_SYMBOL_NOT_FOUND',
      ),
    ).toBe(true);
  });
});

// @vitest-environment node
import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'vitest';

import { createCore } from '@moldea.ai/core';
import {
  createMemoryRepositoryReader,
  type IMemoryRepositoryEntry,
} from '@moldea.ai/repository/memory';

import { eveAdapter } from '../adapter/index.js';
import { EVE_ADAPTER_DIAGNOSTICS } from '../diagnostics/index.js';

interface IEveFixture {
  readonly entries: readonly {
    readonly path: string;
    readonly text: string;
    readonly type: 'file';
  }[];
  readonly manifest: string;
}

type IFixtureReplacement = string | Uint8Array;

const fixture = JSON.parse(
  readFileSync(new URL('../../../../fixtures/adapter-eve/cases.json', import.meta.url), 'utf8'),
) as IEveFixture;
const expectedEvidence = JSON.parse(
  readFileSync(
    new URL('../../../../fixtures/adapter-eve/evidence.expected.json', import.meta.url),
    'utf8',
  ),
) as readonly unknown[];
const expectedDiagnostics = JSON.parse(
  readFileSync(
    new URL('../../../../fixtures/adapter-eve/diagnostics.expected.json', import.meta.url),
    'utf8',
  ),
) as readonly { readonly code: string; readonly message: string }[];

const createEntries = (
  replacements: Readonly<Record<string, IFixtureReplacement | null>> = {},
): readonly IMemoryRepositoryEntry[] => {
  const fixturePaths = new Set(fixture.entries.map(({ path }) => path));

  return [
    {
      content: replacements['/moldea/moldea.yaml'] ?? fixture.manifest,
      path: '/moldea/moldea.yaml',
      type: 'file' as const,
    },
    ...fixture.entries
      .filter(({ path }) => replacements[path] !== null)
      .map((entry): IMemoryRepositoryEntry => ({
        content: replacements[entry.path] ?? entry.text,
        path: entry.path,
        type: 'file',
      })),
    ...Object.entries(replacements)
      .filter(
        ([path, content]) =>
          content !== null && path !== '/moldea/moldea.yaml' && !fixturePaths.has(path),
      )
      .map(([path, content]): IMemoryRepositoryEntry => ({
        content: content as IFixtureReplacement,
        path,
        type: 'file',
      })),
  ];
};

const inspect = async (replacements: Readonly<Record<string, IFixtureReplacement | null>> = {}) =>
  createCore({ adapters: [eveAdapter] }).validateProject({
    repository: createMemoryRepositoryReader(createEntries(replacements)),
  });

const replaceFixture = (path: string, search: string, replacement: string): string => {
  const source = fixture.entries.find((entry) => entry.path === path)?.text;

  if (source === undefined || !source.includes(search)) {
    throw new TypeError(`The fixture ${path} does not contain ${JSON.stringify(search)}.`);
  }

  return source.replace(search, replacement);
};

const workspaceManifest = (includeResearch: boolean): string =>
  `version: 1\nagents:\n  support:\n    runtime:\n      id: eve\n    bindings:\n      runtimeAgent:\n        path: /agents/support/agent/agent.ts\n        symbol: default\n${
    includeResearch
      ? '  research:\n    runtime:\n      id: eve\n    bindings:\n      runtimeAgent:\n        path: /agents/research/agent/agent.ts\n        symbol: default\n'
      : ''
  }`;

const workspaceEntries = (
  declaration: string,
  includeResearch = true,
): Readonly<Record<string, IFixtureReplacement | null>> => ({
  '/package.json': '{"name":"@acme/support-app","dependencies":{"eve":"0.66.3"}}',
  '/moldea/moldea.yaml': workspaceManifest(includeResearch),
  '/moldea/agents/summary/description.md': null,
  '/moldea/agents/summary/handoff-description.md': null,
  '/moldea/agents/summary/instruction.md': null,
  '/moldea/agents/research/description.md': includeResearch
    ? 'Researches support requests.\n'
    : null,
  '/moldea/agents/research/instruction.md': includeResearch
    ? 'You are the `research` agent.\n'
    : null,
  '/agents/support/agent/agent.ts':
    "import { defineAgent } from 'eve'; export default defineAgent({ description: 'Supports customers.', model: 'provider/model' });\n",
  '/agents/research/agent/agent.ts':
    "import { defineAgent } from 'eve'; export default defineAgent({ description: 'Researches support requests.', model: 'provider/model' });\n",
  '/agents/support/agent/subagents/research.ts': declaration,
});

describe('eveAdapter Core integration', () => {
  test('keeps the complete stable diagnostic catalog synchronized', () => {
    expect(
      Object.entries(EVE_ADAPTER_DIAGNOSTICS)
        .map(([code, definition]) => ({ code, ...definition }))
        .sort((left, right) => (left.code < right.code ? -1 : left.code > right.code ? 1 : 0)),
    ).toStrictEqual(expectedDiagnostics);
  });

  test('emits complete normalized evidence for the verified filesystem target', async () => {
    const result = await inspect();

    expect(result.diagnostics).toStrictEqual([]);
    expect(result.valid).toBe(true);
    expect(result.evidence).toEqual(expectedEvidence);
  });

  test('accepts a later stable provider major through the minimum-only range', async () => {
    const result = await inspect({
      '/package.json': '{"name":"@acme/support-app","dependencies":{"eve":"1.0.0"}}',
    });

    expect(result.diagnostics).toStrictEqual([]);
    expect(result.valid).toBe(true);
  });

  test('is deterministic for reversed entries and concurrent inspections', async () => {
    const reversed = await createCore({ adapters: [eveAdapter] }).validateProject({
      repository: createMemoryRepositoryReader([...createEntries()].reverse()),
    });
    const concurrent = await Promise.all([inspect(), inspect(), inspect(), inspect()]);

    expect(reversed.evidence).toEqual(expectedEvidence);
    expect(concurrent.map(({ evidence }) => evidence)).toEqual([
      expectedEvidence,
      expectedEvidence,
      expectedEvidence,
      expectedEvidence,
    ]);
  });

  test.each([
    ['EVE_PACKAGE_MANIFEST_INVALID', '{'],
    ['EVE_SDK_VERSION_UNSUPPORTED', '{"dependencies":{"eve":"0.38.0"}}'],
  ])('emits %s for an invalid owning package boundary', async (code, packageManifest) => {
    const result = await inspect({ '/package.json': packageManifest });

    expect(result.diagnostics.some((diagnostic) => diagnostic.code === code)).toBe(true);
  });

  test.each([
    ['EVE_SOURCE_TEXT_INVALID', Uint8Array.from([0xff])],
    ['EVE_SOURCE_SYNTAX_INVALID', "import { defineAgent } from 'eve'; export default ("],
  ])('emits %s for invalid bound agent source', async (code, source) => {
    const result = await inspect({ '/agent/agent.ts': source });

    expect(result.diagnostics.some((diagnostic) => diagnostic.code === code)).toBe(true);
  });

  test.each([
    ['/agent/contracts.ts', Uint8Array.from([0xff]), 'EVE_SOURCE_TEXT_INVALID'],
    [
      '/agent/tools/search.ts',
      "import { defineTool } from 'eve/tools'; export default (",
      'EVE_SOURCE_SYNTAX_INVALID',
    ],
    ['/agent/skills/analyze.ts', Uint8Array.from([0xff]), 'EVE_SOURCE_TEXT_INVALID'],
    ['/agent/loaders.ts', Uint8Array.from([0xff]), 'EVE_SOURCE_TEXT_INVALID'],
  ])(
    'emits only source diagnostics for an invalid referenced relationship at %s',
    async (path, source, code) => {
      const result = await inspect({ [path]: source });
      const pathDiagnostics = result.diagnostics.filter((diagnostic) => diagnostic.path === path);

      expect(pathDiagnostics.length).toBeGreaterThan(0);
      expect(pathDiagnostics.every((diagnostic) => diagnostic.code === code)).toBe(true);
    },
  );

  test('uses the supported agent definition path for a closed missing instruction relationship', async () => {
    const result = await inspect({ '/agent/instructions.ts': null });
    const diagnostic = result.diagnostics.find(
      ({ code }) => code === 'EVE_INSTRUCTION_LOADER_NOT_WIRED',
    );

    expect(diagnostic?.path).toBe('/agent/agent.ts');
  });

  test('suppresses positive definition evidence for advanced agent options', async () => {
    const result = await inspect({
      '/agent/agent.ts': replaceFixture(
        '/agent/agent.ts',
        'model: MODEL,',
        "model: MODEL, reasoning: { effort: 'high' },",
      ),
    });

    expect(
      result.evidence.some(
        ({ agentId, kind }) => agentId === 'support' && kind === 'agent-definition',
      ),
    ).toBe(false);
  });

  test.each([
    ['defaultTools', '0.52.1', 'EVE_SDK_FEATURE_UNAVAILABLE'],
    ['defaultTools', '>=0.39.1', 'EVE_RUNTIME_RELATIONSHIP_UNVERIFIED'],
    ['defaultTools', '0.52.2', null],
    ['tool', '0.59.0', 'EVE_SDK_FEATURE_UNAVAILABLE'],
    ['tool', '>=0.39.1', 'EVE_RUNTIME_RELATIONSHIP_UNVERIFIED'],
    ['tool', '0.59.1', null],
  ])('classifies the %s agent option for Eve %s', async (option, version, expectedCode) => {
    const result = await inspect({
      '/package.json': `{"name":"@acme/support-app","dependencies":{"eve":"${version}"}}`,
      '/agent/agent.ts': replaceFixture(
        '/agent/agent.ts',
        'model: MODEL,',
        `model: MODEL, ${option}: false,`,
      ),
    });

    expect(result.diagnostics.map(({ code }) => code)).toStrictEqual(
      expectedCode === null ? [] : [expectedCode],
    );
    expect(
      result.evidence.some(
        ({ agentId, kind }) => agentId === 'support' && kind === 'agent-definition',
      ),
    ).toBe(expectedCode === null);
  });

  test('detects instruction-root conflicts without selecting a winner', async () => {
    const result = await inspect({ '/agent/instructions.md': 'Conflicting instructions.\n' });

    expect(result.diagnostics.some(({ code }) => code === 'EVE_INSTRUCTION_ROOT_CONFLICT')).toBe(
      true,
    );
    expect(
      result.evidence.some(
        ({ agentId, kind }) => agentId === 'support' && kind === 'instruction-loader',
      ),
    ).toBe(false);
  });

  test('diagnoses an invalid authored tool segment and suppresses registration', async () => {
    const source = fixture.entries.find(({ path }) => path === '/agent/tools/search.ts')?.text;

    if (source === undefined) {
      throw new TypeError('The tool fixture is missing.');
    }

    const manifest = fixture.manifest.replaceAll(
      '/agent/tools/search.ts',
      '/agent/tools/1search.ts',
    );
    const result = await inspect({
      '/agent/tools/search.ts': null,
      '/agent/tools/1search.ts': source,
      '/moldea/moldea.yaml': manifest,
    });

    expect(result.diagnostics.some(({ code }) => code === 'EVE_TOOL_NAME_INVALID')).toBe(true);
    expect(
      result.evidence.some(
        ({ capabilityId, kind }) => capabilityId === 'search' && kind === 'tool-registration',
      ),
    ).toBe(false);
  });

  test('diagnoses flattened tool names before unsupported definitions can hide collisions', async () => {
    const source = fixture.entries.find(({ path }) => path === '/agent/tools/search.ts')?.text;

    if (source === undefined) {
      throw new TypeError('The tool fixture is missing.');
    }

    const manifest = fixture.manifest
      .replace('name: search', 'name: foo-bar')
      .replaceAll('/agent/tools/search.ts', '/agent/tools/foo-bar.ts');
    const result = await inspect({
      '/agent/tools/search.ts': null,
      '/agent/tools/foo-bar.ts': source,
      '/agent/tools/foo/bar.ts': 'export default {};\n',
      '/moldea/moldea.yaml': manifest,
    });

    expect(result.diagnostics.some(({ code }) => code === 'EVE_TOOL_RUNTIME_NAME_COLLISION')).toBe(
      true,
    );
    expect(
      result.evidence.some(
        ({ capabilityId, kind }) => capabilityId === 'search' && kind === 'tool-registration',
      ),
    ).toBe(false);
  });

  test('diagnoses a tool registration that points to another supported static tool', async () => {
    const otherTool = replaceFixture(
      '/agent/tools/search.ts',
      'Searches the knowledge base.',
      'Performs another operation.',
    );
    const manifest = fixture.manifest.replace(
      'registration:\n          path: /agent/tools/search.ts',
      'registration:\n          path: /agent/tools/other.ts',
    );
    const result = await inspect({
      '/agent/tools/other.ts': otherTool,
      '/moldea/moldea.yaml': manifest,
    });

    expect(result.diagnostics.some(({ code }) => code === 'EVE_TOOL_REGISTRATION_NOT_WIRED')).toBe(
      true,
    );
    expect(result.diagnostics.some(({ code }) => code === 'EVE_TOOL_NAME_MISMATCH')).toBe(false);
  });

  test('recognizes a direct workflow tool with a compiled executor declaration', async () => {
    const result = await inspect({
      '/package.json': '{"name":"@acme/support-app","dependencies":{"eve":"0.66.3"}}',
      '/agent/implementations.ts':
        "export async function searchKnowledge() { 'use workflow'; return { matches: [] }; }\n",
      '/agent/tools/search.ts': replaceFixture(
        '/agent/tools/search.ts',
        "import { defineTool } from 'eve/tools';",
        "import { defineWorkflowTool } from 'eve/tools';",
      )
        .replace('defineTool({', 'defineWorkflowTool({')
        .replace(
          "description: 'Searches the knowledge base.'",
          "description: 'Searches the knowledge base.', execution: 'background'",
        )
        .replace(
          'execute: searchKnowledge',
          'availableInSubagents: false, execute: searchKnowledge',
        ),
    });
    const registration = result.evidence.find(
      ({ capabilityId, kind }) => capabilityId === 'search' && kind === 'tool-registration',
    );

    expect(result.diagnostics).toStrictEqual([]);
    expect(registration?.details).toMatchObject({
      declaredAvailableInSubagents: 'disabled',
      declaredExecution: 'background',
      registrationKind: 'filesystem-workflow-tool',
    });
  });

  test('rejects a referenced workflow arrow that Eve cannot compile', async () => {
    const result = await inspect({
      '/package.json': '{"name":"@acme/support-app","dependencies":{"eve":"0.66.3"}}',
      '/agent/implementations.ts':
        "export const searchKnowledge = async () => { 'use workflow'; return { matches: [] }; };\n",
      '/agent/tools/search.ts': replaceFixture(
        '/agent/tools/search.ts',
        "import { defineTool } from 'eve/tools';",
        "import { defineWorkflowTool } from 'eve/tools';",
      ).replace('defineTool({', 'defineWorkflowTool({'),
    });

    expect(result.diagnostics.map(({ code }) => code)).toContain('EVE_WORKFLOW_EXECUTOR_NOT_WIRED');
    expect(
      result.evidence.some(
        ({ capabilityId, kind }) => capabilityId === 'search' && kind === 'tool-registration',
      ),
    ).toBe(false);
  });

  test.each([
    "async () => { 'use workflow'; return { matches: [] }; }",
    "async function () { 'use workflow'; return { matches: [] }; }",
  ])('rejects an inline workflow executor that is not a direct method', async (executor) => {
    const result = await inspect({
      '/package.json': '{"name":"@acme/support-app","dependencies":{"eve":"0.66.3"}}',
      '/agent/tools/search.ts': replaceFixture(
        '/agent/tools/search.ts',
        "import { defineTool } from 'eve/tools';",
        "import { defineWorkflowTool } from 'eve/tools';",
      )
        .replace('defineTool({', 'defineWorkflowTool({')
        .replace('execute: searchKnowledge', `execute: ${executor}`),
    });

    expect(result.diagnostics.map(({ code }) => code)).toContain('EVE_WORKFLOW_EXECUTOR_NOT_WIRED');
    expect(result.evidence.some(({ kind }) => kind === 'tool-registration')).toBe(false);
  });

  test.each([
    ['0.60.1', 'EVE_SDK_FEATURE_UNAVAILABLE'],
    ['>=0.39.1', 'EVE_RUNTIME_RELATIONSHIP_UNVERIFIED'],
    ['0.61.0', null],
  ])('classifies subagent tool exposure for Eve %s', async (version, expectedCode) => {
    const result = await inspect({
      '/package.json': `{"name":"@acme/support-app","dependencies":{"eve":"${version}"}}`,
      '/agent/tools/search.ts': replaceFixture(
        '/agent/tools/search.ts',
        "description: 'Searches the knowledge base.'",
        "description: 'Searches the knowledge base.', availableInSubagents: false",
      ),
    });

    expect(result.diagnostics.map(({ code }) => code)).toStrictEqual(
      expectedCode === null ? [] : [expectedCode],
    );
    const registration = result.evidence.find(
      ({ capabilityId, kind }) => capabilityId === 'search' && kind === 'tool-registration',
    );
    if (expectedCode === null) {
      expect(registration?.details).toMatchObject({ declaredAvailableInSubagents: 'disabled' });
    } else {
      expect(registration).toBeUndefined();
    }
  });

  test('recognizes an inline async workflow executor', async () => {
    const result = await inspect({
      '/package.json': '{"name":"@acme/support-app","dependencies":{"eve":"0.66.3"}}',
      '/moldea/moldea.yaml': fixture.manifest.replace(
        'path: /agent/implementations.ts\n          symbol: searchKnowledge',
        'path: /agent/tools/search.ts\n          symbol: default',
      ),
      '/agent/tools/search.ts': replaceFixture(
        '/agent/tools/search.ts',
        "import { defineTool } from 'eve/tools';",
        "import { defineWorkflowTool } from 'eve/tools';",
      )
        .replace('defineTool({', 'defineWorkflowTool({')
        .replace(
          'execute: searchKnowledge',
          "async execute() { 'use workflow'; return { matches: [] }; }",
        ),
    });

    expect(result.diagnostics).toStrictEqual([]);
    expect(
      result.evidence.some(
        ({ capabilityId, kind }) => capabilityId === 'search' && kind === 'tool-registration',
      ),
    ).toBe(true);
  });

  test('fails a direct workflow tool without a compiled executor', async () => {
    const result = await inspect({
      '/package.json': '{"name":"@acme/support-app","dependencies":{"eve":"0.66.3"}}',
      '/agent/tools/search.ts': replaceFixture(
        '/agent/tools/search.ts',
        "import { defineTool } from 'eve/tools';",
        "import { defineWorkflowTool } from 'eve/tools';",
      ).replace('defineTool({', 'defineWorkflowTool({'),
    });

    expect(result.diagnostics.some(({ code }) => code === 'EVE_WORKFLOW_EXECUTOR_NOT_WIRED')).toBe(
      true,
    );
    expect(
      result.evidence.some(
        ({ capabilityId, kind }) => capabilityId === 'search' && kind === 'tool-registration',
      ),
    ).toBe(false);
  });

  test.each([
    ['0.39.1', 'EVE_SDK_FEATURE_UNAVAILABLE'],
    ['>=0.39.1', 'EVE_RUNTIME_RELATIONSHIP_UNVERIFIED'],
  ])('does not claim a workflow tool across unsupported eve %s', async (version, code) => {
    const result = await inspect({
      '/package.json': `{"name":"@acme/support-app","dependencies":{"eve":"${version}"}}`,
      '/agent/tools/search.ts': replaceFixture(
        '/agent/tools/search.ts',
        "import { defineTool } from 'eve/tools';",
        "import { defineWorkflowTool } from 'eve/tools';",
      ).replace('defineTool({', 'defineWorkflowTool({'),
    });

    expect(result.diagnostics.map(({ code: observedCode }) => observedCode)).toContain(code);
    expect(
      result.evidence.some(
        ({ capabilityId, kind }) => capabilityId === 'search' && kind === 'tool-registration',
      ),
    ).toBe(false);
  });

  test.each([
    ['0.66.1', 'EVE_TOOL_NAME_INVALID'],
    ['0.66.2', 'EVE_TOOL_REGISTRATION_NOT_WIRED'],
    ['>=0.39.1', 'EVE_RUNTIME_RELATIONSHIP_UNVERIFIED'],
  ])('classifies a manifest-bound test source for eve %s', async (version, code) => {
    const toolSource = fixture.entries.find(({ path }) => path === '/agent/tools/search.ts')?.text;

    if (toolSource === undefined) {
      throw new TypeError('The tool fixture is missing.');
    }

    const testPath = '/agent/tools/search.test.ts';
    const manifest = fixture.manifest
      .replace(
        'path: /agent/implementations.ts\n          symbol: searchKnowledge',
        `path: ${testPath}\n          symbol: default`,
      )
      .replaceAll('/agent/tools/search.ts', testPath);
    const result = await inspect({
      '/package.json': `{"name":"@acme/support-app","dependencies":{"eve":"${version}"}}`,
      '/agent/tools/search.ts': null,
      [testPath]: toolSource,
      '/moldea/moldea.yaml': manifest,
    });

    expect(result.diagnostics.map(({ code: observedCode }) => observedCode)).toContain(code);
    expect(
      result.evidence.some(
        ({ capabilityId, kind }) => capabilityId === 'search' && kind === 'tool-registration',
      ),
    ).toBe(false);
  });

  test('excludes a manifest-bound __tests__ source under eve 0.66.2', async () => {
    const testPath = '/agent/tools/__tests__/search.ts';
    const toolSource = fixture.entries.find(({ path }) => path === '/agent/tools/search.ts')?.text;

    if (toolSource === undefined) {
      throw new TypeError('The tool fixture is missing.');
    }

    const result = await inspect({
      '/package.json': '{"name":"@acme/support-app","dependencies":{"eve":"0.66.2"}}',
      '/agent/tools/search.ts': null,
      [testPath]: toolSource,
      '/moldea/moldea.yaml': fixture.manifest
        .replace(
          'path: /agent/implementations.ts\n          symbol: searchKnowledge',
          `path: ${testPath}\n          symbol: default`,
        )
        .replaceAll('/agent/tools/search.ts', testPath),
    });

    expect(result.diagnostics.map(({ code }) => code)).toContain('EVE_TOOL_REGISTRATION_NOT_WIRED');
    expect(result.evidence.some(({ kind }) => kind === 'tool-registration')).toBe(false);
  });

  test('diagnoses a stale local-subagent routing description but preserves registration', async () => {
    const result = await inspect({
      '/agent/subagents/summary/agent.ts': replaceFixture(
        '/agent/subagents/summary/agent.ts',
        'Summarizes a support request.',
        'Routes requests to the summary agent.',
      ),
    });

    expect(
      result.diagnostics.some(({ code }) => code === 'EVE_ROUTING_DESCRIPTION_NOT_WIRED'),
    ).toBe(true);
    expect(result.evidence.some(({ kind }) => kind === 'handoff-registration')).toBe(true);
  });

  test('emits both direct edges of a registered three-agent nesting chain', async () => {
    const manifest = `${fixture.manifest}  deep:\n    runtime:\n      id: eve\n    bindings:\n      runtimeAgent:\n        path: /agent/subagents/summary/subagents/deep/agent.ts\n        symbol: default\n`;
    const result = await inspect({
      '/moldea/moldea.yaml': manifest,
      '/moldea/agents/deep/description.md': 'Handles detailed summaries.\n',
      '/moldea/agents/deep/handoff-description.md': 'Handles detailed summaries.\n',
      '/moldea/agents/deep/instruction.md': 'You are the `deep` agent.\n',
      '/agent/subagents/summary/subagents/deep/agent.ts':
        "import { defineAgent } from 'eve'; export default defineAgent({ description: 'Handles detailed summaries.', model: 'provider/model' });\n",
    });

    expect(
      result.evidence
        .filter(({ kind }) => kind === 'handoff-registration')
        .map(({ agentId, details }) => [agentId, details['targetAgentId']])
        .sort((left, right) => String(left[0]).localeCompare(String(right[0]))),
    ).toStrictEqual([
      ['summary', 'deep'],
      ['support', 'summary'],
    ]);
  });

  test('checks a nested parent tool namespace before registering its child', async () => {
    const manifest = `${fixture.manifest}  deep:\n    runtime:\n      id: eve\n    bindings:\n      runtimeAgent:\n        path: /agent/subagents/summary/subagents/deep/agent.ts\n        symbol: default\n`;
    const result = await inspect({
      '/moldea/moldea.yaml': manifest,
      '/moldea/agents/deep/description.md': 'Handles detailed summaries.\n',
      '/moldea/agents/deep/handoff-description.md': 'Handles detailed summaries.\n',
      '/moldea/agents/deep/instruction.md': 'You are the `deep` agent.\n',
      '/agent/subagents/summary/subagents/deep/agent.ts':
        "import { defineAgent } from 'eve'; export default defineAgent({ description: 'Handles detailed summaries.', model: 'provider/model' });\n",
      '/agent/subagents/summary/tools/deep.ts':
        "import { defineTool } from 'eve/tools'; export default defineTool({ description: 'Finds a deep summary.', inputSchema: {}, execute: async () => ({}) });\n",
    });

    expect(result.diagnostics.map(({ code }) => code)).toContain(
      'EVE_TOOL_SUBAGENT_NAME_COLLISION',
    );
    expect(
      result.evidence
        .filter(({ kind }) => kind === 'handoff-registration')
        .map(({ agentId, details }) => [agentId, details['targetAgentId']]),
    ).toStrictEqual([['support', 'summary']]);
  });

  test.each([
    ['0.66.2', 'EVE_SUBAGENT_REGISTRATION_NOT_WIRED'],
    ['>=0.39.1', 'EVE_RUNTIME_RELATIONSHIP_UNVERIFIED'],
  ])('does not claim a registered __tests__ subagent for Eve %s', async (version, code) => {
    const path = '/agent/subagents/__tests__/agent.ts';
    const result = await inspect({
      '/package.json': `{"name":"@acme/support-app","dependencies":{"eve":"${version}"}}`,
      '/moldea/moldea.yaml': fixture.manifest.replaceAll('/agent/subagents/summary/agent.ts', path),
      '/agent/subagents/summary/agent.ts': null,
      [path]:
        "import { defineAgent } from 'eve'; export default defineAgent({ description: 'Summarizes a support request.', model: 'provider/model' });\n",
    });

    expect(result.diagnostics.map(({ code: actualCode }) => actualCode)).toContain(code);
    expect(
      result.evidence.some(
        ({ agentId, kind }) => agentId === 'summary' && kind === 'agent-definition',
      ),
    ).toBe(false);
    expect(result.evidence.some(({ kind }) => kind === 'handoff-registration')).toBe(false);
  });

  test('resolves only an exact registered workspace peer and its parent edge', async () => {
    const result = await inspect(
      workspaceEntries(
        "import { defineWorkspaceAgent } from 'eve'; export default defineWorkspaceAgent({ name: 'research' });\n",
      ),
    );

    expect(result.diagnostics).toStrictEqual([]);
    expect(
      result.evidence
        .filter(({ kind }) => kind === 'handoff-registration')
        .map(({ agentId, details, runtimeName }) => ({
          agentId,
          registrationKind: details['registrationKind'],
          runtimeName,
          targetAgentId: details['targetAgentId'],
        })),
    ).toStrictEqual([
      {
        agentId: 'support',
        registrationKind: 'workspace-subagent',
        runtimeName: 'research',
        targetAgentId: 'research',
      },
    ]);
  });

  test('keeps a workspace subagent slot name distinct from its peer name', async () => {
    const declaration =
      "import { defineWorkspaceAgent } from 'eve'; export default defineWorkspaceAgent({ name: 'research' });\n";
    const result = await inspect({
      ...workspaceEntries(declaration),
      '/agents/support/agent/subagents/research.ts': null,
      '/agents/support/agent/subagents/specialist.ts': declaration,
    });

    expect(result.diagnostics).toStrictEqual([]);
    expect(
      result.evidence
        .filter(({ kind }) => kind === 'handoff-registration')
        .map(({ details, runtimeName }) => ({
          runtimeName,
          targetAgentId: details['targetAgentId'],
          targetRuntimeName: details['targetRuntimeName'],
        })),
    ).toStrictEqual([
      { runtimeName: 'specialist', targetAgentId: 'research', targetRuntimeName: 'research' },
    ]);
  });

  test('registers a local child beneath a workspace agent', async () => {
    const result = await inspect({
      ...workspaceEntries(
        "import { defineWorkspaceAgent } from 'eve'; export default defineWorkspaceAgent({ name: 'research' });\n",
      ),
      '/moldea/moldea.yaml': `${workspaceManifest(true)}  deep:\n    runtime:\n      id: eve\n    bindings:\n      runtimeAgent:\n        path: /agents/support/agent/subagents/deep/agent.ts\n        symbol: default\n`,
      '/moldea/agents/deep/description.md': 'Handles detailed requests.\n',
      '/moldea/agents/deep/instruction.md': 'You are the `deep` agent.\n',
      '/agents/support/agent/subagents/deep/agent.ts':
        "import { defineAgent } from 'eve'; export default defineAgent({ description: 'Handles detailed requests.', model: 'provider/model' });\n",
    });

    expect(result.diagnostics).toStrictEqual([]);
    expect(
      result.evidence
        .filter(({ kind }) => kind === 'handoff-registration')
        .map(({ agentId, details }) => [agentId, details['targetAgentId']]),
    ).toStrictEqual([
      ['support', 'deep'],
      ['support', 'research'],
    ]);
  });

  test('does not resolve an unregistered workspace peer', async () => {
    const result = await inspect(
      workspaceEntries(
        "import { defineWorkspaceAgent } from 'eve'; export default defineWorkspaceAgent({ name: 'research' });\n",
        false,
      ),
    );

    expect(result.evidence.some(({ kind }) => kind === 'handoff-registration')).toBe(false);
  });

  test('keeps a workspace peer with tool false callable but not model-visible', async () => {
    const result = await inspect(
      workspaceEntries(
        "import { defineWorkspaceAgent } from 'eve'; export default defineWorkspaceAgent({ name: 'research', tool: false });\n",
      ),
    );

    expect(result.diagnostics).toStrictEqual([]);
    expect(
      result.evidence.some(
        ({ agentId, kind }) => agentId === 'research' && kind === 'agent-definition',
      ),
    ).toBe(true);
    expect(result.evidence.some(({ kind }) => kind === 'handoff-registration')).toBe(false);
  });

  test.each([
    ['0.54.3', 'EVE_SDK_FEATURE_UNAVAILABLE'],
    ['>=0.54.3', 'EVE_RUNTIME_RELATIONSHIP_UNVERIFIED'],
    ['0.59.1', null],
  ])('classifies workspace peer tool visibility for Eve %s', async (version, expectedCode) => {
    const result = await inspect({
      ...workspaceEntries(
        "import { defineWorkspaceAgent } from 'eve'; export default defineWorkspaceAgent({ name: 'research', tool: false });\n",
      ),
      '/package.json': `{"name":"@acme/support-app","dependencies":{"eve":"${version}"}}`,
    });

    expect(result.diagnostics.map(({ code }) => code)).toStrictEqual(
      expectedCode === null ? [] : [expectedCode],
    );
    expect(result.evidence.some(({ kind }) => kind === 'handoff-registration')).toBe(false);
  });

  test.each([
    ['0.39.1', 'EVE_SDK_FEATURE_UNAVAILABLE'],
    ['>=0.39.1', 'EVE_RUNTIME_RELATIONSHIP_UNVERIFIED'],
  ])('does not claim a workspace peer across unsupported eve %s', async (version, code) => {
    const result = await inspect({
      ...workspaceEntries(
        "import { defineWorkspaceAgent } from 'eve'; export default defineWorkspaceAgent({ name: 'research' });\n",
      ),
      '/package.json': `{"name":"@acme/support-app","dependencies":{"eve":"${version}"}}`,
    });

    expect(result.diagnostics.map(({ code: observedCode }) => observedCode)).toContain(code);
    expect(result.evidence.some(({ kind }) => kind === 'handoff-registration')).toBe(false);
  });

  test('diagnoses a local subagent that collides with an eve framework tool', async () => {
    const source = fixture.entries.find(
      ({ path }) => path === '/agent/subagents/summary/agent.ts',
    )?.text;

    if (source === undefined) {
      throw new TypeError('The local-subagent fixture is missing.');
    }

    const result = await inspect({
      '/agent/subagents/summary/agent.ts': null,
      '/agent/subagents/bash/agent.ts': source,
      '/moldea/agents/bash/description.md': 'Runs shell tasks.\n',
      '/moldea/agents/bash/handoff-description.md': 'Summarizes a support request.\n',
      '/moldea/agents/bash/instruction.md': 'You are the `bash` agent.\n',
      '/moldea/agents/summary/description.md': null,
      '/moldea/agents/summary/handoff-description.md': null,
      '/moldea/agents/summary/instruction.md': null,
      '/moldea/moldea.yaml': fixture.manifest.replaceAll('summary', 'bash'),
    });

    expect(
      result.diagnostics.some(
        ({ code, entity }) =>
          code === 'EVE_TOOL_SUBAGENT_NAME_COLLISION' && entity?.agentId === 'bash',
      ),
    ).toBe(true);
    expect(
      result.evidence.some(
        ({ agentId, kind }) => agentId === 'bash' && kind === 'handoff-registration',
      ),
    ).toBe(false);
  });

  test.each([
    ['0.39.1', 'EVE_TOOL_SUBAGENT_NAME_COLLISION'],
    ['0.65.0', null],
    ['>=0.39.1', 'EVE_RUNTIME_RELATIONSHIP_UNVERIFIED'],
  ])('classifies the todo default for eve %s', async (version, expectedCode) => {
    const source = fixture.entries.find(
      ({ path }) => path === '/agent/subagents/summary/agent.ts',
    )?.text;

    if (source === undefined) {
      throw new TypeError('The local-subagent fixture is missing.');
    }

    const result = await inspect({
      '/package.json': `{"name":"@acme/support-app","dependencies":{"eve":"${version}"}}`,
      '/agent/subagents/summary/agent.ts': null,
      '/agent/subagents/todo/agent.ts': source,
      '/moldea/agents/summary/description.md': null,
      '/moldea/agents/summary/handoff-description.md': null,
      '/moldea/agents/summary/instruction.md': null,
      '/moldea/agents/todo/description.md': 'Summarizes support requests.\n',
      '/moldea/agents/todo/handoff-description.md': 'Summarizes a support request.\n',
      '/moldea/agents/todo/instruction.md': 'You are the `todo` agent.\n',
      '/moldea/moldea.yaml': fixture.manifest.replaceAll('summary', 'todo'),
    });
    const handoff = result.evidence.find(
      ({ agentId, kind }) => agentId === 'support' && kind === 'handoff-registration',
    );

    if (expectedCode === null) {
      expect(result.diagnostics).toStrictEqual([]);
    } else {
      expect(result.diagnostics.map(({ code }) => code)).toContain(expectedCode);
    }
    expect(handoff !== undefined).toBe(expectedCode === null);
  });

  test('does not expose a local subagent with tool false to the parent model', async () => {
    const result = await inspect({
      '/package.json': '{"name":"@acme/support-app","dependencies":{"eve":"0.59.1"}}',
      '/agent/subagents/summary/agent.ts': replaceFixture(
        '/agent/subagents/summary/agent.ts',
        "model: 'provider/model'",
        "model: 'provider/model', tool: false",
      ),
    });

    expect(result.diagnostics).toStrictEqual([]);
    expect(
      result.evidence.some(
        ({ agentId, kind }) => agentId === 'summary' && kind === 'agent-definition',
      ),
    ).toBe(true);
    expect(result.evidence.some(({ kind }) => kind === 'handoff-registration')).toBe(false);
  });

  test('propagates cancellation rather than returning partial evidence', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      createCore({ adapters: [eveAdapter] }).validateProject({
        repository: createMemoryRepositoryReader(createEntries()),
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: 'ABORTED' });
  });
});

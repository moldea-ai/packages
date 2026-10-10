// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, test } from 'vitest';

import { createNodeProjectInspection } from '@moldea.ai/core/node';

import {
  createTestCompositionState,
  INSTALLED_PACKAGE_METADATA,
} from '../composition/composition.test-fixtures.js';
import {
  createMemoryRepositoryReader,
  type IMemoryRepositoryEntry,
} from '@moldea.ai/repository/memory';

import {
  createMoldeaCliCoreInspectionExecutor,
  executeMoldeaCliCoreInspection,
} from './executor.js';

const RESOURCE_LIMITS = Object.freeze({
  maxDiagnostics: 32,
  maxEntries: 128,
  maxEvidence: 16,
  maxFileBytes: 4096,
  maxManifestBytes: 2048,
  maxTotalBytes: 16 * 1_048_576,
});

/** Creates one complete agent fixture for a runtime adapter. */
const createAgentEntries = (agentId: string): readonly IMemoryRepositoryEntry[] => [
  {
    content: `${agentId} agent.\n`,
    path: `/moldea/agents/${agentId}/description.md`,
    type: 'file' as const,
  },
  {
    content: `You are the \`${agentId}\` agent.\n`,
    path: `/moldea/agents/${agentId}/instruction.md`,
    type: 'file' as const,
  },
];

describe('CLI Core composition with the memory repository reader', () => {
  test('inspects a valid custom-agent project without a package-backed adapter', async () => {
    const reader = createMemoryRepositoryReader([
      {
        content: 'version: 1\nagents:\n  alpha:\n    runtime:\n      id: custom\n',
        path: '/moldea/moldea.yaml',
        type: 'file',
      },
      { content: '# Project\n', path: '/moldea/project.md', type: 'file' },
      {
        content: 'Alpha agent.\n',
        path: '/moldea/agents/alpha/description.md',
        type: 'file',
      },
      {
        content: 'You are the `alpha` agent.\n',
        path: '/moldea/agents/alpha/instruction.md',
        type: 'file',
      },
    ]);

    const result = await executeMoldeaCliCoreInspection({
      command: 'validate',
      repository: reader,
      resourceLimits: RESOURCE_LIMITS,
      packageMetadata: INSTALLED_PACKAGE_METADATA,
    });

    expect(result).toMatchObject({
      runtimeInspection: 'complete' as const,
      diagnostics: [],
      evidence: [],
      formatVersion: 1,
      summary: { counts: { agents: 1 } },
      valid: true,
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  test('runs the active OpenAI adapter through CLI composition', async () => {
    const reader = createMemoryRepositoryReader([
      {
        content: [
          'version: 1',
          'agents:',
          '  alpha:',
          '    runtime:',
          '      id: openai',
          '    bindings:',
          '      runtimeAgent:',
          '        path: /src/agent.ts',
          '        symbol: alphaAgent',
          '',
        ].join('\n'),
        path: '/moldea/moldea.yaml',
        type: 'file',
      },
      { content: '# Project\n', path: '/moldea/project.md', type: 'file' },
      ...createAgentEntries('alpha'),
      {
        content: '{"dependencies":{"openai":"^7.4.0"}}\n',
        path: '/package.json',
        type: 'file',
      },
      {
        content: [
          "import OpenAI from 'openai';",
          'const client = new OpenAI();',
          "export const alphaAgent = () => client.responses.create({ input: 'hello' });",
          '',
        ].join('\n'),
        path: '/src/agent.ts',
        type: 'file',
      },
    ]);

    const result = await executeMoldeaCliCoreInspection({
      command: 'validate',
      repository: reader,
      resourceLimits: RESOURCE_LIMITS,
      packageMetadata: INSTALLED_PACKAGE_METADATA,
    });

    expect(result).toMatchObject({
      diagnostics: [],
      evidence: [
        { agentId: 'alpha', kind: 'language', source: 'openai' },
        { kind: 'runtime-package', runtimeName: 'openai', source: 'openai' },
        { agentId: 'alpha', kind: 'runtime-pattern', source: 'openai' },
      ],
      summary: { counts: { agents: 1 } },
      valid: true,
    });
  });

  test('runs the active Eve adapter through CLI composition', async () => {
    const reader = createMemoryRepositoryReader([
      {
        content: [
          'version: 1',
          'agents:',
          '  alpha:',
          '    runtime:',
          '      id: eve',
          '    bindings:',
          '      runtimeAgent:',
          '        path: /agent/agent.ts',
          '        symbol: default',
          '',
        ].join('\n'),
        path: '/moldea/moldea.yaml',
        type: 'file',
      },
      { content: '# Project\n', path: '/moldea/project.md', type: 'file' },
      ...createAgentEntries('alpha'),
      {
        content: '{"name":"alpha-app","dependencies":{"eve":"0.39.1"}}\n',
        path: '/package.json',
        type: 'file',
      },
      {
        content: [
          "import { defineAgent } from 'eve';",
          'export default defineAgent({',
          "  description: 'Alpha agent.',",
          "  model: 'openai/gpt-5-mini',",
          '});',
          '',
        ].join('\n'),
        path: '/agent/agent.ts',
        type: 'file',
      },
    ]);

    const result = await executeMoldeaCliCoreInspection({
      command: 'validate',
      repository: reader,
      resourceLimits: RESOURCE_LIMITS,
      packageMetadata: INSTALLED_PACKAGE_METADATA,
    });

    expect(result).toMatchObject({
      diagnostics: [],
      evidence: [
        { agentId: 'alpha', kind: 'agent-definition', source: 'eve' },
        { agentId: 'alpha', kind: 'language', source: 'eve' },
        { kind: 'runtime-package', source: 'eve' },
      ],
      summary: { counts: { agents: 1 } },
      valid: true,
    });
  });

  test('runs the active LangChain adapter through CLI composition', async () => {
    const reader = createMemoryRepositoryReader([
      {
        content: [
          'version: 1',
          'agents:',
          '  alpha:',
          '    runtime:',
          '      id: langchain',
          '    bindings:',
          '      runtimeAgent:',
          '        path: /src/agent.ts',
          '        symbol: alphaAgent',
          '',
        ].join('\n'),
        path: '/moldea/moldea.yaml',
        type: 'file',
      },
      { content: '# Project\n', path: '/moldea/project.md', type: 'file' },
      ...createAgentEntries('alpha'),
      {
        content:
          '{"name":"alpha-app","dependencies":{"@langchain/core":"~1.2.8","langchain":"~1.5.9"}}\n',
        path: '/package.json',
        type: 'file',
      },
      {
        content: [
          "import { createAgent } from 'langchain';",
          "export const alphaAgent = createAgent({ model: 'provider:model' });",
          '',
        ].join('\n'),
        path: '/src/agent.ts',
        type: 'file',
      },
    ]);

    const result = await executeMoldeaCliCoreInspection({
      command: 'validate',
      repository: reader,
      resourceLimits: RESOURCE_LIMITS,
      packageMetadata: INSTALLED_PACKAGE_METADATA,
    });

    expect(result).toMatchObject({
      diagnostics: [],
      evidence: [
        { agentId: 'alpha', kind: 'agent-definition', source: 'langchain' },
        { agentId: 'alpha', kind: 'language', source: 'langchain' },
        { kind: 'runtime-package', runtimeName: '@langchain/core', source: 'langchain' },
        { kind: 'runtime-package', runtimeName: 'langchain', source: 'langchain' },
      ],
      summary: { counts: { agents: 1 } },
      valid: true,
    });
  });

  test('runs the active Google Gen AI adapter through CLI composition', async () => {
    const reader = createMemoryRepositoryReader([
      {
        content: [
          'version: 1',
          'agents:',
          '  alpha:',
          '    runtime:',
          '      id: google-genai',
          '    bindings:',
          '      runtimeAgent:',
          '        path: /src/agent.ts',
          '        symbol: alphaAgent',
          '',
        ].join('\n'),
        path: '/moldea/moldea.yaml',
        type: 'file',
      },
      { content: '# Project\n', path: '/moldea/project.md', type: 'file' },
      ...createAgentEntries('alpha'),
      {
        content: '{"dependencies":{"@google/genai":"2.17.1"}}\n',
        path: '/package.json',
        type: 'file',
      },
      {
        content: [
          "import { GoogleGenAI } from '@google/genai';",
          'const client = new GoogleGenAI();',
          "export const alphaAgent = () => client.models.generateContent({ contents: 'hello' });",
          '',
        ].join('\n'),
        path: '/src/agent.ts',
        type: 'file',
      },
    ]);

    const result = await executeMoldeaCliCoreInspection({
      command: 'validate',
      repository: reader,
      resourceLimits: RESOURCE_LIMITS,
      packageMetadata: INSTALLED_PACKAGE_METADATA,
    });

    expect(result).toMatchObject({
      diagnostics: [],
      evidence: [
        { agentId: 'alpha', kind: 'language', source: 'google-genai' },
        { kind: 'runtime-package', runtimeName: '@google/genai', source: 'google-genai' },
        { agentId: 'alpha', kind: 'runtime-pattern', source: 'google-genai' },
      ],
      summary: { counts: { agents: 1 } },
      valid: true,
    });
  });

  test('combines isolated adapters while universal failure remains all-or-nothing', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'moldea-cli-registry-'));
    const registryPath = path.join(directory, 'registry.mjs');
    const ids = createTestCompositionState().activeAdapters.map(({ id }) => id);
    await writeFile(
      registryPath,
      `export const adapters = ${JSON.stringify(ids)}.map((id) => ({
      id, supportedRepositoryFormatVersions: [1], inspect: async (context) => ({
        diagnostics: id === 'openai' ? [{ code: 'OPENAI_TEST_DIAGNOSTIC', details: {},
          entity: { adapterId: id, agentId: context.agent.id }, message: 'Fixture diagnostic.',
          path: null, pointer: null, range: null, severity: 'error', source: id }] : [],
        evidence: id === 'anthropic' ? [{ agentId: context.agent.id, capabilityId: null,
          capabilityKind: null, details: { observed: true }, kind: 'agent-definition',
          references: [{ path: '/moldea/project.md' }], runtimeName: 'AnthropicFixture', source: id }] : [],
      }),
    }));`,
    );
    try {
      const executeInspection = createMoldeaCliCoreInspectionExecutor(
        createNodeProjectInspection,
        pathToFileURL(registryPath),
      );
      const entries = [
        {
          content: [
            'version: 1',
            'agents:',
            '  alpha:',
            '    runtime:',
            '      id: anthropic',
            '  zeta:',
            '    runtime:',
            '      id: openai',
            '',
          ].join('\n'),
          path: '/moldea/moldea.yaml',
          type: 'file' as const,
        },
        { content: '# Project\n', path: '/moldea/project.md', type: 'file' as const },
        ...createAgentEntries('alpha'),
        ...createAgentEntries('zeta'),
      ];

      const result = await executeInspection({
        command: 'validate',
        repository: createMemoryRepositoryReader(entries),
        resourceLimits: RESOURCE_LIMITS,
        packageMetadata: INSTALLED_PACKAGE_METADATA,
      });

      expect(result).toMatchObject({
        diagnostics: [{ code: 'OPENAI_TEST_DIAGNOSTIC', source: 'openai' }],
        evidence: [{ kind: 'agent-definition', source: 'anthropic' }],
        summary: { counts: { agents: 2 } },
        valid: false,
      });

      const universalFailure = await executeInspection({
        command: 'validate',
        repository: createMemoryRepositoryReader(
          entries.filter(({ path }) => path !== '/moldea/project.md'),
        ),
        resourceLimits: RESOURCE_LIMITS,
        packageMetadata: INSTALLED_PACKAGE_METADATA,
      });

      expect(universalFailure).toMatchObject({ evidence: [], summary: null, valid: false });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

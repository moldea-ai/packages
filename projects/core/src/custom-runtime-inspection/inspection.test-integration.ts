// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { parseRepositoryPath } from '@moldea.ai/repository';

import { createMemoryRepositoryReader } from '../repository.test-fixtures.js';

import type { IAgentManifestEntry } from '../format/index.js';
import { createCore } from '../index.js';

const sourcePath = parseRepositoryPath('/src/custom.ts');
const reference = { path: sourcePath, symbol: 'implementation' };

const createRepository = (declaration: IAgentManifestEntry, instruction?: string) =>
  createMemoryRepositoryReader([
    {
      content: JSON.stringify({ version: 1, agents: { 'custom-agent': declaration } }),
      path: '/moldea/moldea.yaml',
      type: 'file',
    },
    { content: '# Project\n', path: '/moldea/project.md', type: 'file' },
    {
      content: 'A custom runtime agent.\n',
      path: '/moldea/agents/custom-agent/description.md',
      type: 'file',
    },
    {
      content: instruction ?? 'You are the `custom-agent` agent.\n',
      path: '/moldea/agents/custom-agent/instruction.md',
      type: 'file',
    },
    { content: 'export const implementation = {};\n', path: sourcePath, type: 'file' },
  ]);

const declaration: IAgentManifestEntry = {
  runtime: { id: 'custom' },
  bindings: {
    runtimeAgent: reference,
    instructionLoader: reference,
    inputSchema: reference,
    outputSchema: reference,
    variableProviders: { REGION: reference },
  },
  variables: { REGION: { description: 'The deployment region.' } },
  tools: {
    audit: {
      name: 'auditRecords',
      description: 'Audits records.',
      implementation: reference,
      registration: reference,
      inputSchema: reference,
      outputSchema: reference,
    },
  },
  skills: {
    triage: {
      name: 'triage-records',
      description: 'Triages records.',
      implementation: reference,
      registration: reference,
    },
  },
};

describe('reserved custom runtime relationship accounting', () => {
  test('warns once per declared relationship and preserves status across every view and page', async () => {
    const repository = createRepository(
      declaration,
      'You are the `custom-agent` agent.\nOperate in {{REGION}}.\n',
    );
    const core = createCore();
    const result = await core.validateProject({ repository });
    expect(result.valid).toBe(true);
    expect(result.runtimeInspection).toBe('incomplete');
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(11);
    expect(result.evidence).toStrictEqual([]);
    expect(
      result.diagnostics.map((diagnostic) => diagnostic.details['relationship']).sort(),
    ).toStrictEqual([
      'agent-input-schema',
      'agent-output-schema',
      'instruction-loader',
      'runtime-agent',
      'skill-implementation',
      'skill-registration',
      'tool-implementation',
      'tool-input-schema',
      'tool-output-schema',
      'tool-registration',
      'variable-provider',
    ]);
    expect(
      result.diagnostics.every(
        (diagnostic) =>
          diagnostic.code === 'CUSTOM_RUNTIME_RELATIONSHIP_UNVERIFIED' &&
          diagnostic.message === 'The declared runtime relationship could not be verified.' &&
          diagnostic.source === 'custom' &&
          diagnostic.severity === 'warning',
      ),
    ).toBe(true);

    const inspection = await core.createProjectInspection({ repository });
    for (const view of ['all', 'metadata', 'diagnostics', 'evidence'] as const) {
      let cursor: string | undefined;
      do {
        const page = inspection.readPage({
          ...(cursor === undefined ? {} : { cursor }),
          maxItems: 2,
          view,
        });
        expect(page.runtimeInspection).toBe('incomplete');
        expect(page.valid).toBe(true);
        expect(page.counts).toMatchObject({ errors: 0, warnings: 11 });
        expect(page.inspectionDigest).toBe(inspection.inspectionDigest);
        cursor = page.page.nextCursor ?? undefined;
      } while (cursor !== undefined);
    }
  });

  test('creates no runtime warnings for a custom agent without declared relationships', async () => {
    const result = await createCore().validateProject({
      repository: createRepository({ runtime: { id: 'custom' } }),
    });
    expect(result).toMatchObject({
      diagnostics: [],
      runtimeInspection: 'complete',
      valid: true,
      warningCount: 0,
    });
  });

  test('does not run custom relationship checks when universal validation fails', async () => {
    const result = await createCore().validateProject({
      repository: createRepository(declaration),
    });
    expect(result.valid).toBe(false);
    expect(result.runtimeInspection).toBe('not-run');
    expect(result.warningCount).toBe(0);
    expect(
      result.diagnostics.some((diagnostic) => diagnostic.code === 'MOLDEA_VARIABLE_UNUSED'),
    ).toBe(true);
  });

  test('uses the same raw diagnostic allowance as all other runtime inspection', async () => {
    await expect(
      createCore({ limits: { maxDiagnostics: 10 } }).validateProject({
        repository: createRepository(
          declaration,
          'You are the `custom-agent` agent.\nOperate in {{REGION}}.\n',
        ),
      }),
    ).rejects.toMatchObject({
      code: 'RESOURCE_LIMIT_EXCEEDED',
      limit: 'maxDiagnostics',
      limitMaximum: 10,
      observedUsage: 11,
    });
  });
});

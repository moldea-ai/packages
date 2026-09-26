// @vitest-environment node
import { describe, expect, test } from 'vitest';

import type {
  IContentDigest,
  IProjectInspectionPageResult,
  IProjectValidationResult,
} from '@moldea.ai/core';
import { parseRepositoryPath } from '@moldea.ai/repository';

import {
  createMoldeaCliInspectProjection,
  createMoldeaCliValidateProjection,
} from './transformers.js';

const SOURCE = Object.freeze({ id: 'memory:presentation', sourceKind: 'memory' });

describe('schema 5 presentation projections', () => {
  test('projects a bounded Core page without canonical bodies or arbitrary details', () => {
    const inspection: IProjectInspectionPageResult = {
      counts: {
        agents: 1,
        context: 0,
        decisions: 0,
        diagnostics: 0,
        errors: 0,
        evidence: 1,
        metadata: 1,
        warnings: 0,
        mirrors: 0,
        runtimes: 0,
        unresolved: 0,
      },
      formatVersion: 1,
      inspectionDigest: `sha256:${'c'.repeat(64)}`,
      page: {
        isComplete: true,
        nextCursor: null,
        records: [
          {
            item: {
              agent: { agentId: 'assistant', runtimeId: 'openai' },
              kind: 'agent',
            },
            nextCursor: 'agent-cursor',
          },
          {
            item: {
              evidence: {
                agentId: null,
                capabilityId: null,
                capabilityKind: null,
                details: { content: 'must not escape', large: 'x'.repeat(10_000) },
                kind: 'runtime-package',
                references: [{ path: parseRepositoryPath('/package.json') }],
                runtimeName: 'custom',
                source: 'custom',
              },
              kind: 'evidence',
            },
            nextCursor: null,
          },
        ],
        totalItems: 2,
      },
      source: SOURCE,
      summary: {
        counts: {
          agents: 0,
          context: 0,
          decisions: 0,
          mirrors: 0,
          runtimes: 0,
          unresolved: 0,
        },
        manifestDigest: `sha256:${'a'.repeat(64)}` as IContentDigest,
        manifestPath: parseRepositoryPath('/moldea/moldea.yaml'),
        projectDigest: `sha256:${'b'.repeat(64)}` as IContentDigest,
        projectPath: parseRepositoryPath('/moldea/project.md'),
      },
      valid: true,
      view: 'all',
    };
    const projection = createMoldeaCliInspectProjection(inspection);
    const serialized = JSON.stringify(projection.records);

    expect(projection.counts).toStrictEqual(inspection.counts);
    expect(projection.records).toStrictEqual([
      expect.objectContaining({ agentId: 'assistant', kind: 'agent', runtimeId: 'openai' }),
      expect.objectContaining({
        evidenceKind: 'runtime-package',
        kind: 'evidence',
        references: [{ path: '/package.json', symbol: null }],
      }),
    ]);
    expect(projection.records[0]).toStrictEqual({
      agentId: 'assistant',
      key: '["000000","agent","assistant","openai"]',
      kind: 'agent',
      runtimeId: 'openai',
    });
    expect(serialized).not.toContain('must not escape');
    expect(serialized).not.toContain('"details"');
    expect(projection.snapshotDigest).toBe(inspection.inspectionDigest);
  });

  test('projects invalid diagnostics without arbitrary detail fields', () => {
    const validation: IProjectValidationResult = {
      diagnostics: [
        {
          code: 'MOLDEA_MANIFEST_MISSING',
          details: { content: 'private source detail' },
          entity: null,
          message: 'The project manifest is missing.',
          path: parseRepositoryPath('/moldea/moldea.yaml'),
          pointer: null,
          range: null,
          severity: 'error',
          source: 'core',
        },
      ],
      errorCount: 1,
      evidence: [],
      formatVersion: null,
      source: SOURCE,
      summary: null,
      valid: false,
      warningCount: 0,
    };
    const projection = createMoldeaCliValidateProjection(validation);

    expect(projection.diagnostics).toHaveLength(1);
    expect(projection.diagnostics[0]).not.toHaveProperty('details');
    expect(projection.diagnostics[0]).toMatchObject({
      code: 'MOLDEA_MANIFEST_MISSING',
      kind: 'diagnostic',
      severity: 'error',
    });
  });

  test('projects only the approved warning context and complete counts', () => {
    const validation: IProjectValidationResult = {
      diagnostics: [
        {
          code: 'ANTHROPIC_RUNTIME_RELATIONSHIP_UNVERIFIED',
          details: {
            relationship: 'instruction-loader',
            reason: 'version-dependent-behavior',
            packageName: '@anthropic-ai/sdk',
            declaredRange: null,
            boundaryVersion: '1.2.3',
          },
          entity: { agentId: 'support' },
          message: 'The declared runtime relationship could not be verified.',
          path: parseRepositoryPath('/src/agent.ts'),
          pointer: null,
          range: null,
          severity: 'warning',
          source: 'anthropic',
        },
      ],
      errorCount: 0,
      evidence: [],
      formatVersion: 1,
      source: SOURCE,
      summary: {
        counts: { agents: 1, context: 0, decisions: 0, mirrors: 0, runtimes: 0, unresolved: 0 },
        manifestDigest: `sha256:${'a'.repeat(64)}` as IContentDigest,
        manifestPath: parseRepositoryPath('/moldea/moldea.yaml'),
        projectDigest: `sha256:${'b'.repeat(64)}` as IContentDigest,
        projectPath: parseRepositoryPath('/moldea/project.md'),
      },
      valid: true,
      warningCount: 1,
    };
    const projection = createMoldeaCliValidateProjection(validation);

    expect(projection).toMatchObject({ errorCount: 0, valid: true, warningCount: 1 });
    expect(projection.diagnostics[0]).toMatchObject({
      severity: 'warning',
      details: validation.diagnostics[0]?.details,
    });
    expect(Object.keys(projection.diagnostics[0] ?? {}).sort()).toStrictEqual([
      'code',
      'details',
      'entity',
      'key',
      'kind',
      'message',
      'path',
      'pointer',
      'range',
      'severity',
      'source',
    ]);
  });

  test('rejects contradictory validation results', () => {
    expect(() =>
      createMoldeaCliValidateProjection({
        diagnostics: [],
        errorCount: 0,
        evidence: [],
        formatVersion: null,
        source: SOURCE,
        summary: null,
        valid: false,
        warningCount: 0,
      }),
    ).toThrow('The Core validation result is internally inconsistent.');
  });
});

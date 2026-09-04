// @vitest-environment node
import { describe, expect, test } from 'vitest';

import type { IContentDigest, IIndexedTextAsset, IProjectInspectionResult } from '@moldea.ai/core';
import { parseRepositoryPath } from '@moldea.ai/repository';

import {
  createMoldeaCliInspectProjection,
  createMoldeaCliValidateProjection,
} from './transformers.js';

const createAsset = (path: string, content: string): IIndexedTextAsset => ({
  content,
  digest: `sha256:${'a'.repeat(64)}` as IContentDigest,
  path: parseRepositoryPath(path),
  scalarLength: Array.from(content).length,
  utf8ByteLength: Buffer.byteLength(content, 'utf8'),
});

const createValidInspection = (): IProjectInspectionResult => {
  const manifest = createAsset('/moldea/moldea.yaml', 'version: 1\n');
  const project = createAsset('/moldea/project.md', '# Distinct canonical project body\n');

  return {
    diagnostics: [],
    evidence: [
      {
        agentId: null,
        capabilityId: null,
        capabilityKind: null,
        details: { content: 'must not escape', large: 'x'.repeat(10_000) },
        kind: 'runtime-package',
        references: [{ path: parseRepositoryPath('/package.json') }],
        runtimeName: 'custom',
        source: 'custom',
      },
    ],
    formatVersion: 1,
    project: {
      agents: [],
      context: [],
      decisions: [],
      formatVersion: 1,
      manifest: { asset: manifest, value: { version: 1 } },
      project,
      runtimes: [],
      unresolved: {},
    },
    valid: true,
  };
};

describe('schema 3 presentation projections', () => {
  test('projects valid inspection through a content-free metadata allowlist', () => {
    const projection = createMoldeaCliInspectProjection(createValidInspection());
    const serialized = JSON.stringify(projection.records);

    expect(projection.counts).toStrictEqual({
      agents: 0,
      context: 0,
      decisionSupersessions: 0,
      decisions: 0,
      diagnostics: 0,
      evidence: 1,
      evidenceReferences: 1,
      mirrors: 0,
      relationships: 0,
      requirements: 0,
      runtimes: 0,
      unresolved: 0,
    });
    expect(projection.project?.project).toMatchObject({
      path: '/moldea/project.md',
      scalarLength: 34,
    });
    expect(serialized).not.toContain('Distinct canonical project body');
    expect(serialized).not.toContain('must not escape');
    expect(serialized).not.toContain('"details"');
    expect(projection.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'evidence', referenceCount: 1 }),
        expect.objectContaining({ kind: 'evidence-reference', path: '/package.json' }),
      ]),
    );
    expect(projection.snapshotDigest).toMatch(/^sha256:[0-9a-f]{64}$/u);
  });

  test('projects invalid diagnostics without arbitrary detail fields', () => {
    const inspection: IProjectInspectionResult = {
      diagnostics: [
        {
          code: 'MOLDEA_MANIFEST_MISSING',
          details: { content: 'private source detail' },
          entity: null,
          message: 'The project manifest is missing.',
          path: parseRepositoryPath('/moldea/moldea.yaml'),
          pointer: null,
          range: null,
          source: 'core',
        },
      ],
      evidence: [],
      formatVersion: null,
      project: null,
      valid: false,
    };
    const projection = createMoldeaCliValidateProjection(inspection);

    expect(projection.diagnostics).toHaveLength(1);
    expect(projection.diagnostics[0]).not.toHaveProperty('details');
    expect(projection.diagnostics[0]).toMatchObject({
      code: 'MOLDEA_MANIFEST_MISSING',
      kind: 'diagnostic',
    });
  });

  test.each([
    { diagnostics: [], evidence: [], formatVersion: 1 as const, project: null, valid: true },
    { diagnostics: [], evidence: [], formatVersion: null, project: null, valid: false },
  ])('rejects contradictory Core result %#', (inspection) => {
    expect(() => createMoldeaCliInspectProjection(inspection)).toThrow(
      'The Core inspection result is internally inconsistent.',
    );
  });
});

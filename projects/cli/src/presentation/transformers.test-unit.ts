// @vitest-environment node
import { describe, expect, test } from 'vitest';

import type {
  IBindingCoverage,
  IContentDigest,
  ICoreDiagnostic,
  IProjectValidationResult,
} from '@moldea.ai/core';
import { parseRepositoryPath } from '@moldea.ai/repository';

import type { IMoldeaCliCoreInspectPage } from '../core-composition/index.js';

import {
  createMoldeaCliInspectProjection,
  createMoldeaCliValidateProjection,
} from './transformers.js';

const SOURCE = { id: 'memory:presentation', sourceKind: 'memory' };
const COVERAGE: IBindingCoverage = {
  entity: { agentId: 'assistant' },
  relationship: 'runtime-agent',
  path: '/src/agent.ts',
  symbol: 'agent',
  fileCheck: 'passed',
  exportCheck: 'not-checked',
  exportNotCheckedReason: 'unresolved-exports',
};
const COVERAGE_COUNTS = { bindings: 1, exportsPassed: 0, exportsFailed: 0, exportsNotChecked: 1 };
const SUMMARY = {
  counts: { agents: 1, context: 0, decisions: 0, mirrors: 0 },
  manifestDigest: `sha256:${'a'.repeat(64)}` as IContentDigest,
  manifestPath: parseRepositoryPath('/moldea/moldea.yaml'),
  projectDigest: `sha256:${'b'.repeat(64)}` as IContentDigest,
  projectPath: parseRepositoryPath('/moldea/project.md'),
};
const WARNING = {
  code: 'MOLDEA_INTEGRATION_BLOCK_MISSING',
  group: 'integration',
  severity: 'warning',
  source: 'core',
  subject: parseRepositoryPath('/AGENTS.md'),
  qualifier: null,
  acceptable: true,
  entity: { integrationPath: parseRepositoryPath('/AGENTS.md') },
  path: parseRepositoryPath('/AGENTS.md'),
  pointer: null,
  range: null,
  message: 'The AGENTS.md moldea block is missing.',
  details: { content: 'private detail' },
} as const satisfies ICoreDiagnostic;
const createValidation = (
  diagnostics: ICoreDiagnostic[] = [WARNING],
): IProjectValidationResult => ({
  diagnostics,
  coverage: [COVERAGE],
  coverageCounts: COVERAGE_COUNTS,
  diagnosticCount: diagnostics.length,
  acceptedWarningCount: diagnostics.filter(
    (diagnostic) => diagnostic.severity === 'warning' && diagnostic.accepted,
  ).length,
  errorCount: diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length,
  warningCount: diagnostics.filter(
    (diagnostic) => diagnostic.severity === 'warning' && !diagnostic.accepted,
  ).length,
  formatVersion: 1,
  source: SOURCE,
  summary: SUMMARY,
  valid: !diagnostics.some((diagnostic) => diagnostic.severity === 'error'),
});

describe('schema 9 presentation projections', () => {
  test('projects a bounded inventory with global ordinal keys and independent source cursors', () => {
    const inspection: IMoldeaCliCoreInspectPage = {
      coverageCounts: COVERAGE_COUNTS,
      counts: {
        ...SUMMARY.counts,
        diagnostics: 1,
        errors: 0,
        warnings: 1,
        acceptedWarnings: 0,
        coverage: 1,
        metadata: 37,
      },
      formatVersion: 1,
      inspectionDigest: `sha256:${'c'.repeat(64)}`,
      startIndex: 36,
      valid: true,
      records: [
        {
          item: {
            kind: 'metadata',
            metadata: {
              agentId: 'assistant',
              byteLength: 51,
              canonicalDigest: SUMMARY.projectDigest,
              decisionId: null,
              digest: SUMMARY.projectDigest,
              kind: 'agent-instruction',
              path: parseRepositoryPath('/moldea/agents/assistant/instruction.md'),
              scalarLength: 49,
            },
          },
          nextCursor: 'diagnostics-start',
        },
        { item: { kind: 'diagnostic', diagnostic: WARNING }, nextCursor: null },
      ],
    };
    const projection = createMoldeaCliInspectProjection(inspection);
    expect(projection.counts).toStrictEqual(inspection.counts);
    expect(projection.coverageCounts).toStrictEqual(COVERAGE_COUNTS);
    expect(projection.records[0]).toStrictEqual({
      agentId: 'assistant',
      byteLength: 51,
      decisionId: null,
      key: '00000000010',
      kind: 'metadata',
      metadataKind: 'agent-instruction',
      path: '/moldea/agents/assistant/instruction.md',
    });
    expect(projection.records[1]).toMatchObject({ kind: 'diagnostic', key: '00000000011' });
    expect(projection.getSourceCursor(projection.records[0]!)).toBe('diagnostics-start');
    expect(projection.getSourceCursor(projection.records[1]!)).toBeNull();
    expect(projection.snapshotDigest).toBe(inspection.inspectionDigest);
  });

  test('preserves full coverage totals but only pages failed and unchecked checks', () => {
    const result = createMoldeaCliValidateProjection({
      ...createValidation([]),
      coverage: [
        { ...COVERAGE, exportCheck: 'passed' },
        { ...COVERAGE, exportCheck: 'failed' },
        COVERAGE,
      ],
      coverageCounts: { bindings: 3, exportsPassed: 1, exportsFailed: 1, exportsNotChecked: 1 },
    });
    expect(result.coverageCounts).toStrictEqual({
      bindings: 3,
      exportsPassed: 1,
      exportsFailed: 1,
      exportsNotChecked: 1,
    });
    expect(result.records).toMatchObject([
      { key: '00000000000', kind: 'coverage', exportCheck: 'failed' },
      {
        key: '00000000001',
        kind: 'coverage',
        exportCheck: 'not-checked',
        exportNotCheckedReason: 'unresolved-exports',
      },
    ]);
  });

  test('projects warning identity and acceptance without arbitrary detail payloads', () => {
    const projection = createMoldeaCliValidateProjection(createValidation());
    expect(projection).toMatchObject({
      diagnosticCount: 1,
      errorCount: 0,
      warningCount: 1,
      acceptedWarningCount: 0,
      coverageCounts: COVERAGE_COUNTS,
    });
    expect(projection.records).toContainEqual(
      expect.objectContaining({
        kind: 'diagnostic',
        group: 'integration',
        severity: 'warning',
        subject: parseRepositoryPath('/AGENTS.md'),
        qualifier: null,
        acceptable: true,
        accepted: false,
        reason: null,
      }),
    );
    expect(JSON.stringify(projection)).not.toContain('private detail');
    expect(JSON.stringify(projection)).not.toContain('"details"');
  });

  test('counts mixed errors, unaccepted warnings, and accepted warnings separately', () => {
    const error: ICoreDiagnostic = {
      code: 'MOLDEA_MANIFEST_MISSING',
      severity: 'error',
      group: 'discovery',
      source: 'core',
      path: parseRepositoryPath('/moldea/moldea.yaml'),
      pointer: null,
      range: null,
      entity: null,
      message: 'The project manifest is missing.',
      details: { content: 'private error' },
    };
    const accepted: ICoreDiagnostic = {
      ...WARNING,
      accepted: true,
      reason: 'Instructions are shared.',
    };
    const result = createMoldeaCliValidateProjection(createValidation([error, WARNING, accepted]));
    expect(result).toMatchObject({
      valid: false,
      diagnosticCount: 3,
      errorCount: 1,
      warningCount: 1,
      acceptedWarningCount: 1,
    });
    expect(result.records).toContainEqual(
      expect.objectContaining({ accepted: true, reason: 'Instructions are shared.' }),
    );
    expect(new Set(result.records.map((record) => record.key)).size).toBe(result.records.length);
    expect(result.records.map((record) => record.kind)).toStrictEqual([
      'diagnostic',
      'diagnostic',
      'diagnostic',
      'coverage',
    ]);
    expect(result.records.map((record) => record.key)).toStrictEqual(
      [...result.records.map((record) => record.key)].sort(),
    );
    expect(JSON.stringify(result)).not.toContain('private error');
  });

  test('acceptance reasons participate in snapshot identity', () => {
    const first = createMoldeaCliValidateProjection(
      createValidation([{ ...WARNING, accepted: true, reason: 'First reason.' }]),
    );
    const second = createMoldeaCliValidateProjection(
      createValidation([{ ...WARNING, accepted: true, reason: 'Second reason.' }]),
    );
    expect(first.snapshotDigest).not.toBe(second.snapshotDigest);
  });

  test.each([
    { warningCount: 0 },
    { acceptedWarningCount: 1 },
    { diagnosticCount: 0 },
    { valid: false },
  ])('rejects contradictory validation totals %o', (override) => {
    expect(() => createMoldeaCliValidateProjection({ ...createValidation(), ...override })).toThrow(
      'The Core validation result is internally inconsistent.',
    );
  });
});

// @vitest-environment node
import { describe, expect, test, vi } from 'vitest';

import type { IProjectInspectionPageResult, IProjectValidationResult } from '@moldea.ai/core';
import type { INodeProjectInspection } from '@moldea.ai/core/node';
import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';

import {
  createTestCompositionState,
  INSTALLED_PACKAGE_METADATA,
} from '../composition/composition.test-fixtures.js';
import { createMoldeaCliCoreInspectionExecutor } from './executor.js';
import type { IMoldeaCliNodeInspectionFactory } from './types.js';

const RESOURCE_LIMITS = Object.freeze({
  maxDiagnostics: 32,
  maxEntries: 128,
  maxEvidence: 16,
  maxFileBytes: 4096,
  maxManifestBytes: 2048,
  maxTotalBytes: 8192,
});

const SOURCE = Object.freeze({ id: 'memory:test', sourceKind: 'memory' });
const VALIDATION_RESULT = Object.freeze({
  runtimeInspection: 'not-run' as const,
  diagnostics: Object.freeze([]),
  errorCount: 0,
  evidence: Object.freeze([]),
  formatVersion: null,
  source: SOURCE,
  summary: null,
  valid: false,
  warningCount: 0,
}) satisfies IProjectValidationResult;
const INSPECTION_RESULT = Object.freeze({
  runtimeInspection: 'not-run' as const,
  counts: Object.freeze({
    agents: 0,
    context: 0,
    decisions: 0,
    diagnostics: 0,
    errors: 0,
    evidence: 0,
    metadata: 0,
    warnings: 0,
    mirrors: 0,
    runtimes: 0,
    unresolved: 0,
  }),
  formatVersion: null,
  inspectionDigest: `sha256:${'1'.repeat(64)}`,
  page: Object.freeze({
    isComplete: true,
    nextCursor: null,
    records: Object.freeze([]),
    totalItems: 0,
  }),
  source: SOURCE,
  summary: null,
  valid: false,
  view: 'all',
}) satisfies IProjectInspectionPageResult;
const PROJECT_INSPECTION = Object.freeze({
  runtimeInspection: 'not-run' as const,
  counts: INSPECTION_RESULT.counts,
  formatVersion: INSPECTION_RESULT.formatVersion,
  inspectionDigest: INSPECTION_RESULT.inspectionDigest,
  readPage: vi.fn<INodeProjectInspection['readPage']>().mockResolvedValue(INSPECTION_RESULT),
  resourceUsage: Object.freeze({
    canonicalBytes: 0,
    peakRetainedBytes: 512,
    preparedBytes: 512,
    retainedBytes: 512,
    totalBytesRead: 0,
  }),
  source: SOURCE,
  summary: null,
  valid: false,
  adapters: createTestCompositionState().activeAdapters,
  maxAnalysisHeapBytes: 560 * 1_048_576,
  dispose: vi.fn<INodeProjectInspection['dispose']>().mockResolvedValue(undefined),
}) satisfies INodeProjectInspection;

const REGISTRY_URL = new URL('file:///installed-registry.mjs');
const createInput = () => ({
  command: 'validate' as const,
  repository: createMemoryRepositoryReader([]),
  packageMetadata: INSTALLED_PACKAGE_METADATA,
  resourceLimits: RESOURCE_LIMITS,
});

const createInspectionDouble = () => ({
  ...PROJECT_INSPECTION,
  readPage: vi.fn<INodeProjectInspection['readPage']>().mockResolvedValue(INSPECTION_RESULT),
  dispose: vi.fn<INodeProjectInspection['dispose']>().mockResolvedValue(undefined),
});

describe('createMoldeaCliCoreInspectionExecutor', () => {
  test('passes exact limits and caller cancellation to the isolated boundary', async () => {
    const inspection = createInspectionDouble();
    const factory = vi.fn<IMoldeaCliNodeInspectionFactory>().mockResolvedValue(inspection);
    const execute = createMoldeaCliCoreInspectionExecutor(factory, REGISTRY_URL);
    const controller = new AbortController();
    const input = { ...createInput(), signal: controller.signal };
    await expect(execute(input)).resolves.toStrictEqual(VALIDATION_RESULT);
    expect(factory).toHaveBeenCalledWith({
      adapterRegistryUrl: REGISTRY_URL,
      repository: input.repository,
      signal: controller.signal,
      limits: {
        maxDiagnostics: 32,
        maxEntries: 128,
        maxEvidence: 16,
        maxFileBytes: 4096,
        maxManifestBytes: 2048,
        maxRetainedBytes: 32_768,
        maxTotalBytesRead: 8192,
      },
    });
    expect(inspection.readPage.mock.calls.map(([page]) => page.view)).toStrictEqual([
      'diagnostics',
      'evidence',
    ]);
    expect(inspection.dispose).toHaveBeenCalledTimes(1);
  });

  test('passes the opaque cursor to asynchronous inspect paging and disposes before returning', async () => {
    const inspection = createInspectionDouble();
    const execute = createMoldeaCliCoreInspectionExecutor(
      () => Promise.resolve(inspection),
      REGISTRY_URL,
    );
    await expect(execute({ ...createInput(), command: 'inspect', cursor: 'opaque' })).resolves.toBe(
      INSPECTION_RESULT,
    );
    expect(inspection.readPage).toHaveBeenCalledWith({
      cursor: 'opaque',
      maxItems: 128,
      view: 'all',
    });
    expect(inspection.dispose).toHaveBeenCalledTimes(1);
  });

  test('disposes failed paging without reporting success', async () => {
    const inspection = createInspectionDouble();
    const cause = new Error('page failed');
    inspection.readPage.mockRejectedValue(cause);
    const execute = createMoldeaCliCoreInspectionExecutor(
      () => Promise.resolve(inspection),
      REGISTRY_URL,
    );
    await expect(execute(createInput())).rejects.toBe(cause);
    expect(inspection.dispose).toHaveBeenCalledTimes(1);
  });

  test('does not publish a result when disposal detects terminal failure', async () => {
    const inspection = createInspectionDouble();
    const cause = new Error('child lost');
    inspection.dispose.mockRejectedValue(cause);
    const execute = createMoldeaCliCoreInspectionExecutor(
      () => Promise.resolve(inspection),
      REGISTRY_URL,
    );
    await expect(execute(createInput())).rejects.toBe(cause);
  });

  test('rejects actual installed adapter mismatch and still disposes', async () => {
    const inspection = { ...createInspectionDouble(), adapters: [] };
    const execute = createMoldeaCliCoreInspectionExecutor(
      () => Promise.resolve(inspection),
      REGISTRY_URL,
    );
    await expect(execute(createInput())).rejects.toMatchObject({
      code: 'COMPOSITION_STATE_INVALID',
    });
    expect(inspection.dispose).toHaveBeenCalledTimes(1);
  });
});

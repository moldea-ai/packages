// @vitest-environment node
import { describe, expect, test, vi } from 'vitest';

import type {
  ICore,
  IProjectInspection,
  IProjectInspectionPageResult,
  IProjectValidationResult,
} from '@moldea.ai/core';
import type { IRuntimeAdapter } from '@moldea.ai/core/adapter';
import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';

import { ACTIVE_RUNTIME_ADAPTERS } from './constants.js';
import { createMoldeaCliCoreInspectionExecutor } from './executor.js';
import type { IMoldeaCliCoreFactory } from './types.js';

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
  diagnostics: Object.freeze([]),
  evidence: Object.freeze([]),
  formatVersion: null,
  source: SOURCE,
  summary: null,
  valid: false,
}) satisfies IProjectValidationResult;
const INSPECTION_RESULT = Object.freeze({
  counts: Object.freeze({
    agents: 0,
    context: 0,
    decisions: 0,
    diagnostics: 0,
    evidence: 0,
    metadata: 0,
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
  counts: INSPECTION_RESULT.counts,
  formatVersion: INSPECTION_RESULT.formatVersion,
  inspectionDigest: INSPECTION_RESULT.inspectionDigest,
  readPage: vi.fn<IProjectInspection['readPage']>().mockReturnValue(INSPECTION_RESULT),
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
}) satisfies IProjectInspection;

/** Creates a complete Core double around the two CLI project operations. */
const createCoreDouble = () => {
  const createProjectInspection = vi
    .fn<ICore['createProjectInspection']>()
    .mockResolvedValue(PROJECT_INSPECTION);
  const validateProject = vi.fn<ICore['validateProject']>().mockResolvedValue(VALIDATION_RESULT);
  const core: ICore = {
    calculateContentDigest: vi.fn<ICore['calculateContentDigest']>(),
    createProjectInspection,
    matchManifestScope: vi.fn<ICore['matchManifestScope']>(),
    normalizeText: vi.fn<ICore['normalizeText']>(),
    parseDecision: vi.fn<ICore['parseDecision']>(),
    parseManifest: vi.fn<ICore['parseManifest']>(),
    readCanonicalContentPage: vi.fn<ICore['readCanonicalContentPage']>(),
    validateProject,
  };

  return { core, createProjectInspection, validateProject };
};

/** Creates a minimal adapter definition for deterministic registry-order tests. */
const createAdapter = (id: string): IRuntimeAdapter => ({
  id,
  inspect: () => Promise.resolve(Object.freeze({ diagnostics: [], evidence: [] })),
  supportedRepositoryFormatVersions: Object.freeze([1]),
});

describe('createMoldeaCliCoreInspectionExecutor', () => {
  test('creates fresh Core state with exact limits and validates without a project projection', async () => {
    const controller = new AbortController();
    const reader = createMemoryRepositoryReader([]);
    const coreDouble = createCoreDouble();
    const coreFactory = vi.fn<IMoldeaCliCoreFactory>().mockReturnValue(coreDouble.core);
    const executeInspection = createMoldeaCliCoreInspectionExecutor(coreFactory);

    await expect(
      executeInspection({
        command: 'validate',
        repository: reader,
        resourceLimits: RESOURCE_LIMITS,
        signal: controller.signal,
      }),
    ).resolves.toBe(VALIDATION_RESULT);
    expect(coreFactory.mock.calls[0]?.[0]?.limits).toStrictEqual({
      maxDiagnostics: 32,
      maxEntries: 128,
      maxEvidence: 16,
      maxFileBytes: 4096,
      maxManifestBytes: 2048,
      maxRetainedBytes: 32_768,
      maxTotalBytesRead: 8192,
    });
    expect(coreDouble.validateProject).toHaveBeenCalledWith({
      repository: reader,
      signal: controller.signal,
    });

    await executeInspection({
      command: 'validate',
      repository: reader,
      resourceLimits: RESOURCE_LIMITS,
    });

    expect(coreFactory).toHaveBeenCalledTimes(2);
    expect(ACTIVE_RUNTIME_ADAPTERS.map(({ id }) => id)).toStrictEqual([
      'anthropic',
      'claude-agent-sdk',
      'cloudflare-agents',
      'eve',
      'google-genai',
      'langchain',
      'langgraph',
      'openai',
      'openai-agents-sdk',
      'vercel-ai-sdk',
    ]);
  });

  test('passes the opaque Core cursor only to bounded inspection pages', async () => {
    const reader = createMemoryRepositoryReader([]);
    const coreDouble = createCoreDouble();
    const executeInspection = createMoldeaCliCoreInspectionExecutor(() => coreDouble.core);

    await expect(
      executeInspection({
        command: 'inspect',
        cursor: 'core4:all:1:memory%3Atest',
        repository: reader,
        resourceLimits: RESOURCE_LIMITS,
      }),
    ).resolves.toBe(INSPECTION_RESULT);
    expect(coreDouble.createProjectInspection).toHaveBeenCalledWith({
      repository: reader,
    });
    expect(PROJECT_INSPECTION.readPage).toHaveBeenCalledWith({
      cursor: 'core4:all:1:memory%3Atest',
      maxItems: 128,
      view: 'all',
    });
    expect(coreDouble.validateProject).not.toHaveBeenCalled();
  });

  test('normalizes the active adapter set by ID before Core creation', async () => {
    const reader = createMemoryRepositoryReader([]);
    const coreDouble = createCoreDouble();
    const coreFactory = vi.fn<IMoldeaCliCoreFactory>().mockReturnValue(coreDouble.core);
    const zetaAdapter = createAdapter('zeta');
    const alphaAdapter = createAdapter('alpha');
    const executeInspection = createMoldeaCliCoreInspectionExecutor(coreFactory, [
      zetaAdapter,
      alphaAdapter,
    ]);

    await executeInspection({
      command: 'validate',
      repository: reader,
      resourceLimits: RESOURCE_LIMITS,
    });

    expect(coreFactory.mock.calls[0]?.[0]?.adapters).toStrictEqual([alphaAdapter, zetaAdapter]);
  });
});

// @vitest-environment node
import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'vitest';

import { RepositorySourceException, parseRepositoryPath } from '@moldea.ai/repository';
import {
  createMemoryRepositoryReader,
  overrideCoreTestRepositoryReader,
  type IMemoryRepositoryEntry,
} from '../repository.test-fixtures.js';

import type {
  IRuntimeAdapter,
  IRuntimeAdapterContext,
  IRuntimeAdapterResult,
} from '../adapter/index.js';
import { createCore } from '../core/index.js';

interface IAdapterFixture {
  readonly manifest: string;
  readonly entries: readonly {
    readonly path: string;
    readonly text?: string;
    readonly type: 'file' | 'symlink';
  }[];
}

const fixture = JSON.parse(
  readFileSync(
    new URL('../../../../fixtures/core/adapter-contract/cases.json', import.meta.url),
    'utf8',
  ),
) as IAdapterFixture;
const manifestPath = parseRepositoryPath('/moldea/moldea.yaml');
const evidencePath = parseRepositoryPath('/src/evidence.ts');

const createEntries = (): readonly IMemoryRepositoryEntry[] => [
  { content: fixture.manifest, path: manifestPath, type: 'file' },
  ...fixture.entries.map((entry): IMemoryRepositoryEntry => {
    if (entry.type === 'symlink') {
      return { path: entry.path, type: 'symlink' };
    }

    if (entry.text === undefined) {
      throw new TypeError('An adapter fixture file must include text.');
    }

    return { content: entry.text, path: entry.path, type: 'file' };
  }),
];

const createValidEvidence = (): Record<string, unknown> => ({
  agentId: 'alpha',
  capabilityId: null,
  capabilityKind: null,
  details: { language: 'typescript' },
  kind: 'language',
  references: [{ path: evidencePath }],
  runtimeName: null,
  source: 'anthropic',
});

const createValidDiagnostic = (): Record<string, unknown> => ({
  code: 'ANTHROPIC_INVALID_REGISTRATION',
  details: {},
  entity: { agentId: 'alpha' },
  message: 'The registration is invalid.',
  path: evidencePath,
  pointer: null,
  range: null,
  severity: 'error',
  source: 'anthropic',
});

const createValidWarning = (): Record<string, unknown> => ({
  code: 'ANTHROPIC_RUNTIME_RELATIONSHIP_UNVERIFIED',
  details: { relationship: 'tool-implementation', reason: 'dynamic-source-pattern' },
  entity: { agentId: 'alpha', capabilityId: 'audit', capabilityKind: 'tool' },
  message: 'The declared runtime relationship could not be verified.',
  path: parseRepositoryPath('/src/audit.ts'),
  pointer: null,
  range: null,
  severity: 'warning',
  source: 'anthropic',
});

const createValidResult = (): Record<string, unknown> => ({
  diagnostics: [],
  evidence: [createValidEvidence()],
});

const createCyclicResult = (): Record<string, unknown> => {
  const details: Record<string, unknown> = {};
  details['self'] = details;

  return {
    diagnostics: [],
    evidence: [{ ...createValidEvidence(), details }],
  };
};

const resolveAlphaResult = (
  context: IRuntimeAdapterContext,
  candidate: unknown,
): Promise<IRuntimeAdapterResult> =>
  Promise.resolve(
    context.agent.id === 'alpha'
      ? (candidate as IRuntimeAdapterResult)
      : { diagnostics: [], evidence: [] },
  );

const zetaAdapter: IRuntimeAdapter = {
  id: 'openai',
  inspect: () => Promise.resolve({ diagnostics: [], evidence: [] }),
  supportedRepositoryFormatVersions: [1],
};

const malformedCases: readonly [string, () => unknown][] = [
  ['null result', () => null],
  ['missing result array', () => ({ diagnostics: [] })],
  [
    'incorrect evidence source',
    () => ({ diagnostics: [], evidence: [{ ...createValidEvidence(), source: 'other-adapter' }] }),
  ],
  [
    'unsupported evidence kind',
    () => ({ diagnostics: [], evidence: [{ ...createValidEvidence(), kind: 'unknown-kind' }] }),
  ],
  [
    'out-of-scope evidence agent',
    () => ({ diagnostics: [], evidence: [{ ...createValidEvidence(), agentId: 'zeta' }] }),
  ],
  [
    'inconsistent evidence capability',
    () => ({ diagnostics: [], evidence: [{ ...createValidEvidence(), capabilityKind: 'tool' }] }),
  ],
  [
    'trimmed evidence runtime name',
    () => ({ diagnostics: [], evidence: [{ ...createValidEvidence(), runtimeName: ' Alpha' }] }),
  ],
  [
    'empty evidence references',
    () => ({ diagnostics: [], evidence: [{ ...createValidEvidence(), references: [] }] }),
  ],
  [
    'duplicate evidence references',
    () => ({
      diagnostics: [],
      evidence: [
        {
          ...createValidEvidence(),
          references: [{ path: evidencePath }, { path: evidencePath }],
        },
      ],
    }),
  ],
  [
    'multiline evidence symbol',
    () => ({
      diagnostics: [],
      evidence: [
        {
          ...createValidEvidence(),
          references: [{ path: evidencePath, symbol: 'invalid\nsymbol' }],
        },
      ],
    }),
  ],
  [
    'canonical evidence symbol',
    () => ({
      diagnostics: [],
      evidence: [
        {
          ...createValidEvidence(),
          references: [{ path: parseRepositoryPath('/moldea/project.md'), symbol: 'project' }],
        },
      ],
    }),
  ],
  [
    'missing evidence reference',
    () => ({
      diagnostics: [],
      evidence: [
        {
          ...createValidEvidence(),
          references: [{ path: parseRepositoryPath('/src/missing.ts') }],
        },
      ],
    }),
  ],
  [
    'symlinked evidence reference',
    () => ({
      diagnostics: [],
      evidence: [
        {
          ...createValidEvidence(),
          references: [{ path: parseRepositoryPath('/src/symlink.ts') }],
        },
      ],
    }),
  ],
  [
    'unsafe evidence details',
    () => ({ diagnostics: [], evidence: [{ ...createValidEvidence(), details: { nested: {} } }] }),
  ],
  [
    'NUL detail key',
    () => ({
      diagnostics: [],
      evidence: [{ ...createValidEvidence(), details: { ['unsafe\0key']: true } }],
    }),
  ],
  [
    'non-finite evidence details',
    () => ({
      diagnostics: [],
      evidence: [{ ...createValidEvidence(), details: { confidence: Number.NaN } }],
    }),
  ],
  ['cyclic evidence details', createCyclicResult],
  [
    'incorrect diagnostic source',
    () => ({
      diagnostics: [{ ...createValidDiagnostic(), source: 'other-adapter' }],
      evidence: [],
    }),
  ],
  [
    'incorrect diagnostic namespace',
    () => ({
      diagnostics: [{ ...createValidDiagnostic(), code: 'OTHER_ADAPTER_INVALID' }],
      evidence: [],
    }),
  ],
  [
    'missing diagnostic severity',
    () => ({
      diagnostics: [{ ...createValidDiagnostic(), severity: undefined }],
      evidence: [],
    }),
  ],
  [
    'failure code marked as a warning',
    () => ({ diagnostics: [{ ...createValidDiagnostic(), severity: 'warning' }], evidence: [] }),
  ],
  [
    'warning code marked as an error',
    () => ({ diagnostics: [{ ...createValidWarning(), severity: 'error' }], evidence: [] }),
  ],
  [
    'incorrect warning message',
    () => ({ diagnostics: [{ ...createValidWarning(), message: 'Unverified' }], evidence: [] }),
  ],
  [
    'warning without a source location',
    () => ({ diagnostics: [{ ...createValidWarning(), path: null }], evidence: [] }),
  ],
  [
    'warning with an undeclared subject',
    () => ({
      diagnostics: [{ ...createValidWarning(), entity: { agentId: 'beta' } }],
      evidence: [],
    }),
  ],
  [
    'tool-schema warning without a declared schema',
    () => ({
      diagnostics: [
        {
          ...createValidWarning(),
          details: { relationship: 'tool-output-schema', reason: 'dynamic-source-pattern' },
        },
      ],
      evidence: [],
    }),
  ],
  [
    'agent relationship warning with a tool subject',
    () => ({
      diagnostics: [
        {
          ...createValidWarning(),
          details: { relationship: 'handoff-registration', reason: 'dynamic-source-pattern' },
        },
      ],
      evidence: [],
    }),
  ],
  [
    'variable-provider warning without a declared variable and binding',
    () => ({
      diagnostics: [
        {
          ...createValidWarning(),
          details: { relationship: 'variable-provider', reason: 'dynamic-source-pattern' },
          entity: { agentId: 'alpha', variableId: 'MISSING' },
        },
      ],
      evidence: [],
    }),
  ],
  [
    'warning with unrelated details',
    () => ({
      diagnostics: [
        {
          ...createValidWarning(),
          details: {
            relationship: 'tool-implementation',
            reason: 'dynamic-source-pattern',
            source: '/src/audit.ts',
          },
        },
      ],
      evidence: [],
    }),
  ],
  [
    'warning with an accessor detail',
    () => ({
      diagnostics: [
        {
          ...createValidWarning(),
          details: Object.defineProperty({ relationship: 'tool-implementation' }, 'reason', {
            enumerable: true,
            get: () => 'dynamic-source-pattern',
          }),
        },
      ],
      evidence: [],
    }),
  ],
  [
    'warning with an unnormalized version declaration',
    () => ({
      diagnostics: [
        {
          ...createValidWarning(),
          details: {
            relationship: 'tool-implementation',
            reason: 'version-dependent-behavior',
            packageName: '@anthropic-ai/sdk',
            declaredRange: 'latest',
            boundaryVersion: '1.2.3',
          },
        },
      ],
      evidence: [],
    }),
  ],
  [
    'warning with a noncanonical behavior boundary',
    () => ({
      diagnostics: [
        {
          ...createValidWarning(),
          details: {
            relationship: 'tool-implementation',
            reason: 'version-dependent-behavior',
            packageName: '@anthropic-ai/sdk',
            declaredRange: '>=1.0.0 <2.0.0-0',
            boundaryVersion: '01.2.3',
          },
        },
      ],
      evidence: [],
    }),
  ],
  [
    'malformed diagnostic pointer',
    () => ({
      diagnostics: [{ ...createValidDiagnostic(), pointer: '/invalid~pointer' }],
      evidence: [],
    }),
  ],
  [
    'reversed diagnostic range',
    () => ({
      diagnostics: [
        {
          ...createValidDiagnostic(),
          range: {
            end: { column: 1, line: 1, offset: 0 },
            start: { column: 2, line: 1, offset: 1 },
          },
        },
      ],
      evidence: [],
    }),
  ],
  [
    'out-of-scope diagnostic entity',
    () => ({
      diagnostics: [{ ...createValidDiagnostic(), entity: { agentId: 'zeta' } }],
      evidence: [],
    }),
  ],
  [
    'undeclared diagnostic capability',
    () => ({
      diagnostics: [
        {
          ...createValidDiagnostic(),
          entity: { agentId: 'alpha', capabilityId: 'missing', capabilityKind: 'tool' },
        },
      ],
      evidence: [],
    }),
  ],
  [
    'undeclared diagnostic variable',
    () => ({
      diagnostics: [
        { ...createValidDiagnostic(), entity: { agentId: 'alpha', variableId: 'MISSING' } },
      ],
      evidence: [],
    }),
  ],
  [
    'unknown diagnostic decision',
    () => ({
      diagnostics: [{ ...createValidDiagnostic(), entity: { decisionId: '1786000000000' } }],
      evidence: [],
    }),
  ],
  [
    'incorrect diagnostic adapter entity',
    () => ({
      diagnostics: [
        { ...createValidDiagnostic(), entity: { adapterId: 'other-adapter', agentId: 'alpha' } },
      ],
      evidence: [],
    }),
  ],
  [
    'located diagnostic without a path',
    () => ({
      diagnostics: [{ ...createValidDiagnostic(), path: null, pointer: '/agents/alpha' }],
      evidence: [],
    }),
  ],
];

describe('Core runtime-adapter result validation', () => {
  test.each(malformedCases)(
    'rejects %s as an operational adapter failure',
    async (_, createResult) => {
      const alphaAdapter: IRuntimeAdapter = {
        id: 'anthropic',
        inspect: (context) => resolveAlphaResult(context, createResult()),
        supportedRepositoryFormatVersions: [1],
      };
      const zetaAdapter: IRuntimeAdapter = {
        id: 'openai',
        inspect: () => Promise.resolve({ diagnostics: [], evidence: [] }),
        supportedRepositoryFormatVersions: [1],
      };

      await expect(
        createCore({ adapters: [zetaAdapter, alphaAdapter] }).validateProject({
          repository: createMemoryRepositoryReader(createEntries()),
        }),
      ).rejects.toMatchObject({
        adapterId: 'anthropic',
        code: 'ADAPTER_EXECUTION_FAILED',
        message: 'A runtime adapter failed during inspection.',
        operation: 'validate-adapter',
        retryable: false,
      });
    },
  );

  test('normalizes finite details and exact duplicate adapter diagnostics', async () => {
    const diagnostic = {
      ...createValidDiagnostic(),
      details: { zeta: -0, alpha: true },
    };
    const alphaAdapter: IRuntimeAdapter = {
      id: 'anthropic',
      inspect: (context) =>
        resolveAlphaResult(context, { diagnostics: [diagnostic, diagnostic], evidence: [] }),
      supportedRepositoryFormatVersions: [1],
    };
    const zetaAdapter: IRuntimeAdapter = {
      id: 'openai',
      inspect: () => Promise.resolve({ diagnostics: [], evidence: [] }),
      supportedRepositoryFormatVersions: [1],
    };
    const result = await createCore({ adapters: [zetaAdapter, alphaAdapter] }).validateProject({
      repository: createMemoryRepositoryReader(createEntries()),
    });

    expect(result.diagnostics).toHaveLength(1);
    expect({ ...result.diagnostics[0]?.details }).toStrictEqual({ alpha: true, zeta: 0 });
    expect(Object.getPrototypeOf(result.diagnostics[0]?.details)).toBeNull();
  });

  test('keeps scoped warnings valid and counts errors separately', async () => {
    const warning = createValidWarning();
    const alphaAdapter: IRuntimeAdapter = {
      id: 'anthropic',
      inspect: (context) =>
        resolveAlphaResult(context, { diagnostics: [warning, warning], evidence: [] }),
      supportedRepositoryFormatVersions: [1],
    };
    const result = await createCore({ adapters: [alphaAdapter, zetaAdapter] }).validateProject({
      repository: createMemoryRepositoryReader(createEntries()),
    });

    expect(result).toMatchObject({ errorCount: 0, valid: true, warningCount: 1 });
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toMatchObject(warning);
  });

  test('preserves safe version context and distinct behavior boundaries', async () => {
    const warning = createValidWarning();
    const first = {
      ...warning,
      details: {
        boundaryVersion: '1.2.3',
        declaredRange: '>=1.0.0 <2.0.0-0',
        packageName: '@anthropic-ai/sdk',
        reason: 'version-dependent-behavior',
        relationship: 'tool-implementation',
      },
    };
    const second = {
      ...first,
      details: { ...first.details, boundaryVersion: '2.0.0', declaredRange: null },
    };
    const alphaAdapter: IRuntimeAdapter = {
      id: 'anthropic',
      inspect: (context) =>
        resolveAlphaResult(context, { diagnostics: [first, second], evidence: [] }),
      supportedRepositoryFormatVersions: [1],
    };
    const result = await createCore({ adapters: [alphaAdapter, zetaAdapter] }).validateProject({
      repository: createMemoryRepositoryReader(createEntries()),
    });

    expect(result).toMatchObject({ errorCount: 0, valid: true, warningCount: 2 });
    expect(result.diagnostics.map((item) => item.details)).toStrictEqual([
      first.details,
      second.details,
    ]);
  });

  test('counts duplicate adapter diagnostics before deduplication', async () => {
    const diagnostic = createValidDiagnostic();
    const alphaAdapter: IRuntimeAdapter = {
      id: 'anthropic',
      inspect: (context) =>
        resolveAlphaResult(context, { diagnostics: [diagnostic, diagnostic], evidence: [] }),
      supportedRepositoryFormatVersions: [1],
    };
    const zetaAdapter: IRuntimeAdapter = {
      id: 'openai',
      inspect: () => Promise.resolve({ diagnostics: [], evidence: [] }),
      supportedRepositoryFormatVersions: [1],
    };

    await expect(
      createCore({
        adapters: [zetaAdapter, alphaAdapter],
        limits: { maxDiagnostics: 1 },
      }).validateProject({ repository: createMemoryRepositoryReader(createEntries()) }),
    ).rejects.toMatchObject({
      code: 'RESOURCE_LIMIT_EXCEEDED',
      limit: 'maxDiagnostics',
      operation: 'validate-adapter',
    });
  });

  test('counts duplicate warning candidates before deduplication', async () => {
    const warning = createValidWarning();
    const alphaAdapter: IRuntimeAdapter = {
      id: 'anthropic',
      inspect: (context) =>
        resolveAlphaResult(context, { diagnostics: [warning, warning], evidence: [] }),
      supportedRepositoryFormatVersions: [1],
    };

    await expect(
      createCore({
        adapters: [alphaAdapter, zetaAdapter],
        limits: { maxDiagnostics: 1 },
      }).validateProject({
        repository: createMemoryRepositoryReader(createEntries()),
      }),
    ).rejects.toMatchObject({
      code: 'RESOURCE_LIMIT_EXCEEDED',
      limit: 'maxDiagnostics',
      operation: 'validate-adapter',
    });
  });

  test('accepts a complete valid adapter result', async () => {
    const candidate = createValidResult();
    const alphaAdapter: IRuntimeAdapter = {
      id: 'anthropic',
      inspect: (context) => resolveAlphaResult(context, candidate),
      supportedRepositoryFormatVersions: [1],
    };
    const zetaAdapter: IRuntimeAdapter = {
      id: 'openai',
      inspect: () => Promise.resolve({ diagnostics: [], evidence: [] }),
      supportedRepositoryFormatVersions: [1],
    };
    const result = await createCore({ adapters: [zetaAdapter, alphaAdapter] }).validateProject({
      repository: createMemoryRepositoryReader(createEntries()),
    });

    expect(result.valid).toBe(true);
    expect(result.evidence).toHaveLength(1);
    expect(Object.isFrozen(candidate)).toBe(false);
    expect(Object.isFrozen((candidate['evidence'] as readonly unknown[])[0])).toBe(false);
  });

  test('classifies an adapter-result accessor failure as invalid adapter output', async () => {
    const candidate = Object.defineProperty({}, 'evidence', {
      enumerable: true,
      get: () => {
        throw new Error('unsafe adapter accessor');
      },
    });
    Object.defineProperty(candidate, 'diagnostics', { enumerable: true, value: [] });
    const alphaAdapter: IRuntimeAdapter = {
      id: 'anthropic',
      inspect: (context) => resolveAlphaResult(context, candidate),
      supportedRepositoryFormatVersions: [1],
    };
    const zetaAdapter: IRuntimeAdapter = {
      id: 'openai',
      inspect: () => Promise.resolve({ diagnostics: [], evidence: [] }),
      supportedRepositoryFormatVersions: [1],
    };
    const resultPromise = createCore({ adapters: [alphaAdapter, zetaAdapter] }).validateProject({
      repository: createMemoryRepositoryReader(createEntries()),
    });

    await expect(resultPromise).rejects.toMatchObject({
      adapterId: 'anthropic',
      code: 'ADAPTER_EXECUTION_FAILED',
      operation: 'validate-adapter',
      retryable: false,
    });
  });

  test('preserves repository source failures during evidence grounding', async () => {
    const sourceFailure = new RepositorySourceException({
      code: 'SOURCE_UNAVAILABLE',
      operation: 'get-entry',
      path: evidencePath,
      retryable: true,
    });
    const source = createMemoryRepositoryReader(createEntries());
    const repository = overrideCoreTestRepositoryReader(source, {
      getEntry: (path, options) =>
        path === evidencePath ? Promise.reject(sourceFailure) : source.getEntry(path, options),
      iterateEntries: (options) => source.iterateEntries(options),
      readCompleteFile: (path, options) => source.readCompleteFile(path, options),
    });
    const alphaAdapter: IRuntimeAdapter = {
      id: 'anthropic',
      inspect: (context) => resolveAlphaResult(context, createValidResult()),
      supportedRepositoryFormatVersions: [1],
    };
    const zetaAdapter: IRuntimeAdapter = {
      id: 'openai',
      inspect: () => Promise.resolve({ diagnostics: [], evidence: [] }),
      supportedRepositoryFormatVersions: [1],
    };

    await expect(
      createCore({ adapters: [alphaAdapter, zetaAdapter] }).validateProject({ repository }),
    ).rejects.toBe(sourceFailure);
  });

  test('preserves shared cancellation during evidence grounding', async () => {
    const cancellation = new Error('evidence grounding was cancelled');
    const controller = new AbortController();
    const source = createMemoryRepositoryReader(createEntries());
    let groundingSignal: AbortSignal | undefined;
    const repository = overrideCoreTestRepositoryReader(source, {
      getEntry: (path, options) => {
        if (path !== evidencePath) {
          return source.getEntry(path, options);
        }

        groundingSignal = options?.signal;
        controller.abort(cancellation);
        return source.getEntry(path);
      },
      iterateEntries: (options) => source.iterateEntries(options),
      readCompleteFile: (path, options) => source.readCompleteFile(path, options),
    });
    const alphaAdapter: IRuntimeAdapter = {
      id: 'anthropic',
      inspect: (context) => resolveAlphaResult(context, createValidResult()),
      supportedRepositoryFormatVersions: [1],
    };
    const zetaAdapter: IRuntimeAdapter = {
      id: 'openai',
      inspect: () => Promise.resolve({ diagnostics: [], evidence: [] }),
      supportedRepositoryFormatVersions: [1],
    };

    await expect(
      createCore({ adapters: [alphaAdapter, zetaAdapter] }).validateProject({
        repository,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({
      cause: cancellation,
      code: 'ABORTED',
      operation: 'validate-project',
      retryable: true,
    });
    expect(groundingSignal).toBe(controller.signal);
  });
});

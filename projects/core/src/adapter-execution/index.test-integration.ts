// @vitest-environment node
import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'vitest';

import {
  RepositorySourceException,
  parseRepositoryPath,
  type IRepositoryEntry,
  type IRepositoryPath,
} from '@moldea.ai/repository';
import {
  createMemoryRepositoryReader,
  overrideCoreTestRepositoryReader,
  type IMemoryRepositoryEntry,
} from '../repository.test-fixtures.js';

import {
  iterateRuntimeAdapterEntries,
  readRuntimeAdapterFile,
  type IRuntimeAdapter,
  type IRuntimeAdapterContext,
  type IRuntimeAdapterEvidence,
  type IRuntimeAdapterResult,
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

interface IAdapterHarnessOptions {
  readonly includeDiagnostics?: boolean;
  readonly onAlpha?: (context: IRuntimeAdapterContext) => Promise<void> | void;
  readonly onZeta?: (context: IRuntimeAdapterContext) => Promise<void> | void;
}

interface IAdapterHarness {
  readonly adapters: readonly IRuntimeAdapter[];
  readonly calls: string[];
  readonly resolutionKinds: string[];
  readonly scopedAgentIds: string[][];
  readonly unusedCalls: string[];
}

const fixture = JSON.parse(
  readFileSync(
    new URL('../../../../fixtures/core/adapter-contract/cases.json', import.meta.url),
    'utf8',
  ),
) as IAdapterFixture;
const expectedEvidence = JSON.parse(
  readFileSync(
    new URL('../../../../fixtures/core/adapter-contract/evidence.expected.json', import.meta.url),
    'utf8',
  ),
) as readonly unknown[];
const expectedDiagnostics = JSON.parse(
  readFileSync(
    new URL(
      '../../../../fixtures/core/adapter-contract/diagnostics.expected.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as readonly unknown[];
const manifestPath = parseRepositoryPath('/moldea/moldea.yaml');
const projectPath = parseRepositoryPath('/moldea/project.md');
const auditPath = parseRepositoryPath('/src/audit.ts');
const evidencePath = parseRepositoryPath('/src/evidence.ts');

const createEntries = (manifest = fixture.manifest): readonly IMemoryRepositoryEntry[] => [
  { content: manifest, path: manifestPath, type: 'file' },
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

const createAlphaEvidence = (agentId: string): readonly IRuntimeAdapterEvidence[] => {
  const toolRegistration: IRuntimeAdapterEvidence = {
    agentId: 'alpha',
    capabilityId: 'audit',
    capabilityKind: 'tool',
    details: { symbol: 'auditRequests', constructor: 'safe', detected: true },
    kind: 'tool-registration',
    references: [{ path: evidencePath }, { path: auditPath }],
    runtimeName: 'auditRequests',
    source: 'anthropic',
  };

  if (agentId === 'beta') {
    return [
      {
        agentId: 'beta',
        capabilityId: null,
        capabilityKind: null,
        details: { language: 'typescript' },
        kind: 'agent-definition',
        references: [{ path: evidencePath }],
        runtimeName: 'BetaRuntime',
        source: 'anthropic',
      },
    ];
  }

  return [toolRegistration, toolRegistration];
};

const createZetaEvidence = (): readonly IRuntimeAdapterEvidence[] => [
  {
    agentId: 'zeta',
    capabilityId: null,
    capabilityKind: null,
    details: { language: 'typescript' },
    kind: 'language',
    references: [{ path: evidencePath }],
    runtimeName: null,
    source: 'openai',
  },
];

const createAdapterHarness = (options: IAdapterHarnessOptions = {}): IAdapterHarness => {
  const calls: string[] = [];
  const resolutionKinds: string[] = [];
  const scopedAgentIds: string[][] = [];
  const unusedCalls: string[] = [];

  const observeContext = (adapterId: string, context: IRuntimeAdapterContext): void => {
    calls.push(adapterId);
    scopedAgentIds.push([context.agent.id]);
    resolutionKinds.push(context.resolveAgent({ path: evidencePath }).kind);
    expect(Object.isFrozen(context)).toBe(true);
    expect(Object.isFrozen(context.agent)).toBe(true);
  };

  const alphaAdapter: IRuntimeAdapter = {
    id: 'anthropic',
    supportedRepositoryFormatVersions: [1],
    inspect: async (context): Promise<IRuntimeAdapterResult> => {
      observeContext('anthropic', context);
      await options.onAlpha?.(context);
      const agentId = context.agent.id;

      return {
        diagnostics:
          options.includeDiagnostics && agentId === 'alpha'
            ? [
                {
                  code: 'ANTHROPIC_TOOL_REGISTRATION_MISSING',
                  details: { expected: true },
                  entity: {
                    agentId: 'alpha',
                    capabilityId: 'audit',
                    capabilityKind: 'tool',
                  },
                  message: 'The tool registration is missing.',
                  path: auditPath,
                  pointer: null,
                  range: null,
                  source: 'anthropic',
                },
              ]
            : [],
        evidence: createAlphaEvidence(agentId),
      };
    },
  };
  const zetaAdapter: IRuntimeAdapter = {
    id: 'openai',
    supportedRepositoryFormatVersions: [1],
    inspect: async (context): Promise<IRuntimeAdapterResult> => {
      observeContext('openai', context);
      await options.onZeta?.(context);

      return {
        diagnostics: options.includeDiagnostics
          ? [
              {
                code: 'OPENAI_AGENT_DEFINITION_MISSING',
                details: { runtimeName: 'ZetaRuntime' },
                entity: { adapterId: 'openai', agentId: 'zeta' },
                message: 'The runtime agent definition is missing.',
                path: null,
                pointer: null,
                range: null,
                source: 'openai',
              },
            ]
          : [],
        evidence: createZetaEvidence(),
      };
    },
  };
  const unusedAdapter: IRuntimeAdapter = {
    id: 'eve',
    supportedRepositoryFormatVersions: [1],
    inspect: () => {
      unusedCalls.push('eve');
      return Promise.resolve({ diagnostics: [], evidence: [] });
    },
  };

  return {
    adapters: [zetaAdapter, unusedAdapter, alphaAdapter],
    calls,
    resolutionKinds,
    scopedAgentIds,
    unusedCalls,
  };
};

const toJsonValue = (candidate: unknown): unknown =>
  JSON.parse(JSON.stringify(candidate)) as unknown;

describe('Core runtime-adapter execution', () => {
  test('invokes applicable adapters canonically through one mutation-isolated reader session', async () => {
    const source = createMemoryRepositoryReader(createEntries());
    const readCounts = new Map<IRepositoryPath, number>();
    const repository = overrideCoreTestRepositoryReader(source, {
      getEntry: (path, options) => source.getEntry(path, options),
      iterateEntries: (options) => source.iterateEntries(options),
      readCompleteFile: (path, options) => {
        readCounts.set(path, (readCounts.get(path) ?? 0) + 1);
        return source.readCompleteFile(path, options);
      },
    });
    let zetaProjectText = '';
    const harness = createAdapterHarness({
      onAlpha: async (context) => {
        const operationOptions =
          context.signal === undefined ? undefined : { signal: context.signal };
        const bytes = await readRuntimeAdapterFile(
          context.repository,
          projectPath,
          operationOptions,
        );
        bytes[0] = 0;
      },
      onZeta: async (context) => {
        const operationOptions =
          context.signal === undefined ? undefined : { signal: context.signal };
        const bytes = await readRuntimeAdapterFile(
          context.repository,
          projectPath,
          operationOptions,
        );
        zetaProjectText = new TextDecoder().decode(bytes);
      },
    });
    const result = await createCore({ adapters: harness.adapters }).validateProject({ repository });

    expect(result.valid).toBe(true);
    expect(result.summary?.counts.agents).toBe(4);
    expect(toJsonValue(result.evidence)).toStrictEqual(expectedEvidence);
    expect(result.diagnostics).toStrictEqual([]);
    expect(harness.calls).toStrictEqual(['anthropic', 'anthropic', 'openai']);
    expect(harness.scopedAgentIds).toStrictEqual([['alpha'], ['beta'], ['zeta']]);
    expect(harness.resolutionKinds).toStrictEqual(['absent', 'absent', 'absent']);
    expect(harness.unusedCalls).toStrictEqual([]);
    expect(zetaProjectText).toBe('# Adapter project\n');
    expect(readCounts.get(projectPath)).toBe(4);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.evidence[0]?.details)).toBe(true);
    expect(Object.getPrototypeOf(result.evidence[0]?.details)).toBeNull();
  });

  test('retains exact evidence and content-free metadata with adapter diagnostics', async () => {
    const harness = createAdapterHarness({ includeDiagnostics: true });
    const result = await createCore({ adapters: harness.adapters }).validateProject({
      repository: createMemoryRepositoryReader(createEntries()),
    });

    expect(toJsonValue(result)).toMatchObject({
      diagnostics: expectedDiagnostics,
      evidence: expectedEvidence,
      formatVersion: 1,
      valid: false,
    });
    expect(result.summary).not.toBeNull();
    expect(toJsonValue(result.diagnostics)).toStrictEqual(expectedDiagnostics);
    expect(toJsonValue(result.evidence)).toStrictEqual(expectedEvidence);
    expect(harness.calls).toStrictEqual(['anthropic', 'anthropic', 'openai']);
  });

  test('resolves only exact same-runtime agent bindings without exposing an agent collection', async () => {
    const manifest = fixture.manifest
      .replace(
        '  zeta:\n    runtime:\n      id: openai\n',
        '  zeta:\n    runtime:\n      id: openai\n    bindings:\n      runtimeAgent:\n        path: /src/evidence.ts\n        symbol: ZetaRuntime\n',
      )
      .replace(
        '  beta:\n    runtime:\n      id: anthropic\n',
        '  beta:\n    runtime:\n      id: anthropic\n    bindings:\n      runtimeAgent:\n        path: /src/evidence.ts\n        symbol: BetaRuntime\n',
      )
      .replace(
        '  alpha:\n    runtime:\n      id: anthropic\n',
        '  alpha:\n    runtime:\n      id: anthropic\n    bindings:\n      runtimeAgent:\n        path: /src/evidence.ts\n        symbol: AlphaRuntime\n',
      );
    const resolutions: unknown[] = [];
    const harness = createAdapterHarness({
      onAlpha: (context) => {
        if (context.agent.id !== 'alpha') {
          return;
        }

        resolutions.push(
          context.resolveAgent({ path: evidencePath, symbol: 'BetaRuntime' }),
          context.resolveAgent({ path: evidencePath, symbol: 'ZetaRuntime' }),
        );
        expect(Object.keys(context).sort()).toStrictEqual(['agent', 'repository', 'resolveAgent']);
      },
    });

    await createCore({ adapters: harness.adapters }).validateProject({
      repository: createMemoryRepositoryReader(createEntries(manifest)),
    });

    expect(resolutions).toMatchObject([
      { agent: { id: 'beta' }, kind: 'matched' },
      { kind: 'absent' },
    ]);
    expect(Object.isFrozen(resolutions[0])).toBe(true);
    expect(Object.isFrozen((resolutions[0] as { agent: object }).agent)).toBe(true);
    expect((resolutions[0] as { agent: object }).agent).not.toHaveProperty('instruction');
  });

  test('reports duplicate exact runtime bindings as a bounded ambiguous result', async () => {
    const binding =
      '    bindings:\n      runtimeAgent:\n        path: /src/evidence.ts\n        symbol: SharedRuntime\n';
    const manifest = fixture.manifest
      .replace(
        '  beta:\n    runtime:\n      id: anthropic\n',
        `  beta:\n    runtime:\n      id: anthropic\n${binding}`,
      )
      .replace(
        '  alpha:\n    runtime:\n      id: anthropic\n',
        `  alpha:\n    runtime:\n      id: anthropic\n${binding}`,
      );
    let resolution: unknown;
    const harness = createAdapterHarness({
      onAlpha: (context) => {
        resolution = context.resolveAgent({ path: evidencePath, symbol: 'SharedRuntime' });
      },
    });

    await createCore({ adapters: harness.adapters }).validateProject({
      repository: createMemoryRepositoryReader(createEntries(manifest)),
    });

    expect(resolution).toStrictEqual({ candidateCount: 2, kind: 'ambiguous' });
    expect(Object.isFrozen(resolution)).toBe(true);
  });

  test('does not invoke any adapter after universal validation fails', async () => {
    const harness = createAdapterHarness();
    const entries = createEntries().filter(({ path }) => path !== projectPath);
    const result = await createCore({ adapters: harness.adapters }).validateProject({
      repository: createMemoryRepositoryReader(entries),
    });

    expect(result.valid).toBe(false);
    expect(result.summary).toBeNull();
    expect(result.evidence).toStrictEqual([]);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'MOLDEA_PROJECT_FILE_MISSING' }),
    );
    expect(harness.calls).toStrictEqual([]);
    expect(harness.unusedCalls).toStrictEqual([]);
  });

  test('does not invoke any adapter when one declared official adapter is unavailable', async () => {
    const harness = createAdapterHarness();
    const result = await createCore({
      adapters: harness.adapters.filter(({ id }) => id === 'anthropic'),
    }).validateProject({ repository: createMemoryRepositoryReader(createEntries()) });

    expect(result).toMatchObject({
      diagnostics: [
        {
          code: 'MOLDEA_RUNTIME_ADAPTER_UNAVAILABLE',
          entity: { adapterId: 'openai', agentId: 'zeta' },
          pointer: '/agents/zeta/runtime/id',
        },
      ],
      evidence: [],
      valid: false,
    });
    expect(harness.calls).toStrictEqual([]);
  });

  test('wraps unexpected adapter failures with safe adapter metadata and cause', async () => {
    const failure = new Error('private adapter failure');
    const harness = createAdapterHarness({
      onAlpha: () => {
        throw failure;
      },
    });

    await expect(
      createCore({ adapters: harness.adapters }).validateProject({
        repository: createMemoryRepositoryReader(createEntries()),
      }),
    ).rejects.toMatchObject({
      adapterId: 'anthropic',
      cause: failure,
      code: 'ADAPTER_EXECUTION_FAILED',
      message: 'A runtime adapter failed during inspection.',
      operation: 'validate-project',
      retryable: false,
    });
    expect(harness.calls).toStrictEqual(['anthropic']);
  });

  test('preserves repository source exceptions raised through an adapter reader', async () => {
    const sourceFailure = new RepositorySourceException({
      code: 'SOURCE_UNAVAILABLE',
      operation: 'get-entry',
      path: parseRepositoryPath('/source-error'),
      retryable: true,
    });
    const source = createMemoryRepositoryReader(createEntries());
    const repository = overrideCoreTestRepositoryReader(source, {
      getEntry: (path, options) =>
        path === '/source-error' ? Promise.reject(sourceFailure) : source.getEntry(path, options),
      iterateEntries: (options) => source.iterateEntries(options),
      readCompleteFile: (path, options) => source.readCompleteFile(path, options),
    });
    const harness = createAdapterHarness({
      onAlpha: async (context) => {
        const operationOptions =
          context.signal === undefined ? undefined : { signal: context.signal };
        await context.repository.getEntry(parseRepositoryPath('/source-error'), operationOptions);
      },
    });

    await expect(
      createCore({ adapters: harness.adapters }).validateProject({ repository }),
    ).rejects.toBe(sourceFailure);
  });

  test('stops adapter execution when the shared signal is aborted', async () => {
    const controller = new AbortController();
    const harness = createAdapterHarness({
      onAlpha: () => controller.abort(new Error('adapter cancellation')),
    });

    await expect(
      createCore({ adapters: harness.adapters }).validateProject({
        repository: createMemoryRepositoryReader(createEntries()),
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({
      code: 'ABORTED',
      operation: 'validate-project',
      retryable: true,
    });
    expect(harness.calls).toStrictEqual(['anthropic']);
  });

  test('charges adapter enumeration to the shared entry budget', async () => {
    const source = createMemoryRepositoryReader(createEntries());
    let universalEntryCount = 0;
    const observedRepository = overrideCoreTestRepositoryReader(source, {
      getEntry: (path, options) => source.getEntry(path, options),
      iterateEntries: (options): AsyncIterable<IRepositoryEntry> => ({
        async *[Symbol.asyncIterator]() {
          for await (const entry of source.iterateEntries(options)) {
            universalEntryCount += 1;
            yield entry;
          }
        },
      }),
      readCompleteFile: (path, options) => source.readCompleteFile(path, options),
    });
    const baselineHarness = createAdapterHarness();

    await createCore({ adapters: baselineHarness.adapters }).validateProject({
      repository: observedRepository,
    });

    const budgetHarness = createAdapterHarness({
      onAlpha: async (context) => {
        const operationOptions =
          context.signal === undefined ? undefined : { signal: context.signal };

        for await (const entry of iterateRuntimeAdapterEntries(
          context.repository,
          operationOptions,
        )) {
          void entry;
        }
      },
    });

    await expect(
      createCore({
        adapters: budgetHarness.adapters,
        limits: { maxEntries: universalEntryCount },
      }).validateProject({ repository: createMemoryRepositoryReader(createEntries()) }),
    ).rejects.toMatchObject({
      code: 'RESOURCE_LIMIT_EXCEEDED',
      limit: 'maxEntries',
      operation: 'validate-project',
      retryable: false,
    });
  });

  test('enforces the diagnostic budget across every completed adapter', async () => {
    const harness = createAdapterHarness({ includeDiagnostics: true });

    await expect(
      createCore({
        adapters: harness.adapters,
        limits: { maxDiagnostics: 1 },
      }).validateProject({ repository: createMemoryRepositoryReader(createEntries()) }),
    ).rejects.toMatchObject({
      code: 'RESOURCE_LIMIT_EXCEEDED',
      limit: 'maxDiagnostics',
      operation: 'validate-adapter',
      retryable: false,
    });
    expect(harness.calls).toStrictEqual(['anthropic', 'anthropic', 'openai']);
  });

  test('enforces the raw evidence budget before deduplication', async () => {
    const harness = createAdapterHarness();

    await expect(
      createCore({
        adapters: harness.adapters,
        limits: { maxEvidence: 2 },
      }).validateProject({ repository: createMemoryRepositoryReader(createEntries()) }),
    ).rejects.toMatchObject({
      code: 'RESOURCE_LIMIT_EXCEEDED',
      limit: 'maxEvidence',
      operation: 'validate-adapter',
      retryable: false,
    });
    expect(harness.calls).toStrictEqual(['anthropic', 'anthropic']);
  });

  test('allows one immutable adapter instance to serve concurrent inspections', async () => {
    let activeInspections = 0;
    let maximumActiveInspections = 0;
    let startedInspections = 0;
    let releaseInspections!: () => void;
    const rendezvous = new Promise<void>((resolve) => {
      releaseInspections = resolve;
    });
    const harness = createAdapterHarness({
      onAlpha: async () => {
        activeInspections += 1;
        maximumActiveInspections = Math.max(maximumActiveInspections, activeInspections);
        startedInspections += 1;

        if (startedInspections === 2) {
          releaseInspections();
        }

        await rendezvous;
        activeInspections -= 1;
      },
    });
    const core = createCore({ adapters: harness.adapters });
    const [first, second] = await Promise.all([
      core.validateProject({ repository: createMemoryRepositoryReader(createEntries()) }),
      core.validateProject({ repository: createMemoryRepositoryReader(createEntries()) }),
    ]);

    expect(first.valid).toBe(true);
    expect(second.valid).toBe(true);
    expect(maximumActiveInspections).toBe(2);
  });
});

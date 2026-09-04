// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { parseRepositoryPath, type IRepositoryPath } from '@moldea.ai/repository';

import { DEFAULT_CORE_RESOURCE_LIMITS } from '../constants/index.js';
import type { IMoldeaManifestV1, IRepositoryReference } from '../format/index.js';

import { calculateManifestScopeInputDigest, matchParsedManifestScope } from './matching.js';

const repositoryPath = (value: string): IRepositoryPath => parseRepositoryPath(value);
const reference = (path: string, symbol?: string): IRepositoryReference => ({
  path: repositoryPath(path),
  ...(symbol === undefined ? {} : { symbol }),
});

const createCompleteManifest = (): IMoldeaManifestV1 => ({
  version: 1,
  context: {
    '/moldea/project.md': {
      bindings: [reference('/src/context-binding.ts', 'loadContext')],
      affectedBy: ['/src/context/**'],
    },
  },
  decisions: {
    '/moldea/decisions/1786050123456-use-postgresql.md': {
      bindings: [reference('/src/decision-binding.ts')],
      affectedBy: ['/src/decision/**/*.ts'],
    },
  },
  unresolved: {
    'project-policy': {
      category: 'policy',
      effect: 'warning',
      description: 'The project policy is unresolved.',
      resolution: 'Resolve the project policy.',
      related: [reference('/src/project-policy.ts')],
    },
  },
  agents: {
    reviewer: {
      runtime: { id: 'custom' },
      variables: { API_TOKEN: { description: 'The runtime token.' } },
      bindings: {
        runtimeAgent: reference('/src/agent.ts', 'reviewer'),
        inputSchema: reference('/src/input-schema.ts'),
        outputSchema: reference('/src/output-schema.ts'),
        instructionLoader: reference('/src/instruction-loader.ts'),
        variableProviders: { API_TOKEN: reference('/src/token-provider.ts') },
      },
      affectedBy: ['/src/review/*/handler.ts'],
      mirrors: [repositoryPath('/runtime/reviewer.md')],
      tools: {
        inspect: {
          name: 'inspect',
          description: 'Inspects the supplied repository state.',
          implementation: reference('/src/tools/inspect.ts', 'inspect'),
          registration: reference('/src/tools/register.ts'),
          inputSchema: reference('/src/tools/input.ts'),
          outputSchema: reference('/src/tools/output.ts'),
          affectedBy: ['/src/tools/**/*.ts'],
        },
      },
      skills: {
        audit: {
          name: 'audit',
          description: 'Audits the supplied repository state.',
          implementation: reference('/skills/audit/SKILL.md'),
          registration: reference('/skills/register.ts'),
          affectedBy: ['/skills/**'],
        },
      },
      unresolved: {
        'runtime-policy': {
          category: 'runtime',
          effect: 'blocking',
          description: 'The runtime policy is unresolved.',
          resolution: 'Resolve the runtime policy.',
          related: [reference('/src/runtime-policy.ts')],
        },
      },
    },
  },
});

describe('parsed manifest scope matching', () => {
  test('matches every version 1 repository relationship with stable content-free metadata', () => {
    const paths = [
      '/src/context-binding.ts',
      '/src/context/current.ts',
      '/src/decision-binding.ts',
      '/src/decision/rule.ts',
      '/src/project-policy.ts',
      '/src/agent.ts',
      '/src/input-schema.ts',
      '/src/output-schema.ts',
      '/src/instruction-loader.ts',
      '/src/token-provider.ts',
      '/src/review/orders/handler.ts',
      '/runtime/reviewer.md',
      '/src/tools/inspect.ts',
      '/src/tools/register.ts',
      '/src/tools/input.ts',
      '/src/tools/output.ts',
      '/src/tools/nested/runtime.ts',
      '/skills/audit/SKILL.md',
      '/skills/register.ts',
      '/skills/deeper/file.md',
      '/src/runtime-policy.ts',
      '/unrelated/readme.md',
    ].map(repositoryPath);
    const result = matchParsedManifestScope(
      createCompleteManifest(),
      paths,
      DEFAULT_CORE_RESOURCE_LIMITS,
    );

    expect(result.counts).toStrictEqual({
      declarations: 21,
      inputPaths: 22,
      matchedOwners: 7,
      matchedPaths: 21,
      matches: 27,
    });
    expect(new Set(result.matches.map(({ field }) => field))).toStrictEqual(
      new Set([
        'affectedBy',
        'bindings',
        'implementation',
        'inputSchema',
        'instructionLoader',
        'mirrors',
        'outputSchema',
        'registration',
        'related',
        'runtimeAgent',
        'variableProvider',
      ]),
    );
    expect(result.matches).toContainEqual({
      declaration: {
        kind: 'exact',
        path: '/src/context-binding.ts',
        symbol: 'loadContext',
      },
      field: 'bindings',
      inputPath: '/src/context-binding.ts',
      owner: { agentId: null, id: '/moldea/project.md', kind: 'context' },
      pointer: '/context/~1moldea~1project.md/bindings/0',
    });
    expect(result.matches).toContainEqual({
      declaration: { kind: 'glob', pattern: '/src/decision/**/*.ts' },
      field: 'affectedBy',
      inputPath: '/src/decision/rule.ts',
      owner: {
        agentId: null,
        id: '/moldea/decisions/1786050123456-use-postgresql.md',
        kind: 'decision',
      },
      pointer: '/decisions/~1moldea~1decisions~11786050123456-use-postgresql.md/affectedBy/0',
    });
    expect(result.matches.every((match) => !('content' in match.declaration))).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.matches)).toBe(true);
    expect(Object.isFrozen(result.matches[0]?.owner)).toBe(true);
  });

  test('supports zero-segment globstars, segment wildcards, and exact case-sensitive paths', () => {
    const manifest: IMoldeaManifestV1 = {
      version: 1,
      context: {
        '/moldea/project.md': {
          affectedBy: ['/packages/orders/**/*.ts', '/apps/*/route.ts', '/Case/Exact.ts'],
        },
      },
    };
    const result = matchParsedManifestScope(
      manifest,
      [
        '/packages/orders/index.ts',
        '/packages/orders/archive/index.ts',
        '/apps/api/route.ts',
        '/apps/api/nested/route.ts',
        '/case/exact.ts',
        '/Case/Exact.ts',
      ].map(repositoryPath),
      DEFAULT_CORE_RESOURCE_LIMITS,
    );

    expect(result.matches.map(({ inputPath }) => inputPath)).toStrictEqual([
      '/Case/Exact.ts',
      '/apps/api/route.ts',
      '/packages/orders/archive/index.ts',
      '/packages/orders/index.ts',
    ]);
  });

  test('returns no matches for empty manifests or empty changed-path sets', () => {
    expect(
      matchParsedManifestScope({ version: 1 }, [], DEFAULT_CORE_RESOURCE_LIMITS),
    ).toStrictEqual({
      counts: {
        declarations: 0,
        inputPaths: 0,
        matchedOwners: 0,
        matchedPaths: 0,
        matches: 0,
      },
      matches: [],
    });
  });

  test('preserves deterministic order across manifest insertion order', () => {
    const first: IMoldeaManifestV1 = {
      version: 1,
      agents: {
        zeta: { runtime: { id: 'custom' }, affectedBy: ['/src/**'] },
        alpha: { runtime: { id: 'custom' }, affectedBy: ['/src/**'] },
      },
    };
    const second: IMoldeaManifestV1 = {
      version: 1,
      agents: {
        alpha: { runtime: { id: 'custom' }, affectedBy: ['/src/**'] },
        zeta: { runtime: { id: 'custom' }, affectedBy: ['/src/**'] },
      },
    };
    const paths = ['/src/z.ts', '/src/a.ts'].map(repositoryPath);

    expect(matchParsedManifestScope(first, paths, DEFAULT_CORE_RESOURCE_LIMITS)).toStrictEqual(
      matchParsedManifestScope(second, paths, DEFAULT_CORE_RESOURCE_LIMITS),
    );
  });

  test('handles representative large path and relationship sets without cross-bucket output', () => {
    const agentEntries = Array.from(
      { length: 32 },
      (_, index) =>
        [
          `agent-${index}`,
          {
            runtime: { id: 'custom' },
            affectedBy: [`/area-${index}/**/*.ts`],
          },
        ] as const,
    );
    const manifest: IMoldeaManifestV1 = {
      version: 1,
      agents: Object.fromEntries(agentEntries),
    };
    const paths = Array.from({ length: 2_048 }, (_, index) =>
      repositoryPath(`/area-${index % 32}/group-${index}/file.ts`),
    );
    const result = matchParsedManifestScope(manifest, paths, DEFAULT_CORE_RESOURCE_LIMITS);

    expect(result.counts).toStrictEqual({
      declarations: 32,
      inputPaths: 2_048,
      matchedOwners: 32,
      matchedPaths: 2_048,
      matches: 2_048,
    });
  });

  test('rejects match output above the configured entry budget', () => {
    const manifest: IMoldeaManifestV1 = {
      version: 1,
      agents: {
        agent: { runtime: { id: 'custom' }, affectedBy: ['/src/**'] },
      },
    };

    expect(() =>
      matchParsedManifestScope(manifest, ['/src/a.ts', '/src/b.ts'].map(repositoryPath), {
        ...DEFAULT_CORE_RESOURCE_LIMITS,
        maxEntries: 1,
      }),
    ).toThrowError(
      expect.objectContaining({
        code: 'RESOURCE_LIMIT_EXCEEDED',
        limit: 'maxEntries',
        operation: 'match-manifest-scope',
      }),
    );
  });

  test('digests the sorted unique path-set encoding deterministically', async () => {
    const first = await calculateManifestScopeInputDigest(['/a.ts', '/z.ts'].map(repositoryPath));
    const same = await calculateManifestScopeInputDigest(['/a.ts', '/z.ts'].map(repositoryPath));
    const different = await calculateManifestScopeInputDigest(
      ['/a.ts', '/z.js'].map(repositoryPath),
    );

    expect(first).toBe(same);
    expect(first).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(different).not.toBe(first);
  });
});

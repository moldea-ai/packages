// @vitest-environment node
import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'vitest';

import {
  parseRepositoryPath,
  type IRepositoryEntry,
  type IRepositoryPath,
} from '@moldea.ai/repository';
import {
  createMemoryRepositoryReader,
  createIntegratedMemoryRepositoryReader,
  overrideCoreTestRepositoryReader,
  type ICoreTestRepositoryReader,
  type IMemoryRepositoryEntry,
} from '../repository.test-fixtures.js';

import { discoverCanonicalAssets } from '../canonical-discovery/index.js';
import { createCore } from '../core/index.js';
import { readDecisionGraph } from '../decision-graph/index.js';
import type { ICoreDiagnostic } from '../diagnostics/index.js';
import type { IDecisionStatus } from '../format/index.js';
import { normalizeCoreOptions } from '../options/index.js';

import { validateManifestRelationships } from './index.js';

interface IDecisionFixture {
  readonly id: string;
  readonly slug: string;
  readonly status: IDecisionStatus;
}

interface IExpectedDiagnostic {
  readonly code: string;
  readonly details: Readonly<Record<string, string>>;
  readonly entity: Readonly<Record<string, string>> | null;
  readonly path: string;
  readonly pointer: string | null;
}

interface IManifestRelationshipFixture {
  readonly cases: readonly {
    readonly name: string;
    readonly manifest: string;
    readonly contextPaths: readonly string[];
    readonly decisions: readonly IDecisionFixture[];
    readonly expectedDiagnostics: readonly IExpectedDiagnostic[];
  }[];
}

const fixture = JSON.parse(
  readFileSync(
    new URL('../../../../fixtures/core/manifest-relationships/cases.json', import.meta.url),
    'utf8',
  ),
) as IManifestRelationshipFixture;
const options = normalizeCoreOptions(undefined);

const createDecisionPath = (decision: IDecisionFixture): IRepositoryPath => {
  return parseRepositoryPath(`/moldea/decisions/${decision.id}-${decision.slug}.md`);
};

const createDecisionContent = (decision: IDecisionFixture): string => {
  return [
    '---',
    `status: ${decision.status}`,
    `createdAt: "${new Date(Number(decision.id)).toISOString()}"`,
    '---',
    `Decision ${decision.id}.`,
    '',
  ].join('\n');
};

const createRepositoryEntries = (
  fixtureCase: Pick<
    IManifestRelationshipFixture['cases'][number],
    'manifest' | 'contextPaths' | 'decisions'
  >,
): readonly IMemoryRepositoryEntry[] => [
  { content: fixtureCase.manifest, path: '/moldea/moldea.yaml', type: 'file' },
  { content: '# Project\n', path: '/moldea/project.md', type: 'file' },
  ...fixtureCase.contextPaths.map((path): IMemoryRepositoryEntry => ({
    content: `# ${path}\n`,
    path,
    type: 'file',
  })),
  ...fixtureCase.decisions.map((decision): IMemoryRepositoryEntry => ({
    content: createDecisionContent(decision),
    path: createDecisionPath(decision),
    type: 'file',
  })),
];

const reverseEnumeration = (repository: ICoreTestRepositoryReader): ICoreTestRepositoryReader =>
  overrideCoreTestRepositoryReader(repository, {
    getEntry: (path, operationOptions) => repository.getEntry(path, operationOptions),
    iterateEntries: (operationOptions): AsyncIterable<IRepositoryEntry> => ({
      async *[Symbol.asyncIterator]() {
        const entries: IRepositoryEntry[] = [];

        for await (const entry of repository.iterateEntries(operationOptions)) {
          entries.push(entry);
        }

        for (const entry of entries.reverse()) {
          yield entry;
        }
      },
    }),
    readCompleteFile: (path, operationOptions) =>
      repository.readCompleteFile(path, operationOptions),
  });

const simplifyDiagnostics = (diagnostics: readonly ICoreDiagnostic[]) => {
  return diagnostics.map(({ code, details, entity, path, pointer }) => ({
    code,
    details: { ...details },
    entity: entity === null ? null : { ...entity },
    path,
    pointer,
  }));
};

const validateRepositoryRelationships = async (repository: ICoreTestRepositoryReader) => {
  const discovery = await discoverCanonicalAssets(repository, options.limits);
  const manifestPath = discovery.inventory.manifest;

  expect(discovery.diagnostics).toStrictEqual([]);
  if (manifestPath === null) {
    throw new TypeError('The relationship fixture must include a manifest.');
  }

  const manifestResult = await createCore().parseManifest({
    content: await repository.readCompleteFile(manifestPath),
    path: manifestPath,
  });
  const decisionGraph = await readDecisionGraph(repository, discovery.inventory.decisions, options);

  expect(manifestResult.diagnostics).toStrictEqual([]);
  expect(decisionGraph.diagnostics).toStrictEqual([]);
  if (manifestResult.manifest === null) {
    throw new TypeError('The relationship fixture manifest must be valid.');
  }

  return validateManifestRelationships(
    manifestPath,
    manifestResult.manifest,
    discovery,
    decisionGraph.decisions,
    options.limits,
  );
};

describe('Core manifest relationships through the memory repository reader', () => {
  test.each([[0], [1]])(
    'retains authored context and decision indexes through Core (%d)',
    async (missingIndex) => {
      const contextPaths = ['/moldea/context/z.md', '/moldea/context/a.md'];
      const decisions: IDecisionFixture[] = [
        { id: '1767225600001', slug: 'z', status: 'proposed' },
        { id: '1767225600000', slug: 'a', status: 'proposed' },
      ];
      const fixtureCase = {
        manifest: JSON.stringify({
          version: 1,
          agents: {
            reviewer: {
              runtime: { id: 'custom' },
              context: contextPaths,
              decisions: decisions.map(createDecisionPath),
            },
          },
        }),
        contextPaths: contextPaths.filter((_, index) => index !== missingIndex),
        decisions: decisions.filter((_, index) => index !== missingIndex),
      };
      const repository = createIntegratedMemoryRepositoryReader([
        ...createRepositoryEntries(fixtureCase),
        { path: '/moldea/agents/reviewer/description.md', type: 'file', content: 'Reviewer.\n' },
        {
          path: '/moldea/agents/reviewer/instruction.md',
          type: 'file',
          content: 'You are the `reviewer` agent. Follow project policy.\n',
        },
      ]);
      const result = await createCore().validateProject({ repository });

      expect(result.valid).toBe(false);
      expect(result.errorCount).toBe(3);
      expect(simplifyDiagnostics(result.diagnostics)).toStrictEqual([
        {
          code: 'MOLDEA_REFERENCE_MISSING',
          details: { referencedPath: contextPaths[missingIndex] },
          entity: { agentId: 'reviewer' },
          path: '/moldea/moldea.yaml',
          pointer: `/agents/reviewer/context/${missingIndex}`,
        },
        ...decisions.map((decision, index) => ({
          code:
            index === missingIndex
              ? 'MOLDEA_DECISION_REFERENCE_MISSING'
              : 'MOLDEA_DECISION_RELATIONSHIP_INACTIVE',
          details: {
            referencedPath: createDecisionPath(decision),
            ...(index === missingIndex ? {} : { targetStatus: 'proposed' }),
          },
          entity: { agentId: 'reviewer', decisionId: decision.id },
          path: '/moldea/moldea.yaml',
          pointer: `/agents/reviewer/decisions/${index}`,
        })),
      ]);
    },
  );

  test.each(fixture.cases)('returns exact relationship diagnostics for $name', async (case_) => {
    const repository = createMemoryRepositoryReader(createRepositoryEntries(case_));
    const diagnostics = await validateRepositoryRelationships(repository);

    expect(simplifyDiagnostics(diagnostics)).toStrictEqual(case_.expectedDiagnostics);
    expect(Object.isFrozen(diagnostics)).toBe(true);
    expect(Object.isFrozen(diagnostics[0])).toBe(true);
  });

  test('is independent of repository enumeration and fixture insertion order', async () => {
    const fixtureCase = fixture.cases[0];
    if (fixtureCase === undefined) {
      throw new TypeError('The resolved relationship fixture is required.');
    }

    const entries = createRepositoryEntries(fixtureCase);
    const expected = await validateRepositoryRelationships(createMemoryRepositoryReader(entries));
    const reorderedRepository = reverseEnumeration(
      createMemoryRepositoryReader([...entries].reverse()),
    );

    expect(await validateRepositoryRelationships(reorderedRepository)).toStrictEqual(expected);
  });

  test('suppresses relationship noise for discovery and decision parsing failures', async () => {
    const contextPath = parseRepositoryPath('/moldea/context/blocked.md');
    const decisionPath = parseRepositoryPath('/moldea/decisions/1767225600000-invalid.md');
    const repository = createMemoryRepositoryReader([
      {
        content:
          'version: 1\ncontext:\n  /moldea/context/blocked.md:\n    affectedBy:\n      - /src/**\ndecisions:\n  /moldea/decisions/1767225600000-invalid.md:\n    affectedBy:\n      - /src/**\n',
        path: '/moldea/moldea.yaml',
        type: 'file',
      },
      { content: '# Project\n', path: '/moldea/project.md', type: 'file' },
      { path: contextPath, target: 'linked-target.md', type: 'symlink' },
      { content: 'Not decision frontmatter.\n', path: decisionPath, type: 'file' },
    ]);
    const discovery = await discoverCanonicalAssets(repository, options.limits);
    const manifestResult = await createCore().parseManifest({
      content: await repository.readCompleteFile(parseRepositoryPath('/moldea/moldea.yaml')),
      path: parseRepositoryPath('/moldea/moldea.yaml'),
    });
    const decisionGraph = await readDecisionGraph(
      repository,
      discovery.inventory.decisions,
      options,
    );

    expect(discovery.diagnostics).toMatchObject([
      { code: 'MOLDEA_CANONICAL_ASSET_SYMLINK', path: contextPath },
    ]);
    expect(decisionGraph.diagnostics).toMatchObject([
      { code: 'MOLDEA_DECISION_FRONTMATTER_MISSING', path: decisionPath },
    ]);
    if (manifestResult.manifest === null) {
      throw new TypeError('The suppression fixture manifest must be valid.');
    }

    expect(
      validateManifestRelationships(
        parseRepositoryPath('/moldea/moldea.yaml'),
        manifestResult.manifest,
        discovery,
        decisionGraph.decisions,
        options.limits,
      ),
    ).toStrictEqual([]);
  });
});

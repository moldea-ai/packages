// @vitest-environment node
import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'vitest';

import { RepositorySourceException, parseRepositoryPath } from '@moldea.ai/repository';

import {
  createIntegratedMemoryRepositoryReader,
  type ICoreTestRepositoryReader,
  type IMemoryRepositoryEntry,
} from '../repository.test-fixtures.js';

import { discoverCanonicalAssets } from '../canonical-discovery/index.js';
import { createCore } from '../core/index.js';
import type { ICoreDiagnostic } from '../diagnostics/index.js';
import { normalizeCoreOptions } from '../options/index.js';
import { createRepositoryInspectionSession } from '../repository-inspection-session/index.js';

import { validateRepositoryReferences } from './index.js';

interface IExpectedDiagnostic {
  readonly code: string;
  readonly details: Readonly<Record<string, string>>;
  readonly entity: Readonly<Record<string, string>> | null;
  readonly path: string;
  readonly pointer: string | null;
}

interface IRepositoryReferenceFixture {
  readonly cases: readonly {
    readonly name: string;
    readonly manifest: string;
    readonly entries: readonly IMemoryRepositoryEntry[];
    readonly expectedDiagnostics: readonly IExpectedDiagnostic[];
  }[];
}

const fixture = JSON.parse(
  readFileSync(
    new URL('../../../../fixtures/core/repository-references/cases.json', import.meta.url),
    'utf8',
  ),
) as IRepositoryReferenceFixture;
const options = normalizeCoreOptions(undefined);

const createRepositoryEntries = (
  fixtureCase: IRepositoryReferenceFixture['cases'][number],
): readonly IMemoryRepositoryEntry[] => [
  { content: fixtureCase.manifest, path: '/moldea/moldea.yaml', type: 'file' },
  { content: '# Project\n', path: '/moldea/project.md', type: 'file' },
  ...fixtureCase.entries,
];

const simplifyDiagnostics = (diagnostics: readonly ICoreDiagnostic[]) => {
  return diagnostics.map(({ code, details, entity, path, pointer }) => ({
    code,
    details: { ...details },
    entity: entity === null ? null : { ...entity },
    path,
    pointer,
  }));
};

const validateFixture = async (sourceRepository: ICoreTestRepositoryReader) => {
  const session = createRepositoryInspectionSession(sourceRepository, options.limits);
  const discovery = await discoverCanonicalAssets(session.reader, options.limits);
  const manifestPath = discovery.inventory.manifest;

  expect(discovery.diagnostics).toStrictEqual([]);
  if (manifestPath === null) {
    throw new TypeError('The repository-reference fixture must include a manifest.');
  }

  const manifestResult = await createCore().parseManifest({
    content: await session.reader.readCompleteFile(manifestPath),
    path: manifestPath,
  });

  expect(manifestResult.diagnostics).toStrictEqual([]);
  if (manifestResult.manifest === null) {
    throw new TypeError('The repository-reference fixture manifest must be valid.');
  }

  return validateRepositoryReferences(
    session.reader,
    manifestPath,
    manifestResult.manifest,
    discovery,
    options.limits,
  );
};

describe('Core repository references through the memory repository reader', () => {
  test.each(fixture.cases)('returns exact repository diagnostics for $name', async (case_) => {
    const repository = createIntegratedMemoryRepositoryReader(createRepositoryEntries(case_));
    const diagnostics = await validateFixture(repository);

    expect(simplifyDiagnostics(diagnostics)).toStrictEqual(case_.expectedDiagnostics);
    expect(Object.isFrozen(diagnostics)).toBe(true);
    expect(Object.isFrozen(diagnostics[0])).toBe(true);
  });

  test('is independent of repository fixture insertion order', async () => {
    const fixtureCase = fixture.cases[1];
    if (fixtureCase === undefined) {
      throw new TypeError('The invalid repository-reference fixture is required.');
    }

    const entries = createRepositoryEntries(fixtureCase);
    const expected = await validateFixture(createIntegratedMemoryRepositoryReader(entries));
    const reorderedRepository = createIntegratedMemoryRepositoryReader([...entries].reverse());

    expect(await validateFixture(reorderedRepository)).toStrictEqual(expected);
  });
});

const createExportRepository = (
  content: string | Uint8Array,
  sourcePath = '/src/entry.ts',
  symbol: string | null = 'entry',
) =>
  createIntegratedMemoryRepositoryReader([
    {
      path: '/moldea/moldea.yaml',
      type: 'file',
      content: JSON.stringify({
        version: 1,
        context: {
          '/moldea/project.md': {
            bindings: [{ path: sourcePath, ...(symbol === null ? {} : { symbol }) }],
          },
        },
      }),
    },
    { path: '/moldea/project.md', type: 'file', content: '# Project\n' },
    { path: sourcePath, type: 'file', content },
  ]);

describe('universal binding coverage through Core', () => {
  test.each([
    ['ts', 'export const entry = 1;', 'entry', 'passed'],
    ['tsx', 'export const entry = <div />;', 'entry', 'passed'],
    ['mts', 'export function entry() {}', 'entry', 'passed'],
    ['cts', 'export class entry {}', 'entry', 'passed'],
    ['js', 'export const entry = 1;', 'entry', 'passed'],
    ['mjs', 'export function entry() {}', 'entry', 'passed'],
    ['jsx', 'export const entry = <div />;', 'entry', 'passed'],
    ['ts', 'export default () => 1;', 'default', 'passed'],
    ['ts', 'export { entry } from "./elsewhere.js";', 'entry', 'passed'],
    ['ts', 'export * as entry from "./elsewhere.js";', 'entry', 'passed'],
    ['ts', 'export const other = 1;', 'entry', 'failed'],
    ['ts', 'export interface entry {}', 'entry', 'failed'],
    ['ts', 'export type entry = string;', 'entry', 'failed'],
    ['ts', 'export declare const entry: string;', 'entry', 'failed'],
    ['ts', 'interface Local {} export { Local as entry };', 'entry', 'failed'],
    [
      'ts',
      'import type { Local } from "./types.js"; export { Local as entry };',
      'entry',
      'failed',
    ],
    ['ts', 'export { type Local as entry } from "./types.js";', 'entry', 'failed'],
    ['ts', 'export type * as entry from "./types.js";', 'entry', 'failed'],
    ['ts', 'import type * as Local from "./types.js"; export {Local as entry};', 'entry', 'failed'],
    ['ts', 'declare const Local: string; export {Local as entry};', 'entry', 'failed'],
    ['ts', 'interface Local {} class Local {} export {Local as entry};', 'entry', 'passed'],
  ])('checks %s export %s (%s) -> %s', async (extension, source, symbol, expected) => {
    const result = await createCore().validateProject({
      repository: createExportRepository(source, `/src/entry.${extension}`, symbol),
    });
    expect(result.coverage).toStrictEqual([
      {
        entity: { contextPath: '/moldea/project.md' },
        relationship: 'context-binding',
        path: `/src/entry.${extension}`,
        symbol,
        fileCheck: 'passed',
        exportCheck: expected,
      },
    ]);
    expect(result.valid).toBe(expected === 'passed');
    expect(result.coverageCounts).toStrictEqual({
      bindings: 1,
      exportsPassed: expected === 'passed' ? 1 : 0,
      exportsFailed: expected === 'failed' ? 1 : 0,
      exportsNotChecked: 0,
    });
    expect(
      result.diagnostics.map(({ code, severity, group }) => ({ code, severity, group })),
    ).toStrictEqual(
      expected === 'passed'
        ? []
        : [{ code: 'MOLDEA_REFERENCE_EXPORT_MISSING', severity: 'error', group: 'references' }],
    );
  });

  test.each([
    ['ts', 'export * from "./elsewhere.js";', 'unresolved-exports'],
    ['cts', 'export = {}', 'unresolved-exports'],
    ['js', 'exports.entry = 1; delete exports.entry;', 'unresolved-exports'],
    ['js', 'module["exports"] = { entry: 1 }; module.exports = {};', 'unresolved-exports'],
    ['js', 'export const entry = 1; exports["entry"] = 2;', 'unresolved-exports'],
    ['js', 'Object.assign(exports, {entry: 1});', 'unresolved-exports'],
    ['js', 'const alias = module; alias.exports = {entry: 1};', 'unresolved-exports'],
    ['ts', 'export const { entry } = {entry: 1};', 'unresolved-exports'],
    ['ts', 'export const entry = ;', 'unparseable-source'],
    [
      'ts',
      'export const entry = ' + '('.repeat(4096) + '0' + ')'.repeat(4096) + ';',
      'unparseable-source',
    ],
    ['cjs', 'module.exports = {};', 'unsupported-file-type'],
    ['d.ts', 'export declare const entry: string;', 'unsupported-file-type'],
    ['py', 'entry = 1', 'unsupported-file-type'],
  ])('records inconclusive %s source (%s) -> %s', async (extension, source, reason) => {
    const result = await createCore().validateProject({
      repository: createExportRepository(source, `/src/entry.${extension}`),
    });
    expect(result.valid).toBe(true);
    expect(result.diagnostics).toStrictEqual([]);
    expect(result.coverage).toMatchObject([
      { fileCheck: 'passed', exportCheck: 'not-checked', exportNotCheckedReason: reason },
    ]);
    expect(result.coverageCounts).toStrictEqual({
      bindings: 1,
      exportsPassed: 0,
      exportsFailed: 0,
      exportsNotChecked: 1,
    });
  });

  test('records a file-only binding without parsing its source', async () => {
    const result = await createCore().validateProject({
      repository: createExportRepository('invalid syntax', '/src/entry.ts', null),
    });
    expect(result.coverage).toMatchObject([
      { symbol: null, exportCheck: 'not-checked', exportNotCheckedReason: 'no-symbol' },
    ]);
  });

  test('records invalid UTF-8 as an inconclusive export check', async () => {
    const result = await createCore().validateProject({
      repository: createExportRepository(new Uint8Array([255])),
    });
    expect(result.coverage).toMatchObject([
      { exportCheck: 'not-checked', exportNotCheckedReason: 'unparseable-source' },
    ]);
    expect(result.valid).toBe(true);
  });

  test('skips parsing when its pre-parse reservation would exhaust the ledger', async () => {
    const result = await createCore({ limits: { maxRetainedBytes: 131_072 } }).validateProject({
      repository: createExportRepository(' '.repeat(4096) + 'export const entry = ;'),
    });
    expect(result.valid).toBe(true);
    expect(result.coverage).toMatchObject([
      { exportCheck: 'not-checked', exportNotCheckedReason: 'resource-limit' },
    ]);
  });

  test('preserves failed export coverage and counts on a filtered inspection page', async () => {
    const inspection = await createCore().createProjectInspection({
      repository: createExportRepository('export const other = 1;'),
    });
    const page = inspection.readPage({ view: 'coverage', maxItems: 1 });
    expect(inspection.valid).toBe(false);
    expect(page.coverageCounts).toStrictEqual({
      bindings: 1,
      exportsPassed: 0,
      exportsFailed: 1,
      exportsNotChecked: 0,
    });
    expect(page.page.records).toMatchObject([
      { item: { kind: 'coverage', coverage: { fileCheck: 'passed', exportCheck: 'failed' } } },
    ]);
    expect(inspection.readPage({ view: 'diagnostics', maxItems: 1 }).page.records).toMatchObject([
      { item: { kind: 'diagnostic', diagnostic: { code: 'MOLDEA_REFERENCE_EXPORT_MISSING' } } },
    ]);
  });

  test('does not report a successful file check when a bound file is missing', async () => {
    const source = createExportRepository('export const entry = 1;');
    const repository = {
      ...source,
      getEntry: (
        path: Parameters<typeof source.getEntry>[0],
        options: Parameters<typeof source.getEntry>[1],
      ) => (path === '/src/entry.ts' ? Promise.resolve(null) : source.getEntry(path, options)),
    };
    const result = await createCore().validateProject({ repository });
    expect(result.coverage).toStrictEqual([]);
    expect(result.valid).toBe(false);
    expect(result.diagnostics.map(({ code }) => code)).toStrictEqual(['MOLDEA_REFERENCE_MISSING']);
  });

  test('rejects the whole inspection when a bound source read fails', async () => {
    const source = createExportRepository('export const entry = 1;');
    const failure = new RepositorySourceException({
      code: 'SOURCE_UNAVAILABLE',
      operation: 'read-file-page',
      path: parseRepositoryPath('/src/entry.ts'),
      retryable: true,
    });
    const repository = {
      ...source,
      readFilePage: (
        path: Parameters<typeof source.readFilePage>[0],
        options: Parameters<typeof source.readFilePage>[1],
      ) =>
        path === '/src/entry.ts' ? Promise.reject(failure) : source.readFilePage(path, options),
    };
    await expect(createCore().validateProject({ repository })).rejects.toBe(failure);
  });

  test('propagates cancellation during a bound source read without returning coverage', async () => {
    const source = createExportRepository('export const entry = 1;');
    const controller = new AbortController();
    const repository = {
      ...source,
      readFilePage: (
        path: Parameters<typeof source.readFilePage>[0],
        options: Parameters<typeof source.readFilePage>[1],
      ) => {
        if (path === '/src/entry.ts') controller.abort();
        return source.readFilePage(path, options);
      },
    };
    await expect(
      createCore().validateProject({ repository, signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'ABORTED' });
  });

  test('rejects a source exceeding maxFileBytes instead of returning inconclusive coverage', async () => {
    await expect(
      createCore({ limits: { maxFileBytes: 1024 } }).validateProject({
        repository: createExportRepository(' '.repeat(2048)),
      }),
    ).rejects.toMatchObject({ code: 'RESOURCE_LIMIT_EXCEEDED', limit: 'maxFileBytes' });
  });

  test('checks every binding kind while parsing a shared source once per operation', async () => {
    const reference = { path: '/src/entry.ts', symbol: 'entry' };
    const decisionPath = '/moldea/decisions/1786131723456-use-postgresql.md';
    const manifest = {
      version: 1,
      context: { '/moldea/project.md': { bindings: [reference] } },
      decisions: { [decisionPath]: { bindings: [reference] } },
      agents: {
        reviewer: {
          runtime: { id: 'openai' },
          variables: { REGION: { description: 'The region.' } },
          bindings: {
            runtimeAgent: reference,
            instructionLoader: reference,
            inputSchema: reference,
            outputSchema: reference,
            variableProviders: { REGION: reference },
          },
          tools: {
            lookup: {
              name: 'Lookup',
              description: 'Looks up an order.',
              implementation: reference,
              registration: reference,
              inputSchema: reference,
              outputSchema: reference,
            },
          },
          skills: {
            audit: {
              name: 'Audit',
              description: 'Audits an order.',
              implementation: reference,
              registration: reference,
            },
          },
        },
      },
    };
    const source = createIntegratedMemoryRepositoryReader([
      { path: '/moldea/moldea.yaml', type: 'file', content: JSON.stringify(manifest) },
      { path: '/moldea/project.md', type: 'file', content: '# Project\n' },
      {
        path: decisionPath,
        type: 'file',
        content:
          '---\nstatus: accepted\ncreatedAt: "2026-08-07T19:42:03.456Z"\n---\nUse PostgreSQL.\n',
      },
      {
        path: '/moldea/agents/reviewer/description.md',
        type: 'file',
        content: 'Reviews orders.\n',
      },
      {
        path: '/moldea/agents/reviewer/instruction.md',
        type: 'file',
        content: 'You are the `reviewer` agent. Region: {{REGION}}.\n',
      },
      { path: reference.path, type: 'file', content: 'export const entry = 1;' },
    ]);
    let reads = 0;
    const repository = {
      ...source,
      readFilePage: (
        path: Parameters<typeof source.readFilePage>[0],
        options: Parameters<typeof source.readFilePage>[1],
      ) => {
        if (path === reference.path) reads++;
        return source.readFilePage(path, options);
      },
    };
    const inspection = await createCore().createProjectInspection({ repository });
    expect(inspection.valid).toBe(true);
    expect(inspection.coverageCounts).toStrictEqual({
      bindings: 13,
      exportsPassed: 13,
      exportsFailed: 0,
      exportsNotChecked: 0,
    });
    const records: string[] = [];
    let cursor: string | undefined;
    do {
      const page = inspection.readPage({
        view: 'coverage',
        maxItems: 4,
        ...(cursor === undefined ? {} : { cursor }),
      });
      expect(page.coverageCounts).toStrictEqual(inspection.coverageCounts);
      expect(page.page.records.length).toBeLessThanOrEqual(4);
      for (const { item } of page.page.records) {
        expect(item.kind).toBe('coverage');
        if (item.kind === 'coverage') records.push(item.coverage.relationship);
      }
      cursor = page.page.nextCursor ?? undefined;
    } while (cursor !== undefined);
    expect(new Set(records).size).toBe(13);
    expect(reads).toBe(1);
  });

  test.each([64, 1024])(
    'releases parse reservations across %d distinct bound files',
    async (count) => {
      const paths = Array.from({ length: count }, (_, index) => `/src/entry-${index}.ts`);
      const repository = createIntegratedMemoryRepositoryReader([
        {
          path: '/moldea/moldea.yaml',
          type: 'file',
          content: JSON.stringify({
            version: 1,
            context: {
              '/moldea/project.md': { bindings: paths.map((path) => ({ path, symbol: 'entry' })) },
            },
          }),
        },
        { path: '/moldea/project.md', type: 'file', content: '# Project\n' },
        ...paths.map((path) => ({
          path,
          type: 'file' as const,
          content: 'export const entry = 1;' + ' '.repeat(4096),
        })),
      ]);
      const inspection = await createCore({
        limits: { maxRetainedBytes: 8_388_608 },
      }).createProjectInspection({ repository });
      expect(inspection.valid).toBe(true);
      expect(inspection.coverageCounts.exportsPassed).toBe(count);
      expect(inspection.resourceUsage.peakRetainedBytes).toBeLessThanOrEqual(8_388_608);
    },
  );

  test('bounds a source near maxFileBytes without admitting an oversized syntax tree', async () => {
    const result = await createCore().validateProject({
      repository: createExportRepository('export const entry = 1;' + ' '.repeat(8_388_000)),
    });
    expect(result.valid).toBe(true);
    expect(result.coverage).toMatchObject([
      { exportCheck: 'not-checked', exportNotCheckedReason: 'resource-limit' },
    ]);
  });

  test('fails the operation when coverage exceeds its independent bound', async () => {
    const repository = createIntegratedMemoryRepositoryReader([
      {
        path: '/moldea/moldea.yaml',
        type: 'file',
        content: JSON.stringify({
          version: 1,
          context: {
            '/moldea/project.md': {
              bindings: [
                { path: '/src/entry.ts', symbol: 'entry' },
                { path: '/src/entry.ts', symbol: 'other' },
              ],
            },
          },
        }),
      },
      { path: '/moldea/project.md', type: 'file', content: '# Project\n' },
      {
        path: '/src/entry.ts',
        type: 'file',
        content: 'export const entry = 1; export const other = 2;',
      },
    ]);
    await expect(
      createCore({ limits: { maxCoverage: 1 } }).validateProject({ repository }),
    ).rejects.toMatchObject({ code: 'RESOURCE_LIMIT_EXCEEDED', limit: 'maxCoverage' });
  });
});

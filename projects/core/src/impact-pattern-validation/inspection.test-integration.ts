// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { parseRepositoryPath, RepositorySourceException } from '@moldea.ai/repository';

import { createCore } from '../core/index.js';
import {
  createIntegratedMemoryRepositoryReader,
  type IMemoryRepositoryEntry,
} from '../repository.test-fixtures.js';
import { matchManifestScope } from '../scope/index.js';

const code = 'MOLDEA_IMPACT_PATTERN_UNMATCHED';
const subject = '/moldea/project.md';
const reason = 'This area is intentionally reserved for the next release.';
const acceptance = (qualifier: string) => ({ code, subject, qualifier, reason });
const createRepository = (
  patterns: string[],
  acceptedWarnings: unknown[] = [],
  entries: IMemoryRepositoryEntry[] = [],
  bindings?: { path: string; symbol: string }[],
) =>
  createIntegratedMemoryRepositoryReader([
    {
      path: '/moldea/moldea.yaml',
      type: 'file',
      content: JSON.stringify({
        version: 1,
        context: {
          [subject]: { affectedBy: patterns, ...(bindings === undefined ? {} : { bindings }) },
        },
        ...(acceptedWarnings.length === 0 ? {} : { acceptedWarnings }),
      }),
    },
    { path: subject, type: 'file', content: '# Project\n' },
    ...entries,
  ]);

describe('bounded impact warnings and manifest acceptance through Core', () => {
  test('reports an unmatched pattern with its canonical owner and stable identity', async () => {
    const result = await createCore().validateProject({
      repository: createRepository(['/future/**']),
    });
    expect(result.valid).toBe(true);
    expect(result.summary).not.toBeNull();
    expect(result.diagnostics).toMatchObject([
      {
        code,
        severity: 'warning',
        group: 'references',
        subject,
        qualifier: '/future/**',
        acceptable: true,
        entity: { contextPath: subject },
      },
    ]);
    expect(result.warningCount).toBe(1);
    expect(result.acceptedWarningCount).toBe(0);
    expect(result.diagnosticCount).toBe(1);
  });

  test('retains accepted findings and reasons while excluding them from the warning count', async () => {
    const repository = createRepository(['/future/**'], [acceptance('/future/**')]);
    const result = await createCore().validateProject({ repository });
    expect(result.diagnostics).toMatchObject([{ code, accepted: true, reason, acceptable: true }]);
    expect(result.warningCount).toBe(0);
    expect(result.acceptedWarningCount).toBe(1);
    expect(result.diagnosticCount).toBe(1);
    expect(result.valid).toBe(true);
    const inspection = await createCore().createProjectInspection({ repository });
    const page = inspection.readPage({ view: 'diagnostics', maxItems: 1 });
    expect(page.counts).toMatchObject({
      warnings: 0,
      acceptedWarnings: 1,
      diagnostics: 1,
      errors: 0,
    });
    expect(page.page.records).toMatchObject([
      { item: { kind: 'diagnostic', diagnostic: { accepted: true, reason } } },
    ]);
    expect(inspection.readPage({ view: 'metadata', maxItems: 1 }).counts).toStrictEqual(
      page.counts,
    );
  });

  test('reports an obsolete acceptance only after the pattern check completes', async () => {
    const repository = createRepository(
      ['/src/**'],
      [acceptance('/src/**')],
      [{ path: '/src/entry.ts', type: 'file', content: '' }],
    );
    const result = await createCore().validateProject({ repository });
    expect(result.diagnostics).toMatchObject([
      {
        code: 'MOLDEA_ACCEPTANCE_UNMATCHED',
        severity: 'warning',
        group: 'manifest',
        subject: '/moldea/moldea.yaml',
        qualifier: '/acceptedWarnings/0',
        acceptable: false,
      },
    ]);
    expect(result.warningCount).toBe(1);
    expect(result.acceptedWarningCount).toBe(0);
  });

  test.each([{ subject: '/moldea/context/unrelated.md' }, { qualifier: '/other/**' }])(
    'requires the exact acceptance identity (%o)',
    async (change) => {
      const result = await createCore().validateProject({
        repository: createRepository(['/future/**'], [{ ...acceptance('/future/**'), ...change }]),
      });
      expect(result.acceptedWarningCount).toBe(0);
      expect(result.warningCount).toBe(2);
      expect(result.diagnostics.map(({ code }) => code).sort()).toStrictEqual([
        'MOLDEA_ACCEPTANCE_UNMATCHED',
        'MOLDEA_IMPACT_PATTERN_UNMATCHED',
      ]);
    },
  );

  test('uses canonical owner identities for context, decision, agent, tool, and skill patterns', async () => {
    const decisionPath = '/moldea/decisions/1786131723456-use-postgresql.md';
    const instructionPath = '/moldea/agents/reviewer/instruction.md';
    const repository = createIntegratedMemoryRepositoryReader([
      {
        path: '/moldea/moldea.yaml',
        type: 'file',
        content: JSON.stringify({
          version: 1,
          context: { [subject]: { affectedBy: ['/context-future/**'] } },
          decisions: { [decisionPath]: { affectedBy: ['/decision-future/**'] } },
          agents: {
            reviewer: {
              runtime: { id: 'openai' },
              affectedBy: ['/agent-future/**'],
              tools: {
                lookup: {
                  name: 'Lookup',
                  description: 'Looks up an order.',
                  implementation: { path: '/src/entry.ts' },
                  affectedBy: ['/tool-future/**'],
                },
              },
              skills: {
                audit: {
                  name: 'Audit',
                  description: 'Audits an order.',
                  implementation: { path: '/src/entry.ts' },
                  affectedBy: ['/skill-future/**'],
                },
              },
            },
          },
        }),
      },
      { path: subject, type: 'file', content: '# Project\n' },
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
      { path: instructionPath, type: 'file', content: 'You are the `reviewer` agent.\n' },
      { path: '/src/entry.ts', type: 'file', content: '' },
    ]);
    const result = await createCore().validateProject({ repository });
    expect(result.valid).toBe(true);
    expect(result.warningCount).toBe(5);
    expect(
      result.diagnostics
        .filter((diagnostic) => diagnostic.severity === 'warning')
        .map(({ subject, qualifier, entity }) => ({
          subject,
          qualifier,
          entity: entity === null ? null : { ...entity },
        }))
        .sort((left, right) => left.qualifier!.localeCompare(right.qualifier!)),
    ).toStrictEqual([
      { subject: instructionPath, qualifier: '/agent-future/**', entity: { agentId: 'reviewer' } },
      { subject, qualifier: '/context-future/**', entity: { contextPath: subject } },
      {
        subject: decisionPath,
        qualifier: '/decision-future/**',
        entity: { decisionId: '1786131723456' },
      },
      {
        subject: instructionPath,
        qualifier: '/skill-future/**',
        entity: { agentId: 'reviewer', capabilityId: 'audit', capabilityKind: 'skill' },
      },
      {
        subject: instructionPath,
        qualifier: '/tool-future/**',
        entity: { agentId: 'reviewer', capabilityId: 'lookup', capabilityKind: 'tool' },
      },
    ]);
  });

  test('keeps mixed accepted warnings, unaccepted warnings, and errors in separate totals', async () => {
    const result = await createCore().validateProject({
      repository: createRepository(
        ['/future/**', '/later/**'],
        [acceptance('/future/**')],
        [{ path: '/src/entry.ts', type: 'file', content: 'export const other = 1;' }],
        [{ path: '/src/entry.ts', symbol: 'missing' }],
      ),
    });
    expect(result.valid).toBe(false);
    expect(result.errorCount).toBe(1);
    expect(result.warningCount).toBe(1);
    expect(result.acceptedWarningCount).toBe(1);
    expect(result.diagnosticCount).toBe(
      result.errorCount + result.warningCount + result.acceptedWarningCount,
    );
  });

  test('shares a fixed-prefix traversal and stops after the first file satisfies every pattern', async () => {
    const source = createRepository(
      ['/src/*.ts', '/src/a*.ts'],
      [],
      Array.from({ length: 1024 }, (_, index) => ({
        path: `/src/a${String(index).padStart(4, '0')}.ts`,
        type: 'file' as const,
        content: '',
      })),
    );
    let pages = 0;
    const repository = {
      ...source,
      listEntriesPage: (options: Parameters<typeof source.listEntriesPage>[0]) => {
        if (options.prefix === '/src') pages++;
        return source.listEntriesPage(options);
      },
    };
    const result = await createCore().validateProject({ repository });
    expect(result.diagnostics).toStrictEqual([]);
    expect(pages).toBe(1);
  });

  test('does not count directories or symlinks as matching files', async () => {
    const result = await createCore().validateProject({
      repository: createRepository(
        ['/src/*.ts'],
        [],
        [
          { path: '/src/directory.ts', type: 'directory' },
          { path: '/src/link.ts', target: 'linked-target.md', type: 'symlink' },
        ],
      ),
    });
    expect(result.diagnostics).toMatchObject([{ code, qualifier: '/src/*.ts' }]);
  });

  test('skips pattern warnings and acceptances when the remaining entry budget is exhausted', async () => {
    const repository = createRepository(
      ['/src/missing*'],
      [acceptance('/src/missing*')],
      Array.from({ length: 64 }, (_, index) => ({
        path: `/src/existing-${index}.ts`,
        type: 'file' as const,
        content: '',
      })),
    );
    // ten required entries, including the three Claude Code lookups, leave one for patterns
    const result = await createCore({ limits: { maxEntries: 11 } }).validateProject({ repository });
    expect(result.valid).toBe(true);
    expect(result.diagnostics).toStrictEqual([]);
  });

  test('completes validation when retained memory is exhausted during pattern inspection', async () => {
    const source = createRepository(
      ['/src/missing*'],
      [acceptance('/src/missing*')],
      Array.from({ length: 64 }, (_, index) => ({
        path: `/src/existing-${index}.ts`,
        type: 'file' as const,
        content: '',
      })),
    );
    let patternLookups = 0;
    const repository = {
      ...source,
      getEntry: (
        path: Parameters<typeof source.getEntry>[0],
        options: Parameters<typeof source.getEntry>[1],
      ) => {
        if (path === '/src') patternLookups += 1;
        return source.getEntry(path, options);
      },
    };
    const result = await createCore({ limits: { maxRetainedBytes: 8192 } }).validateProject({
      repository,
    });
    expect(result.valid).toBe(true);
    expect(patternLookups).toBeGreaterThan(0);
    expect(
      result.diagnostics.filter(
        ({ code }) =>
          code === 'MOLDEA_IMPACT_PATTERN_UNMATCHED' || code === 'MOLDEA_ACCEPTANCE_UNMATCHED',
      ),
    ).toStrictEqual([]);
  });

  test('skips pattern warnings and acceptances on a reader resource refusal', async () => {
    const source = createRepository(
      ['/src/missing*'],
      [acceptance('/src/missing*')],
      [{ path: '/src/entry.ts', type: 'file', content: '' }],
    );
    const repository = {
      ...source,
      listEntriesPage: (options: Parameters<typeof source.listEntriesPage>[0]) =>
        options.prefix === '/src'
          ? Promise.reject(
              new RepositorySourceException({
                code: 'RESOURCE_LIMIT_EXCEEDED',
                operation: 'list-entries-page',
                path: parseRepositoryPath('/src'),
                retryable: false,
                resource: { dimension: 'provider-requests', limit: 4, observed: 5 },
              }),
            )
          : source.listEntriesPage(options),
    };
    const result = await createCore().validateProject({ repository });
    expect(result.valid).toBe(true);
    expect(result.diagnostics).toStrictEqual([]);
  });

  test('propagates cancellation during the optional traversal', async () => {
    const source = createRepository(
      ['/src/missing*'],
      [],
      [{ path: '/src/entry.ts', type: 'file', content: '' }],
    );
    const controller = new AbortController();
    const repository = {
      ...source,
      listEntriesPage: (options: Parameters<typeof source.listEntriesPage>[0]) => {
        if (options.prefix === '/src') controller.abort();
        return source.listEntriesPage(options);
      },
    };
    await expect(
      createCore().validateProject({ repository, signal: controller.signal }),
    ).rejects.toMatchObject({ code: 'ABORTED' });
  });

  test('parses acceptances in scope without running warnings or acceptance matching', async () => {
    const result = await matchManifestScope({
      manifest: {
        path: parseRepositoryPath('/moldea/moldea.yaml'),
        content: JSON.stringify({
          version: 1,
          context: { [subject]: { affectedBy: ['/future/**'] } },
          acceptedWarnings: [acceptance('/future/**')],
        }),
      },
      paths: ['/unrelated.ts'],
    });
    expect(result.valid).toBe(true);
    expect(result.relevant).toBe(false);
    expect(result.diagnostics).toStrictEqual([]);
  });
});

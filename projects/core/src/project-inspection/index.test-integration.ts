// @vitest-environment node
import { describe, expect, test, vi } from 'vitest';

import { parseRepositoryPath } from '@moldea.ai/repository';

import type { IProjectInspectionPageRecord } from '../contracts/index.js';
import { createCore } from '../core/index.js';
import { CoreOperationException } from '../exceptions/index.js';
import {
  createMemoryRepositoryReader,
  overrideCoreTestRepositoryReader,
  type IMemoryRepositoryEntry,
} from '../repository.test-fixtures.js';

const createValidRepository = (projectContent: string) =>
  createMemoryRepositoryReader([
    {
      content: 'version: 1\n',
      path: parseRepositoryPath('/moldea/moldea.yaml'),
      type: 'file',
    },
    {
      content: projectContent,
      path: parseRepositoryPath('/moldea/project.md'),
      type: 'file',
    },
  ]);

const createAgentRepository = (assignments: readonly { agentId: string; runtimeId: string }[]) => {
  const manifest = [
    'version: 1',
    'agents:',
    ...assignments.flatMap(({ agentId, runtimeId }) => [
      `  ${agentId}:`,
      `    runtime: { id: ${runtimeId} }`,
    ]),
    '',
  ].join('\n');
  const entries: IMemoryRepositoryEntry[] = [
    {
      content: manifest,
      path: parseRepositoryPath('/moldea/moldea.yaml'),
      type: 'file',
    },
    {
      content: '# Project\n',
      path: parseRepositoryPath('/moldea/project.md'),
      type: 'file',
    },
  ];

  for (const { agentId } of assignments) {
    entries.push(
      {
        content: `${agentId} agent.\n`,
        path: parseRepositoryPath(`/moldea/agents/${agentId}/description.md`),
        type: 'file',
      },
      {
        content: `You are the \`${agentId}\` agent.\n`,
        path: parseRepositoryPath(`/moldea/agents/${agentId}/instruction.md`),
        type: 'file',
      },
    );
  }

  return createMemoryRepositoryReader(entries);
};

describe('prepared project inspection', () => {
  test('returns content-free pages without another repository operation', async () => {
    const source = createAgentRepository(
      Array.from({ length: 16 }, (_, index) => ({
        agentId: `agent${index.toString().padStart(2, '0')}`,
        runtimeId: 'custom',
      })),
    );
    const getEntry = vi.fn(source.getEntry.bind(source));
    const listEntriesPage = vi.fn(source.listEntriesPage.bind(source));
    const readFilePage = vi.fn(source.readFilePage.bind(source));
    const repository = overrideCoreTestRepositoryReader(source, {
      getEntry,
      listEntriesPage,
      readFilePage,
    });
    const inspection = await createCore().createProjectInspection({ repository });

    getEntry.mockClear();
    listEntriesPage.mockClear();
    readFilePage.mockClear();

    const records: IProjectInspectionPageRecord[] = [];
    let cursor: string | undefined;
    let pageCount = 0;

    do {
      const result = inspection.readPage({
        ...(cursor === undefined ? {} : { cursor }),
        maxItems: 4,
        view: 'all',
      });
      records.push(...result.page.records);
      cursor = result.page.nextCursor ?? undefined;
      pageCount += 1;
    } while (cursor !== undefined);

    expect(pageCount).toBeGreaterThan(10);
    expect(records).toHaveLength(inspection.readPage({ maxItems: 1, view: 'all' }).page.totalItems);
    expect(getEntry).not.toHaveBeenCalled();
    expect(listEntriesPage).not.toHaveBeenCalled();
    expect(readFilePage).not.toHaveBeenCalled();
    expect(JSON.stringify(inspection)).not.toContain('You are the');
  });

  test('binds cursors to one inspection digest and view', async () => {
    const inspection = await createCore().createProjectInspection({
      repository: createValidRepository('# First project\n'),
    });
    const firstPage = inspection.readPage({ maxItems: 1, view: 'metadata' });
    const cursor = firstPage.page.nextCursor;

    if (cursor === null) {
      throw new TypeError('The first page must expose a continuation cursor.');
    }

    const changedInspection = await createCore().createProjectInspection({
      repository: createValidRepository('# Changed project\n'),
    });

    expect(() => inspection.readPage({ cursor, maxItems: 1, view: 'all' })).toThrowError(
      expect.objectContaining({
        code: 'INVALID_ARGUMENT',
        operation: 'create-project-inspection',
      }),
    );
    expect(() =>
      changedInspection.readPage({ cursor, maxItems: 1, view: 'metadata' }),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_ARGUMENT' }));
  });

  test('returns one independent runtime assignment record per canonical agent', async () => {
    const core = createCore({
      adapters: [
        {
          id: 'openai',
          inspect: () => Promise.resolve({ diagnostics: [], evidence: [] }),
          supportedRepositoryFormatVersions: [1],
        },
      ],
    });
    const inspection = await core.createProjectInspection({
      repository: createAgentRepository([
        { agentId: 'agent-a', runtimeId: 'custom' },
        { agentId: 'agent', runtimeId: 'openai' },
      ]),
    });
    const metadata = inspection.readPage({ maxItems: 8, view: 'metadata' });
    const all = inspection.readPage({ maxItems: 16, view: 'all' });
    const expectedAssignments = [
      { agent: { agentId: 'agent', runtimeId: 'openai' }, kind: 'agent' },
      { agent: { agentId: 'agent-a', runtimeId: 'custom' }, kind: 'agent' },
    ];

    expect(metadata.counts).toMatchObject({ agents: 2, metadata: 6 });
    expect(metadata.page).toMatchObject({ isComplete: true, nextCursor: null, totalItems: 8 });
    expect(
      metadata.page.records.map(({ item }) => item).filter(({ kind }) => kind === 'agent'),
    ).toStrictEqual(expectedAssignments);
    expect(
      all.page.records.map(({ item }) => item).filter(({ kind }) => kind === 'agent'),
    ).toStrictEqual(expectedAssignments);
  });

  test('pages a large inventory in deterministic bounded slices', async () => {
    const assignments = Array.from({ length: 128 }, (_, index) => ({
      agentId: `agent${index.toString().padStart(3, '0')}`,
      runtimeId: 'custom',
    }));
    const inspection = await createCore().createProjectInspection({
      repository: createAgentRepository(assignments),
    });
    const records: IProjectInspectionPageRecord[] = [];
    let cursor: string | undefined;
    let totalItems: number | null = null;

    do {
      const result = inspection.readPage({
        ...(cursor === undefined ? {} : { cursor }),
        maxItems: 32,
        view: 'metadata',
      });

      expect(result.page.records.length).toBeLessThanOrEqual(32);
      if (totalItems !== null) {
        expect(result.page.totalItems).toBe(totalItems);
      }
      records.push(...result.page.records);
      totalItems = result.page.totalItems;
      cursor = result.page.nextCursor ?? undefined;
    } while (cursor !== undefined);

    if (totalItems === null) {
      throw new TypeError('The inspection must report a total item count.');
    }

    expect(records).toHaveLength(totalItems);
    expect(records.filter(({ item }) => item.kind === 'agent')).toHaveLength(assignments.length);
    expect(totalItems).toBe(386);
  });

  test('rejects malformed cursors and page limits synchronously', async () => {
    const inspection = await createCore().createProjectInspection({
      repository: createValidRepository('# Project\n'),
    });

    expect(() =>
      inspection.readPage({
        cursor: 'not-a-core-cursor',
        maxItems: 1,
        view: 'metadata',
      }),
    ).toThrowError(CoreOperationException);
    expect(() => inspection.readPage({ maxItems: 0, view: 'metadata' })).toThrowError(
      expect.objectContaining({ code: 'INVALID_ARGUMENT' }),
    );
  });

  test('preflights exact retained-byte boundaries before building prepared state', async () => {
    const repository = createValidRepository('# Project\n');
    const baseline = await createCore().createProjectInspection({ repository });
    let lower = 1;
    let upper = baseline.resourceUsage.peakRetainedBytes;

    while (lower < upper) {
      const candidate = lower + Math.floor((upper - lower) / 2);

      try {
        await createCore({ limits: { maxRetainedBytes: candidate } }).createProjectInspection({
          repository,
        });
        upper = candidate;
      } catch (error: unknown) {
        if (
          !(error instanceof CoreOperationException) ||
          error.code !== 'RESOURCE_LIMIT_EXCEEDED'
        ) {
          throw error;
        }

        lower = candidate + 1;
      }
    }

    const maximum = lower;
    const exact = await createCore({
      limits: { maxRetainedBytes: maximum },
    }).createProjectInspection({ repository });

    expect(exact.resourceUsage.peakRetainedBytes).toBe(maximum);
    await expect(
      createCore({ limits: { maxRetainedBytes: maximum - 1 } }).createProjectInspection({
        repository,
      }),
    ).rejects.toMatchObject({
      code: 'RESOURCE_LIMIT_EXCEEDED',
      limit: 'maxRetainedBytes',
      limitMaximum: maximum - 1,
      nextAction: 'reduce-input-or-increase-limit',
      observedUsage: maximum,
    });
    expect(baseline.resourceUsage.retainedBytes).toBe(baseline.resourceUsage.preparedBytes);
    expect(baseline.resourceUsage.peakRetainedBytes).toBeGreaterThan(
      baseline.resourceUsage.retainedBytes,
    );
    expect(JSON.stringify(baseline)).not.toContain('# Project');
  });
});

// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { parseRepositoryPath } from '@moldea.ai/repository';

import type { IProjectInspectionPageRecord } from '../contracts/index.js';
import { createCore } from '../core/index.js';
import { CoreOperationException } from '../exceptions/index.js';
import {
  createMemoryRepositoryReader,
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

describe('paged project inspection', () => {
  test('returns content-free metadata pages without gaps or duplicates', async () => {
    const core = createCore();
    const repository = createValidRepository('# Project\n');
    const firstPage = await core.inspectProjectPage({
      maxItems: 1,
      repository,
      view: 'metadata',
    });
    const cursor = firstPage.page.nextCursor;

    if (cursor === null) {
      throw new TypeError('The first page must expose a continuation cursor.');
    }

    const secondPage = await core.inspectProjectPage({
      cursor,
      maxItems: 1,
      repository: createValidRepository('# Project\n'),
      view: 'metadata',
    });
    const records = [...firstPage.page.records, ...secondPage.page.records];

    expect(firstPage).toMatchObject({
      counts: { diagnostics: 0, evidence: 0, metadata: 2 },
      page: { isComplete: false, totalItems: 2 },
      valid: true,
      view: 'metadata',
    });
    expect(secondPage.page).toMatchObject({ isComplete: true, nextCursor: null, totalItems: 2 });
    expect(
      records.map(({ item }) => (item.kind === 'metadata' ? item.metadata.path : item.kind)),
    ).toStrictEqual(['/moldea/moldea.yaml', '/moldea/project.md']);
    expect(JSON.stringify([firstPage, secondPage])).not.toContain('Project');
  });

  test('binds cursors to the view and repository snapshot', async () => {
    const core = createCore();
    const repository = createValidRepository('# First project\n');
    const firstPage = await core.inspectProjectPage({
      maxItems: 1,
      repository,
      view: 'metadata',
    });
    const cursor = firstPage.page.nextCursor;

    if (cursor === null) {
      throw new TypeError('The first page must expose a continuation cursor.');
    }

    const viewMismatch = core.inspectProjectPage({
      cursor,
      maxItems: 1,
      repository,
      view: 'all',
    });
    const snapshotMismatch = core.inspectProjectPage({
      cursor,
      maxItems: 1,
      repository: createValidRepository('# Changed project\n'),
      view: 'metadata',
    });

    await expect(viewMismatch).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
      operation: 'inspect-project-page',
    });
    await expect(snapshotMismatch).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
      operation: 'inspect-project-page',
    });
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
    const repository = createAgentRepository([
      { agentId: 'agent-a', runtimeId: 'custom' },
      { agentId: 'agent', runtimeId: 'openai' },
    ]);
    const metadata = await core.inspectProjectPage({ maxItems: 8, repository, view: 'metadata' });
    const all = await core.inspectProjectPage({ maxItems: 16, repository, view: 'all' });
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
    expect(JSON.stringify([metadata, all])).not.toContain('You are the');
  });

  test('pages a large agent inventory within the requested item bound', async () => {
    const assignments = Array.from({ length: 128 }, (_, index) => ({
      agentId: `agent${index.toString().padStart(3, '0')}`,
      runtimeId: 'custom',
    }));
    const core = createCore();
    const repository = createAgentRepository(assignments);
    const records: IProjectInspectionPageRecord[] = [];
    let cursor: string | undefined;
    let totalItems: number | null = null;

    do {
      const result = await core.inspectProjectPage({
        ...(cursor === undefined ? {} : { cursor }),
        maxItems: 32,
        repository,
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
      throw new TypeError('The assignment inspection must return at least one page.');
    }

    expect(records).toHaveLength(totalItems);
    expect(records.filter(({ item }) => item.kind === 'agent')).toHaveLength(assignments.length);
    expect(totalItems).toBe(386);
  });

  test('invalidates continuation when an agent runtime assignment changes', async () => {
    const core = createCore({
      adapters: [
        {
          id: 'openai',
          inspect: () => Promise.resolve({ diagnostics: [], evidence: [] }),
          supportedRepositoryFormatVersions: [1],
        },
      ],
    });
    const original = await core.inspectProjectPage({
      maxItems: 1,
      repository: createAgentRepository([{ agentId: 'assistant', runtimeId: 'custom' }]),
      view: 'metadata',
    });
    const cursor = original.page.nextCursor;

    if (cursor === null) {
      throw new TypeError('The assignment inspection must expose a continuation cursor.');
    }

    await expect(
      core.inspectProjectPage({
        cursor,
        maxItems: 1,
        repository: createAgentRepository([{ agentId: 'assistant', runtimeId: 'openai' }]),
        view: 'metadata',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
  });

  test('rejects malformed cursor and page limits', async () => {
    const core = createCore();
    const repository = createValidRepository('# Project\n');

    await expect(
      core.inspectProjectPage({
        cursor: 'not-a-core-cursor',
        maxItems: 1,
        repository,
        view: 'metadata',
      }),
    ).rejects.toBeInstanceOf(CoreOperationException);
    await expect(
      core.inspectProjectPage({ maxItems: 0, repository, view: 'metadata' }),
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });

    const firstPage = await core.inspectProjectPage({
      maxItems: 1,
      repository,
      view: 'metadata',
    });
    const cursor = firstPage.page.nextCursor;

    if (cursor === null) {
      throw new TypeError('The first page must expose a continuation cursor.');
    }

    await expect(
      core.inspectProjectPage({
        cursor: `${cursor.slice(0, -1)}${cursor.endsWith('0') ? '1' : '0'}`,
        maxItems: 1,
        repository,
        view: 'metadata',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
  });
});

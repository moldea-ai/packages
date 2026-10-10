// @vitest-environment node
import { readFileSync } from 'node:fs';

import { expect, test } from 'vitest';

import { createCore } from '@moldea.ai/core';
import type { IRepositoryReader } from '@moldea.ai/repository';
import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';

import { eveAdapter } from '../adapter/index.js';

interface IEveFixture {
  manifest: string;
  entries: { path: string; text: string; type: 'file' }[];
}

const fixture = JSON.parse(
  readFileSync(new URL('../../../../fixtures/adapter-eve/cases.json', import.meta.url), 'utf8'),
) as IEveFixture;
const schemaReference = (symbol: string) => ({ path: '/agent/contracts.ts', symbol });

test.each([8, 16, 32])(
  'preserves %d registered dense tools with serial source work',
  async (toolCount) => {
    const tools = Array.from(
      { length: toolCount },
      (_, index) => `tool${index.toString().padStart(3, '0')}`,
    );
    const baseSource = fixture.entries.find(
      (entry) => entry.path === '/agent/tools/search.ts',
    )?.text;
    if (baseSource === undefined)
      throw new TypeError('The registered Eve tool fixture is missing.');
    const padding = `const padding = [${'0,'.repeat(Math.floor((256 * 1024 - baseSource.length - 24) / 2))}];\n`;
    const declarations = Object.fromEntries(
      tools.map((name) => {
        const reference = { path: `/agent/tools/${name}.ts`, symbol: 'default' };
        return [
          name,
          {
            name,
            description: 'Searches the knowledge base.',
            implementation: { path: '/agent/implementations.ts', symbol: 'searchKnowledge' },
            registration: reference,
            inputSchema: schemaReference('SearchInputSchema'),
            outputSchema: schemaReference('SearchOutputSchema'),
          },
        ];
      }),
    );
    const reader = createMemoryRepositoryReader([
      {
        path: '/moldea/moldea.yaml',
        type: 'file',
        content: JSON.stringify({
          version: 1,
          agents: {
            support: {
              runtime: { id: 'eve' },
              bindings: {
                runtimeAgent: { path: '/agent/agent.ts', symbol: 'default' },
                instructionLoader: { path: '/agent/loaders.ts', symbol: 'loadInstruction' },
                outputSchema: schemaReference('SupportOutputSchema'),
              },
              tools: declarations,
            },
            summary: {
              runtime: { id: 'eve' },
              bindings: {
                runtimeAgent: { path: '/agent/subagents/summary/agent.ts', symbol: 'default' },
              },
            },
          },
        }),
      },
      ...fixture.entries.map((entry) => ({
        path: entry.path,
        type: entry.type,
        content: entry.text,
      })),
      ...tools.map((name) => ({
        path: `/agent/tools/${name}.ts`,
        type: 'file' as const,
        content: padding + baseSource,
      })),
    ]);
    let activeToolReads = 0;
    let peakToolReads = 0;
    const readPaths = new Set<string>();
    const measuredReader: IRepositoryReader = {
      snapshot: reader.snapshot,
      compare: (...args) => reader.compare(...args),
      getEntry: (...args) => reader.getEntry(...args),
      listEntriesPage: (...args) => reader.listEntriesPage(...args),
      readFilePage: async (logicalPath, options) => {
        if (!logicalPath.startsWith('/agent/tools/'))
          return reader.readFilePage(logicalPath, options);
        activeToolReads += 1;
        peakToolReads = Math.max(peakToolReads, activeToolReads);
        readPaths.add(logicalPath);
        try {
          await Promise.resolve();
          return await reader.readFilePage(logicalPath, options);
        } finally {
          activeToolReads -= 1;
        }
      },
    };
    const result = await createCore({ adapters: [eveAdapter] }).validateProject({
      repository: measuredReader,
    });

    expect(result.diagnostics).toStrictEqual([]);
    expect(result.valid).toBe(true);
    expect(result.runtimeInspection).toBe('complete');
    expect(
      result.evidence
        .filter((record) => record.kind === 'tool-registration')
        .map((record) => record.runtimeName)
        .sort(),
    ).toStrictEqual(tools);
    expect(peakToolReads).toBe(1);
    expect(activeToolReads).toBe(0);
    expect([...readPaths].sort()).toStrictEqual([
      '/agent/tools/search.ts',
      ...tools.map((name) => `/agent/tools/${name}.ts`),
    ]);
  },
);

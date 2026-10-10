// @vitest-environment node
import { expect, test } from 'vitest';

import { parseRepositoryPath } from '@moldea.ai/repository';

import type { ICapabilityCase } from '../../../lib/capabilities/index.ts';
import { getRuntimeSourcePreviews } from './utilities.ts';

const example: ICapabilityCase = {
  id: 'example',
  groupId: 'runtime-wiring',
  title: 'A request',
  description: 'An executed source example.',
  limitation: 'Static source only.',
  packageName: '@moldea.ai/adapter-anthropic',
  operation: 'inspect',
  sourcePaths: [],
  files: [
    {
      path: '/src/tool.ts',
      content: 'export const findOrder = () => null;',
      language: 'ts',
      representation: 'source',
      isExcerpt: false,
    },
    {
      path: '/src/agent.ts',
      content: 'export const request = client.messages.create({});',
      language: 'ts',
      representation: 'source',
      isExcerpt: false,
    },
  ],
  result: {
    kind: 'adapter',
    valid: true,
    errorCount: 0,
    warningCount: 1,
    evidence: [],
    diagnostics: [
      {
        code: 'ANTHROPIC_RUNTIME_RELATIONSHIP_UNVERIFIED',
        details: { relationship: 'instruction-loader', reason: 'dynamic-source-pattern' },
        entity: { agentId: 'support' },
        message: 'The declared runtime relationship could not be verified.',
        path: parseRepositoryPath('/src/tool.ts'),
        pointer: null,
        range: null,
        severity: 'warning',
        source: 'anthropic',
      },
    ],
  },
};
const catalog: Parameters<typeof getRuntimeSourcePreviews>[1] = {
  runtimeTargets: [
    {
      patterns: [
        {
          id: 'direct-request',
          proofs: [
            {
              caseId: 'example',
              source: { path: '/src/agent.ts', contains: 'client.messages.create({' },
              witness: { kind: 'validation' },
            },
          ],
        },
      ],
    },
  ],
};

test('shows the witnessed request instead of an unrelated warning input', () => {
  const previews = getRuntimeSourcePreviews(example, catalog);
  expect(previews).toHaveLength(1);
  expect(previews[0].file.path).toBe('/src/agent.ts');
  expect(previews[0].content).toContain('client.messages.create({');
  expect(previews[0].content).not.toContain('findOrder');
});

test('keeps Markdown witnesses literal and bounds a source window around its marker', () => {
  const markdown = {
    ...example.files[1],
    path: '/agent/instructions.md',
    language: 'markdown',
    content: '# Support\nHelp customers.',
  };
  const markdownCatalog: Parameters<typeof getRuntimeSourcePreviews>[1] = {
    runtimeTargets: [
      {
        patterns: [
          {
            id: 'instruction',
            proofs: [
              {
                caseId: 'example',
                source: { path: markdown.path, contains: 'Help customers.' },
                witness: { kind: 'validation' },
              },
            ],
          },
        ],
      },
    ],
  };
  expect(
    getRuntimeSourcePreviews({ ...example, files: [markdown] }, markdownCatalog)[0].content,
  ).toBe(markdown.content);
  const lines = Array.from({ length: 64 }, (_, index) => `line ${index}`);
  lines[48] = 'client.messages.create({});';
  const previews = getRuntimeSourcePreviews(
    { ...example, files: [{ ...example.files[1], content: lines.join('\n') }] },
    catalog,
  );
  expect(previews[0].content).toContain(lines[48]);
  expect(previews[0].content.split('\n')).toHaveLength(16);
  expect(previews[0].isExcerpt).toBe(true);
});

test('refuses missing or stale source witnesses instead of selecting a different file', () => {
  expect(() =>
    getRuntimeSourcePreviews({ ...example, files: [example.files[0]] }, catalog),
  ).toThrow('witnessed input file');
  expect(() =>
    getRuntimeSourcePreviews(
      { ...example, files: [{ ...example.files[1], content: 'other source' }] },
      catalog,
    ),
  ).toThrow('required source witness');
});

test('uses an actual source fallback only for stories without a pattern witness', () => {
  expect(getRuntimeSourcePreviews(example, { runtimeTargets: [] })[0].file.path).toBe(
    '/src/tool.ts',
  );
  expect(() =>
    getRuntimeSourcePreviews({ ...example, files: [example.files[1]] }, { runtimeTargets: [] }),
  ).toThrow('executed source');
  expect(() => getRuntimeSourcePreviews({ ...example, files: [] }, { runtimeTargets: [] })).toThrow(
    'executed source',
  );
});

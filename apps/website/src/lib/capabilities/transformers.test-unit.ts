// @vitest-environment node
import { expect, test } from 'vitest';

import type { IDiagnostic } from '@moldea.ai/core';
import { parseRepositoryPath } from '@moldea.ai/repository';

import { projectDiagnostics, projectEntry, projectEvidence, projectFile } from './transformers.ts';

test('drops additive process fields from diagnostics, positions, and entities', () => {
  const expected: IDiagnostic = {
    code: 'MOLDEA_VARIABLE_UNDECLARED',
    source: 'core',
    message: 'The agent instruction references an undeclared runtime variable.',
    path: parseRepositoryPath('/moldea/agents/support/instruction.md'),
    pointer: null,
    range: { start: { line: 4, column: 9, offset: 80 }, end: { line: 4, column: 21, offset: 92 } },
    entity: { agentId: 'support', variableId: 'ORDER_ID' },
    details: { occurrences: 1 },
  };
  if (expected.range === null) throw new Error('Expected source range is missing.');
  const diagnostic = {
    ...expected,
    path: expected.path === null ? null : parseRepositoryPath(expected.path),
    internalContext: 'not-for-publication',
    entity: { ...expected.entity, internalContext: 'not-for-publication' },
    range: {
      start: { ...expected.range.start, internalContext: 'not-for-publication' },
      end: expected.range.end,
    },
  };
  const projected = projectDiagnostics([diagnostic]);
  expect(projected).toStrictEqual([expected]);
  expect(JSON.stringify(projected)).not.toContain('not-for-publication');
  expect(projected[0]?.details).not.toBe(diagnostic.details);
});

test('keeps evidence relationships without additive process or reference fields', () => {
  const evidence = {
    source: 'openai',
    kind: 'instruction-loader' as const,
    agentId: 'support',
    capabilityId: null,
    capabilityKind: null,
    runtimeName: null,
    references: [
      {
        path: parseRepositoryPath('/src/instructions.ts'),
        symbol: 'loadInstruction',
        hostPath: 'not-for-publication',
      },
    ],
    details: { loader: 'direct' },
    snapshotIdentity: 'not-for-publication',
  };
  expect(projectEvidence([evidence])).toStrictEqual([
    {
      source: 'openai',
      kind: 'instruction-loader',
      agentId: 'support',
      capabilityId: null,
      capabilityKind: null,
      runtimeName: null,
      references: [{ path: '/src/instructions.ts', symbol: 'loadInstruction' }],
      details: { loader: 'direct' },
    },
  ]);
});

test('entry metadata omits opaque content identities', () => {
  expect(
    projectEntry({
      path: parseRepositoryPath('/policy.md'),
      type: 'file',
      byteLength: 8,
      contentIdentity: 'opaque-identity',
    }),
  ).toStrictEqual({ path: '/policy.md', type: 'file', byteLength: 8 });
});

test('labels a bounded excerpt from the same executed source', () => {
  const lines = Array.from({ length: 17 }, (_, index) => `Line ${index + 1}`);
  expect(
    projectFile({ path: '/instruction.md', type: 'file', content: lines.join('\n') }),
  ).toStrictEqual({
    path: '/instruction.md',
    language: 'markdown',
    content: lines.slice(0, 16).join('\n'),
    isExcerpt: true,
    representation: 'source',
  });
  expect(projectFile({ path: '/directory', type: 'directory' })).toBeNull();
});

test.each([
  ['\uD800', 'json', '"\\ud800"', 'json-string'],
  ['Return\u0000policy', 'json', '"Return\\u0000policy"', 'json-string'],
  [new Uint8Array([255]), 'text', 'Bytes: ff', 'bytes'],
  ['Café', 'markdown', 'Café', 'source'],
])('projectFile(%s) -> safe %s representation', (content, language, expected, representation) => {
  expect(projectFile({ path: '/instruction.md', type: 'file', content })).toStrictEqual({
    path: '/instruction.md',
    language,
    content: expected,
    isExcerpt: false,
    representation,
  });
});

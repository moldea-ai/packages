// @vitest-environment node
import { expect, test } from 'vitest';
import { parseRepositoryPath } from '@moldea.ai/repository';

import type { ICapabilityCase } from '../../../lib/capabilities/index.ts';
import {
  getIdentityIllustration,
  getMirrorIllustration,
  getVariableIllustration,
} from './utilities.ts';

const instructionPath = '/moldea/agents/support/instruction.md';
const example: ICapabilityCase = {
  id: 'variable-undeclared',
  groupId: 'agents',
  title: 'Variable',
  description: 'Missing variable.',
  limitation: 'Structure only.',
  packageName: '@moldea.ai/core',
  operation: 'validateProject',
  sourcePaths: [],
  files: [
    {
      path: '/moldea/moldea.yaml',
      language: 'yaml',
      content: 'agents:\n  support:\n    variables:\n      REGION: {}\n',
      isExcerpt: false,
      representation: 'source',
    },
    {
      path: instructionPath,
      language: 'markdown',
      content: 'Agent instruction\nLook up {{ORDER_ID}}.\n',
      isExcerpt: false,
      representation: 'source',
    },
  ],
  result: {
    kind: 'validation',
    valid: false,
    diagnostics: [
      {
        code: 'MOLDEA_VARIABLE_UNDECLARED',
        severity: 'error',
        source: 'core',
        message: 'The agent instruction references an undeclared runtime variable.',
        path: parseRepositoryPath(instructionPath),
        pointer: null,
        range: {
          start: { line: 2, column: 9, offset: 26 },
          end: { line: 2, column: 21, offset: 38 },
        },
        entity: { agentId: 'support', variableId: 'ORDER_ID' },
        details: { occurrences: 1 },
      },
    ],
  },
};

test('shows actual declared names and only the diagnosed line, without changing source files', () => {
  const before = structuredClone(example);
  expect(getVariableIllustration(example)).toStrictEqual({
    instruction: example.files[1],
    manifest: example.files[0],
    token: '{{ORDER_ID}}',
    variableId: 'ORDER_ID',
    before: 'Look up ',
    after: '.',
    names: ['REGION'],
  });
  expect(example).toStrictEqual(before);
  const unicode = {
    ...example,
    files: example.files.map((file) => ({
      ...file,
      content: file.content.replace('Look up', '📦 Find'),
    })),
  };
  expect(getVariableIllustration(unicode).before).toBe('📦 Find ');
});

test.each([
  ['missing instruction', { ...example, files: [example.files[0]] }],
  [
    'stale token',
    {
      ...example,
      files: example.files.map((file) => ({
        ...file,
        content: file.content.replace('ORDER_ID', 'ORDER_NUMBER'),
      })),
    },
  ],
  [
    'declared variable',
    {
      ...example,
      files: example.files.map((file) => ({
        ...file,
        content: file.content.replace('REGION: {}', 'ORDER_ID: {}'),
      })),
    },
  ],
  [
    'wrong manifest shape',
    { ...example, files: [{ ...example.files[0], content: 'agents: []' }, example.files[1]] },
  ],
])('getVariableIllustration(%s) rejects a misleading illustration', (_label, input) => {
  expect(() => getVariableIllustration(input)).toThrow();
});

test('isolates the changed return window and rejects missing or unrelated differences', () => {
  const original = {
    ...example.files[1],
    content: 'You are the `support` agent.\nAccept returns within 60 days of delivery.\n',
  };
  const copy = {
    ...original,
    path: '/instructions/support.md',
    content: original.content.replace('60', '30'),
  };
  const input = { ...example, files: [original, copy] };
  const before = structuredClone(input);
  expect(getMirrorIllustration(input)).toStrictEqual({
    original,
    copy,
    before: 'Accept returns within ',
    originalDays: '60',
    copyDays: '30',
    after: ' of delivery.',
  });
  expect(input).toStrictEqual(before);
  for (const content of [
    original.content,
    `Different\n${original.content}`,
    `${original.content}\n`,
    copy.content.replace('support', 'sales'),
    copy.content.replace('delivery', 'purchase'),
    copy.content.replace('Accept', 'Reject'),
    copy.content.replace('30 days', 'one month'),
  ])
    expect(() =>
      getMirrorIllustration({ ...example, files: [original, { ...copy, content }] }),
    ).toThrow('Mirror illustration requires');
  expect(() => getMirrorIllustration({ ...example, files: [original] })).toThrow(
    'Mirror illustration requires',
  );
  expect(() =>
    getMirrorIllustration({
      ...example,
      files: [
        { ...original, content: 'Different instruction.\n' },
        { ...copy, content: 'Different instruction.\nExtra line.\n' },
      ],
    }),
  ).toThrow('Mirror illustration requires a single changed return window.');
});

test('shows the diagnosed owner and only the first instruction line for an identity mismatch', () => {
  const input: ICapabilityCase = {
    ...example,
    files: [
      example.files[0],
      { ...example.files[1], content: 'You are the `sales` agent.\n\nOther instructions.\n' },
    ],
    result: {
      kind: 'validation',
      valid: false,
      diagnostics: [
        {
          code: 'MOLDEA_AGENT_IDENTITY_INVALID',
          severity: 'error',
          source: 'core',
          message: 'The agent instruction identity is invalid.',
          path: parseRepositoryPath(instructionPath),
          pointer: null,
          range: null,
          entity: { agentId: 'support' },
          details: { reason: 'missing' },
        },
      ],
    },
  };
  const before = structuredClone(input);
  expect(getIdentityIllustration(input)).toStrictEqual({
    manifest: input.files[0],
    instruction: input.files[1],
    agentId: 'support',
    line: 'You are the `sales` agent.',
  });
  expect(input).toStrictEqual(before);
  expect(() => getIdentityIllustration({ ...input, files: [input.files[1]] })).toThrow(
    'Identity illustration requires',
  );
  expect(() =>
    getIdentityIllustration({
      ...input,
      result: { kind: 'validation', valid: true, diagnostics: [] },
    }),
  ).toThrow('Identity illustration requires');
});

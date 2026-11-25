// @vitest-environment node
import { expect, test } from 'vitest';
import { parseRepositoryPath } from '@moldea.ai/repository';

import type { ICapabilityCase } from '../../../lib/capabilities/index.ts';
import { getIdentityIllustration, getMirrorIllustration } from './utilities.ts';

const instructionPath = '/moldea/agents/support/instruction.md';
const example: ICapabilityCase = {
  id: 'agent-identity',
  groupId: 'agents',
  title: 'Agent identity',
  description: 'Checks the introduced agent ID.',
  limitation: 'Structure only.',
  packageName: '@moldea.ai/core',
  operation: 'validateProject',
  sourcePaths: [],
  files: [
    {
      path: '/moldea/moldea.yaml',
      language: 'yaml',
      content: 'agents:\n  support:\n',
      isExcerpt: false,
      representation: 'source',
    },
    {
      path: instructionPath,
      language: 'markdown',
      content: 'You are the `support` agent.\n',
      isExcerpt: false,
      representation: 'source',
    },
  ],
  output: { kind: 'execution-facts', responses: [{}], redactions: [] },
  result: { kind: 'validation', valid: false, diagnostics: [] },
};

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
          group: 'agents',
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

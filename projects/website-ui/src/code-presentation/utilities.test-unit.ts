// @vitest-environment node
import { expect, test } from 'vitest';

import { formatRepositoryPath, resolveCodeOverflow } from './index.js';
import { splitCodeSegments } from './utilities.js';

test.each([
  ['/moldea/moldea.yaml', 'moldea/moldea.yaml'],
  ['moldea/moldea.yaml', 'moldea/moldea.yaml'],
  ['/', ''],
  ['', ''],
  ['//a', '/a'],
])('formatRepositoryPath(%s) -> %s', (path, expected) => {
  expect(formatRepositoryPath(path)).toBe(expected);
});

test.each([
  ['markdown', 'wrap'],
  ['md', 'wrap'],
  ['mdx', 'wrap'],
  ['text', 'wrap'],
  ['txt', 'wrap'],
  ['plaintext', 'wrap'],
  [' Markdown ', 'wrap'],
  ['typescript', 'scroll'],
  ['yaml', 'scroll'],
  ['json', 'scroll'],
  ['sh', 'scroll'],
  ['diff', 'scroll'],
  ['unsupported', 'scroll'],
  ['', 'scroll'],
  [undefined, 'scroll'],
])('resolveCodeOverflow(%s) -> %s', (language, expected) => {
  expect(resolveCodeOverflow(language)).toBe(expected);
});

test.each([
  ['b/instructions.md', 'wrap'],
  ['a/README.MD', 'wrap'],
  ['b/notes.txt', 'wrap'],
  ['b/policy.markdown', 'wrap'],
  ['b/guide.mdx', 'wrap'],
  ['b/config.yaml', 'scroll'],
  ['b/result.json', 'scroll'],
  ['b/source.ts', 'scroll'],
  ['b/unknown', 'scroll'],
])('resolveCodeOverflow(text, default, %s) -> %s', (filePath, expected) => {
  expect(resolveCodeOverflow('text', undefined, filePath)).toBe(expected);
});

test.each([
  ['/moldea/agents/support/instruction.md', ['/moldea/', 'agents/', 'support/', 'instruction.md']],
  ['MOLDEA_REFERENCE_EXPORT_MISSING', ['MOLDEA_', 'REFERENCE_', 'EXPORT_', 'MISSING']],
  ['./src/answer-cache.ts', ['./src/', 'answer-', 'cache.ts']],
  ['@moldea.ai/core', ['@moldea.', 'ai/', 'core']],
  ['src/payments/refund-policy.ts', ['src/', 'payments/', 'refund-', 'policy.ts']],
  ['archive.tar.gz', ['archive.', 'tar.gz']],
  ['moldea.yaml', ['moldea.yaml']],
  ['refund-policy.ts/', ['refund-', 'policy.', 'ts/']],
  ['__init__.py', ['__init__.py']],
  ['moldea', ['moldea']],
  ['', ['']],
])('splitCodeSegments(%s) -> %o', (value, expected) => {
  expect(splitCodeSegments(value)).toStrictEqual(expected);
  expect(splitCodeSegments(value).join('')).toBe(value);
});

test.each(['wrap', 'scroll'] as const)(
  'preserves the explicit %s choice for every source kind',
  (overflow) => {
    for (const language of ['markdown', 'text', 'json', 'typescript', undefined]) {
      expect(resolveCodeOverflow(language, overflow)).toBe(overflow);
      expect(resolveCodeOverflow(language, overflow, 'b/instructions.md')).toBe(overflow);
      expect(resolveCodeOverflow(language, overflow, 'b/source.ts')).toBe(overflow);
    }
  },
);

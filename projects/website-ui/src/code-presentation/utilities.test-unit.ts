// @vitest-environment node
import { expect, test } from 'vitest';

import { resolveCodeOverflow } from './index.js';

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

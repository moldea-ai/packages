// @vitest-environment node
import { expect, test } from 'vitest';

import { parseDocumentationExample } from './index.js';

const fileBlock = (filePath: string): string =>
  `### ${filePath}\n\n\`\`\`markdown\n# Example\n\`\`\``;
const example = (body: string): string =>
  `<!-- example:start -->\n\n${body}\n\n<!-- example:end -->`;

test('parseDocumentationExample preserves file bytes and ignores surrounding prose', () => {
  expect(
    parseDocumentationExample(`Introduction\n${example(fileBlock('/moldea/project.md'))}\nEnd`),
  ).toStrictEqual([{ path: '/moldea/project.md', content: '# Example\n', type: 'file' }]);
});

test('parseDocumentationExample accepts CRLF and nested Markdown fences', () => {
  const source = example('### /moldea/project.md\n\n````markdown\n```ts\nconst n = 1;\n```\n````');
  expect(parseDocumentationExample(source.replaceAll('\n', '\r\n'))[0]?.content).toBe(
    '```ts\nconst n = 1;\n```\n',
  );
});

test.each(['', '<!-- example:end -->\n<!-- example:start -->', example('') + example('')])(
  'parseDocumentationExample rejects invalid markers (%s)',
  (source) => {
    expect(() => parseDocumentationExample(source)).toThrow('one complete marked file set');
  },
);

test.each([
  '/../secret',
  '//server/share',
  '/a/../b',
  '/a\\b',
  '/con.txt',
  '/A.ts',
  '/a./b',
  '/_archive/a',
  '/a/_backups/b',
  `/${'a'.repeat(65)}`,
])('parseDocumentationExample rejects unsafe virtual path (%s)', (filePath) => {
  expect(() => parseDocumentationExample(example(fileBlock(filePath)))).toThrow(
    'invalid or duplicate file path',
  );
});

test('parseDocumentationExample rejects duplicate files', () => {
  expect(() =>
    parseDocumentationExample(example(`${fileBlock('/a.md')}\n\n${fileBlock('/a.md')}`)),
  ).toThrow('invalid or duplicate file path');
});

test.each([
  '',
  'unparsed text',
  '### /a.ts\n\n```typescript\nunfinished',
  '### /a.ts\n\n```unknown\ncontent\n```',
])('parseDocumentationExample rejects malformed blocks (%s)', (body) => {
  expect(() => parseDocumentationExample(example(body))).toThrow('malformed file blocks');
});

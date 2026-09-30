// @vitest-environment node
import { expect, test } from 'vitest';

import { buildCodeDiff } from './index.js';

const sourceOf = (line: { tokens: { content: string }[] }): string =>
  line.tokens.map((token) => token.content).join('');

test('aligns unequal replacement groups while retaining original line numbers', async () => {
  const diff = await buildCodeDiff('start\nold one\nold two\nend\n', 'start\nnew one\nend\n');
  expect([diff.addedCount, diff.removedCount]).toStrictEqual([1, 2]);
  expect(
    diff.sections
      .flatMap((section) => section.lines)
      .map((line) => [line.kind, line.oldNumber, line.newNumber, sourceOf(line)]),
  ).toStrictEqual([
    ['unchanged', 1, 1, 'start'],
    ['removed', 2, undefined, 'old one'],
    ['removed', 3, undefined, 'old two'],
    ['added', undefined, 2, 'new one'],
    ['unchanged', 4, 3, 'end'],
  ]);
  expect(
    diff.sections
      .flatMap((section) => section.rows)
      .map((row) => [row.before && sourceOf(row.before), row.after && sourceOf(row.after)]),
  ).toStrictEqual([
    ['start', 'start'],
    ['old one', 'new one'],
    ['old two', undefined],
    ['end', 'end'],
  ]);
});

test.each([
  ['', '', 0, 0],
  ['', 'first\n\nlast\n', 3, 0],
  ['first\n\nlast\n', '', 0, 3],
  ['  first\n\nlast\n', '  first\n\nlast\n', 0, 0],
  ['first\r\nlast\r\n', 'first\nlast\n', 0, 0],
  ['first\n', 'first', 1, 1],
])(
  'compares %s -> %s with %d additions and %d removals',
  async (before, after, addedCount, removedCount) => {
    const diff = await buildCodeDiff(before, after);
    expect([diff.addedCount, diff.removedCount]).toStrictEqual([addedCount, removedCount]);
    expect(
      diff.sections
        .flatMap((section) => section.lines)
        .filter((line) => line.kind !== 'removed')
        .map(sourceOf)
        .join('\n'),
    ).toBe(after.replaceAll('\r\n', '\n').replace(/\n$/u, ''));
  },
);

test('labels final-newline changes without creating a phantom empty line', async () => {
  const diff = await buildCodeDiff('first\n', 'first');
  expect(diff.sections[0]!.lines.map((line) => line.hasNoFinalNewline)).toStrictEqual([
    false,
    true,
  ]);
});

test('keeps complete source available while folding distant context around multiple changes', async () => {
  const before = Array.from({ length: 32 }, (_, index) => `line ${index + 1}`).join('\n') + '\n';
  const after = before.replace('line 9\n', 'changed 9\n').replace('line 24\n', 'changed 24\n');
  const diff = await buildCodeDiff(before, after, 'text', 2);
  expect(
    diff.sections.filter((section) => section.isCollapsed).map((section) => section.lines.length),
  ).toStrictEqual([6, 10, 6]);
  expect(
    diff.sections
      .flatMap((section) => section.lines)
      .filter((line) => line.kind !== 'removed')
      .map(sourceOf)
      .join('\n') + '\n',
  ).toBe(after);
  const complete = await buildCodeDiff(before, after, 'text', Infinity);
  expect(complete.sections.some((section) => section.isCollapsed)).toBe(false);
});

test('highlights complete multiline syntax in both themes and preserves literal HTML', async () => {
  const source = 'const message = `first\n<script>second</script>`;\n';
  const diff = await buildCodeDiff('', source, 'typescript');
  const lines = diff.sections.flatMap((section) => section.lines);
  expect(lines.map(sourceOf)).toStrictEqual([
    'const message = `first',
    '<script>second</script>`;',
  ]);
  expect(lines[1]!.tokens.some((token) => token.lightColor !== token.darkColor)).toBe(true);
  const unknown = await buildCodeDiff('', '<script>literal</script>', 'unknown-language');
  expect(sourceOf(unknown.sections[0]!.lines[0]!)).toBe('<script>literal</script>');
});

test('falls back to a complete comparison for large unrelated inputs within the search budget', async () => {
  const before = Array.from({ length: 1024 }, (_, index) => `before ${index}\n`).join('');
  const after = Array.from({ length: 1024 }, (_, index) => `after ${index}\n`).join('');
  const diff = await buildCodeDiff(before, after);
  expect(diff.isCoarseComparison).toBe(true);
  expect([diff.removedCount, diff.addedCount]).toStrictEqual([1024, 1024]);
  const lines = diff.sections.flatMap((section) => section.lines);
  expect(
    lines
      .filter((line) => line.kind === 'removed')
      .map(sourceOf)
      .join('\n') + '\n',
  ).toBe(before);
  expect(
    lines
      .filter((line) => line.kind === 'added')
      .map(sourceOf)
      .join('\n') + '\n',
  ).toBe(after);
});

// @vitest-environment node
import { expect, test } from 'vitest';

import { buildCodePatch, type ICodeDiffLine } from './index.js';

const emphasisOf = (line: ICodeDiffLine): string[] => {
  const ranges: string[] = [];
  let continuesRange = false;
  for (const token of line.tokens) {
    if (token.isChanged) {
      if (continuesRange) ranges[ranges.length - 1] += token.content;
      else ranges.push(token.content);
    }
    continuesRange = token.isChanged === true;
  }
  return ranges;
};

const recordedChange = (before: string, after: string): string =>
  [
    '--- a/policy.txt',
    '+++ b/policy.txt',
    `@@ -8,${before.split('\n').length} +8,${after.split('\n').length} @@`,
    ...before.split('\n').map((line) => `-${line}`),
    ...after.split('\n').map((line) => `+${line}`),
    '',
  ].join('\n');

test.each([
  ['call rename', 'getUser();', 'getAccount();', [['getUser']], [['getAccount']]],
  ['half retained', 'alpha + beta;', 'gamma + delta;', [['alpha', 'beta']], [['gamma', 'delta']]],
  ['below half', 'alpha + beta;', 'gamma - delta;', [[]], [[]]],
  ['no anchor', 'alpha', 'beta', [[]], [[]]],
  ['whitespace only', 'policy 30 days', 'policy\t30  days', [[]], [[]]],
  [
    'code rewrite',
    'const total = items.length; if (total > 0) return total;',
    'for (const entry of entries) { await save(entry, { force: true }); }',
    [[]],
    [[]],
  ],
  [
    'prose rewrite',
    'Read the saved pickup policy before replying.',
    'Archive the weekly sales report after processing.',
    [[]],
    [[]],
  ],
  [
    'mixed addition',
    'const count = getCount();',
    'const count = readCount();\nstartWorker();',
    [['getCount']],
    [['readCount'], []],
  ],
  [
    'mixed removal',
    'const count = readCount();\nstartWorker();',
    'const count = getCount();',
    [['readCount'], []],
    [['getCount']],
  ],
  [
    'wrapped insertion',
    'policy and quote it.',
    'policy, confirm the customer identity\nwith two separate checks recorded in the ticket,\nand quote it.',
    [[]],
    [[', confirm the customer identity'], ['with two separate checks recorded in the ticket,'], []],
  ],
  [
    'wrapped deletion',
    'policy, confirm the customer identity\nwith two separate checks recorded in the ticket,\nand quote it.',
    'policy and quote it.',
    [[', confirm the customer identity'], ['with two separate checks recorded in the ticket,'], []],
    [[]],
  ],
])(
  'buildCodePatch(%s) -> exact emphasis without changing recorded rows',
  async (_description, before, after, expectedBefore, expectedAfter) => {
    const comparison = await buildCodePatch(recordedChange(before, after));
    expect(comparison).not.toBeNull();
    const lines = comparison!.sections.flatMap((section) => section.lines);
    const removed = lines.filter((line) => line.kind === 'removed');
    const added = lines.filter((line) => line.kind === 'added');
    expect(removed.map(emphasisOf)).toStrictEqual(expectedBefore);
    expect(added.map(emphasisOf)).toStrictEqual(expectedAfter);
    expect(
      removed.map((line) => line.tokens.map((token) => token.content).join('')).join('\n'),
    ).toBe(before);
    expect(added.map((line) => line.tokens.map((token) => token.content).join('')).join('\n')).toBe(
      after,
    );
    expect(removed.map((line) => line.oldNumber)).toStrictEqual(
      before.split('\n').map((_line, index) => 8 + index),
    );
    expect(added.map((line) => line.newNumber)).toStrictEqual(
      after.split('\n').map((_line, index) => 8 + index),
    );
    expect([comparison!.removedCount, comparison!.addedCount]).toStrictEqual([
      removed.length,
      added.length,
    ]);
    expect(comparison!.sections[0]!.rows[0]!.before).toBe(removed[0]);
    expect(comparison!.sections[0]!.rows[0]!.after).toBe(added[0]);
  },
);

test.each([
  '--- a/first.ts\n+++ b/first.ts\n@@ -1 +1,0 @@\n-getUser();\n@@ -8,0 +8 @@\n+getAccount();\n',
  '--- a/first.ts\n+++ b/first.ts\n@@ -1 +1,0 @@\n-getUser();\n--- a/second.ts\n+++ b/second.ts\n@@ -8,0 +8 @@\n+getAccount();\n',
])('never aligns changes across recorded hunk/file boundaries (%s)', async (patch) => {
  const comparison = await buildCodePatch(patch);
  expect(comparison!.sections).toHaveLength(2);
  expect(comparison!.sections.flatMap((section) => section.lines).map(emphasisOf)).toStrictEqual([
    [],
    [],
  ]);
});

test('shares the aggregate refinement budget across recorded hunks', async () => {
  const after = 'policy new;';
  const changes = Array.from({ length: 5 }, (_unused, index) => {
    const before =
      'policy old;' + ' '.repeat((index < 4 ? 16_384 : 32) - 'policy old;'.length - after.length);
    return `@@ -${1 + index * 4} +${1 + index * 4} @@\n-${before}\n+${after}\n`;
  });
  const comparison = await buildCodePatch(
    '--- a/policy.txt\n+++ b/policy.txt\n' + changes.join(''),
  );
  expect(comparison!.sections).toHaveLength(5);
  expect(comparison!.sections.map((section) => emphasisOf(section.lines[1]!))).toStrictEqual([
    ['new'],
    ['new'],
    ['new'],
    ['new'],
    [],
  ]);
  expect([comparison!.removedCount, comparison!.addedCount]).toStrictEqual([5, 5]);
});

test.each([
  [16_384, true],
  [16_385, false],
])('preserves recorded source at block length %d (refined=%s)', async (length, refined) => {
  const after = 'policy new;';
  const before = 'policy old;' + ' '.repeat(length - 'policy old;'.length - after.length);
  const comparison = await buildCodePatch(recordedChange(before, after));
  expect(comparison!.sections[0]!.lines.map(emphasisOf)).toStrictEqual(
    refined ? [['old'], ['new']] : [[], []],
  );
  expect(comparison!.sections[0]!.lines[0]!.tokens.map((token) => token.content).join('')).toBe(
    before,
  );
});

test('preserves recorded multi-file hunks, source positions, uneven edits, and newline markers', async () => {
  const comparison = await buildCodePatch(
    [
      'diff --git a/src/policy.ts b/src/policy.ts',
      '--- a/src/policy.ts',
      '+++ b/src/policy.ts',
      '@@ -10,3 +12,2 @@',
      ' unchanged',
      '-old one',
      '-old two',
      '+<script>new</script>',
      '\\ No newline at end of file',
      '--- /dev/null',
      '+++ b/new.txt',
      '@@ -0,0 +1,1 @@',
      '+new file',
      '',
    ].join('\n'),
  );
  expect(comparison).not.toBeNull();
  expect([comparison!.removedCount, comparison!.addedCount]).toStrictEqual([2, 2]);
  expect(comparison!.sections.map((section) => section.label)).toStrictEqual([
    'b/src/policy.ts · @@ -10,3 +12,2 @@',
    'b/new.txt · @@ -0,0 +1,1 @@',
  ]);
  expect(comparison!.sections.map((section) => section.filePath)).toStrictEqual([
    'b/src/policy.ts',
    'b/new.txt',
  ]);
  expect(
    comparison!.sections
      .flatMap((section) => section.lines)
      .map((line) => [
        line.kind,
        line.oldNumber,
        line.newNumber,
        line.tokens.map((token) => token.content).join(''),
        line.hasNoFinalNewline,
      ]),
  ).toStrictEqual([
    ['unchanged', 10, 12, 'unchanged', false],
    ['removed', 11, undefined, 'old one', false],
    ['removed', 12, undefined, 'old two', false],
    ['added', undefined, 13, '<script>new</script>', true],
    ['added', undefined, 1, 'new file', false],
  ]);
  expect(comparison!.sections[0]!.rows[2]!.after).toBeUndefined();
});

test('renders deleted files and hunk-only excerpts without inventing missing file content', async () => {
  const comparison = await buildCodePatch(
    '--- a/deleted.txt\n+++ /dev/null\n@@ -20,1 +0,0 @@\n-old\n',
  );
  expect(comparison!.sections[0]!.label).toBe('a/deleted.txt · @@ -20,1 +0,0 @@');
  expect(comparison!.sections[0]!.filePath).toBe('a/deleted.txt');
  expect(comparison!.sections[0]!.lines).toHaveLength(1);
  const excerpt = await buildCodePatch(
    '@@ -8 +8 @@\n-const day = 0;\n+const day = 1;\n',
    'typescript',
  );
  expect(excerpt!.sections[0]!.label).toBe('Recorded excerpt · @@ -8,1 +8,1 @@');
  expect(excerpt!.sections[0]!.filePath).toBeUndefined();
  expect(
    excerpt!.sections[0]!.lines[1]!.tokens.some((token) => token.lightColor !== token.darkColor),
  ).toBe(true);
});

test.each([
  '',
  'not a patch',
  '@@ invalid @@\n-old\n+new\n',
  '--- a/file\n+++ b/file\n@@ -1,2 +1,2 @@\n-old\n+new\n',
  'diff --git a/file b/file\nBinary files a/file and b/file differ\n',
  'diff --git a/old b/new\nsimilarity index 100%\nrename from old\nrename to new\n',
])('returns a raw-source fallback for %s', async (patch) => {
  expect(await buildCodePatch(patch)).toBeNull();
});

test('normalizes CRLF and preserves long recorded lines', async () => {
  const source = 'policy '.repeat(1024);
  const comparison = await buildCodePatch(`@@ -1 +1 @@\r\n-old\r\n+${source}\r\n`);
  expect(comparison!.sections[0]!.lines[1]!.tokens.map((token) => token.content).join('')).toBe(
    source,
  );
});

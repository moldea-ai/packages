// @vitest-environment node
import { expect, test } from 'vitest';

import { buildCodePatch } from './index.js';

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
  expect(comparison!.sections[0]!.lines).toHaveLength(1);
  const excerpt = await buildCodePatch(
    '@@ -8 +8 @@\n-const day = 0;\n+const day = 1;\n',
    'typescript',
  );
  expect(excerpt!.sections[0]!.label).toBe('Recorded excerpt · @@ -8,1 +8,1 @@');
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

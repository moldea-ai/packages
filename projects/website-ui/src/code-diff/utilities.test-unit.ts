// @vitest-environment node
import { expect, test } from 'vitest';

import { buildCodeDiff, type ICodeDiffLine } from './index.js';

const sourceOf = (line: { tokens: { content: string }[] }): string =>
  line.tokens.map((token) => token.content).join('');

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

const sizedChange = (length: number): { before: string; after: string } => {
  const before = 'policy old;';
  const after = 'policy new;';
  return { before: before + ' '.repeat(length - before.length - after.length), after };
};

const joinChanges = (changes: { before: string; after: string }[]): [string, string] => [
  changes.map((change, index) => `${change.before}\ncontext ${index}\n`).join(''),
  changes.map((change, index) => `${change.after}\ncontext ${index}\n`).join(''),
];

test.each([
  ['call rename', 'getUser();', 'getAccount();', [['getUser']], [['getAccount']]],
  ['numbers', 'const days = 30;', 'const days = 14;', [['30']], [['14']]],
  ['punctuation', 'call(value);', 'call[value];', [['(', ')']], [['[', ']']]],
  ['half retained', 'alpha + beta;', 'gamma + delta;', [['alpha', 'beta']], [['gamma', 'delta']]],
  ['below half', 'alpha + beta;', 'gamma - delta;', [[]], [[]]],
  ['half of expanded side', 'alpha beta', 'alpha beta gamma delta', [[]], [['gamma delta']]],
  ['below half of expanded side', 'alpha beta', 'alpha beta gamma delta epsilon', [[]], [[]]],
  ['half of contracted side', 'alpha beta gamma delta', 'alpha beta', [['gamma delta']], [[]]],
  ['below half of contracted side', 'alpha beta gamma delta epsilon', 'alpha beta', [[]], [[]]],
  ['no anchor', 'alpha', 'beta', [[]], [[]]],
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
    'separated changes',
    'const first = old; const next = stale;',
    'const first = fresh; const next = current;',
    [['old', 'stale']],
    [['fresh', 'current']],
  ],
  [
    'repeated words and insertion',
    'send the policy and the receipt.',
    'send the updated policy and the receipt.',
    [[]],
    [['updated']],
  ],
  ['reflow', 'Read the policy and quote it.', 'Read the policy\nand quote it.', [[]], [[], []]],
  [
    'short multiline insertion',
    'Read the policy and quote it.',
    'Read the updated policy\nand quote it.',
    [[]],
    [['updated'], []],
  ],
  ['combining marks', 'mark = "a\u0301";', 'mark = "e\u0301";', [['a\u0301']], [['e\u0301']]],
  ['emoji clusters', 'mark = "👩‍💻";', 'mark = "👨‍💻";', [['👩‍💻']], [['👨‍💻']]],
  ['literal HTML', 'html = "<b>old</b>";', 'html = "<b>new</b>";', [['old']], [['new']]],
])(
  'buildCodeDiff(%s) -> exact emphasized ranges and original source',
  async (_description, before, after, expectedBefore, expectedAfter) => {
    const comparison = await buildCodeDiff(before, after, 'unknown-language', Infinity);
    const lines = comparison.sections.flatMap((section) => section.lines);
    expect(
      lines
        .flatMap((line) => line.tokens)
        .every((token) => token.isChanged === true || !Object.hasOwn(token, 'isChanged')),
    ).toBe(true);
    expect(lines.filter((line) => line.kind === 'removed').map(emphasisOf)).toStrictEqual(
      expectedBefore,
    );
    expect(lines.filter((line) => line.kind === 'added').map(emphasisOf)).toStrictEqual(
      expectedAfter,
    );
    expect(
      lines
        .filter((line) => line.kind !== 'added')
        .map(sourceOf)
        .join('\n'),
    ).toBe(before);
    expect(
      lines
        .filter((line) => line.kind !== 'removed')
        .map(sourceOf)
        .join('\n'),
    ).toBe(after);
  },
);

test.each([false, true])(
  'keeps substantial wrapped expansions at row level (reverse=%s)',
  async (reverse) => {
    const original = 'policy and quote it.';
    const inserted =
      'policy, confirm the customer identity\nwith two separate checks recorded in the ticket,\nand quote it.';
    const comparison = await buildCodeDiff(
      reverse ? inserted : original,
      reverse ? original : inserted,
    );
    const lines = comparison.sections.flatMap((section) => section.lines);
    expect(
      lines.filter((line) => line.kind === (reverse ? 'removed' : 'added')).map(emphasisOf),
    ).toStrictEqual([[], [], []]);
    expect(
      lines.filter((line) => line.kind === (reverse ? 'added' : 'removed')).map(emphasisOf),
    ).toStrictEqual([[]]);
    expect(
      lines
        .filter((line) => line.kind !== 'added')
        .map(sourceOf)
        .join('\n'),
    ).toBe(reverse ? inserted : original);
    expect(
      lines
        .filter((line) => line.kind !== 'removed')
        .map(sourceOf)
        .join('\n'),
    ).toBe(reverse ? original : inserted);
  },
);

test.each([false, true])('keeps the booking rewrite at row level (reverse=%s)', async (reverse) => {
  const original = ") => availableSlots.includes(slot) ? 'confirmed' : 'unavailable';";
  const replacement = `  isSameDay: boolean,
) => {
  if (!availableSlots.includes(slot)) {
    return 'unavailable';
  }
  return isSameDay
    ? 'pending_staff_approval'
    : 'confirmed';
};`;
  const before = reverse ? replacement : original;
  const after = reverse ? original : replacement;
  const comparison = await buildCodeDiff(before, after, 'typescript', Infinity);
  const lines = comparison.sections.flatMap((section) => section.lines);
  expect(lines.every((line) => emphasisOf(line).length === 0)).toBe(true);
  expect(
    lines
      .filter((line) => line.kind !== 'added')
      .map(sourceOf)
      .join('\n'),
  ).toBe(before);
  expect(
    lines
      .filter((line) => line.kind !== 'removed')
      .map(sourceOf)
      .join('\n'),
  ).toBe(after);
});

test.each([false, true])(
  'suppresses standalone whole-line changes inside mixed blocks (reverse=%s)',
  async (reverse) => {
    const original = 'const count = getCount();';
    const inserted = 'const count = readCount();\nstartWorker();';
    const comparison = await buildCodeDiff(
      reverse ? inserted : original,
      reverse ? original : inserted,
      'typescript',
    );
    const lines = comparison.sections.flatMap((section) => section.lines);
    expect(
      lines.filter((line) => line.kind === (reverse ? 'removed' : 'added')).map(emphasisOf),
    ).toStrictEqual([['readCount'], []]);
    expect(
      lines.filter((line) => line.kind === (reverse ? 'added' : 'removed')).map(emphasisOf),
    ).toStrictEqual([['getCount']]);
    for (const section of comparison.sections)
      for (const row of section.rows) {
        if (row.before) expect(section.lines).toContain(row.before);
        if (row.after) expect(section.lines).toContain(row.after);
      }
  },
);

test.each([
  ['', 'new line'],
  ['old line', ''],
  ['policy 30 days\n', 'policy\t30  days\n'],
  ['policy;\n', 'policy;'],
  ['policy;\r\n', 'policy;\n'],
])('keeps pure or whitespace/newline changes at row level (%s -> %s)', async (before, after) => {
  const comparison = await buildCodeDiff(before, after);
  expect(
    comparison.sections
      .flatMap((section) => section.lines)
      .every((line) => emphasisOf(line).length === 0),
  ).toBe(true);
});

test('retains original syntax colors when emphasized fragments split Shiki tokens', async () => {
  const before = 'const message = "read the old policy";';
  const after = 'const message = "read the new policy";';
  const comparison = await buildCodeDiff(before, after, 'typescript');
  const colorsOf = (line: ICodeDiffLine) =>
    line.tokens.flatMap((token) =>
      [...token.content].map((character) => [character, token.lightColor, token.darkColor]),
    );
  const lines = comparison.sections.flatMap((section) => section.lines);
  for (const [source, kind, expected] of [
    [before, 'removed', 'old'],
    [after, 'added', 'new'],
  ] as const) {
    const baseline = await buildCodeDiff(source, source, 'typescript');
    const changed = lines.find((line) => line.kind === kind)!;
    expect(emphasisOf(changed)).toStrictEqual([expected]);
    expect(colorsOf(changed)).toStrictEqual(colorsOf(baseline.sections[0]!.lines[0]!));
  }
});

test.each([
  [16_384, true],
  [16_385, false],
])('bounds combined block length at %d (refined=%s)', async (length, refined) => {
  const { before, after } = sizedChange(length);
  expect(before.length + after.length).toBe(length);
  const comparison = await buildCodeDiff(before, after);
  const lines = comparison.sections.flatMap((section) => section.lines);
  expect(lines.map(emphasisOf)).toStrictEqual(refined ? [['old'], ['new']] : [[], []]);
  expect(lines.map(sourceOf)).toStrictEqual([before, after]);
});

test('admits the exact aggregate budget, then keeps remaining blocks complete without emphasis', async () => {
  const [before, after] = joinChanges([
    ...Array.from({ length: 4 }, () => sizedChange(16_384)),
    sizedChange(32),
  ]);
  const comparison = await buildCodeDiff(before, after);
  const lines = comparison.sections.flatMap((section) => section.lines);
  expect(lines.filter((line) => line.kind === 'removed').map(emphasisOf)).toStrictEqual([
    ['old'],
    ['old'],
    ['old'],
    ['old'],
    [],
  ]);
  expect([comparison.removedCount, comparison.addedCount]).toStrictEqual([5, 5]);
  expect(
    lines
      .filter((line) => line.kind !== 'added')
      .map(sourceOf)
      .join('\n') + '\n',
  ).toBe(before);
  expect(
    lines
      .filter((line) => line.kind !== 'removed')
      .map(sourceOf)
      .join('\n') + '\n',
  ).toBe(after);
});

test('stops subsequent refinement after a block cannot fit the remaining aggregate budget', async () => {
  const [before, after] = joinChanges([
    sizedChange(16_384),
    sizedChange(16_384),
    sizedChange(16_384),
    sizedChange(15_360),
    sizedChange(2_048),
    sizedChange(32),
  ]);
  const comparison = await buildCodeDiff(before, after);
  expect(
    comparison.sections
      .flatMap((section) => section.lines)
      .filter((line) => line.kind === 'added')
      .map(emphasisOf),
  ).toStrictEqual([['new'], ['new'], ['new'], ['new'], [], []]);
});

test('skips oversized blocks without spending the admitted-work budget', async () => {
  const [before, after] = joinChanges([sizedChange(16_385), sizedChange(32)]);
  const comparison = await buildCodeDiff(before, after);
  expect(
    comparison.sections
      .flatMap((section) => section.lines)
      .filter((line) => line.kind === 'added')
      .map(emphasisOf),
  ).toStrictEqual([[], ['new']]);
});

test('charges admitted blocks even when token edit searches abort', async () => {
  const beforePrefix =
    'anchor '.repeat(256) +
    Array.from({ length: 129 }, (_, index) => `before${index}`).join(' ') +
    ';';
  const after =
    'anchor '.repeat(256) +
    Array.from({ length: 129 }, (_, index) => `after${index}`).join(' ') +
    ';';
  const aborted = {
    before: beforePrefix + ' '.repeat(16_384 - beforePrefix.length - after.length),
    after,
  };
  const [beforeSource, afterSource] = joinChanges([
    ...Array.from({ length: 4 }, () => aborted),
    sizedChange(32),
  ]);
  const comparison = await buildCodeDiff(beforeSource, afterSource);
  expect(comparison.isCoarseComparison).toBe(false);
  expect([comparison.removedCount, comparison.addedCount]).toStrictEqual([5, 5]);
  expect(
    comparison.sections
      .flatMap((section) => section.lines)
      .every((line) => emphasisOf(line).length === 0),
  ).toBe(true);
});

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
  expect(lines.every((line) => emphasisOf(line).length === 0)).toBe(true);
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

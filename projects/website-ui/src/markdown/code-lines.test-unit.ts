// @vitest-environment node
import type { Element, ElementContent, Root } from 'hast';
import { expect, test } from 'vitest';

import { addCodeLines } from './code-lines.js';

const sourceText = (nodes: ElementContent[]): string =>
  nodes
    .map((node) =>
      node.type === 'text' ? node.value : node.type === 'element' ? sourceText(node.children) : '',
    )
    .join('');

test('numbers nested multiline syntax without inserting gutter text into the source', () => {
  const code: Element = {
    type: 'element',
    tagName: 'code',
    properties: {},
    children: [
      {
        type: 'element',
        tagName: 'span',
        properties: { style: 'color:red' },
        children: [{ type: 'text', value: '<example>\n\n  final\n' }],
      },
    ],
  };
  const tree: Root = {
    type: 'root',
    children: [{ type: 'element', tagName: 'pre', properties: {}, children: [code] }],
  };
  addCodeLines({ startingLineNumber: 8, highlightedLines: [7, 8, 8, 10, 99, NaN, 9.5] })(tree);
  const lines = code.children.filter((node): node is Element => node.type === 'element');
  expect(sourceText(code.children)).toBe('<example>\n\n  final\n');
  expect(
    lines.map((line) => (line.children[0] as Element).properties['dataLineNumber']),
  ).toStrictEqual([8, 9, 10, 11]);
  expect(lines.map((line) => line.properties['dataHighlightedLine'] !== undefined)).toStrictEqual([
    true,
    false,
    true,
    false,
  ]);
  expect(lines[0]?.children[1]).toMatchObject({ properties: { style: 'color:red' } });
});

test.each([0, -1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1])(
  'defaults an invalid starting line %s to one',
  (startingLineNumber) => {
    const code: Element = {
      type: 'element',
      tagName: 'code',
      properties: {},
      children: [{ type: 'text', value: 'one\ntwo' }],
    };
    const tree: Root = {
      type: 'root',
      children: [{ type: 'element', tagName: 'pre', properties: {}, children: [code] }],
    };
    addCodeLines({ startingLineNumber })(tree);
    expect((code.children[0] as Element).children[0]).toMatchObject({
      properties: { dataLineNumber: 1 },
    });
    expect(sourceText(code.children)).toBe('one\ntwo');
  },
);

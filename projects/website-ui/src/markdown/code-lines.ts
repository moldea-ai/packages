import type { Element, ElementContent, Root } from 'hast';

import type { ICodeBlockLineOptions } from './types.js';

/** Splits highlighted nodes at source newlines, retaining nested syntax spans. */
const splitLines = (nodes: ElementContent[]): ElementContent[][] => {
  const lines: ElementContent[][] = [[]];
  for (const node of nodes) {
    const fragments =
      node.type === 'text'
        ? node.value.split('\n').map((value): ElementContent => ({ type: 'text', value }))
        : node.type === 'element'
          ? splitLines(node.children).map((children): ElementContent => ({ ...node, children }))
          : [node];
    for (const [index, fragment] of fragments.entries()) {
      if (index > 0) lines.push([]);
      lines.at(-1)!.push(fragment);
    }
  }
  return lines;
};

/** Adds original coordinates after sanitization and Shiki without changing copied source text. */
export const addCodeLines =
  (options: ICodeBlockLineOptions) =>
  (tree: Root): void => {
    const start = options.startingLineNumber;
    const firstLine = Number.isSafeInteger(start) && start! > 0 ? start! : 1;
    const highlights = new Set(
      options.highlightedLines?.filter((line) => Number.isSafeInteger(line) && line >= firstLine),
    );
    const visit = (parent: Root | Element): void => {
      for (const pre of parent.children) {
        if (pre.type !== 'element' || pre.tagName !== 'pre') {
          if ('children' in pre) visit(pre);
          continue;
        }
        const code = pre.children.find(
          (child) => child.type === 'element' && child.tagName === 'code',
        );
        if (code?.type !== 'element') continue;
        pre.properties['dataCodeLines'] = '';
        code.children = splitLines(code.children).flatMap((children, index): ElementContent[] => {
          const lineNumber = firstLine + index;
          const line: ElementContent = {
            type: 'element',
            tagName: 'span',
            properties: {
              className: ['code-source-line'],
              ...(highlights.has(lineNumber) ? { dataHighlightedLine: '' } : {}),
            },
            children: [
              {
                type: 'element',
                tagName: 'span',
                properties: {
                  className: ['code-line-number'],
                  ariaHidden: 'true',
                  dataLineNumber: lineNumber,
                },
                children: [],
              },
              ...children,
            ],
          };
          return index === 0 ? [line] : [{ type: 'text', value: '\n' }, line];
        });
      }
    };
    visit(tree);
  };

import type { Root as IHtmlRoot, RootContent as IHtmlNode } from 'hast';
import type {
  Blockquote as IMarkdownQuote,
  Paragraph as IMarkdownParagraph,
  Root as IMarkdownRoot,
  RootContent as IMarkdownNode,
} from 'mdast';

import type {
  IConversationRole,
  IRenderedConversationMessage,
  IRenderedMarkdownBlock,
} from './types.js';

/** Recognizes a standalone authored speaker label, never a label embedded in prose. */
const getSpeaker = (paragraph: IMarkdownParagraph): IConversationRole | undefined => {
  if (paragraph.children.length !== 1) return undefined;
  const label = paragraph.children[0];
  if (label?.type !== 'strong' || label.children.length !== 1) return undefined;
  const text = label.children[0];
  if (text?.type !== 'text') return undefined;
  if (text.value === 'You') return 'user';
  if (text.value === 'Coding agent') return 'assistant';
  return undefined;
};

/** Splits explicitly labelled turns even when CommonMark combines adjacent quotes. */
const splitTurns = (quote: IMarkdownQuote): IMarkdownQuote[] => {
  const first = quote.children[0];
  if (first?.type !== 'paragraph' || !getSpeaker(first)) return [quote];
  const turns: IMarkdownQuote[] = [];
  let turn: IMarkdownQuote | undefined;
  for (const child of quote.children) {
    const role = child.type === 'paragraph' ? getSpeaker(child) : undefined;
    if (role) {
      turn = {
        type: 'blockquote',
        children: [],
        data: { hProperties: { dataConversationRole: role } },
      };
      turns.push(turn);
    }
    turn?.children.push(child);
  }
  return turns.every(({ children }) => children.length > 1) ? turns : [quote];
};

/**
 * Marks only top-level, explicitly authored conversations before HTML conversion.
 * @param options Whether this document opts into the authored conversation syntax.
 * @returns A Markdown AST transformer; ordinary quotes and nested content remain unchanged.
 */
export const markConversations =
  (options: { enabled: boolean }) =>
  (tree: IMarkdownRoot): void => {
    if (!options.enabled) return;
    tree.children = tree.children.flatMap<IMarkdownNode>((child) =>
      child.type === 'blockquote' ? splitTurns(child) : [child],
    );
  };

/**
 * Composes ordered presentation blocks from the already sanitized full-document AST.
 * @param tree Sanitized, highlighted HTML AST with document-wide heading IDs.
 * @param render The document's existing HTML serializer and presentation policy.
 * @returns Ordered HTML and conversation blocks without reparsing HTML or Markdown.
 */
export const createDocumentBlocks = (
  tree: IHtmlRoot,
  render: (root: IHtmlRoot) => string,
): IRenderedMarkdownBlock[] => {
  const blocks: IRenderedMarkdownBlock[] = [];
  let htmlNodes: IHtmlNode[] = [];
  let messages: IRenderedConversationMessage[] = [];
  const flushHtml = (): void => {
    if (!htmlNodes.length) return;
    const html = render({ type: 'root', children: htmlNodes });
    if (html.trim()) blocks.push({ kind: 'html', html });
    htmlNodes = [];
  };
  const flushConversation = (): void => {
    if (messages.length) blocks.push({ kind: 'conversation', messages });
    messages = [];
  };
  for (const node of tree.children) {
    const role =
      node.type === 'element' && node.tagName === 'blockquote'
        ? node.properties['dataConversationRole']
        : undefined;
    if (node.type === 'element' && (role === 'user' || role === 'assistant')) {
      flushHtml();
      const labelIndex = node.children.findIndex(
        (child) => child.type === 'element' && child.tagName === 'p',
      );
      messages.push({
        role,
        html: render({ type: 'root', children: node.children.slice(labelIndex + 1) }),
      });
    } else if (!(messages.length && node.type === 'text' && !node.value.trim())) {
      flushConversation();
      htmlNodes.push(node);
    }
  }
  flushHtml();
  flushConversation();
  return blocks;
};

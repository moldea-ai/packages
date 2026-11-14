// rendered contracts
export type {
  ICodeBlockLineOptions,
  IConversationRole,
  IMarkdownBadgeTone,
  IMarkdownStrongLabelBadge,
  IMarkdownRenderOptions,
  IMarkdownDocumentRenderOptions,
  IRenderedMarkdownHeading,
  IRenderedMarkdownDocument,
  IRenderedMarkdownBlock,
  IRenderedConversationMessage,
} from './types.js';

// renderers
export { renderMarkdownDocument, renderMarkdownFragment, renderCodeBlock } from './markdown.js';

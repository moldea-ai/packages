import type { ICodeOverflow } from '../code-presentation/index.js';

// rendered documentation heading available to navigation surfaces
export interface IRenderedMarkdownHeading {
  readonly depth: 2 | 3;
  readonly html: string;
  readonly id: string;
  readonly text: string;
}

// sanitized document HTML and its stable page outline
export interface IRenderedMarkdownDocument {
  readonly headings: readonly IRenderedMarkdownHeading[];
  readonly html: string;
  readonly blocks: IRenderedMarkdownBlock[];
}

// semantic tones available to allowlisted Markdown badges
export type IMarkdownBadgeTone = 'danger' | 'info' | 'neutral' | 'success' | 'warning';

// one exact strong-label transformation owned by the caller
export interface IMarkdownStrongLabelBadge {
  readonly id: string;
  readonly label: string;
  readonly tone: IMarkdownBadgeTone;
}

// deterministic presentation options shared by document and fragment rendering
export interface IMarkdownRenderOptions {
  readonly basePath?: string;
  readonly localLinks?: 'prefix' | 'unwrap';
  readonly strongLabelBadges?: readonly IMarkdownStrongLabelBadge[];
  readonly codeOverflow?: ICodeOverflow;
}

// document-only rendering options
export interface IMarkdownDocumentRenderOptions extends IMarkdownRenderOptions {
  readonly hasDocumentTitle?: boolean;
  readonly conversations?: boolean;
}

// explicitly authored conversation speakers
export type IConversationRole = 'user' | 'assistant';

// sanitized content for one turn, without the authored speaker paragraph
export interface IRenderedConversationMessage {
  role: IConversationRole;
  html: string;
}

// ordered document content for component-based presentation
export type IRenderedMarkdownBlock =
  | { kind: 'html'; html: string }
  | { kind: 'conversation'; messages: IRenderedConversationMessage[] };

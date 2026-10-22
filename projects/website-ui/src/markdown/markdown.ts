import rehypeShiki from '@shikijs/rehype';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import type {
  Element as IHtmlElement,
  ElementContent as IHtmlContent,
  Root as IHtmlRoot,
} from 'hast';

import { withBase } from '../site/index.js';
import { resolveCodeOverflow, type ICodeOverflow } from '../code-presentation/index.js';
import { splitCodeSegments } from '../code-presentation/utilities.js';

import type {
  IMarkdownBadgeTone,
  IMarkdownRenderOptions,
  IMarkdownDocumentRenderOptions,
  IMarkdownStrongLabelBadge,
  IRenderedMarkdownHeading,
  IRenderedMarkdownDocument,
} from './types.js';
import { markConversations, createDocumentBlocks } from './conversations.js';
const BADGE_TONE_CLASSES = {
  danger: 'border-destructive/40 bg-destructive/10 text-foreground',
  info: 'border-info/40 bg-info/10 text-foreground',
  neutral: 'border-border bg-muted text-muted-foreground',
  success: 'border-foreground/25 bg-secondary text-foreground',
  warning: 'border-warning/60 bg-warning/15 text-warning-foreground dark:text-foreground',
} as const satisfies Readonly<Record<IMarkdownBadgeTone, string>>;

// Lucide external-link icon used by sanitized Markdown links.
const EXTERNAL_LINK_ICON_HTML =
  '&#160;<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide inline size-3.5" aria-hidden="true" data-external-link-icon><path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path></svg>';

/** Keeps an external-link indicator with the final readable segment without blocking earlier wraps. */
const appendExternalLinkIcon = (content: string): string => {
  const trailingSegmentMatch = content.match(/([^\s<>/]+\/?)(\s*(?:<\/[^>]+>\s*)*)$/u);

  if (!trailingSegmentMatch || trailingSegmentMatch.index === undefined) {
    return `<span class="whitespace-nowrap">${content}${EXTERNAL_LINK_ICON_HTML}</span>`;
  }

  const trailingSegment = trailingSegmentMatch[1] ?? '';
  const closingTags = trailingSegmentMatch[2] ?? '';

  return `${content.slice(0, trailingSegmentMatch.index)}<span class="whitespace-nowrap">${trailingSegment}${EXTERNAL_LINK_ICON_HTML}</span>${closingTags}`;
};

/** Removes rendered tags when deriving a plain heading label. */
const stripTags = (html: string): string => html.replaceAll(/<[^>]+>/g, '');

/** Prefixes root-relative links through the configured public base path. */
const prefixInternalLinks = (html: string, basePath: string): string => {
  return html.replaceAll(/href="\/(?!\/)/g, `href="${withBase('/', basePath)}`);
};

/** Removes recorded local links that cannot resolve in an embedded public fragment. */
const unwrapLocalLinks = (html: string): string =>
  html.replaceAll(/<a href="(?!(?:[a-z][a-z\d+.-]*:|\/\/))[^" ]*">([\s\S]*?)<\/a>/giu, '$1');

/** Adds safe external-window behavior and a visible indicator to absolute web links. */
const markExternalLinks = (html: string): string => {
  return html.replaceAll(
    /<a href="((?:https?:)?\/\/[^" ]+)"([^>]*)>([\s\S]*?)<\/a>/g,
    (_match, href: string, attributes: string, content: string) =>
      `<a href="${href}"${attributes} target="_blank" rel="noopener noreferrer">${appendExternalLinkIcon(content)}</a>`,
  );
};

/*
 * Wraps wide tables in one keyboard-focusable, named scrolling group. A group, unlike a region
 * landmark, may repeat its generic name when one page renders several tables.
 */
const wrapTables = (html: string): string => {
  return html.replaceAll(
    /<table>([\s\S]*?)<\/table>/g,
    '<div class="table-scroll" tabindex="0" role="group" aria-label="Scrollable table"><table>$1</table></div>',
  );
};

/** Escapes consumer-owned text before inserting it into an HTML attribute. */
const escapeHtmlAttribute = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

/** Names code groups and makes their horizontal overflow keyboard-accessible. */
const markCodeBlocks = (html: string, ariaLabel = 'Code block', overflow?: ICodeOverflow): string =>
  html.replaceAll(
    /<pre\b([^>]*)>([\s\S]*?)<\/pre>/gu,
    (_match, attributes: string, body: string) => {
      const focusAttribute = /\btabindex=/u.test(attributes) ? '' : ' tabindex="0"';
      const language = body.match(/<code\b[^>]*\bclass="[^"]*\blanguage-([^\s"]+)/u)?.[1];
      const mode = resolveCodeOverflow(language, overflow);
      return `<pre${attributes}${focusAttribute} role="group" aria-label="${escapeHtmlAttribute(ariaLabel)}" data-code-overflow="${escapeHtmlAttribute(mode)}">${body}</pre>`;
    },
  );

/** Converts allowlisted strong labels into package-owned semantic badges. */
const renderStrongLabelBadges = (
  html: string,
  badges: readonly IMarkdownStrongLabelBadge[],
): string => {
  const seenLabels = new Set<string>();

  return badges.reduce((renderedHtml, badge) => {
    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(badge.id) ||
      !/^[\p{L}\p{N}][\p{L}\p{N} ._-]{0,63}$/u.test(badge.label) ||
      seenLabels.has(badge.label)
    ) {
      throw new Error('Markdown strong-label badge configuration is invalid.');
    }
    seenLabels.add(badge.label);

    return renderedHtml.replaceAll(
      `<strong>${badge.label}</strong>`,
      `<span class="markdown-badge ${BADGE_TONE_CLASSES[badge.tone]}" data-markdown-badge="${badge.id}">${badge.label}</span>`,
    );
  }, html);
};

/** Splits inline code text after separators with break opportunities that carry no text. */
const addCodeBreaks = (content: IHtmlContent): IHtmlContent[] =>
  content.type === 'text'
    ? splitCodeSegments(content.value).flatMap((value, index) => {
        const text: IHtmlContent = { type: 'text', value };
        return index > 0
          ? [{ type: 'element', tagName: 'wbr', properties: {}, children: [] }, text]
          : [text];
      })
    : [content];

/**
 * Lets inline code wrap only after `/`, `_`, `.` or `-`, never mid-word. Runs after sanitization
 * so the break opportunities survive; code blocks inside `pre` keep their exact source.
 */
const addInlineCodeBreaks = () => (tree: IHtmlRoot) => {
  const visit = (node: IHtmlRoot | IHtmlElement): void => {
    for (const child of node.children) {
      if (child.type !== 'element' || child.tagName === 'pre') continue;
      if (child.tagName === 'code') child.children = child.children.flatMap(addCodeBreaks);
      else visit(child);
    }
  };
  visit(tree);
};

/** Shares sanitization and highlighting between authored Markdown and literal code. */
const createMarkdownProcessor = (shouldSlugHeadings: boolean, conversations = false) => {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(markConversations, { enabled: conversations })
    .use(remarkRehype);
  if (shouldSlugHeadings) processor.use(rehypeSlug);

  return processor
    .use(rehypeSanitize, {
      ...defaultSchema,
      clobberPrefix: '',
      attributes: {
        ...defaultSchema.attributes,
        blockquote: [['dataConversationRole', 'user', 'assistant']],
      },
    })
    .use(addInlineCodeBreaks)
    .use(rehypeShiki, {
      addLanguageClass: true,
      defaultColor: false,
      langs: [],
      lazy: true,
      themes: {
        dark: 'github-dark-default',
        light: 'github-light-default',
      },
    })
    .use(rehypeStringify);
};

/** Processes Markdown with optional stable heading IDs. */
const processMarkdown = async (source: string, shouldSlugHeadings: boolean): Promise<string> => {
  const file = await createMarkdownProcessor(shouldSlugHeadings).process(source);

  return String(file);
};

/** Applies deterministic link, table, badge, and code presentation. */
const applyPresentation = (html: string, options: IMarkdownRenderOptions): string => {
  const basePath = options.basePath ?? '/';
  const localLinks = options.localLinks ?? 'prefix';
  const linkedHtml =
    localLinks === 'unwrap' ? unwrapLocalLinks(html) : prefixInternalLinks(html, basePath);
  const badgedHtml = renderStrongLabelBadges(linkedHtml, options.strongLabelBadges ?? []);
  return markCodeBlocks(
    wrapTables(markExternalLinks(badgedHtml)),
    'Code block',
    options.codeOverflow,
  );
};

/** Extracts stable second- and third-level headings from sanitized document HTML. */
const getHeadings = (html: string): readonly IRenderedMarkdownHeading[] => {
  return [...html.matchAll(/<h([23]) id="([^"]+)">([\s\S]*?)<\/h\1>/g)].map(
    (match): IRenderedMarkdownHeading => ({
      depth: Number(match[1]) as 2 | 3,
      html: match[3] ?? '',
      id: match[2] ?? '',
      text: stripTags(match[3] ?? ''),
    }),
  );
};

/**
 * Renders a complete authored Markdown document through one sanitized pipeline.
 * @param markdown Repository-owned Markdown source.
 * @param options Deterministic document presentation options.
 * @returns Sanitized highlighted HTML and stable second- and third-level headings.
 * @throws
 * - INVALID_BASE_PATH: The website base path contains unsupported URL characters.
 * - If the strong-label badge configuration is invalid
 */
export const renderMarkdownDocument = async (
  markdown: string,
  options: IMarkdownDocumentRenderOptions = {},
): Promise<IRenderedMarkdownDocument> => {
  const source = options.hasDocumentTitle === false ? markdown : markdown.replace(/^# .+\n+/u, '');
  const processor = createMarkdownProcessor(true, options.conversations);
  const tree = await processor.run(processor.parse(source));
  const render = (root: typeof tree): string =>
    applyPresentation(processor.stringify(root), options);
  const html = render(tree);

  return { headings: getHeadings(html), html, blocks: createDocumentBlocks(tree, render) };
};

/**
 * Renders one embedded Markdown fragment without document-owned heading IDs.
 * @param markdown Repository-owned or recorded Markdown source.
 * @param options Deterministic fragment presentation options.
 * @returns Sanitized highlighted HTML for an embedded content surface.
 * @throws
 * - INVALID_BASE_PATH: The website base path contains unsupported URL characters.
 * - If the strong-label badge configuration is invalid
 */
export const renderMarkdownFragment = async (
  markdown: string,
  options: IMarkdownRenderOptions = {},
): Promise<string> => {
  const renderedHtml = await processMarkdown(markdown, false);

  return applyPresentation(renderedHtml, options);
};

/**
 * Renders literal source without interpreting its contents as Markdown or HTML.
 * @param source Code or plain text to display verbatim.
 * @param language Syntax language; omitted languages remain unhighlighted and do not wrap.
 * @param ariaLabel Accessible name for the keyboard-scrollable code group.
 * @param overflow Optional wrapping/scrolling override; otherwise the language selects the mode.
 * @returns Sanitized, highlighted HTML with a keyboard-accessible code group.
 */
export const renderCodeBlock = async (
  source: string,
  language = '',
  ariaLabel = 'Code block',
  overflow?: ICodeOverflow,
): Promise<string> => {
  const processor = createMarkdownProcessor(false);
  const rendered = await processor.run({
    type: 'root',
    children: [{ type: 'code', lang: language || null, value: source }],
  });

  return markCodeBlocks(processor.stringify(rendered), ariaLabel, overflow);
};

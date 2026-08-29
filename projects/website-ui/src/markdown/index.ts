import rehypeShiki from '@shikijs/rehype';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

import { withBase } from '../site/index.js';

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
  readonly productNameTreatment?: 'code' | 'none';
  readonly strongLabelBadges?: readonly IMarkdownStrongLabelBadge[];
}

// document-only rendering options
export interface IMarkdownDocumentRenderOptions extends IMarkdownRenderOptions {
  readonly hasDocumentTitle?: boolean;
}

const BADGE_TONE_CLASSES = {
  danger: 'border-destructive/40 bg-destructive/10 text-foreground',
  info: 'border-info/40 bg-info/10 text-foreground',
  neutral: 'border-border bg-muted text-muted-foreground',
  success: 'border-foreground/25 bg-secondary text-foreground',
  warning: 'border-warning/60 bg-warning/15 text-warning-foreground dark:text-foreground',
} as const satisfies Readonly<Record<IMarkdownBadgeTone, string>>;

/** Removes rendered tags when deriving a plain heading label. */
const stripTags = (html: string): string => html.replaceAll(/<[^>]+>/g, '');

/** Prefixes root-relative links through the configured public base path. */
const prefixInternalLinks = (html: string, basePath: string): string => {
  return html.replaceAll(/href="\/(?!\/)/g, `href="${withBase('/', basePath)}`);
};

/** Removes recorded local links that cannot resolve in an embedded public fragment. */
const unwrapLocalLinks = (html: string): string =>
  html.replaceAll(/<a href="(?!(?:[a-z][a-z\d+.-]*:|\/\/))[^" ]*">([\s\S]*?)<\/a>/giu, '$1');

/** Adds safe external-window attributes to absolute web links. */
const markExternalLinks = (html: string): string => {
  return html.replaceAll(
    /<a href="((?:https?:)?\/\/[^" ]+)"/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer"',
  );
};

/** Wraps wide tables in one keyboard-focusable scrolling region. */
const wrapTables = (html: string): string => {
  return html.replaceAll(
    /<table>([\s\S]*?)<\/table>/g,
    '<div class="table-scroll" tabindex="0" role="region" aria-label="Scrollable table"><table>$1</table></div>',
  );
};

/** Applies the public product-name treatment outside existing code elements. */
const renderProductNamesAsCode = (html: string): string => {
  let codeDepth = 0;

  return html.replaceAll(/<[^>]+>|[^<]+/g, (token) => {
    if (/^<code(?:\s|>)/u.test(token)) codeDepth += 1;
    if (/^<\/code>/u.test(token)) codeDepth -= 1;
    if (token.startsWith('<') || codeDepth > 0) return token;

    return token.replaceAll(/\bmoldea\b/giu, '<code>moldea</code>');
  });
};

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

/** Processes Markdown with optional stable heading IDs. */
const processMarkdown = async (source: string, shouldSlugHeadings: boolean): Promise<string> => {
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkRehype);
  if (shouldSlugHeadings) processor.use(rehypeSlug);

  const file = await processor
    .use(rehypeSanitize, { ...defaultSchema, clobberPrefix: '' })
    .use(rehypeShiki, {
      defaultColor: false,
      langs: [],
      lazy: true,
      themes: {
        dark: 'github-dark-default',
        light: 'github-light-default',
      },
    })
    .use(rehypeStringify)
    .process(source);

  return String(file);
};

/** Applies deterministic link, table, badge, and product-name presentation. */
const applyPresentation = (html: string, options: IMarkdownRenderOptions): string => {
  const basePath = options.basePath ?? '/';
  const localLinks = options.localLinks ?? 'prefix';
  const linkedHtml =
    localLinks === 'unwrap' ? unwrapLocalLinks(html) : prefixInternalLinks(html, basePath);
  const badgedHtml = renderStrongLabelBadges(linkedHtml, options.strongLabelBadges ?? []);
  const productHtml =
    options.productNameTreatment === 'code' ? renderProductNamesAsCode(badgedHtml) : badgedHtml;

  return wrapTables(markExternalLinks(productHtml));
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
  const renderedHtml = await processMarkdown(source, true);
  const html = applyPresentation(renderedHtml, options);

  return { headings: getHeadings(html), html };
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

import type { ICodeOverflow } from './types.js';

/*
 * A break may follow a separator only when it sits between two non-separator characters, and
 * never between a name and its final extension, so `policy.ts` stays whole while `@moldea.ai/core`
 * can still break after its dot.
 */
const BREAK_AFTER_SEPARATOR = /(?<=[^/_.-][/_.-])(?=[^/_.-])(?!(?<=\.)[^/_.-]+$)/u;

/**
 * Splits inline code after path and identifier separators so it can wrap without breaking words.
 * Rendered Markdown inline code and the `CodeText` component both use it.
 * @param value The inline code text.
 * @returns The text segments, each ending at a permitted break.
 * @example
 * splitCodeSegments('/src/answer-cache.ts'); // ['/src/', 'answer-', 'cache.ts']
 */
export const splitCodeSegments = (value: string): string[] => value.split(BREAK_AFTER_SEPARATOR);

/**
 * Formats a root-relative repository path for display without its leading slash.
 * Native output, copied values, and code samples keep the exact path.
 * @param path The repository path, usually as reported by Core (`/moldea/moldea.yaml`).
 * @returns The path without one leading slash; other values are returned unchanged.
 * @example
 * formatRepositoryPath('/moldea/moldea.yaml'); // 'moldea/moldea.yaml'
 */
export const formatRepositoryPath = (path: string): string =>
  path.startsWith('/') ? path.slice(1) : path;

/**
 * Resolves shared source-line presentation while preserving explicit consumer choices.
 * @param language Syntax language; unlabelled source preserves its line layout.
 * @param overflow Optional consumer override.
 * @param filePath Recorded file path, which takes precedence over a patch-wide language hint.
 * @returns Wrapping for Markdown/plain text, or horizontal scrolling for other source.
 */
export const resolveCodeOverflow = (
  language?: string,
  overflow?: ICodeOverflow,
  filePath?: string,
): ICodeOverflow => {
  if (overflow !== undefined) return overflow;
  if (filePath !== undefined) {
    return /\.(?:md|markdown|mdx|txt|text)$/iu.test(filePath) ? 'wrap' : 'scroll';
  }
  return /^(?:md|markdown|mdx|text|txt|plaintext)$/iu.test(language?.trim() ?? '')
    ? 'wrap'
    : 'scroll';
};

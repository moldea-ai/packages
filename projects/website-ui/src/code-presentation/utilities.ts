import type { ICodeOverflow } from './types.js';

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

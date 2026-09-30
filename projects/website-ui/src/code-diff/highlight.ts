import {
  bundledLanguages,
  bundledLanguagesAlias,
  codeToTokensWithThemes,
  type BundledLanguage,
} from 'shiki';

import type { ICodeDiffToken } from './types.js';

const isBundledLanguage = (language: string): language is BundledLanguage =>
  Object.hasOwn(bundledLanguages, language) || Object.hasOwn(bundledLanguagesAlias, language);

/** Highlights one version of a file or recorded hunk in both supported themes. */
export const highlightSource = async (
  source: string,
  language: string,
): Promise<ICodeDiffToken[][]> => {
  const lines = await codeToTokensWithThemes(source, {
    lang: isBundledLanguage(language) ? language : 'text',
    themes: { light: 'github-light-default', dark: 'github-dark-default' },
  });
  return lines.map((tokens) =>
    tokens.map((token) => ({
      content: token.content,
      lightColor: token.variants['light']?.color,
      darkColor: token.variants['dark']?.color,
    })),
  );
};

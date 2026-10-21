import { resolveThemePreference, type IThemePreference } from 'jg-site';

// persisted website theme choices, and their parser
export { parseThemePreference, type IThemePreference } from 'jg-site';

/**
 * Resolves whether the effective theme should be dark.
 * @param preference Explicit or system theme preference.
 * @param doesSystemPreferDark Current operating-system preference.
 * @returns Whether the effective website theme is dark.
 */
export const isDarkTheme = (preference: IThemePreference, doesSystemPreferDark: boolean): boolean =>
  resolveThemePreference(preference, doesSystemPreferDark) === 'dark';

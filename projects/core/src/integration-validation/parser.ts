import { hasErrorCode } from 'jg-exception';
import { ERRORS, findMarkedRegion, type IMarkedRegion } from 'jg-utilities';

import type { IIntegrationBlockResult } from './types.js';

// the marker lines the skill writer puts around the managed block
const MARKERS = { start: '<!-- moldea:start -->', end: '<!-- moldea:end -->' };

/**
 * Finds the managed block's region with the skill writer's region semantics: one start and one end
 * marker, each on its own line, the start first.
 * @param text The instruction document.
 * @returns The region, or why the document has none.
 */
export const parseManagedIntegrationRegion = (
  text: string,
): IMarkedRegion | 'block-missing' | 'block-invalid' => {
  try {
    return findMarkedRegion(text, MARKERS) ?? 'block-missing';
  } catch (error) {
    if (hasErrorCode(error, ERRORS.INVALID_MARKED_REGION)) return 'block-invalid';
    throw error;
  }
};

/**
 * Extracts the relative installation path from the fixed relevance-gate command without executing it.
 * @returns The safe installation path or the reason it could not be obtained.
 */
export const parseIntegrationBlock = (text: string): IIntegrationBlockResult => {
  const region = parseManagedIntegrationRegion(text);
  if (typeof region === 'string') return { kind: 'missing', reason: region };
  const matches = text
    .slice(region.start, region.end)
    .matchAll(/^node "<repo-root>\/([^"\r\n]+)\/scripts\/relevance-gate\.mjs"(?:[ \t\r]|$)/gm);
  const first = matches.next().value;
  if (first === undefined || !matches.next().done)
    return { kind: 'missing', reason: 'skill-path-missing' };
  const skillPath = first[1];
  if (
    skillPath === undefined ||
    !/^[A-Za-z0-9._/-]+$/.test(skillPath) ||
    skillPath.startsWith('/') ||
    skillPath.endsWith('/') ||
    skillPath.includes('//') ||
    /(?:^|\/)\.{1,2}(?:\/|$)/.test(skillPath)
  )
    return { kind: 'missing', reason: 'skill-path-invalid' };
  return { kind: 'found', skillPath };
};

// import lines Claude Code resolves to the root AGENTS.md, by the importing file's directory
const ROOT_AGENTS_IMPORTS: ReadonlySet<string> = new Set(['@AGENTS.md', '@./AGENTS.md']);
const NESTED_AGENTS_IMPORTS: ReadonlySet<string> = new Set(['@../AGENTS.md']);

/**
 * Reports whether Claude Code instruction text imports the root AGENTS.md on a line of its own.
 * Lines inside fenced code blocks and imports embedded in other text do not count.
 * @param text The decoded instruction text.
 * @param isNested Whether the text belongs to `/.claude/CLAUDE.md` rather than a root file.
 * @returns `true` when one unfenced line, trimmed of spaces and tabs, is an AGENTS.md import.
 */
export const hasAgentsImport = (text: string, isNested: boolean): boolean => {
  const imports = isNested ? NESTED_AGENTS_IMPORTS : ROOT_AGENTS_IMPORTS;
  let fence: string | null = null;

  for (const rawLine of text.replace(/^\uFEFF/u, '').split(/\r\n|\n|\r/u)) {
    const line = rawLine.replace(/^[ \t]+|[ \t]+$/gu, '');
    const marker = /^(`{3,}|~{3,})/u.exec(line)?.[1];

    if (fence !== null) {
      if (marker !== undefined && marker[0] === fence[0] && marker.length >= fence.length)
        fence = null;
    } else if (marker !== undefined) {
      fence = marker;
    } else if (imports.has(line)) {
      return true;
    }
  }

  return false;
};

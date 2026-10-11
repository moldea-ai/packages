import type { IIntegrationBlockResult, IManagedIntegrationRegion } from './types.js';

const START = '<!-- moldea:start -->';
const END = '<!-- moldea:end -->';

/** Finds one ordered marker pair on complete lines, matching the skill writer's region semantics. */
export const parseManagedIntegrationRegion = (text: string): IManagedIntegrationRegion | null => {
  const start = text.indexOf(START);
  const end = text.indexOf(END);
  if (
    start < 0 ||
    end < start ||
    text.indexOf(START, start + START.length) >= 0 ||
    text.indexOf(END, end + END.length) >= 0
  )
    return null;
  const startsLine = (offset: number): boolean =>
    offset === 0 || (offset === 1 && text[0] === '\uFEFF') || text[offset - 1] === '\n';
  if (!startsLine(start) || !startsLine(end)) return null;
  const afterStart = start + START.length;
  const lineEnding = text.startsWith('\r\n', afterStart)
    ? '\r\n'
    : text[afterStart] === '\n'
      ? '\n'
      : null;
  if (lineEnding === null) return null;
  const afterEnd = end + END.length;
  const endLength = text.startsWith('\r\n', afterEnd) ? 2 : text[afterEnd] === '\n' ? 1 : 0;
  if (endLength === 0 && afterEnd !== text.length) return null;
  return { start, end: afterEnd + endLength, lineEnding };
};

/**
 * Extracts the relative installation path from the fixed relevance-gate command without executing it.
 * @returns The safe installation path or the reason it could not be obtained.
 */
export const parseIntegrationBlock = (text: string): IIntegrationBlockResult => {
  const region = parseManagedIntegrationRegion(text);
  if (region === null)
    return {
      kind: 'missing',
      reason: text.includes(START) || text.includes(END) ? 'block-invalid' : 'block-missing',
    };
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

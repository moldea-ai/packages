import { diffLines } from 'diff';
import type { ICodeDiffLine, ICodeDiffModel, ICodeDiffSection } from './types.js';
import { buildSplitRows } from './transformers.js';
import { highlightSource } from './highlight.js';

// cap Myers search work for unrelated files; coarse replacement remains complete and deterministic
const MAX_EDIT_LENGTH = 1024;

const normalizeSource = (source: string): string => source.replaceAll('\r\n', '\n');
const getLineCount = (source: string): number =>
  source.length === 0 ? 0 : source.split('\n').length - (source.endsWith('\n') ? 1 : 0);

/** Keeps nearby context visible and puts only distant unchanged rows in native disclosures. */
const buildSections = (lines: ICodeDiffLine[], contextLines: number): ICodeDiffSection[] => {
  if (lines.every((line) => line.kind === 'unchanged')) {
    return [{ isCollapsed: false, lines, rows: buildSplitRows(lines) }];
  }
  const sections: ICodeDiffSection[] = [];
  let visible: ICodeDiffLine[] = [];
  const appendSection = (sectionLines: ICodeDiffLine[], isCollapsed: boolean): void => {
    if (sectionLines.length > 0) {
      sections.push({ isCollapsed, lines: sectionLines, rows: buildSplitRows(sectionLines) });
    }
  };
  let index = 0;
  while (index < lines.length) {
    if (lines[index]!.kind !== 'unchanged') {
      visible.push(lines[index++]!);
      continue;
    }
    const start = index;
    while (index < lines.length && lines[index]!.kind === 'unchanged') index += 1;
    const leadingCount = start === 0 ? 0 : contextLines;
    const trailingCount = index === lines.length ? 0 : contextLines;
    const hiddenStart = start + leadingCount;
    const hiddenEnd = index - trailingCount;
    if (hiddenEnd - hiddenStart < 2) {
      for (let offset = start; offset < index; offset += 1) visible.push(lines[offset]!);
      continue;
    }
    for (let offset = start; offset < hiddenStart; offset += 1) visible.push(lines[offset]!);
    appendSection(visible, false);
    visible = [];
    appendSection(lines.slice(hiddenStart, hiddenEnd), true);
    for (let offset = hiddenEnd; offset < index; offset += 1) visible.push(lines[offset]!);
  }
  appendSection(visible, false);
  return sections;
};

/**
 * Compares complete files and highlights each version once, preserving multiline syntax context.
 * CRLF and LF compare equally; final-newline differences remain visible. Unrecognized languages
 * use plain text. Work exceeding the edit budget falls back to a complete coarse replacement.
 * @param oldValue Complete previous source.
 * @param newValue Complete replacement source.
 * @param language Shiki language or alias; defaults to plain text.
 * @param contextLines Unchanged lines retained beside changes, or Infinity to show every line.
 * @returns Highlighted rows, change counts, and expandable unchanged sections.
 */
export const buildCodeDiff = async (
  oldValue: string,
  newValue: string,
  language = 'text',
  contextLines = 3,
): Promise<ICodeDiffModel> => {
  const beforeSource = normalizeSource(oldValue);
  const afterSource = normalizeSource(newValue);
  const beforeCount = getLineCount(beforeSource);
  const afterCount = getLineCount(afterSource);
  const diff = diffLines(beforeSource, afterSource, { maxEditLength: MAX_EDIT_LENGTH });
  const changes = diff ?? [
    { removed: true, added: false, count: beforeCount },
    { removed: false, added: true, count: afterCount },
  ];
  const [beforeTokens, afterTokens] = await Promise.all([
    highlightSource(beforeSource, language),
    highlightSource(afterSource, language),
  ]);
  const lines: ICodeDiffLine[] = [];
  let oldNumber = 1;
  let newNumber = 1;
  let addedCount = 0;
  let removedCount = 0;
  for (const change of changes) {
    for (let offset = 0; offset < change.count; offset += 1) {
      const kind = change.added ? 'added' : change.removed ? 'removed' : 'unchanged';
      const usesBefore = kind === 'removed';
      const number = usesBefore ? oldNumber : newNumber;
      const tokens = (usesBefore ? beforeTokens : afterTokens)[number - 1] ?? [];
      lines.push({
        kind,
        oldNumber: kind === 'added' ? undefined : oldNumber++,
        newNumber: kind === 'removed' ? undefined : newNumber++,
        tokens,
        hasNoFinalNewline:
          number === (usesBefore ? beforeCount : afterCount) &&
          !(usesBefore ? beforeSource : afterSource).endsWith('\n'),
      });
      if (kind === 'added') addedCount += 1;
      if (kind === 'removed') removedCount += 1;
    }
  }
  const resolvedContext =
    contextLines === Infinity ? Infinity : Math.max(0, Math.floor(contextLines) || 0);
  return {
    addedCount,
    removedCount,
    isCoarseComparison: diff === undefined,
    sections: buildSections(lines, resolvedContext),
  };
};

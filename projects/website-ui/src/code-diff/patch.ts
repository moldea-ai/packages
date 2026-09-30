import { parsePatch, type StructuredPatchHunk } from 'diff';

import type { ICodeDiffLine, ICodeDiffModel, ICodeDiffSection } from './types.js';
import { buildSplitRows } from './transformers.js';
import { highlightSource } from './highlight.js';

/** Preserves a recorded hunk's ordering, source line numbers, and newline annotations. */
const buildHunkLines = async (
  hunk: StructuredPatchHunk,
  language: string,
): Promise<ICodeDiffLine[]> => {
  const sourceLines = hunk.lines.filter((line) => line.startsWith('\\') === false);
  const beforeSource = sourceLines
    .filter((line) => !line.startsWith('+'))
    .map((line) => line.slice(1));
  const afterSource = sourceLines
    .filter((line) => !line.startsWith('-'))
    .map((line) => line.slice(1));
  const [beforeTokens, afterTokens] = await Promise.all([
    highlightSource(beforeSource.join('\n'), language),
    highlightSource(afterSource.join('\n'), language),
  ]);
  const lines: ICodeDiffLine[] = [];
  let oldNumber = hunk.oldStart;
  let newNumber = hunk.newStart;
  let beforeIndex = 0;
  let afterIndex = 0;
  for (const sourceLine of hunk.lines) {
    if (sourceLine.startsWith('\\')) {
      const previous = lines.at(-1);
      if (previous) previous.hasNoFinalNewline = true;
      continue;
    }
    const kind = sourceLine.startsWith('+')
      ? 'added'
      : sourceLine.startsWith('-')
        ? 'removed'
        : 'unchanged';
    const tokens = (kind === 'removed' ? beforeTokens[beforeIndex] : afterTokens[afterIndex]) ?? [];
    lines.push({
      kind,
      oldNumber: kind === 'added' ? undefined : oldNumber++,
      newNumber: kind === 'removed' ? undefined : newNumber++,
      tokens,
      hasNoFinalNewline: false,
    });
    if (kind !== 'added') beforeIndex += 1;
    if (kind !== 'removed') afterIndex += 1;
  }
  return lines;
};

/**
 * Presents recorded unified hunks without reconstructing missing source or recalculating changes.
 * Highlighting sees only the recorded context. Consumers must preserve the raw patch alongside
 * the rendered hunks, including metadata and binary changes that have no textual rows.
 * @param patch Recorded unified patch, optionally containing multiple files.
 * @param language Shiki language or alias for the recorded excerpts; defaults to plain text.
 * @returns Recorded rows and counts, or null when there are no parseable textual hunks.
 */
export const buildCodePatch = async (
  patch: string,
  language = 'text',
): Promise<ICodeDiffModel | null> => {
  let files: ReturnType<typeof parsePatch>;
  try {
    files = parsePatch(patch.replaceAll('\r\n', '\n'));
  } catch {
    // malformed recorded patches remain readable through the component's raw-source fallback
    return null;
  }
  const sections: ICodeDiffSection[] = [];
  let addedCount = 0;
  let removedCount = 0;
  for (const file of files) {
    for (const hunk of file.hunks) {
      if (
        ![hunk.oldStart, hunk.oldLines, hunk.newStart, hunk.newLines].every(
          (number) => Number.isSafeInteger(number) && number >= 0,
        ) ||
        hunk.lines.length === 0
      )
        return null;
      const lines = await buildHunkLines(hunk, language);
      const fileName = file.newFileName === '/dev/null' ? file.oldFileName : file.newFileName;
      sections.push({
        label: `${fileName ?? 'Recorded excerpt'} · @@ -${hunk.oldStart - (hunk.oldLines === 0 ? 1 : 0)},${hunk.oldLines} +${hunk.newStart - (hunk.newLines === 0 ? 1 : 0)},${hunk.newLines} @@`,
        isCollapsed: false,
        lines,
        rows: buildSplitRows(lines),
      });
      for (const line of lines) {
        if (line.kind === 'added') addedCount += 1;
        if (line.kind === 'removed') removedCount += 1;
      }
    }
  }
  return sections.length === 0
    ? null
    : { addedCount, removedCount, isCoarseComparison: false, sections };
};

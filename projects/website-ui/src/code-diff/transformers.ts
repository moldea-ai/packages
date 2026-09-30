import type { ICodeDiffLine, ICodeDiffRow } from './types.js';

/** Aligns adjacent removals and additions without inventing matches between changed lines. */
export const buildSplitRows = (lines: ICodeDiffLine[]): ICodeDiffRow[] => {
  const rows: ICodeDiffRow[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index]!;
    if (line.kind === 'unchanged') {
      rows.push({ before: line, after: line });
      index += 1;
      continue;
    }
    const removed: ICodeDiffLine[] = [];
    const added: ICodeDiffLine[] = [];
    while (index < lines.length && lines[index]!.kind !== 'unchanged') {
      const changedLine = lines[index]!;
      (changedLine.kind === 'removed' ? removed : added).push(changedLine);
      index += 1;
    }
    for (let offset = 0; offset < Math.max(removed.length, added.length); offset += 1) {
      rows.push({ before: removed[offset], after: added[offset] });
    }
  }
  return rows;
};

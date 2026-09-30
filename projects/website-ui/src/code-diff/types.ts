// build-time, syntax-highlighted rows shared by unified and split diff layouts
export interface ICodeDiffToken {
  content: string;
  lightColor: string | undefined;
  darkColor: string | undefined;
}

export interface ICodeDiffLine {
  kind: 'added' | 'removed' | 'unchanged';
  oldNumber: number | undefined;
  newNumber: number | undefined;
  tokens: ICodeDiffToken[];
  hasNoFinalNewline: boolean;
}

export interface ICodeDiffRow {
  before: ICodeDiffLine | undefined;
  after: ICodeDiffLine | undefined;
}

export interface ICodeDiffSection {
  label?: string;
  isCollapsed: boolean;
  lines: ICodeDiffLine[];
  rows: ICodeDiffRow[];
}

export interface ICodeDiffModel {
  addedCount: number;
  removedCount: number;
  isCoarseComparison: boolean;
  sections: ICodeDiffSection[];
}

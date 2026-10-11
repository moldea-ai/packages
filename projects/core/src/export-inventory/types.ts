// syntax-only runtime export inventory; no AST or source bodies escape
export type IExportInventory =
  | { kind: 'parsed'; names: ReadonlySet<string>; complete: boolean }
  | {
      kind: 'not-checked';
      reason: 'unparseable-source' | 'resource-limit' | 'unsupported-file-type';
    };

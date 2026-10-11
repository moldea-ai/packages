import ts from 'typescript';

import type { IExportInventory } from './types.js';

const hasModifier = (node: ts.Node, kind: ts.SyntaxKind): boolean =>
  ts.canHaveModifiers(node) &&
  ts.getModifiers(node)?.some((modifier) => modifier.kind === kind) === true;

/** Creates a syntax-only program without library files, import resolution, or type checking. */
const hasSyntaxError = (source: ts.SourceFile, text: string): boolean => {
  const host: ts.CompilerHost = {
    fileExists: (name) => name === source.fileName,
    getCanonicalFileName: (name) => name,
    getCurrentDirectory: () => '/',
    getDefaultLibFileName: () => '/lib.d.ts',
    getDirectories: () => [],
    getNewLine: () => '\n',
    getSourceFile: (name) => (name === source.fileName ? source : undefined),
    readFile: (name) => (name === source.fileName ? text : undefined),
    useCaseSensitiveFileNames: () => true,
    writeFile: () => undefined,
  };
  const program = ts.createProgram({
    host,
    options: {
      allowJs: true,
      jsx: ts.JsxEmit.Preserve,
      module: ts.ModuleKind.ESNext,
      noLib: true,
      noResolve: true,
      target: ts.ScriptTarget.ES2023,
    },
    rootNames: [source.fileName],
  });
  return program
    .getSyntacticDiagnostics(source)
    .some((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
};

/** Retains only runtime export names and whether absence can be concluded from this file. */
const collectExportInventory = (path: string, bytes: Uint8Array): IExportInventory => {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true })
      .decode(bytes)
      .replace(/^\uFEFF/, '')
      .replace(/\r\n?/g, '\n');
  } catch {
    return { kind: 'not-checked', reason: 'unparseable-source' };
  }
  if (text.includes('\0')) return { kind: 'not-checked', reason: 'unparseable-source' };
  const kind = path.endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : path.endsWith('.jsx')
      ? ts.ScriptKind.JSX
      : /\.(?:js|mjs)$/.test(path)
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS;
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.ES2023, true, kind);
  if (hasSyntaxError(source, text)) return { kind: 'not-checked', reason: 'unparseable-source' };
  const names = new Set<string>();
  const typeOnlyNames = new Set<string>();
  let complete = true;
  const runtimeNames = new Set<string>();
  const addBindingNames = (name: ts.BindingName, target: Set<string>): void => {
    const pending = [name];
    while (pending.length > 0) {
      const current = pending.pop()!;
      if (ts.isIdentifier(current)) target.add(current.text);
      else
        for (const element of current.elements) {
          if (ts.isBindingElement(element)) pending.push(element.name);
        }
    }
  };
  for (const statement of source.statements) {
    const isTypeOnly =
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      hasModifier(statement, ts.SyntaxKind.DeclareKeyword) ||
      (ts.isFunctionDeclaration(statement) && statement.body === undefined);
    const target = isTypeOnly ? typeOnlyNames : runtimeNames;
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations)
        addBindingNames(declaration.name, target);
    } else if (
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isEnumDeclaration(statement) ||
      ts.isModuleDeclaration(statement)
    ) {
      if (statement.name && ts.isIdentifier(statement.name)) target.add(statement.name.text);
    }
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      if (clause?.name) (clause.isTypeOnly ? typeOnlyNames : runtimeNames).add(clause.name.text);
      if (clause?.namedBindings) {
        if (ts.isNamespaceImport(clause.namedBindings))
          (clause.isTypeOnly ? typeOnlyNames : runtimeNames).add(clause.namedBindings.name.text);
        else
          for (const element of clause.namedBindings.elements)
            (clause.isTypeOnly || element.isTypeOnly ? typeOnlyNames : runtimeNames).add(
              element.name.text,
            );
      }
    }
  }
  for (const name of runtimeNames) typeOnlyNames.delete(name);
  for (const statement of source.statements) {
    if (
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      hasModifier(statement, ts.SyntaxKind.DeclareKeyword)
    )
      continue;
    if (ts.isExportAssignment(statement)) {
      if (statement.isExportEquals) complete = false;
      else if (
        !ts.isIdentifier(statement.expression) ||
        !typeOnlyNames.has(statement.expression.text)
      )
        names.add('default');
      continue;
    }
    if (hasModifier(statement, ts.SyntaxKind.DefaultKeyword)) {
      names.add('default');
      continue;
    }
    if (ts.isExportDeclaration(statement)) {
      if (statement.isTypeOnly) continue;
      const clause = statement.exportClause;
      if (clause === undefined) complete = false;
      else if (ts.isNamespaceExport(clause)) names.add(clause.name.text);
      else
        for (const element of clause.elements) {
          const localName = element.propertyName?.text ?? element.name.text;
          if (
            !element.isTypeOnly &&
            (statement.moduleSpecifier !== undefined || !typeOnlyNames.has(localName))
          )
            names.add(element.name.text);
        }
      continue;
    }
    if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) continue;
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) names.add(declaration.name.text);
        else complete = false;
      }
    } else if (
      (ts.isFunctionDeclaration(statement) && statement.body !== undefined) ||
      ts.isClassDeclaration(statement) ||
      ts.isEnumDeclaration(statement) ||
      ts.isModuleDeclaration(statement)
    ) {
      if (statement.name && ts.isIdentifier(statement.name)) names.add(statement.name.text);
    }
  }
  // CommonJS aliases, helpers, deletes, and computed writes leave exports inconclusive.
  const pending: ts.Node[] = [source];
  while (pending.length > 0) {
    const node = pending.pop()!;
    if (ts.isIdentifier(node) && (node.text === 'module' || node.text === 'exports'))
      complete = false;
    ts.forEachChild(node, (child) => {
      pending.push(child);
    });
  }
  return { kind: 'parsed', names, complete };
};

/** Treats compiler stack exhaustion as an inconclusive parse without masking other failures. */
export const inventoryExports = (path: string, bytes: Uint8Array): IExportInventory => {
  try {
    return collectExportInventory(path, bytes);
  } catch (error) {
    if (error instanceof RangeError) return { kind: 'not-checked', reason: 'unparseable-source' };
    throw error;
  }
};

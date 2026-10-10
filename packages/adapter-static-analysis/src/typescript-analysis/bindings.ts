import { posix } from 'node:path';
import ts from 'typescript';

import type {
  IStaticAnalysisExportState,
  IStaticAnalysisImportConfig,
  IStaticAnalysisModuleArray,
  IStaticAnalysisNamedImport,
  IStaticAnalysisReference,
  IStaticAnalysisSource,
} from '../types.js';
import { getDirectCall, unwrapExpression } from './expressions.js';

const hasModifier = (node: ts.Node, kind: ts.SyntaxKind): boolean =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node)?.some((modifier) => modifier.kind === kind) ?? false);

const isConstDeclarationList = (declarationList: ts.VariableDeclarationList): boolean =>
  (declarationList.flags & ts.NodeFlags.Const) !== 0;

/**
 * Indexes static value imports and supported SDK constructor imports.
 * @param sourceFile The parsed TypeScript source.
 * @param config The provider package and constructor import forms.
 * @returns Module-owned import bindings needed by static checks.
 */
export const indexImports = (
  sourceFile: ts.SourceFile,
  config: IStaticAnalysisImportConfig,
): {
  readonly constructorNames: ReadonlySet<string>;
  readonly namedImports: ReadonlyMap<string, IStaticAnalysisNamedImport>;
} => {
  const constructorNames = new Set<string>();
  const namedImports = new Map<string, IStaticAnalysisNamedImport>();
  const supportedNamedImports = new Set(config.namedConstructorImports);

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }

    const importClause = statement.importClause;

    if (importClause?.isTypeOnly === true) {
      continue;
    }

    const moduleSpecifier = statement.moduleSpecifier.text;

    if (
      moduleSpecifier === config.packageName &&
      config.supportsDefaultConstructorImport &&
      importClause?.name !== undefined
    ) {
      constructorNames.add(importClause.name.text);
    }

    if (
      moduleSpecifier === config.packageName &&
      importClause?.namedBindings !== undefined &&
      ts.isNamedImports(importClause.namedBindings)
    ) {
      for (const element of importClause.namedBindings.elements) {
        const importedName = element.propertyName?.text ?? element.name.text;

        if (!element.isTypeOnly && supportedNamedImports.has(importedName)) {
          constructorNames.add(element.name.text);
        }
      }
    }

    if (
      (!moduleSpecifier.startsWith('.') &&
        !['node:fs', 'fs', 'node:fs/promises', 'fs/promises'].includes(moduleSpecifier) &&
        !config.namedHelperModuleSpecifiers?.includes(moduleSpecifier)) ||
      importClause?.namedBindings === undefined ||
      !ts.isNamedImports(importClause.namedBindings)
    ) {
      continue;
    }

    for (const element of importClause.namedBindings.elements) {
      if (element.isTypeOnly) {
        continue;
      }

      namedImports.set(
        element.name.text,
        Object.freeze({
          importedName: element.propertyName?.text ?? element.name.text,
          moduleSpecifier,
        }),
      );
    }
  }

  return { constructorNames, namedImports };
};

/**
 * Indexes direct exports, module-level SDK clients, and constant arrays.
 * @param sourceFile The parsed TypeScript source.
 * @param constructorNames The supported constructor bindings.
 * @returns Static module declarations used by adapter inspection.
 */
export const indexModuleDeclarations = (
  sourceFile: ts.SourceFile,
  constructorNames: ReadonlySet<string>,
): {
  readonly clientNames: ReadonlySet<string>;
  readonly exports: ReadonlyMap<
    string,
    IStaticAnalysisExportState & { readonly declaration: ts.Node }
  >;
  readonly moduleArrays: ReadonlyMap<string, IStaticAnalysisModuleArray>;
  readonly moduleConstDeclarations: ReadonlyMap<string, ts.VariableDeclaration>;
} => {
  const clientNames = new Set<string>();
  const exports = new Map<string, IStaticAnalysisExportState & { readonly declaration: ts.Node }>();
  const moduleArrays = new Map<string, IStaticAnalysisModuleArray>();
  const moduleConstDeclarations = new Map<string, ts.VariableDeclaration>();

  for (const statement of sourceFile.statements) {
    if (
      ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement) ||
      hasModifier(statement, ts.SyntaxKind.DeclareKeyword)
    ) {
      continue;
    }
    if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      exports.set(
        'default',
        Object.freeze({ declaration: statement, kind: 'present-unsupported' }),
      );
      continue;
    }
    if (hasModifier(statement, ts.SyntaxKind.DefaultKeyword)) {
      exports.set(
        'default',
        Object.freeze({ declaration: statement, kind: 'present-unsupported' }),
      );
      continue;
    }
    if (ts.isFunctionDeclaration(statement) && statement.name !== undefined) {
      if (hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
        exports.set(
          statement.name.text,
          Object.freeze({
            declaration: statement,
            kind:
              statement.body === undefined || hasModifier(statement, ts.SyntaxKind.DefaultKeyword)
                ? 'present-unsupported'
                : 'present-supported',
          }),
        );
      }

      continue;
    }

    if (ts.isExportDeclaration(statement) && statement.exportClause !== undefined) {
      if (statement.isTypeOnly) {
        continue;
      }
      if (ts.isNamespaceExport(statement.exportClause)) {
        exports.set(
          statement.exportClause.name.text,
          Object.freeze({ declaration: statement.exportClause, kind: 'present-unsupported' }),
        );
        continue;
      }
      if (!ts.isNamedExports(statement.exportClause)) {
        continue;
      }

      for (const element of statement.exportClause.elements) {
        if (!element.isTypeOnly) {
          exports.set(
            element.name.text,
            Object.freeze({ declaration: element, kind: 'present-unsupported' }),
          );
        }
      }

      continue;
    }

    if (!ts.isVariableStatement(statement)) {
      if (
        hasModifier(statement, ts.SyntaxKind.ExportKeyword) &&
        (ts.isClassDeclaration(statement) ||
          ts.isEnumDeclaration(statement) ||
          ts.isModuleDeclaration(statement)) &&
        statement.name !== undefined &&
        ts.isIdentifier(statement.name)
      ) {
        exports.set(
          statement.name.text,
          Object.freeze({ declaration: statement, kind: 'present-unsupported' }),
        );
      }

      continue;
    }

    const isConst = isConstDeclarationList(statement.declarationList);
    const isExported = hasModifier(statement, ts.SyntaxKind.ExportKeyword);

    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) {
        continue;
      }

      if (isExported) {
        exports.set(
          declaration.name.text,
          Object.freeze({
            declaration,
            kind:
              isConst && declaration.initializer !== undefined
                ? 'present-supported'
                : 'present-unsupported',
          }),
        );
      }

      if (!isConst || declaration.initializer === undefined) {
        continue;
      }

      moduleConstDeclarations.set(declaration.name.text, declaration);
      const initializer = unwrapExpression(declaration.initializer);

      if (ts.isNewExpression(initializer)) {
        const constructor = unwrapExpression(initializer.expression);

        if (ts.isIdentifier(constructor) && constructorNames.has(constructor.text)) {
          clientNames.add(declaration.name.text);
        }
      }

      if (ts.isArrayLiteralExpression(initializer)) {
        moduleArrays.set(
          declaration.name.text,
          Object.freeze({ declaration, expression: initializer }),
        );
      }
    }
  }

  return { clientNames, exports, moduleArrays, moduleConstDeclarations };
};

const addBindingNames = (names: Set<string>, bindingName: ts.BindingName): void => {
  if (ts.isIdentifier(bindingName)) {
    names.add(bindingName.text);
    return;
  }

  for (const element of bindingName.elements) {
    if (!ts.isOmittedExpression(element)) {
      addBindingNames(names, element.name);
    }
  }
};

const addVariableDeclarationListBindings = (
  names: Set<string>,
  declarationList: ts.VariableDeclarationList,
): void => {
  for (const declaration of declarationList.declarations) {
    addBindingNames(names, declaration.name);
  }
};

const addStatementBindings = (names: Set<string>, statement: ts.Statement): void => {
  if (ts.isVariableStatement(statement)) {
    addVariableDeclarationListBindings(names, statement.declarationList);
    return;
  }

  if (
    ts.isFunctionDeclaration(statement) ||
    ts.isClassDeclaration(statement) ||
    ts.isEnumDeclaration(statement) ||
    ts.isModuleDeclaration(statement)
  ) {
    if (statement.name !== undefined && ts.isIdentifier(statement.name)) {
      names.add(statement.name.text);
    }
  }
};

const isFunctionScope = (node: ts.Node): node is ts.FunctionLikeDeclaration =>
  ts.isArrowFunction(node) ||
  ts.isConstructorDeclaration(node) ||
  ts.isFunctionDeclaration(node) ||
  ts.isFunctionExpression(node) ||
  ts.isGetAccessorDeclaration(node) ||
  ts.isMethodDeclaration(node) ||
  ts.isSetAccessorDeclaration(node);

const getLocalBindingNames = (bindings: Map<ts.Node, Set<string>>, scope: ts.Node): Set<string> => {
  const existingNames = bindings.get(scope);

  if (existingNames !== undefined) {
    return existingNames;
  }

  const names = new Set<string>();
  bindings.set(scope, names);
  return names;
};

/**
 * Indexes local runtime bindings that can shadow module-owned identifiers.
 * @param sourceFile The parsed TypeScript source.
 * @returns Local binding names keyed by lexical or function scope.
 */
export const indexLexicalBindings = (
  sourceFile: ts.SourceFile,
): {
  names: ReadonlyMap<ts.Node, ReadonlySet<string>>;
  declarations: ReadonlyMap<ts.Node, ReadonlyMap<string, ts.Node | null>>;
} => {
  const bindings = new Map<ts.Node, Set<string>>();
  const declarations = new Map<ts.Node, Map<string, ts.Node | null>>();
  const register = (scope: ts.Node, name: ts.BindingName, declaration: ts.Node): void => {
    const names = new Set<string>();
    addBindingNames(names, name);
    const scoped = declarations.get(scope) ?? new Map<string, ts.Node | null>();
    for (const name of names) {
      const prior = scoped.get(name);
      scoped.set(name, prior === undefined || prior === declaration ? declaration : null);
    }
    declarations.set(scope, scoped);
  };
  const registerStatement = (scope: ts.Node, statement: ts.Statement): void => {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations)
        register(scope, declaration.name, declaration);
    } else if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isEnumDeclaration(statement) ||
        ts.isModuleDeclaration(statement)) &&
      statement.name !== undefined &&
      ts.isIdentifier(statement.name)
    )
      register(scope, statement.name, statement);
    else if (ts.isImportDeclaration(statement) && statement.importClause !== undefined) {
      const clause = statement.importClause;
      if (clause.name !== undefined) register(scope, clause.name, clause);
      if (clause.namedBindings !== undefined) {
        if (ts.isNamespaceImport(clause.namedBindings))
          register(scope, clause.namedBindings.name, clause.namedBindings);
        else
          for (const element of clause.namedBindings.elements)
            register(scope, element.name, element);
      }
    }
  };
  const visit = (node: ts.Node, functionScope: ts.FunctionLikeDeclaration | null): void => {
    let childFunctionScope = functionScope;

    if (isFunctionScope(node)) {
      const names = getLocalBindingNames(bindings, node);

      for (const parameter of node.parameters) {
        addBindingNames(names, parameter.name);
        register(node, parameter.name, parameter);
      }

      if (node.name !== undefined && ts.isIdentifier(node.name)) {
        names.add(node.name.text);
        register(node, node.name, node);
      }

      childFunctionScope = node;
    }

    if (ts.isBlock(node) || ts.isModuleBlock(node) || ts.isSourceFile(node)) {
      const names = getLocalBindingNames(bindings, node);

      for (const statement of node.statements) {
        addStatementBindings(names, statement);
        registerStatement(node, statement);
      }
    } else if (ts.isCaseBlock(node)) {
      const names = getLocalBindingNames(bindings, node);

      for (const clause of node.clauses) {
        for (const statement of clause.statements) {
          addStatementBindings(names, statement);
          registerStatement(node, statement);
        }
      }
    } else if (ts.isCatchClause(node) && node.variableDeclaration !== undefined) {
      addBindingNames(getLocalBindingNames(bindings, node), node.variableDeclaration.name);
      register(node, node.variableDeclaration.name, node.variableDeclaration);
    } else if (
      (ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node)) &&
      node.initializer !== undefined &&
      ts.isVariableDeclarationList(node.initializer)
    ) {
      addVariableDeclarationListBindings(getLocalBindingNames(bindings, node), node.initializer);
      for (const declaration of node.initializer.declarations)
        register(node, declaration.name, declaration);
    } else if (ts.isClassExpression(node) && node.name !== undefined) {
      getLocalBindingNames(bindings, node).add(node.name.text);
    }

    if (
      childFunctionScope !== null &&
      ts.isVariableDeclarationList(node) &&
      (node.flags & ts.NodeFlags.BlockScoped) === 0
    ) {
      addVariableDeclarationListBindings(getLocalBindingNames(bindings, childFunctionScope), node);
      for (const declaration of node.declarations)
        register(childFunctionScope, declaration.name, declaration);
    }

    ts.forEachChild(node, (child) => visit(child, childFunctionScope));
  };

  visit(sourceFile, null);
  return { names: bindings, declarations };
};

/** Finds the nearest scope containing the name, preserving ambiguous declarations. */
const findLexicalBindingScope = (
  identifier: ts.Identifier,
  analysis: Pick<IStaticAnalysisSource, 'lexicalBindings'>,
): ReadonlyMap<string, ts.Node | null> | undefined => {
  let scope: ts.Node | undefined = identifier.parent;
  while (scope !== undefined) {
    const declarations = analysis.lexicalBindings.get(scope);
    if (declarations?.has(identifier.text) === true) return declarations;
    scope = scope.parent;
  }
  return undefined;
};

/** Checks whether a declaration shadows a global name, including ambiguous merged bindings. */
export const hasLexicalBinding = (
  identifier: ts.Identifier,
  analysis: Pick<IStaticAnalysisSource, 'lexicalBindings'>,
): boolean => findLexicalBindingScope(identifier, analysis) !== undefined;

/**
 * Resolves the nearest lexical declaration, preserving parameter and local shadowing.
 * @param identifier The binding use.
 * @param analysis The source's indexed lexical declarations.
 * @returns Its exact declaration, or null for unknown or conflicting bindings.
 */
export const resolveLexicalBinding = (
  identifier: ts.Identifier,
  analysis: Pick<IStaticAnalysisSource, 'lexicalBindings'>,
): ts.Node | null => findLexicalBindingScope(identifier, analysis)?.get(identifier.text) ?? null;

/**
 * Indexes identifier occurrences once for binding-specific safety analysis.
 * @param sourceFile The parsed TypeScript source.
 * @returns Identifier occurrences grouped by exact source spelling.
 */
export const indexIdentifierUses = (
  sourceFile: ts.SourceFile,
): { identifierUses: ReadonlyMap<string, readonly ts.Identifier[]>; nodeCount: number } => {
  const identifierUses = new Map<string, ts.Identifier[]>();
  let nodeCount = 0;
  const visit = (node: ts.Node): void => {
    nodeCount += 1;
    if (ts.isIdentifier(node)) {
      const uses = identifierUses.get(node.text) ?? [];
      uses.push(node);
      identifierUses.set(node.text, uses);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return {
    identifierUses: new Map(
      [...identifierUses].map(([name, uses]) => [name, Object.freeze(uses)] as const),
    ),
    nodeCount,
  };
};

/**
 * Determines whether a module-bound name is visible at one identifier use.
 * @param identifier The identifier whose lexical environment is inspected.
 * @param analysis The indexed source containing the identifier.
 * @returns Whether no parameter or local declaration shadows the module binding.
 */
export const isModuleBindingVisible = (
  identifier: ts.Identifier,
  analysis: IStaticAnalysisSource,
): boolean => {
  let current: ts.Node | undefined = identifier.parent;

  while (current !== undefined && !ts.isSourceFile(current)) {
    if (analysis.localBindingNames.get(current)?.has(identifier.text) === true) {
      return false;
    }

    current = current.parent;
  }

  return true;
};

/**
 * Resolves TypeScript source candidates for a supported relative ESM specifier.
 * @param containingPath The importing source path.
 * @param moduleSpecifier The exact relative ESM specifier.
 * @returns Supported logical source candidates in deterministic order.
 */
export const resolveImportCandidatePaths = (
  containingPath: string,
  moduleSpecifier: string,
): readonly string[] => {
  const resolved = posix.resolve(posix.dirname(containingPath), moduleSpecifier);

  if (resolved.endsWith('.js')) {
    return [`${resolved.slice(0, -3)}.ts`, `${resolved.slice(0, -3)}.tsx`];
  }

  if (resolved.endsWith('.mjs')) {
    return [`${resolved.slice(0, -4)}.mts`];
  }

  return ['.ts', '.tsx', '.mts'].some((extension) => resolved.endsWith(extension))
    ? [resolved]
    : [];
};

/**
 * Resolves the explicit module references an identifier can denote.
 * @param identifier The local source identifier.
 * @param analysis The source containing that identifier.
 * @returns Same-file or relative-import candidates in deterministic order.
 */
type IBindingReferences = readonly (IStaticAnalysisReference & { readonly symbol: string })[];
const referenceOwners = new WeakMap<
  IStaticAnalysisSource,
  {
    identities: Map<ts.Node, IBindingReferences>;
    calls: Map<ts.Node, IBindingReferences>;
  }
>();

const resolveReferences = (
  identifier: ts.Identifier,
  analysis: IStaticAnalysisSource,
  followReturnCalls: boolean,
): readonly (IStaticAnalysisReference & { readonly symbol: string })[] => {
  const initial = resolveLexicalBinding(identifier, analysis);
  if (initial === null) return [];
  let owner = referenceOwners.get(analysis);
  if (owner === undefined) {
    owner = { identities: new Map(), calls: new Map() };
    referenceOwners.set(analysis, owner);
  }
  const cache = followReturnCalls ? owner.calls : owner.identities;
  const cached = cache.get(initial);
  if (cached !== undefined) return cached;
  const references: (IStaticAnalysisReference & { readonly symbol: string })[] = [];
  const visited = new Set<ts.Node>();
  let current: ts.Identifier | null = identifier;
  while (current !== null) {
    const binding = resolveLexicalBinding(current, analysis);
    if (binding === null || visited.has(binding)) break;
    if (analysis.bindingMutations.get(binding)?.has(null) === true) {
      const unresolved = Object.freeze([]);
      cache.set(initial, unresolved);
      return unresolved;
    }
    visited.add(binding);
    if (
      analysis.exports.get(current.text)?.declaration === binding ||
      (ts.isImportSpecifier(binding) &&
        isModuleBindingVisible(current, analysis) &&
        analysis.exports.has(current.text))
    ) {
      references.push(Object.freeze({ path: analysis.path, symbol: current.text }));
    }
    if (ts.isImportSpecifier(binding) && isModuleBindingVisible(current, analysis)) {
      const imported = analysis.namedImports.get(current.text);
      if (imported?.moduleSpecifier.startsWith('.') === true) {
        for (const path of resolveImportCandidatePaths(analysis.path, imported.moduleSpecifier)) {
          references.push(Object.freeze({ path, symbol: imported.importedName }));
        }
      }
      break;
    }
    let expression: ts.Expression | null = null;
    if (
      ts.isVariableDeclaration(binding) &&
      binding.initializer !== undefined &&
      ts.isVariableDeclarationList(binding.parent) &&
      (binding.parent.flags & ts.NodeFlags.Const) !== 0
    ) {
      const initializer = unwrapExpression(binding.initializer);
      if (ts.isIdentifier(initializer)) expression = initializer;
      else if (
        followReturnCalls &&
        (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) &&
        initializer.parameters.length === 0
      ) {
        const body = initializer.body;
        expression = ts.isBlock(body)
          ? body.statements.length === 1 && ts.isReturnStatement(body.statements[0]!)
            ? (body.statements[0].expression ?? null)
            : null
          : body;
      }
    } else if (
      followReturnCalls &&
      ts.isFunctionDeclaration(binding) &&
      binding.parameters.length === 0 &&
      binding.body?.statements.length === 1
    ) {
      const statement = binding.body.statements[0];
      if (statement !== undefined && ts.isReturnStatement(statement))
        expression = statement.expression ?? null;
    }
    if (expression === null) break;
    const candidate = unwrapExpression(expression);
    const call = getDirectCall(candidate);
    const isAlias: boolean =
      ts.isVariableDeclaration(binding) &&
      binding.initializer !== undefined &&
      ts.isIdentifier(unwrapExpression(binding.initializer));
    const target: ts.Expression | null = isAlias
      ? candidate
      : call?.arguments.length === 0
        ? unwrapExpression(call.expression)
        : null;
    current = target !== null && ts.isIdentifier(target) ? target : null;
  }
  const result = Object.freeze(references);
  cache.set(initial, result);
  return result;
};

/** Resolves direct binding identity through immutable aliases, without invoking wrappers. */
export const resolveBindingReferences = (
  identifier: ts.Identifier,
  analysis: IStaticAnalysisSource,
): readonly (IStaticAnalysisReference & { readonly symbol: string })[] =>
  resolveReferences(identifier, analysis, false);

/** Resolves instruction consumers through immutable aliases and simple return-call wrappers. */
export const resolveInstructionCallReferences = (
  identifier: ts.Identifier,
  analysis: IStaticAnalysisSource,
): readonly (IStaticAnalysisReference & { readonly symbol: string })[] =>
  resolveReferences(identifier, analysis, true);

/**
 * Checks whether an identifier resolves directly to an explicit bound reference.
 * @param identifier The local source identifier.
 * @param analysis The source containing that identifier.
 * @param reference The explicit source binding to match.
 * @returns Whether local or named-import identity proves the relationship.
 */
export const isBoundIdentifier = (
  identifier: ts.Identifier,
  analysis: IStaticAnalysisSource,
  reference: IStaticAnalysisReference,
): boolean => {
  if (reference.symbol === undefined) {
    return false;
  }

  return resolveBindingReferences(identifier, analysis).some(
    (candidate) => candidate.path === reference.path && candidate.symbol === reference.symbol,
  );
};

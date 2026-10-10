import { posix } from 'node:path';
import ts from 'typescript';

import type { IStaticAnalysisSource, IStaticAnalysisSourceResult } from '../types.js';
import { normalizeText } from '../text/index.js';
import {
  isModuleBindingVisible,
  resolveImportCandidatePaths,
  resolveLexicalBinding,
  getClosedObjectProperties,
  getStaticString,
  unwrapExpression,
  getRuntimeExport,
  hasBindingMutation,
} from '../typescript-analysis/index.js';

// provenance is separate from the provider's consumer relationship
export type IInstructionSourceResult =
  { kind: 'verified'; path: string } | { kind: 'mismatch' } | { kind: 'unverified' };

const UNVERIFIED = Object.freeze({ kind: 'unverified' } as const);
const MISMATCH = Object.freeze({ kind: 'mismatch' } as const);

const getSingleReturn = (
  body: ts.ConciseBody,
): {
  expression: ts.Expression;
  locals: Map<string, ts.Expression>;
} | null => {
  const locals = new Map<string, ts.Expression>();
  if (!ts.isBlock(body)) return { expression: body, locals };
  for (const statement of body.statements.slice(0, -1)) {
    if (
      !ts.isVariableStatement(statement) ||
      (statement.declarationList.flags & ts.NodeFlags.Const) === 0
    )
      return null;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.initializer === undefined) return null;
      locals.set(declaration.name.text, declaration.initializer);
    }
  }
  const returned = body.statements.at(-1);
  return returned !== undefined &&
    ts.isReturnStatement(returned) &&
    returned.expression !== undefined
    ? { expression: returned.expression, locals }
    : null;
};

const resolveAlias = (
  expression: ts.Expression,
  locals: ReadonlyMap<string, ts.Expression>,
  analysis: IStaticAnalysisSource,
): ts.Expression | null => {
  let current = unwrapExpression(expression);
  const visited = new Set<ts.Node>();
  while (ts.isIdentifier(current)) {
    if (hasBindingMutation(current, analysis, '')) return null;
    if (visited.has(current)) return null;
    visited.add(current);
    const local = locals.get(current.text);
    if (local !== undefined) {
      current = unwrapExpression(local);
      continue;
    }
    if (!isModuleBindingVisible(current, analysis)) return null;
    const module = analysis.moduleConstDeclarations.get(current.text)?.initializer;
    if (module === undefined) return current;
    current = unwrapExpression(module);
  }
  return current;
};

const getUtf8Encoding = (
  expression: ts.Expression,
  locals: ReadonlyMap<string, ts.Expression>,
  analysis: IStaticAnalysisSource,
): boolean => {
  const direct = getStaticString(expression);
  if (direct !== null) return direct === 'utf8' || direct === 'utf-8';
  const candidate = unwrapExpression(expression);
  if (!ts.isObjectLiteralExpression(candidate)) return false;
  const encoding = getClosedObjectProperties(candidate)?.get('encoding');
  const resolved = encoding === undefined ? null : resolveAlias(encoding, locals, analysis);
  const literal = getStaticString(resolved);
  return literal === 'utf8' || literal === 'utf-8';
};

const isImportMetaUrl = (expression: ts.Expression): boolean => {
  const candidate = unwrapExpression(expression);
  return (
    ts.isPropertyAccessExpression(candidate) &&
    candidate.name.text === 'url' &&
    ts.isMetaProperty(candidate.expression) &&
    candidate.expression.keywordToken === ts.SyntaxKind.ImportKeyword &&
    candidate.expression.name.text === 'meta'
  );
};

/**
 * Establishes a supported canonical UTF-8 read without executing repository code.
 * Follows immutable aliases and simple return wrappers with cycle detection.
 * @param options The loader source, validated canonical/mirror paths, and bounded source callbacks.
 * @returns Canonical provenance, a proven contradiction, or an unsupported implementation.
 * @throws Propagates repository access failures and cancellation.
 */
export const classifyInstructionSource = async (options: {
  analysis: IStaticAnalysisSource;
  symbol: string;
  canonicalPaths: readonly string[];
  canonicalContent: string;
  analyzeSource: (path: string) => Promise<IStaticAnalysisSourceResult>;
  getEntry: (path: string) => Promise<{ type: string } | null>;
  signal?: AbortSignal;
}): Promise<IInstructionSourceResult> => {
  let analysis = options.analysis;
  const loader = getRuntimeExport(analysis, options.symbol);
  if (loader.kind !== 'present-supported' || loader.body === undefined) return UNVERIFIED;
  let returned = getSingleReturn(loader.body);
  if (returned === null) return UNVERIFIED;
  let expression = returned.expression;
  let locals = returned.locals;
  const visited = new Set<ts.Node>();
  const visitedReferences = new Set<string>([JSON.stringify([analysis.path, options.symbol])]);
  while (true) {
    options.signal?.throwIfAborted();
    let candidate = resolveAlias(expression, locals, analysis);
    if (candidate === null) return UNVERIFIED;
    if (ts.isAwaitExpression(candidate)) candidate = unwrapExpression(candidate.expression);
    if (visited.has(candidate)) return UNVERIFIED;
    visited.add(candidate);
    const literal = getStaticString(candidate);
    if (literal !== null) {
      const normalized = normalizeText(new TextEncoder().encode(literal));
      return normalized.valid && normalized.value === options.canonicalContent
        ? UNVERIFIED
        : MISMATCH;
    }
    if (!ts.isCallExpression(candidate) || candidate.arguments.length > 2) return UNVERIFIED;
    const callee = resolveAlias(candidate.expression, locals, analysis);
    if (callee === null) return UNVERIFIED;
    const imported = ts.isIdentifier(callee) ? analysis.namedImports.get(callee.text) : undefined;
    const isNodeRead =
      imported !== undefined &&
      ((['node:fs', 'fs'].includes(imported.moduleSpecifier) &&
        imported.importedName === 'readFileSync') ||
        (['node:fs/promises', 'fs/promises'].includes(imported.moduleSpecifier) &&
          imported.importedName === 'readFile'));
    if (isNodeRead) {
      const [sourceArgument, encodingArgument] = candidate.arguments;
      if (sourceArgument === undefined || encodingArgument === undefined) return UNVERIFIED;
      const encoding = resolveAlias(encodingArgument, locals, analysis);
      if (encoding === null || !getUtf8Encoding(encoding, locals, analysis)) return UNVERIFIED;
      const source = resolveAlias(sourceArgument, locals, analysis);
      if (
        source === null ||
        !ts.isNewExpression(source) ||
        !ts.isIdentifier(source.expression) ||
        source.expression.text !== 'URL' ||
        !isModuleBindingVisible(source.expression, analysis) ||
        resolveLexicalBinding(source.expression, analysis) !== null ||
        analysis.moduleConstDeclarations.has('URL') ||
        analysis.namedImports.has('URL') ||
        source.arguments?.length !== 2
      )
        return UNVERIFIED;
      const [relativePath, base] = source.arguments;
      const path = getStaticString(
        relativePath === undefined ? undefined : resolveAlias(relativePath, locals, analysis),
      );
      if (
        path === null ||
        base === undefined ||
        !isImportMetaUrl(base) ||
        /[\\%?#:]/.test(path) ||
        path.startsWith('/')
      )
        return UNVERIFIED;
      const components = posix.dirname(analysis.path).split('/').filter(Boolean);
      for (const component of path.split('/')) {
        if (component === '..') {
          if (components.length === 0) return MISMATCH;
          components.pop();
        } else if (component !== '.' && component !== '') components.push(component);
      }
      const canonical = options.canonicalPaths.find(
        (reference) => reference.replace(/^\//, '') === components.join('/'),
      );
      return canonical === undefined
        ? MISMATCH
        : Object.freeze({ kind: 'verified', path: canonical });
    }
    if (candidate.arguments.length !== 0) return UNVERIFIED;
    if (ts.isArrowFunction(callee) || ts.isFunctionExpression(callee)) {
      if (callee.parameters.length !== 0) return UNVERIFIED;
      returned = getSingleReturn(callee.body);
    } else if (ts.isIdentifier(callee)) {
      const local = analysis.sourceFile.statements.find(
        (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === callee.text,
      );
      if (local !== undefined && ts.isFunctionDeclaration(local) && local.body !== undefined) {
        if (local.parameters.length !== 0) return UNVERIFIED;
        returned = getSingleReturn(local.body);
      } else if (imported?.moduleSpecifier.startsWith('.') === true) {
        const matches: string[] = [];
        for (const path of resolveImportCandidatePaths(analysis.path, imported.moduleSpecifier)) {
          if ((await options.getEntry(path))?.type === 'file') matches.push(path);
        }
        if (matches.length !== 1 || matches[0] === undefined) return UNVERIFIED;
        const key = JSON.stringify([matches[0], imported.importedName]);
        if (visitedReferences.has(key)) return UNVERIFIED;
        visitedReferences.add(key);
        const result = await options.analyzeSource(matches[0]);
        if (result.kind !== 'valid') return UNVERIFIED;
        analysis = result.analysis;
        const wrapper = getRuntimeExport(analysis, imported.importedName);
        if (wrapper.kind !== 'present-supported' || wrapper.body === undefined) return UNVERIFIED;
        returned = getSingleReturn(wrapper.body);
      } else return UNVERIFIED;
    } else return UNVERIFIED;
    if (returned === null) return UNVERIFIED;
    expression = returned.expression;
    locals = returned.locals;
  }
};

import ts from 'typescript';

import {
  analyzeModuleValueMutations,
  classifyAiSdkFunctionToolShape,
  isModuleBindingVisible,
  unwrapExpression,
} from '@moldea.ai/adapter-static-analysis';

import type {
  IVercelAiSdkFunctionTool,
  IVercelAiSdkFunctionToolResult,
  IVercelAiSdkRelationship,
  IVercelAiSdkSourceAnalysis,
} from '../contracts/index.js';
import { analyzeVercelAiSdkObjectRelationships } from './bindings.js';

const RELATIONSHIP_NAMES = ['execute', 'inputSchema', 'outputSchema'] as const;

const getFunctionToolObject = (
  initializer: ts.Expression,
  analysis: IVercelAiSdkSourceAnalysis,
): ts.ObjectLiteralExpression | null => {
  const candidate = unwrapExpression(initializer);

  if (!ts.isCallExpression(candidate) || candidate.arguments.length !== 1) {
    return null;
  }

  const callee = unwrapExpression(candidate.expression);

  if (
    !ts.isIdentifier(callee) ||
    !analysis.imports.toolNames.has(callee.text) ||
    !isModuleBindingVisible(callee, analysis)
  ) {
    return null;
  }

  const object = unwrapExpression(candidate.arguments[0] as ts.Expression);
  return ts.isObjectLiteralExpression(object) ? object : null;
};

/** Classifies one directly exported repository-local function tool. */
export const getVercelAiSdkFunctionTool = (
  analysis: IVercelAiSdkSourceAnalysis,
  symbol: string,
  allowedToolMapReferences: ReadonlySet<ts.Identifier> = new Set(),
): IVercelAiSdkFunctionToolResult => {
  const exported = analysis.exports.get(symbol);

  if (exported === undefined) {
    return Object.freeze({ kind: 'absent' });
  }

  if (
    exported.kind !== 'present-supported' ||
    !ts.isVariableDeclaration(exported.declaration) ||
    exported.declaration.initializer === undefined
  ) {
    return Object.freeze({ declaration: exported.declaration, kind: 'present-unsupported' });
  }

  const object = getFunctionToolObject(exported.declaration.initializer, analysis);

  const shape = object === null ? null : classifyAiSdkFunctionToolShape(object);

  if (object === null || shape === null) {
    return Object.freeze({ declaration: exported.declaration, kind: 'present-unsupported' });
  }

  const relationships = analyzeVercelAiSdkObjectRelationships(object, RELATIONSHIP_NAMES);
  const mutations = analyzeModuleValueMutations(
    analysis,
    exported.declaration,
    allowedToolMapReferences,
  );

  if (mutations.hasUnknownMutation || mutations.mutatedMembers.has('type')) {
    return Object.freeze({ declaration: exported.declaration, kind: 'present-unsupported' });
  }

  const relationship = (name: (typeof RELATIONSHIP_NAMES)[number]): IVercelAiSdkRelationship =>
    mutations.mutatedMembers.has(name) ? { kind: 'unresolved' } : relationships[name];
  const deferLoading: IVercelAiSdkRelationship = mutations.mutatedMembers.has('deferLoading')
    ? { kind: 'unresolved' }
    : shape.deferLoading === null
      ? { kind: 'absent' }
      : { expression: shape.deferLoading, kind: 'present' };
  const tool: IVercelAiSdkFunctionTool = Object.freeze({
    declaration: exported.declaration,
    deferLoading,
    execute: relationship('execute'),
    inputSchema: relationship('inputSchema'),
    object,
    outputSchema: relationship('outputSchema'),
  });

  return Object.freeze({ kind: 'present-supported', tool });
};

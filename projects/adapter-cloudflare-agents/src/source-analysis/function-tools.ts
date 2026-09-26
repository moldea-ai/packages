import ts from 'typescript';

import {
  classifyAiSdkFunctionToolShape,
  isModuleBindingVisible,
  unwrapExpression,
} from '@moldea.ai/adapter-static-analysis';

import type {
  ICloudflareAgentsFunctionTool,
  ICloudflareAgentsRelationship,
  ICloudflareAgentsSourceAnalysis,
} from '../contracts/index.js';
import { analyzeCloudflareAgentsObjectRelationships } from './bindings.js';

/** Classifies one direct AI SDK function-tool declaration. */
export const getCloudflareAgentsFunctionTool = (
  analysis: ICloudflareAgentsSourceAnalysis,
  declaration: ts.VariableDeclaration,
): ICloudflareAgentsFunctionTool | null => {
  if (declaration.initializer === undefined) {
    return null;
  }

  const call = unwrapExpression(declaration.initializer);

  if (!ts.isCallExpression(call) || call.arguments.length !== 1) {
    return null;
  }

  const callee = unwrapExpression(call.expression);
  const object = unwrapExpression(call.arguments[0] as ts.Expression);

  if (
    !ts.isIdentifier(callee) ||
    !analysis.imports.toolNames.has(callee.text) ||
    !isModuleBindingVisible(callee, analysis) ||
    !ts.isObjectLiteralExpression(object)
  ) {
    return null;
  }

  const shape = classifyAiSdkFunctionToolShape(object);

  if (shape === null) {
    return null;
  }

  const relationships = analyzeCloudflareAgentsObjectRelationships(object, [
    'execute',
    'inputSchema',
    'outputSchema',
  ] as const);
  const deferLoading: ICloudflareAgentsRelationship =
    shape.deferLoading === null
      ? { kind: 'absent' }
      : { expression: shape.deferLoading, kind: 'present' };

  return Object.freeze({ declaration, deferLoading, ...relationships });
};

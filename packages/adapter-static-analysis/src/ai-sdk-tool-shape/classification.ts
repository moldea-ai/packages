import ts from 'typescript';

import type { IAiSdkDeferredLoading, IAiSdkFunctionToolShape } from './types.js';
import { unwrapExpression } from '../typescript-analysis/index.js';

const TOLERATED_PROPERTY_NAMES = new Set([
  'contextSchema',
  'deferLoading',
  'description',
  'execute',
  'inputExamples',
  'inputSchema',
  'metadata',
  'needsApproval',
  'onInputAvailable',
  'onInputDelta',
  'onInputStart',
  'outputSchema',
  'providerOptions',
  'strict',
  'title',
  'toModelOutput',
  'type',
]);

/**
 * Classifies a closed AI SDK function-tool object without interpreting its registration.
 * @param object The direct object passed to the SDK `tool` helper.
 * @returns Its deferred-loading expression, or `null` for an unsupported shape.
 */
export const classifyAiSdkFunctionToolShape = (
  object: ts.ObjectLiteralExpression,
): IAiSdkFunctionToolShape | null => {
  const names = new Set<string>();
  let hasInputSchema = false;
  let deferLoading: ts.Expression | null = null;

  for (const property of object.properties) {
    if (ts.isSpreadAssignment(property) || ts.isComputedPropertyName(property.name)) {
      return null;
    }

    const name =
      ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)
        ? property.name.text
        : null;

    if (name === null || !TOLERATED_PROPERTY_NAMES.has(name) || names.has(name)) {
      return null;
    }

    names.add(name);

    if (name === 'inputSchema') {
      if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) {
        return null;
      }
      hasInputSchema = true;
    }

    if (name === 'deferLoading') {
      if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) {
        return null;
      }
      deferLoading = unwrapExpression(
        ts.isPropertyAssignment(property) ? property.initializer : property.name,
      );
    }

    if (name === 'type') {
      if (!ts.isPropertyAssignment(property)) {
        return null;
      }

      const type = unwrapExpression(property.initializer);

      if (
        (!ts.isStringLiteral(type) && !ts.isNoSubstitutionTemplateLiteral(type)) ||
        type.text !== 'function'
      ) {
        return null;
      }
    }
  }

  return hasInputSchema ? Object.freeze({ deferLoading }) : null;
};

/**
 * Classifies only the declared deferred-loading option, not per-turn tool availability.
 * @param expression The option expression, or `null` when omitted.
 * @returns Whether the option is absent, enabled, disabled, or statically unknown.
 */
export const classifyAiSdkDeferredLoading = (
  expression: ts.Expression | null,
): IAiSdkDeferredLoading => {
  if (expression === null) {
    return 'absent';
  }

  if (unwrapExpression(expression).kind === ts.SyntaxKind.FalseKeyword) {
    return 'disabled';
  }

  return unwrapExpression(expression).kind === ts.SyntaxKind.TrueKeyword ? 'enabled' : 'unknown';
};

import ts from 'typescript';

import {
  analyzeModuleValueMutations,
  getClosedObjectProperties,
  getConstExport,
  getStaticString,
} from '@moldea.ai/adapter-static-analysis';

import {
  GOOGLE_GENAI_FUNCTION_NAME_LIMIT,
  GOOGLE_GENAI_FUNCTION_NAME_PATTERN,
} from '../constants/index.js';
import type { IGoogleGenAiSourceAnalysis } from '../contracts/index.js';

export interface IGoogleGenAiFunctionDeclarationShape {
  readonly detectedName: string;
  readonly name: ts.Expression;
  readonly object: ts.ObjectLiteralExpression;
  readonly parametersJsonSchema: ts.Expression | null | undefined;
  readonly properties: ReadonlyMap<string, ts.Expression>;
}

export type IGoogleGenAiFunctionDeclarationShapeResult =
  | { readonly kind: 'absent' }
  | { readonly kind: 'present-unsupported' }
  | ({ readonly kind: 'present-supported' } & IGoogleGenAiFunctionDeclarationShape);

const ALLOWED_FUNCTION_DECLARATION_PROPERTIES = new Set([
  'behavior',
  'description',
  'name',
  'parametersJsonSchema',
  'response',
  'responseJsonSchema',
]);

/**
 * Validates one closed Google Gen AI function-declaration object.
 * @param object The function-declaration object literal.
 * @returns Its supported static shape or an unsupported observation.
 */
export const getGoogleGenAiFunctionDeclarationObjectShape = (
  object: ts.ObjectLiteralExpression,
): IGoogleGenAiFunctionDeclarationShapeResult => {
  if (object.properties.some((property) => !ts.isPropertyAssignment(property))) {
    return { kind: 'present-unsupported' };
  }

  const properties = getClosedObjectProperties(object);

  if (
    properties === null ||
    [...properties.keys()].some(
      (propertyName) => !ALLOWED_FUNCTION_DECLARATION_PROPERTIES.has(propertyName),
    )
  ) {
    return { kind: 'present-unsupported' };
  }

  const name = properties.get('name');
  const description = properties.get('description');
  const parametersJsonSchema = properties.get('parametersJsonSchema');
  const detectedName = getStaticString(name);

  if (
    name === undefined ||
    detectedName === null ||
    (description !== undefined && getStaticString(description) === null)
  ) {
    return { kind: 'present-unsupported' };
  }

  return Object.freeze({
    detectedName,
    kind: 'present-supported',
    name,
    object,
    parametersJsonSchema: parametersJsonSchema ?? null,
    properties,
  });
};

/**
 * Resolves a directly exported constant function declaration.
 * @param analysis The source containing the declared registration.
 * @param symbol The exact exported registration symbol.
 * @returns The absent, unsupported, or supported registration shape.
 */
export const getGoogleGenAiFunctionDeclarationShape = (
  analysis: IGoogleGenAiSourceAnalysis,
  symbol: string,
): IGoogleGenAiFunctionDeclarationShapeResult => {
  const exported = getConstExport(analysis, symbol, ['name']);

  if (exported.kind === 'absent') {
    return { kind: 'absent' };
  }

  if (
    exported.kind !== 'present-supported' ||
    exported.expression === undefined ||
    !ts.isObjectLiteralExpression(exported.expression)
  ) {
    return { kind: 'present-unsupported' };
  }

  const shape = getGoogleGenAiFunctionDeclarationObjectShape(exported.expression);
  if (shape.kind !== 'present-supported' || !ts.isVariableDeclaration(exported.declaration))
    return shape;
  const mutations = analyzeModuleValueMutations(analysis, exported.declaration, new Set());
  if (mutations.hasUnknownMutation || mutations.mutatedMembers.has('name')) {
    return { kind: 'present-unsupported' };
  }
  return {
    ...shape,
    parametersJsonSchema: mutations.mutatedMembers.has('parametersJsonSchema')
      ? undefined
      : shape.parametersJsonSchema,
  };
};

/**
 * Checks the version-matched Google Gen AI SDK function-name declaration limits.
 * @param name The exact statically detected function name.
 * @returns Whether the name satisfies both scalar-length and ASCII-pattern limits.
 */
export const isGoogleGenAiFunctionNameValid = (name: string): boolean => {
  const scalarLength = [...name].length;

  return (
    scalarLength >= 1 &&
    scalarLength <= GOOGLE_GENAI_FUNCTION_NAME_LIMIT &&
    GOOGLE_GENAI_FUNCTION_NAME_PATTERN.test(name)
  );
};

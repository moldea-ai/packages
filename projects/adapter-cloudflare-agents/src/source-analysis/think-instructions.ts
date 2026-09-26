import ts from 'typescript';

import {
  getClosedObjectProperties,
  getDirectCall,
  getStaticString,
  unwrapExpression,
} from '@moldea.ai/adapter-static-analysis';

import type {
  ICloudflareAgentsClassDefinition,
  ICloudflareAgentsContextInstruction,
  ICloudflareAgentsRelationship,
  ICloudflareAgentsThinkContextSources,
} from '../contracts/index.js';
import { getCloudflareAgentsMethod } from './methods.js';

const CONFIGURED_CONTEXT_PROPERTIES = new Set(['label', 'provider', 'description', 'maxTokens']);
const SESSION_CONTEXT_PROPERTIES = new Set(['provider', 'description', 'maxTokens']);

/** Extracts the exact direct loader call returned by `getSystemPrompt`. */
export const getCloudflareAgentsThinkSystemPrompt = (
  definition: ICloudflareAgentsClassDefinition,
): ICloudflareAgentsRelationship => {
  const method = getCloudflareAgentsMethod(definition.methods, 'getSystemPrompt', 0);

  if (method === null) {
    return Object.freeze({
      kind: definition.methods.has('getSystemPrompt') ? 'unresolved' : 'absent',
    });
  }

  if (method.body.statements.length !== 1) {
    return Object.freeze({ kind: 'unresolved' });
  }

  const statement = method.body.statements[0];

  if (
    statement === undefined ||
    !ts.isReturnStatement(statement) ||
    statement.expression === undefined
  ) {
    return Object.freeze({ kind: 'unresolved' });
  }

  return Object.freeze(
    getDirectCall(statement.expression) === null
      ? { kind: 'unresolved' }
      : { expression: statement.expression, kind: 'present' },
  );
};

const getProviderGetter = (
  expression: ts.Expression,
  expectedPropertyCount = 1,
): ts.Expression | null => {
  const provider = unwrapExpression(expression);

  if (!ts.isObjectLiteralExpression(provider)) {
    return null;
  }

  if (provider.properties.some((property) => !ts.isPropertyAssignment(property))) {
    return null;
  }

  const properties = getClosedObjectProperties(provider);
  const getter = properties?.get('get');

  if (getter === undefined || properties?.size !== expectedPropertyCount) {
    return null;
  }

  const candidate = unwrapExpression(getter);

  if (ts.isIdentifier(candidate)) {
    return ts.factory.createCallExpression(candidate, undefined, []);
  }

  if (
    (!ts.isArrowFunction(candidate) && !ts.isFunctionExpression(candidate)) ||
    candidate.parameters.length !== 0 ||
    (ts.isFunctionExpression(candidate) && candidate.asteriskToken !== undefined)
  ) {
    return null;
  }

  if (!ts.isBlock(candidate.body)) {
    return candidate.body;
  }

  const statement = candidate.body.statements[0];
  return candidate.body.statements.length === 1 &&
    statement !== undefined &&
    ts.isReturnStatement(statement) &&
    statement.expression !== undefined
    ? statement.expression
    : null;
};

const hasInertPromptSetter = (expression: ts.Expression): boolean => {
  const candidate = unwrapExpression(expression);
  const parameter =
    (ts.isArrowFunction(candidate) || ts.isFunctionExpression(candidate)) &&
    candidate.parameters.length === 1
      ? candidate.parameters[0]
      : undefined;

  if (
    (!ts.isArrowFunction(candidate) && !ts.isFunctionExpression(candidate)) ||
    (ts.isFunctionExpression(candidate) && candidate.asteriskToken !== undefined) ||
    !candidate.modifiers?.some(({ kind }) => kind === ts.SyntaxKind.AsyncKeyword) ||
    parameter === undefined ||
    !ts.isIdentifier(parameter.name) ||
    parameter.dotDotDotToken !== undefined ||
    parameter.initializer !== undefined ||
    !ts.isBlock(candidate.body)
  ) {
    return false;
  }

  const statements = candidate.body.statements;
  const statement = statements[0];
  return (
    statements.length === 0 ||
    (statements.length === 1 &&
      statement !== undefined &&
      ts.isReturnStatement(statement) &&
      statement.expression === undefined)
  );
};

/** Classifies the custom frozen-prompt store getter used by older Think sessions. */
export const getCloudflareAgentsThinkCachedPromptLoader = (
  provider: ts.Expression,
): ICloudflareAgentsRelationship => {
  const candidate = unwrapExpression(provider);

  if (!ts.isObjectLiteralExpression(candidate)) {
    return Object.freeze({ kind: 'unresolved' });
  }

  const properties = getClosedObjectProperties(candidate);
  const setter = properties?.get('set');

  if (
    properties?.size !== 2 ||
    !properties.has('get') ||
    setter === undefined ||
    !hasInertPromptSetter(setter)
  ) {
    return Object.freeze({ kind: 'unresolved' });
  }

  const getter = getProviderGetter(provider, 2);
  return getter === null
    ? Object.freeze({ kind: 'unresolved' })
    : Object.freeze({ expression: getter, kind: 'present' });
};

const getClosedContextOptions = (
  options: ts.Expression | undefined,
  kind: 'configured' | 'session',
): ReadonlyMap<string, ts.Expression> | null => {
  if (options === undefined) {
    return kind === 'session' ? new Map() : null;
  }

  const candidate = unwrapExpression(options);

  if (!ts.isObjectLiteralExpression(candidate)) {
    return null;
  }

  if (candidate.properties.some((property) => !ts.isPropertyAssignment(property))) {
    return null;
  }

  const properties = getClosedObjectProperties(candidate);

  if (properties === null) {
    return null;
  }

  const allowedProperties =
    kind === 'configured' ? CONFIGURED_CONTEXT_PROPERTIES : SESSION_CONTEXT_PROPERTIES;

  if ([...properties.keys()].some((name) => !allowedProperties.has(name))) {
    return null;
  }

  const description = properties.get('description');

  if (description !== undefined && getStaticString(description) === null) {
    return null;
  }

  const maxTokens = properties.get('maxTokens');

  if (maxTokens !== undefined) {
    const limit = unwrapExpression(maxTokens);

    if (
      !ts.isNumericLiteral(limit) ||
      !Number.isSafeInteger(Number(limit.text)) ||
      Number(limit.text) < 0
    ) {
      return null;
    }
  }

  return properties;
};

/** Checks complete context options before a builder call is treated as closed. */
export const isCloudflareAgentsThinkContextOptionsClosed = (
  options: ts.Expression | undefined,
  kind: 'configured' | 'session',
): boolean => getClosedContextOptions(options, kind) !== null;

/** Classifies the optional provider getter in one supported Think context block. */
export const getCloudflareAgentsThinkContextLoader = (
  options: ts.Expression | undefined,
  kind: 'configured' | 'session' = 'session',
): ICloudflareAgentsRelationship => {
  const properties = getClosedContextOptions(options, kind);

  if (properties === null) {
    return Object.freeze({ kind: 'unresolved' });
  }

  const provider = properties.get('provider');

  if (provider === undefined) {
    return Object.freeze({ kind: 'absent' });
  }

  const getter = getProviderGetter(provider);
  return getter === null
    ? Object.freeze({ kind: 'unresolved' })
    : Object.freeze({ expression: getter, kind: 'present' });
};

/** Extracts closed `configureContext` blocks in their declared merge order. */
export const getCloudflareAgentsThinkContextSources = (
  definition: ICloudflareAgentsClassDefinition,
): ICloudflareAgentsThinkContextSources => {
  const method = getCloudflareAgentsMethod(definition.methods, 'configureContext', 0);

  if (method === null) {
    return definition.methods.has('configureContext')
      ? Object.freeze({ kind: 'unresolved' })
      : Object.freeze({ contexts: Object.freeze([]), kind: 'closed' });
  }

  const statement = method.body.statements[0];
  const returned =
    method.body.statements.length === 1 &&
    statement !== undefined &&
    ts.isReturnStatement(statement) &&
    statement.expression !== undefined
      ? unwrapExpression(statement.expression)
      : null;

  if (returned === null || !ts.isArrayLiteralExpression(returned)) {
    return Object.freeze({ kind: 'unresolved' });
  }

  const contexts: ICloudflareAgentsContextInstruction[] = [];

  for (const element of returned.elements) {
    const candidate = ts.isExpression(element) ? unwrapExpression(element) : null;

    if (candidate === null || !ts.isObjectLiteralExpression(candidate)) {
      return Object.freeze({ kind: 'unresolved' });
    }

    const properties = getClosedObjectProperties(candidate);
    const label = getStaticString(properties?.get('label'));

    if (properties === null || label === null || label.length === 0) {
      return Object.freeze({ kind: 'unresolved' });
    }

    if (!isCloudflareAgentsThinkContextOptionsClosed(candidate, 'configured')) {
      return Object.freeze({ kind: 'unresolved' });
    }

    contexts.push(
      Object.freeze({
        label,
        relationship: getCloudflareAgentsThinkContextLoader(candidate, 'configured'),
      }),
    );
  }

  return Object.freeze({ contexts: Object.freeze(contexts), kind: 'closed' });
};

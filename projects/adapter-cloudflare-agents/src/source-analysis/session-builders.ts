import ts from 'typescript';

import { getStaticString, unwrapExpression } from '@moldea.ai/adapter-static-analysis';

import type {
  ICloudflareAgentsClassDefinition,
  ICloudflareAgentsContextInstruction,
  ICloudflareAgentsRelationship,
  ICloudflareAgentsThinkSessionSources,
} from '../contracts/index.js';
import { getCloudflareAgentsMethod } from './methods.js';
import {
  getCloudflareAgentsThinkCachedPromptLoader,
  getCloudflareAgentsThinkContextLoader,
  isCloudflareAgentsThinkContextOptionsClosed,
} from './think-instructions.js';

const isSupportedCompactAfter = (call: ts.CallExpression): boolean => {
  const argument = call.arguments[0];

  if (call.arguments.length !== 1 || argument === undefined) {
    return false;
  }

  const candidate = unwrapExpression(argument);
  return (
    ts.isNumericLiteral(candidate) &&
    Number.isSafeInteger(Number(candidate.text)) &&
    Number(candidate.text) >= 0
  );
};

/** Extracts the closed Think session context chain and older cached-prompt candidate. */
export const getCloudflareAgentsThinkSessionInstructions = (
  definition: ICloudflareAgentsClassDefinition,
): ICloudflareAgentsThinkSessionSources => {
  const method = getCloudflareAgentsMethod(definition.methods, 'configureSession', 1);

  if (method === null) {
    return definition.methods.has('configureSession')
      ? Object.freeze({ kind: 'unresolved' })
      : Object.freeze({
          cachedPrompt: Object.freeze({ kind: 'absent' }),
          contexts: Object.freeze([]),
          kind: 'closed',
        });
  }

  const statement = method.body.statements[0];
  const parameter = method.declaration.parameters[0]?.name;

  if (
    method.body.statements.length !== 1 ||
    statement === undefined ||
    !ts.isReturnStatement(statement) ||
    statement.expression === undefined ||
    parameter === undefined ||
    !ts.isIdentifier(parameter)
  ) {
    return Object.freeze({ kind: 'unresolved' });
  }

  let expression = unwrapExpression(statement.expression);
  let cachedPrompt: ICloudflareAgentsRelationship = { kind: 'absent' };
  let hasCachedPrompt = false;
  const reversedContexts: ICloudflareAgentsContextInstruction[] = [];

  while (ts.isCallExpression(expression)) {
    const callee = unwrapExpression(expression.expression);

    if (!ts.isPropertyAccessExpression(callee)) {
      return Object.freeze({ kind: 'unresolved' });
    }

    const methodName = callee.name.text;

    if (methodName === 'withContext') {
      const label = getStaticString(expression.arguments[0]);

      if (
        (expression.arguments.length !== 1 && expression.arguments.length !== 2) ||
        label === null ||
        label.length === 0 ||
        !isCloudflareAgentsThinkContextOptionsClosed(expression.arguments[1], 'session')
      ) {
        return Object.freeze({ kind: 'unresolved' });
      }

      reversedContexts.push(
        Object.freeze({
          label,
          relationship: getCloudflareAgentsThinkContextLoader(expression.arguments[1]),
        }),
      );
    } else if (methodName === 'withCachedPrompt') {
      if (expression.arguments.length > 1) {
        return Object.freeze({ kind: 'unresolved' });
      }

      const provider = expression.arguments[0];
      cachedPrompt = hasCachedPrompt
        ? { kind: 'unresolved' }
        : provider === undefined
          ? { kind: 'absent' }
          : getCloudflareAgentsThinkCachedPromptLoader(provider);
      hasCachedPrompt = true;
    } else if (methodName === 'forSession') {
      if (expression.arguments.length !== 1 || getStaticString(expression.arguments[0]) === null) {
        return Object.freeze({ kind: 'unresolved' });
      }
    } else if (methodName === 'compactAfter') {
      if (!isSupportedCompactAfter(expression)) {
        return Object.freeze({ kind: 'unresolved' });
      }
    } else if (methodName === 'onCompaction') {
      return Object.freeze({ kind: 'unresolved' });
    } else {
      return Object.freeze({ kind: 'unresolved' });
    }

    expression = unwrapExpression(callee.expression);
  }

  return ts.isIdentifier(expression) && expression.text === parameter.text
    ? Object.freeze({
        cachedPrompt: Object.freeze(cachedPrompt),
        contexts: Object.freeze(reversedContexts.reverse()),
        kind: 'closed',
      })
    : Object.freeze({ kind: 'unresolved' });
};

import ts from 'typescript';

import {
  analyzeClientRequests,
  analyzeObjectRelationships,
  unwrapExpression,
  type IStaticAnalysisRequest,
  type IStaticAnalysisRequestRelationship,
} from '@moldea.ai/adapter-static-analysis';

import type {
  IAnthropicMessagesAnalysis,
  IAnthropicMessagesRequest,
  IAnthropicSourceAnalysis,
} from '../contracts/index.js';
import { ANTHROPIC_SOURCE_CONFIG } from './source-analysis.js';

const RELATIONSHIP_NAMES = ['system', 'tools', 'output_config'] as const;

const getEffectiveRelationships = (
  request: IStaticAnalysisRequest,
): ReadonlyMap<string, IStaticAnalysisRequestRelationship> => {
  if (request.options === null) {
    return request.relationships;
  }

  const options = unwrapExpression(request.options);

  if (ts.isObjectLiteralExpression(options)) {
    const body = analyzeObjectRelationships(options, ['body']).relationships.get('body');

    if (body?.kind === 'absent') {
      return request.relationships;
    }

    if (body?.kind === 'present') {
      const expression = unwrapExpression(body.expression);

      if (ts.isObjectLiteralExpression(expression)) {
        return analyzeObjectRelationships(expression, RELATIONSHIP_NAMES).relationships;
      }
    }
  }

  return new Map(RELATIONSHIP_NAMES.map((name) => [name, { kind: 'unresolved' as const }]));
};

/**
 * Finds every direct Messages request owned by one runtime-agent body.
 * @param analysis The indexed runtime source.
 * @param body The supported runtime-agent lexical body.
 * @param signal The active inspection signal.
 * @returns Recognized requests and conservative ambiguity state.
 * @throws If response analysis is aborted.
 */
export const analyzeAnthropicMessages = (
  analysis: IAnthropicSourceAnalysis,
  body: ts.ConciseBody,
  signal?: AbortSignal,
): IAnthropicMessagesAnalysis => {
  const result = analyzeClientRequests(
    analysis,
    body,
    ANTHROPIC_SOURCE_CONFIG.requestConfig,
    signal,
  );
  const requests: IAnthropicMessagesRequest[] = result.requests.map((request) => {
    const relationships = getEffectiveRelationships(request);

    return Object.freeze({
      methodName: request.methodName,
      object: request.object,
      outputConfig: relationships.get('output_config') ?? Object.freeze({ kind: 'absent' }),
      system: relationships.get('system') ?? Object.freeze({ kind: 'absent' }),
      tools: relationships.get('tools') ?? Object.freeze({ kind: 'absent' }),
    });
  });

  return Object.freeze({
    hasAmbiguousCandidate: result.hasAmbiguousCandidate,
    requests: Object.freeze(requests),
  });
};

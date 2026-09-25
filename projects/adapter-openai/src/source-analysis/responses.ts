import ts from 'typescript';

import {
  analyzeClientRequests,
  analyzeObjectRelationships,
  unwrapExpression,
  type IStaticAnalysisRequest,
  type IStaticAnalysisRequestRelationship,
} from '@moldea.ai/adapter-static-analysis';

import type {
  IOpenAiResponsesAnalysis,
  IOpenAiResponsesRequest,
  IOpenAiSourceAnalysis,
} from '../contracts/index.js';
import { OPENAI_SOURCE_CONFIG } from './source-analysis.js';

const RELATIONSHIP_NAMES = ['instructions', 'tools', 'text'] as const;

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
 * Finds every direct Responses request owned by one runtime-agent body.
 * @param analysis The indexed runtime source.
 * @param body The supported runtime-agent lexical body.
 * @param signal The active inspection signal.
 * @returns Recognized requests and conservative ambiguity state.
 * @throws If response analysis is aborted.
 */
export const analyzeOpenAiResponses = (
  analysis: IOpenAiSourceAnalysis,
  body: ts.ConciseBody,
  signal?: AbortSignal,
): IOpenAiResponsesAnalysis => {
  const result = analyzeClientRequests(analysis, body, OPENAI_SOURCE_CONFIG.requestConfig, signal);
  const requests: IOpenAiResponsesRequest[] = result.requests.map((request) => {
    const relationships = getEffectiveRelationships(request);

    return Object.freeze({
      instructions: relationships.get('instructions') ?? Object.freeze({ kind: 'absent' }),
      methodName: request.methodName,
      object: request.object,
      text: relationships.get('text') ?? Object.freeze({ kind: 'absent' }),
      tools: relationships.get('tools') ?? Object.freeze({ kind: 'absent' }),
    });
  });

  return Object.freeze({
    hasAmbiguousCandidate: result.hasAmbiguousCandidate,
    requests: Object.freeze(requests),
  });
};

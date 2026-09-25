import ts from 'typescript';

import {
  analyzeObjectRelationships,
  classifySchemaRelationship,
  getConstExport,
  getStaticString,
  isModuleBindingVisible,
  unwrapExpression,
  type IStaticAnalysisRequestRelationship,
} from '@moldea.ai/adapter-static-analysis';
import type { IIndexedAgent, IRuntimeAdapterEvidence } from '@moldea.ai/core/adapter';
import type { IAdapterDiagnostic } from '@moldea.ai/core/adapter';

import { OPENAI_ADAPTER_ID } from '../constants/index.js';
import type {
  IOpenAiInspectionSession,
  IOpenAiResponsesAnalysis,
  IOpenAiSourceAnalysis,
} from '../contracts/index.js';
import {
  addOpenAiDiagnostic,
  addOpenAiUnverifiedRelationship,
  analyzeOpenAiBoundReference,
  createOpenAiEvidence,
} from './common.js';

const ABSENT = Object.freeze({ kind: 'absent' as const });
const UNRESOLVED = Object.freeze({ kind: 'unresolved' as const });

const getNestedProperty = (
  relationship: IStaticAnalysisRequestRelationship,
  propertyName: string,
): IStaticAnalysisRequestRelationship => {
  if (relationship.kind !== 'present') {
    return relationship;
  }

  const object = unwrapExpression(relationship.expression);

  return ts.isObjectLiteralExpression(object)
    ? (analyzeObjectRelationships(object, [propertyName]).relationships.get(propertyName) ?? ABSENT)
    : UNRESOLVED;
};

const getFormatSchema = (
  analysis: IOpenAiSourceAnalysis,
  format: IStaticAnalysisRequestRelationship,
): IStaticAnalysisRequestRelationship => {
  if (format.kind !== 'present') {
    return format;
  }

  const expression = unwrapExpression(format.expression);

  if (ts.isObjectLiteralExpression(expression)) {
    const properties = analyzeObjectRelationships(expression, ['type', 'schema']).relationships;
    const type = properties.get('type') ?? ABSENT;

    if (type.kind !== 'present') {
      return type.kind === 'absent' ? UNRESOLVED : type;
    }

    const formatType = getStaticString(type.expression);

    if (formatType === 'json_schema') {
      return properties.get('schema') ?? ABSENT;
    }

    return formatType === 'text' || formatType === 'json_object' ? ABSENT : UNRESOLVED;
  }

  if (!ts.isCallExpression(expression) || expression.arguments.length !== 2) {
    return UNRESOLVED;
  }

  const callee = unwrapExpression(expression.expression);

  if (!ts.isIdentifier(callee) || !isModuleBindingVisible(callee, analysis)) {
    return UNRESOLVED;
  }

  const imported = analysis.namedImports.get(callee.text);

  if (
    imported?.moduleSpecifier !== 'openai/helpers/zod' ||
    imported.importedName !== 'zodTextFormat' ||
    getStaticString(expression.arguments[1]) === null
  ) {
    return UNRESOLVED;
  }

  const schema = expression.arguments[0];
  return schema === undefined ? UNRESOLVED : { expression: schema, kind: 'present' };
};

/** Inspects the exact agent output-schema binding in effective Responses text formats. */
export const inspectOpenAiOutputSchema = async (
  session: IOpenAiInspectionSession,
  agent: IIndexedAgent,
  runtimeAnalysis: IOpenAiSourceAnalysis,
  responses: IOpenAiResponsesAnalysis,
  evidence: IRuntimeAdapterEvidence[],
  diagnostics: IAdapterDiagnostic[],
): Promise<void> => {
  const reference = agent.declaration.bindings?.outputSchema;

  if (reference?.symbol === undefined) {
    return;
  }

  const schemaAnalysis = await analyzeOpenAiBoundReference(
    session,
    reference,
    diagnostics,
    agent.id,
  );

  if (schemaAnalysis === null) {
    return;
  }

  const schema = getConstExport(schemaAnalysis, reference.symbol);

  if (schema.kind === 'absent') {
    addOpenAiDiagnostic(
      diagnostics,
      'OPENAI_OUTPUT_SCHEMA_SYMBOL_NOT_FOUND',
      reference.path,
      agent.id,
    );
    return;
  }

  if (schema.kind !== 'present-supported') {
    addOpenAiUnverifiedRelationship(
      diagnostics,
      'agent-output-schema',
      'unsupported-source-pattern',
      reference.path,
      agent.id,
    );
    return;
  }

  let isUnverified = responses.hasAmbiguousCandidate;
  let absentExpression: ts.Expression | null = null;

  for (const request of responses.requests) {
    const format = getNestedProperty(request.text, 'format');
    const formatSchema = getFormatSchema(runtimeAnalysis, format);

    if (formatSchema.kind === 'unresolved') {
      isUnverified = true;
      continue;
    }

    if (formatSchema.kind === 'absent') {
      continue;
    }

    const relationship = classifySchemaRelationship(
      runtimeAnalysis,
      formatSchema.expression,
      reference,
    );

    if (relationship.kind === 'present') {
      evidence.push(
        createOpenAiEvidence({
          agentId: agent.id,
          capabilityId: null,
          capabilityKind: null,
          details: { requestProperty: 'text.format', schemaRole: 'output' },
          kind: 'schema',
          references: [
            { path: runtimeAnalysis.path },
            { path: reference.path, symbol: reference.symbol },
          ],
          runtimeName: reference.symbol,
          source: OPENAI_ADAPTER_ID,
        }),
      );
      return;
    }

    if (relationship.kind === 'ambiguous') {
      isUnverified = true;
    } else {
      absentExpression ??= relationship.expression;
    }
  }

  if (isUnverified) {
    addOpenAiUnverifiedRelationship(
      diagnostics,
      'agent-output-schema',
      'dynamic-source-pattern',
      runtimeAnalysis.path,
      agent.id,
    );
  } else {
    addOpenAiDiagnostic(
      diagnostics,
      'OPENAI_OUTPUT_SCHEMA_NOT_WIRED',
      runtimeAnalysis.path,
      agent.id,
      absentExpression === null
        ? null
        : runtimeAnalysis.text.locator.locateRange(
            absentExpression.getStart(),
            absentExpression.end,
          ),
    );
  }
};

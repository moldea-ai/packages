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

import { ANTHROPIC_ADAPTER_ID } from '../constants/index.js';
import type {
  IAnthropicInspectionSession,
  IAnthropicMessagesAnalysis,
  IAnthropicSourceAnalysis,
} from '../contracts/index.js';
import {
  addAnthropicDiagnostic,
  addAnthropicUnverifiedRelationship,
  analyzeAnthropicBoundReference,
  createAnthropicEvidence,
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
  analysis: IAnthropicSourceAnalysis,
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

    return getStaticString(type.expression) === 'json_schema'
      ? (properties.get('schema') ?? ABSENT)
      : UNRESOLVED;
  }

  if (!ts.isCallExpression(expression) || expression.arguments.length !== 1) {
    return UNRESOLVED;
  }

  const callee = unwrapExpression(expression.expression);

  if (!ts.isIdentifier(callee) || !isModuleBindingVisible(callee, analysis)) {
    return UNRESOLVED;
  }

  const imported = analysis.namedImports.get(callee.text);

  if (
    imported?.moduleSpecifier !== '@anthropic-ai/sdk/helpers/zod' ||
    imported.importedName !== 'zodOutputFormat'
  ) {
    return UNRESOLVED;
  }

  const schema = expression.arguments[0];
  return schema === undefined ? UNRESOLVED : { expression: schema, kind: 'present' };
};

/** Inspects the exact agent output-schema binding in effective Messages output formats. */
export const inspectAnthropicOutputSchema = async (
  session: IAnthropicInspectionSession,
  agent: IIndexedAgent,
  runtimeAnalysis: IAnthropicSourceAnalysis,
  messages: IAnthropicMessagesAnalysis,
  evidence: IRuntimeAdapterEvidence[],
  diagnostics: IAdapterDiagnostic[],
): Promise<void> => {
  const reference = agent.declaration.bindings?.outputSchema;

  if (reference?.symbol === undefined) {
    return;
  }

  const schemaAnalysis = await analyzeAnthropicBoundReference(
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
    addAnthropicDiagnostic(
      diagnostics,
      'ANTHROPIC_OUTPUT_SCHEMA_SYMBOL_NOT_FOUND',
      reference.path,
      agent.id,
    );
    return;
  }

  if (schema.kind !== 'present-supported') {
    addAnthropicUnverifiedRelationship(
      diagnostics,
      'agent-output-schema',
      'unsupported-source-pattern',
      reference.path,
      agent.id,
    );
    return;
  }

  let isUnverified = messages.hasAmbiguousCandidate;
  let absentExpression: ts.Expression | null = null;

  for (const request of messages.requests) {
    const format = getNestedProperty(request.outputConfig, 'format');
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
        createAnthropicEvidence({
          agentId: agent.id,
          capabilityId: null,
          capabilityKind: null,
          details: { requestProperty: 'output_config.format', schemaRole: 'output' },
          kind: 'schema',
          references: [
            { path: runtimeAnalysis.path },
            { path: reference.path, symbol: reference.symbol },
          ],
          runtimeName: reference.symbol,
          source: ANTHROPIC_ADAPTER_ID,
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
    addAnthropicUnverifiedRelationship(
      diagnostics,
      'agent-output-schema',
      'dynamic-source-pattern',
      runtimeAnalysis.path,
      agent.id,
    );
  } else {
    addAnthropicDiagnostic(
      diagnostics,
      'ANTHROPIC_OUTPUT_SCHEMA_NOT_WIRED',
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

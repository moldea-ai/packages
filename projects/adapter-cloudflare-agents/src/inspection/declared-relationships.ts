import {
  classifyInstructionSource,
  isSupportedTypeScriptSourcePath,
  type IInstructionSourceResult,
} from '@moldea.ai/adapter-static-analysis';
import {
  createRelationshipCoverage,
  inspectDeclaredExports,
  type IDeclaredRelationship,
} from '@moldea.ai/adapter-static-analysis';
import type {
  IRuntimeAdapterContext,
  IRuntimeAdapterResultCollector,
} from '@moldea.ai/core/adapter';
import { parseRepositoryPath } from '@moldea.ai/repository';

import { CLOUDFLARE_AGENTS_ADAPTER_ID } from '../constants/index.js';
import type {
  ICloudflareAgentsAdapterDiagnosticCode,
  ICloudflareAgentsInspectionSession,
} from '../contracts/index.js';
import { createCloudflareAgentsDiagnostic } from '../diagnostics/index.js';

// exact diagnostics for independently provable missing declarations
const MISSING_EXPORT_CODES = {
  'runtime-agent': 'CLOUDFLARE_AGENTS_RUNTIME_AGENT_SYMBOL_NOT_FOUND',
  'instruction-loader': 'CLOUDFLARE_AGENTS_INSTRUCTION_LOADER_SYMBOL_NOT_FOUND',
  'agent-input-schema': 'CLOUDFLARE_AGENTS_AGENT_INPUT_SCHEMA_SYMBOL_NOT_FOUND',
  'agent-output-schema': 'CLOUDFLARE_AGENTS_AGENT_OUTPUT_SCHEMA_SYMBOL_NOT_FOUND',
  'tool-implementation': 'CLOUDFLARE_AGENTS_TOOL_IMPLEMENTATION_SYMBOL_NOT_FOUND',
  'tool-registration': 'CLOUDFLARE_AGENTS_TOOL_REGISTRATION_SYMBOL_NOT_FOUND',
  'tool-input-schema': 'CLOUDFLARE_AGENTS_TOOL_INPUT_SCHEMA_SYMBOL_NOT_FOUND',
  'tool-output-schema': 'CLOUDFLARE_AGENTS_TOOL_OUTPUT_SCHEMA_SYMBOL_NOT_FOUND',
  'skill-implementation': 'CLOUDFLARE_AGENTS_SKILL_IMPLEMENTATION_SYMBOL_NOT_FOUND',
  'skill-registration': 'CLOUDFLARE_AGENTS_SKILL_REGISTRATION_SYMBOL_NOT_FOUND',
  'variable-provider': 'CLOUDFLARE_AGENTS_VARIABLE_PROVIDER_SYMBOL_NOT_FOUND',
} as const satisfies Record<IDeclaredRelationship, ICloudflareAgentsAdapterDiagnosticCode>;

/**
 * Accounts for explicit declarations through budgeted result records.
 * @param context The selected agent and immutable operation context.
 * @param collector The Core-owned result admission boundary.
 * @param session The provider source session.
 * @returns Output observers, independent export checks, and final relationship accounting.
 */
export const createDeclaredCloudflareAgentsRelationships = (
  context: IRuntimeAdapterContext,
  collector: IRuntimeAdapterResultCollector,
  session: ICloudflareAgentsInspectionSession,
) => {
  const coverage = createRelationshipCoverage(context.agent.declaration, context.agent.id, true);
  let instructionSource: IInstructionSourceResult = { kind: 'unverified' };
  const diagnostics = {
    some: (predicate: Parameters<typeof collector.diagnostics.some>[0]): boolean =>
      collector.diagnostics.some(predicate),
    add: (factory: () => ReturnType<typeof createCloudflareAgentsDiagnostic>): void =>
      collector.diagnostics.add(() => {
        const record = factory();
        coverage.observeDiagnostic(record);
        return record;
      }),
  };
  const evidence = {
    instruction: (factory: Parameters<typeof collector.evidence.add>[0]): void => {
      if (instructionSource.kind !== 'verified') return;
      const canonicalPath = parseRepositoryPath(instructionSource.path);
      evidence.add(() => {
        const record = factory();
        return Object.freeze({
          ...record,
          references: Object.freeze(
            record.references.some(
              (reference) => reference.path === canonicalPath && reference.symbol === undefined,
            )
              ? record.references
              : [...record.references, { path: canonicalPath }],
          ),
        });
      });
    },
    some: (predicate: Parameters<typeof collector.evidence.some>[0]): boolean =>
      collector.evidence.some(predicate),
    add: (factory: Parameters<typeof collector.evidence.add>[0]): void =>
      collector.evidence.add(() => {
        const record = factory();
        coverage.observeEvidence(record);
        return record;
      }),
  };
  const inspectExports = async (): Promise<void> => {
    for await (const failure of inspectDeclaredExports(
      context.agent.declaration,
      (path) => session.analyzeSource(parseRepositoryPath(path)),
      context.signal,
    )) {
      const { subject } = failure;
      diagnostics.add(() => {
        coverage.observeSubject(subject);
        return createCloudflareAgentsDiagnostic({
          code:
            failure.kind === 'missing'
              ? MISSING_EXPORT_CODES[subject.relationship]
              : failure.kind === 'invalid-text'
                ? 'CLOUDFLARE_AGENTS_SOURCE_TEXT_INVALID'
                : 'CLOUDFLARE_AGENTS_SOURCE_SYNTAX_INVALID',
          details: {},
          entity: {
            adapterId: CLOUDFLARE_AGENTS_ADAPTER_ID,
            agentId: context.agent.id,
            ...(subject.capabilityId === undefined ? {} : { capabilityId: subject.capabilityId }),
            ...(subject.capabilityKind === undefined
              ? {}
              : { capabilityKind: subject.capabilityKind }),
            ...(subject.variableId === undefined ? {} : { variableId: subject.variableId }),
          },
          path: parseRepositoryPath(subject.reference.path),
          pointer: null,
          range: failure.range,
        });
      });
    }
  };
  const inspectInstructionSource = async (): Promise<void> => {
    const reference = context.agent.declaration.bindings?.instructionLoader;
    if (reference === undefined) return;
    if (
      reference.symbol === undefined &&
      [
        context.agent.instruction.path,
        ...context.agent.mirrors.map((mirror) => mirror.path),
      ].includes(reference.path)
    ) {
      instructionSource = { kind: 'verified', path: reference.path };
    }
    if (reference.symbol !== undefined && isSupportedTypeScriptSourcePath(reference.path)) {
      const result = await session.analyzeSource(reference.path);
      if (result.kind === 'valid')
        instructionSource = await classifyInstructionSource({
          analysis: result.analysis,
          symbol: reference.symbol,
          canonicalContent: context.agent.instruction.content,
          canonicalPaths: [
            context.agent.instruction.path,
            ...context.agent.mirrors.map((mirror) => mirror.path),
          ],
          analyzeSource: (path) => session.analyzeSource(parseRepositoryPath(path)),
          getEntry: (path) => session.getEntry(parseRepositoryPath(path)),
          ...(context.signal === undefined ? {} : { signal: context.signal }),
        });
    }
    if (instructionSource.kind === 'mismatch')
      diagnostics.add(() =>
        createCloudflareAgentsDiagnostic({
          code: 'CLOUDFLARE_AGENTS_INSTRUCTION_SOURCE_MISMATCH',
          details: {},
          entity: { adapterId: CLOUDFLARE_AGENTS_ADAPTER_ID, agentId: context.agent.id },
          path: reference.path,
          pointer: null,
          range: null,
        }),
      );
    else if (
      instructionSource.kind === 'unverified' &&
      !diagnostics.some(
        (diagnostic) =>
          diagnostic.path === reference.path &&
          [
            MISSING_EXPORT_CODES['instruction-loader'],
            'CLOUDFLARE_AGENTS_SOURCE_TEXT_INVALID',
            'CLOUDFLARE_AGENTS_SOURCE_SYNTAX_INVALID',
          ].includes(diagnostic.code),
      )
    )
      diagnostics.add(() =>
        createCloudflareAgentsDiagnostic({
          code: 'CLOUDFLARE_AGENTS_RUNTIME_RELATIONSHIP_UNVERIFIED',
          details: { relationship: 'instruction-loader', reason: 'unsupported-source-pattern' },
          entity: { adapterId: CLOUDFLARE_AGENTS_ADAPTER_ID, agentId: context.agent.id },
          path: reference.path,
          pointer: null,
          range: null,
        }),
      );
  };
  const finalize = (): void =>
    coverage.finalize((subject) =>
      diagnostics.add(() =>
        createCloudflareAgentsDiagnostic({
          code: 'CLOUDFLARE_AGENTS_RUNTIME_RELATIONSHIP_UNVERIFIED',
          details: { reason: 'unsupported-source-pattern', relationship: subject.relationship },
          entity: {
            adapterId: CLOUDFLARE_AGENTS_ADAPTER_ID,
            agentId: context.agent.id,
            ...(subject.capabilityId === undefined ? {} : { capabilityId: subject.capabilityId }),
            ...(subject.capabilityKind === undefined
              ? {}
              : { capabilityKind: subject.capabilityKind }),
            ...(subject.variableId === undefined ? {} : { variableId: subject.variableId }),
          },
          path: parseRepositoryPath(subject.reference.path),
          pointer: null,
          range: null,
        }),
      ),
    );
  return Object.freeze({
    diagnostics,
    evidence,
    inspectExports,
    inspectInstructionSource,
    finalize,
  });
};

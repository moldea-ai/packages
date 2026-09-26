import type ts from 'typescript';

import { classifyAiSdkDeferredLoading } from '@moldea.ai/adapter-static-analysis';
import type {
  IAdapterDiagnostic,
  IRuntimeAdapterContext,
  IRuntimeAdapterEvidence,
  IRuntimeAdapterResolvedAgent,
} from '@moldea.ai/core/adapter';
import type { IRepositoryReference } from '@moldea.ai/core/format';

import {
  CLOUDFLARE_AGENTS_ADAPTER_ID,
  CLOUDFLARE_THINK_CONTEXT_BOUNDARY_VERSION,
  CLOUDFLARE_THINK_PACKAGE_NAME,
} from '../constants/index.js';
import type {
  ICloudflareAgentsAdapterDiagnosticCode,
  ICloudflareAgentsInspectionSession,
  ICloudflareAgentsRelationship,
  ICloudflareAgentsSourceAnalysis,
} from '../contracts/index.js';
import {
  classifyCloudflareAgentsDirectBinding,
  classifyCloudflareAgentsInstructionLoader,
  getCloudflareAgentsOutputSchema,
} from '../source-analysis/index.js';
import {
  addCloudflareAgentsDiagnostic,
  addCloudflareAgentsWarning,
  createCloudflareAgentsEvidence,
  hasCloudflareAgentsSymbol,
} from './common.js';
import { inspectCloudflareAgentsHandoffs } from './handoffs.js';
import {
  resolveCloudflareAgentsToolDefinition,
  resolveCloudflareAgentsToolMap,
  type ICloudflareAgentsResolvedToolMap,
} from './resolution.js';
import type {
  ICloudflareAgentsInspectedAgent,
  ICloudflareAgentsThinkInstructions,
} from './types.js';
import type { ICloudflareAgentsScopedAgent } from './types.js';

const inspectBinding = async (
  session: ICloudflareAgentsInspectionSession,
  agent: ICloudflareAgentsScopedAgent,
  relationship: ICloudflareAgentsRelationship,
  analysis: ICloudflareAgentsSourceAnalysis,
  reference: IRepositoryReference,
  symbolMissingCode: Exclude<
    ICloudflareAgentsAdapterDiagnosticCode,
    'CLOUDFLARE_AGENTS_RUNTIME_RELATIONSHIP_UNVERIFIED'
  >,
  notWiredCode: Exclude<
    ICloudflareAgentsAdapterDiagnosticCode,
    'CLOUDFLARE_AGENTS_RUNTIME_RELATIONSHIP_UNVERIFIED'
  >,
  evidenceKind: 'instruction-loader' | 'schema',
  evidence: IRuntimeAdapterEvidence[],
  diagnostics: IAdapterDiagnostic[],
  schemaRole?: 'agent-output',
): Promise<void> => {
  const boundAnalysis = await hasCloudflareAgentsSymbol(
    session,
    reference,
    diagnostics,
    agent.id,
    symbolMissingCode,
  );

  if (boundAnalysis === null) {
    return;
  }

  const matches =
    evidenceKind === 'instruction-loader'
      ? classifyCloudflareAgentsInstructionLoader(relationship, analysis, reference)
      : classifyCloudflareAgentsDirectBinding(relationship, analysis, reference);

  if (matches !== true) {
    addCloudflareAgentsDiagnostic(diagnostics, notWiredCode, reference.path, agent.id);
    return;
  }

  evidence.push(
    createCloudflareAgentsEvidence({
      agentId: agent.id,
      capabilityId: null,
      capabilityKind: null,
      details: schemaRole === undefined ? {} : { schemaRole },
      kind: evidenceKind,
      references: [reference],
      runtimeName: reference.symbol ?? null,
      source: CLOUDFLARE_AGENTS_ADAPTER_ID,
    }),
  );
};

const classifyThinkInstructionVersion = (
  sources: ICloudflareAgentsThinkInstructions,
  analysis: ICloudflareAgentsSourceAnalysis,
  reference: IRepositoryReference,
  behavior: 'before' | 'after',
): boolean | null => {
  const systemPrompt = classifyCloudflareAgentsInstructionLoader(
    sources.systemPrompt,
    analysis,
    reference,
  );

  if (systemPrompt === true) {
    return true;
  }

  // An unresolved Session override can replace an earlier configured context block.
  if (sources.session.kind === 'unresolved') {
    return null;
  }

  const contexts = new Map(
    [
      ...(behavior === 'after' && sources.context.kind === 'closed'
        ? sources.context.contexts
        : []),
      ...sources.session.contexts,
    ].map(({ label, relationship }) => [label, relationship] as const),
  );
  const relationships = [...contexts.values()];

  if (sources.session.cachedPrompt.kind !== 'absent') {
    relationships.push(sources.session.cachedPrompt);
  }

  const results = relationships.map((relationship) =>
    classifyCloudflareAgentsInstructionLoader(relationship, analysis, reference),
  );

  if (results.includes(true)) {
    return true;
  }

  if (
    systemPrompt === null ||
    results.includes(null) ||
    (behavior === 'after' && sources.context.kind === 'unresolved')
  ) {
    return null;
  }

  return false;
};

const inspectThinkInstructionLoader = async (
  session: ICloudflareAgentsInspectionSession,
  inspected: ICloudflareAgentsInspectedAgent,
  sources: ICloudflareAgentsThinkInstructions,
  reference: IRepositoryReference,
  evidence: IRuntimeAdapterEvidence[],
  diagnostics: IAdapterDiagnostic[],
): Promise<void> => {
  const boundAnalysis = await hasCloudflareAgentsSymbol(
    session,
    reference,
    diagnostics,
    inspected.agent.id,
    'CLOUDFLARE_AGENTS_INSTRUCTION_LOADER_SYMBOL_NOT_FOUND',
  );

  if (boundAnalysis === null) {
    return;
  }

  const before = classifyThinkInstructionVersion(sources, inspected.analysis, reference, 'before');
  const after = classifyThinkInstructionVersion(sources, inspected.analysis, reference, 'after');
  const result =
    sources.package.thinkBehavior === 'before'
      ? before
      : sources.package.thinkBehavior === 'after'
        ? after
        : before === after
          ? before
          : null;

  if (result === true) {
    evidence.push(
      createCloudflareAgentsEvidence({
        agentId: inspected.agent.id,
        capabilityId: null,
        capabilityKind: null,
        details: {},
        kind: 'instruction-loader',
        references: [reference],
        runtimeName: reference.symbol ?? null,
        source: CLOUDFLARE_AGENTS_ADAPTER_ID,
      }),
    );
  } else if (result === false) {
    addCloudflareAgentsDiagnostic(
      diagnostics,
      'CLOUDFLARE_AGENTS_INSTRUCTION_LOADER_NOT_WIRED',
      reference.path,
      inspected.agent.id,
    );
  } else if (sources.package.thinkBehavior === null && before !== after) {
    addCloudflareAgentsWarning(diagnostics, inspected.analysis.path, inspected.agent.id, {
      boundaryVersion: CLOUDFLARE_THINK_CONTEXT_BOUNDARY_VERSION,
      declaredRange: sources.package.declaredThinkRange,
      packageName: CLOUDFLARE_THINK_PACKAGE_NAME,
      reason: 'version-dependent-behavior',
      relationship: 'instruction-loader',
    });
  } else {
    addCloudflareAgentsWarning(diagnostics, inspected.analysis.path, inspected.agent.id, {
      reason: 'dynamic-source-pattern',
      relationship: 'instruction-loader',
    });
  }
};

const inspectToolReference = async (
  session: ICloudflareAgentsInspectionSession,
  agent: ICloudflareAgentsScopedAgent,
  capabilityId: string,
  relationship: ICloudflareAgentsRelationship,
  relationshipAnalysis: ICloudflareAgentsSourceAnalysis,
  reference: IRepositoryReference | undefined,
  symbolMissingCode: Exclude<
    ICloudflareAgentsAdapterDiagnosticCode,
    'CLOUDFLARE_AGENTS_RUNTIME_RELATIONSHIP_UNVERIFIED'
  >,
  notWiredCode: Exclude<
    ICloudflareAgentsAdapterDiagnosticCode,
    'CLOUDFLARE_AGENTS_RUNTIME_RELATIONSHIP_UNVERIFIED'
  >,
  diagnostics: IAdapterDiagnostic[],
): Promise<boolean> => {
  if (reference === undefined) {
    return true;
  }

  const analysis = await hasCloudflareAgentsSymbol(
    session,
    reference,
    diagnostics,
    agent.id,
    symbolMissingCode,
    capabilityId,
  );

  if (analysis === null) {
    return false;
  }

  if (
    classifyCloudflareAgentsDirectBinding(relationship, relationshipAnalysis, reference) !== true
  ) {
    addCloudflareAgentsDiagnostic(
      diagnostics,
      notWiredCode,
      reference.path,
      agent.id,
      null,
      capabilityId,
    );
    return false;
  }

  return true;
};

const inspectTools = async (
  session: ICloudflareAgentsInspectionSession,
  inspected: ICloudflareAgentsInspectedAgent,
  context: IRuntimeAdapterContext,
  isResolvedAgentSupported: (agent: IRuntimeAdapterResolvedAgent) => Promise<boolean>,
  evidence: IRuntimeAdapterEvidence[],
  diagnostics: IAdapterDiagnostic[],
): Promise<void> => {
  if (inspected.tools.some((relationship) => relationship.kind === 'unresolved')) {
    return;
  }

  const presentRelationships = inspected.tools.filter(
    (relationship) => relationship.kind === 'present',
  );
  const resolvedMaps = (
    await Promise.all(
      presentRelationships.map((relationship) =>
        resolveCloudflareAgentsToolMap(session, inspected.analysis, relationship),
      ),
    )
  ).filter(
    (map): map is ICloudflareAgentsResolvedToolMap => map !== null && map.map.kind === 'closed',
  );

  if (resolvedMaps.length !== presentRelationships.length) {
    return;
  }

  await inspectCloudflareAgentsHandoffs(
    session,
    inspected.agent,
    context,
    isResolvedAgentSupported,
    resolvedMaps,
    evidence,
    diagnostics,
  );

  for (const [capabilityId, tool] of Object.entries(inspected.agent.declaration.tools ?? {})) {
    if (tool.registration === undefined) {
      continue;
    }

    await hasCloudflareAgentsSymbol(
      session,
      tool.registration,
      diagnostics,
      inspected.agent.id,
      'CLOUDFLARE_AGENTS_TOOL_REGISTRATION_SYMBOL_NOT_FOUND',
      capabilityId,
    );
    let matchedEntry:
      | {
          readonly analysis: ICloudflareAgentsSourceAnalysis;
          readonly expression: ts.Expression;
          readonly name: string;
        }
      | undefined;

    for (const resolvedMap of resolvedMaps) {
      for (const entry of resolvedMap.map.entries) {
        if (
          classifyCloudflareAgentsDirectBinding(
            { expression: entry.expression, kind: 'present' },
            resolvedMap.analysis,
            tool.registration,
          ) === true
        ) {
          matchedEntry = { analysis: resolvedMap.analysis, ...entry };
          break;
        }
      }
    }

    if (matchedEntry === undefined) {
      addCloudflareAgentsDiagnostic(
        diagnostics,
        'CLOUDFLARE_AGENTS_TOOL_REGISTRATION_NOT_WIRED',
        tool.registration.path,
        inspected.agent.id,
        null,
        capabilityId,
      );
      continue;
    }

    if (matchedEntry.name !== tool.name) {
      addCloudflareAgentsDiagnostic(
        diagnostics,
        'CLOUDFLARE_AGENTS_TOOL_NAME_MISMATCH',
        tool.registration.path,
        inspected.agent.id,
        null,
        capabilityId,
        { declaredName: tool.name, detectedName: matchedEntry.name },
      );
      continue;
    }

    const resolvedTool = await resolveCloudflareAgentsToolDefinition(
      session,
      matchedEntry.analysis,
      matchedEntry.expression,
    );

    if (resolvedTool?.definition.kind !== 'function-tool') {
      continue;
    }

    const functionTool = resolvedTool.definition.tool;
    const implementationMatches = await inspectToolReference(
      session,
      inspected.agent,
      capabilityId,
      functionTool.execute,
      resolvedTool.analysis,
      tool.implementation,
      'CLOUDFLARE_AGENTS_TOOL_IMPLEMENTATION_SYMBOL_NOT_FOUND',
      'CLOUDFLARE_AGENTS_TOOL_IMPLEMENTATION_NOT_WIRED',
      diagnostics,
    );
    const inputMatches = await inspectToolReference(
      session,
      inspected.agent,
      capabilityId,
      functionTool.inputSchema,
      resolvedTool.analysis,
      tool.inputSchema,
      'CLOUDFLARE_AGENTS_TOOL_INPUT_SCHEMA_SYMBOL_NOT_FOUND',
      'CLOUDFLARE_AGENTS_TOOL_INPUT_SCHEMA_NOT_WIRED',
      diagnostics,
    );
    const outputMatches = await inspectToolReference(
      session,
      inspected.agent,
      capabilityId,
      functionTool.outputSchema,
      resolvedTool.analysis,
      tool.outputSchema,
      'CLOUDFLARE_AGENTS_TOOL_OUTPUT_SCHEMA_SYMBOL_NOT_FOUND',
      'CLOUDFLARE_AGENTS_TOOL_OUTPUT_SCHEMA_NOT_WIRED',
      diagnostics,
    );

    if (implementationMatches && inputMatches && outputMatches) {
      evidence.push(
        createCloudflareAgentsEvidence({
          agentId: inspected.agent.id,
          capabilityId,
          capabilityKind: 'tool',
          details: {
            declaredDeferredLoading: classifyAiSdkDeferredLoading(
              functionTool.deferLoading.kind === 'present'
                ? functionTool.deferLoading.expression
                : null,
            ),
            toolName: matchedEntry.name,
          },
          kind: 'tool-registration',
          references: [tool.registration, tool.implementation],
          runtimeName: matchedEntry.name,
          source: CLOUDFLARE_AGENTS_ADAPTER_ID,
        }),
      );

      for (const [schemaRole, reference] of [
        ['tool-input', tool.inputSchema],
        ['tool-output', tool.outputSchema],
      ] as const) {
        if (reference !== undefined) {
          evidence.push(
            createCloudflareAgentsEvidence({
              agentId: inspected.agent.id,
              capabilityId,
              capabilityKind: 'tool',
              details: { schemaRole },
              kind: 'schema',
              references: [reference],
              runtimeName: reference.symbol ?? null,
              source: CLOUDFLARE_AGENTS_ADAPTER_ID,
            }),
          );
        }
      }
    }
  }
};

/** Inspects manifest relationships for every supported Cloudflare runtime agent. */
export const inspectCloudflareAgentsRelationships = async (
  session: ICloudflareAgentsInspectionSession,
  inspectedAgents: readonly ICloudflareAgentsInspectedAgent[],
  context: IRuntimeAdapterContext,
  isResolvedAgentSupported: (agent: IRuntimeAdapterResolvedAgent) => Promise<boolean>,
  evidence: IRuntimeAdapterEvidence[],
  diagnostics: IAdapterDiagnostic[],
): Promise<void> => {
  for (const inspected of inspectedAgents) {
    const bindings = inspected.agent.declaration.bindings;

    if (bindings?.instructionLoader !== undefined) {
      if (inspected.thinkInstructions === null) {
        await inspectBinding(
          session,
          inspected.agent,
          inspected.instructions,
          inspected.analysis,
          bindings.instructionLoader,
          'CLOUDFLARE_AGENTS_INSTRUCTION_LOADER_SYMBOL_NOT_FOUND',
          'CLOUDFLARE_AGENTS_INSTRUCTION_LOADER_NOT_WIRED',
          'instruction-loader',
          evidence,
          diagnostics,
        );
      } else {
        await inspectThinkInstructionLoader(
          session,
          inspected,
          inspected.thinkInstructions,
          bindings.instructionLoader,
          evidence,
          diagnostics,
        );
      }
    }

    if (bindings?.outputSchema !== undefined) {
      await inspectBinding(
        session,
        inspected.agent,
        getCloudflareAgentsOutputSchema(inspected.output, inspected.analysis),
        inspected.analysis,
        bindings.outputSchema,
        'CLOUDFLARE_AGENTS_AGENT_OUTPUT_SCHEMA_SYMBOL_NOT_FOUND',
        'CLOUDFLARE_AGENTS_AGENT_OUTPUT_SCHEMA_NOT_WIRED',
        'schema',
        evidence,
        diagnostics,
        'agent-output',
      );
    }

    await inspectTools(
      session,
      inspected,
      context,
      isResolvedAgentSupported,
      evidence,
      diagnostics,
    );
  }
};

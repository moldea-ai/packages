import ts from 'typescript';

import { resolveBindingReferences, unwrapExpression } from '@moldea.ai/adapter-static-analysis';
import type {
  IAdapterDiagnostic,
  IRuntimeAdapterContext,
  IRuntimeAdapterEvidence,
  IRuntimeAdapterResolvedAgent,
} from '@moldea.ai/core/adapter';
import { parseRepositoryPath } from '@moldea.ai/repository';

import { CLOUDFLARE_AGENTS_ADAPTER_ID } from '../constants/index.js';
import type {
  ICloudflareAgentsInspectionSession,
  ICloudflareAgentsSourceAnalysis,
} from '../contracts/index.js';
import { addCloudflareAgentsDiagnostic, createCloudflareAgentsEvidence } from './common.js';
import { resolveCloudflareAgentsToolDefinition } from './resolution.js';
import type { ICloudflareAgentsResolvedToolMap } from './resolution.js';
import type { ICloudflareAgentsScopedAgent } from './types.js';

type ICloudflareAgentsTargetResolution =
  | { readonly kind: 'absent' }
  | { readonly kind: 'ambiguous' }
  | { readonly agent: IRuntimeAdapterResolvedAgent; readonly kind: 'matched' };

const resolveTargetAgent = (
  target: ts.Expression,
  analysis: ICloudflareAgentsSourceAnalysis,
  context: IRuntimeAdapterContext,
): ICloudflareAgentsTargetResolution => {
  const candidate = unwrapExpression(target);

  if (!ts.isIdentifier(candidate)) {
    return Object.freeze({ kind: 'absent' });
  }

  const references = resolveBindingReferences(candidate, analysis);
  const matchedAgents = new Map<string, IRuntimeAdapterResolvedAgent>();

  for (const reference of references) {
    const resolution = context.resolveAgent({
      path: parseRepositoryPath(reference.path),
      symbol: reference.symbol,
    });

    if (resolution.kind === 'ambiguous') {
      return Object.freeze({ kind: 'ambiguous' });
    }

    if (resolution.kind === 'matched') {
      matchedAgents.set(resolution.agent.id, resolution.agent);
    }
  }

  if (matchedAgents.size > 1) {
    return Object.freeze({ kind: 'ambiguous' });
  }

  const agent = matchedAgents.values().next().value;
  return agent === undefined
    ? Object.freeze({ kind: 'absent' })
    : Object.freeze({ agent, kind: 'matched' });
};

/** Inspects active Cloudflare `agentTool` helpers as runtime handoff registrations. */
export const inspectCloudflareAgentsHandoffs = async (
  session: ICloudflareAgentsInspectionSession,
  sourceAgent: ICloudflareAgentsScopedAgent,
  context: IRuntimeAdapterContext,
  isResolvedAgentSupported: (agent: IRuntimeAdapterResolvedAgent) => Promise<boolean>,
  resolvedMaps: readonly ICloudflareAgentsResolvedToolMap[],
  evidence: IRuntimeAdapterEvidence[],
  diagnostics: IAdapterDiagnostic[],
): Promise<void> => {
  for (const resolvedMap of resolvedMaps) {
    for (const entry of resolvedMap.map.entries) {
      const resolved = await resolveCloudflareAgentsToolDefinition(
        session,
        resolvedMap.analysis,
        entry.expression,
      );

      if (resolved?.definition.kind !== 'agent-tool') {
        continue;
      }

      const targetResolution = resolveTargetAgent(
        resolved.definition.tool.target,
        resolved.analysis,
        context,
      );

      if (targetResolution.kind === 'ambiguous') {
        addCloudflareAgentsDiagnostic(
          diagnostics,
          'CLOUDFLARE_AGENTS_HANDOFF_TARGET_AMBIGUOUS',
          resolved.reference.path,
          sourceAgent.id,
          null,
          undefined,
          { toolName: entry.name },
        );
        continue;
      }

      const target = targetResolution.kind === 'matched' ? targetResolution.agent : undefined;

      if (target === undefined || !(await isResolvedAgentSupported(target))) {
        continue;
      }

      const description = resolved.definition.tool.description;
      const effectiveDescription = target.handoffDescription?.value ?? target.description.value;

      if (description === null || description.length === 0) {
        addCloudflareAgentsDiagnostic(
          diagnostics,
          'CLOUDFLARE_AGENTS_HANDOFF_ROUTING_DESCRIPTION_MISSING',
          resolved.reference.path,
          sourceAgent.id,
          null,
          undefined,
          { targetAgentId: target.id, toolName: entry.name },
        );
        continue;
      }

      if (description !== effectiveDescription) {
        addCloudflareAgentsDiagnostic(
          diagnostics,
          'CLOUDFLARE_AGENTS_HANDOFF_ROUTING_DESCRIPTION_NOT_WIRED',
          resolved.reference.path,
          sourceAgent.id,
          null,
          undefined,
          { targetAgentId: target.id, toolName: entry.name },
        );
        continue;
      }

      const targetReference = target.declaration.bindings?.runtimeAgent;

      if (targetReference === undefined) {
        continue;
      }

      evidence.push(
        createCloudflareAgentsEvidence({
          agentId: sourceAgent.id,
          capabilityId: null,
          capabilityKind: null,
          details: { targetAgentId: target.id, toolName: entry.name },
          kind: 'handoff-registration',
          references: [resolved.reference, targetReference],
          runtimeName: entry.name,
          source: CLOUDFLARE_AGENTS_ADAPTER_ID,
        }),
      );
    }
  }
};

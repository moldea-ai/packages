import { createRuntimeAdapterResultCollector } from '@moldea.ai/core/adapter';
import type { IRuntimeAdapterRecordCollector } from '@moldea.ai/core/adapter';
import { isSupportedTypeScriptSourcePath } from '@moldea.ai/adapter-static-analysis';
import type { IIndexedAgent } from '@moldea.ai/core/adapter';
import type {
  IAdapterDiagnostic,
  IRuntimeAdapterContext,
  IRuntimeAdapterResult,
} from '@moldea.ai/core/adapter';

import type { IVercelAiSdkEvidenceCollector } from '../contracts/index.js';
import {
  VERCEL_AI_SDK_ADAPTER_ID,
  VERCEL_AI_SDK_GENERATION_TARGET_ID,
  VERCEL_AI_SDK_TOOL_LOOP_AGENT_TARGET_ID,
} from '../constants/index.js';
import type { IVercelAiSdkInspectionSession } from '../contracts/index.js';
import {
  getVercelAiSdkGenerationWrapper,
  getVercelAiSdkToolLoopAgentDefinition,
  resolveVercelAiSdkStaticString,
} from '../source-analysis/index.js';

import { createDeclaredVercelAiSdkRelationships } from './declared-relationships.js';
import {
  addVercelAiSdkDiagnostic,
  analyzeVercelAiSdkBoundReference,
  createVercelAiSdkEvidence,
  isVercelAiSdkMachineString,
} from './common.js';
import { inspectVercelAiSdkPackage } from './package-inspection.js';
import { inspectVercelAiSdkRelationships } from './relationships.js';
import { createVercelAiSdkInspectionSession } from './session.js';
import type { IVercelAiSdkInspectedAgent } from './types.js';

const inspectAgent = async (
  session: IVercelAiSdkInspectionSession,
  agent: IIndexedAgent,
  evidence: IVercelAiSdkEvidenceCollector,
  diagnostics: IRuntimeAdapterRecordCollector<IAdapterDiagnostic>,
): Promise<IVercelAiSdkInspectedAgent | null> => {
  const runtimeAgent = agent.declaration.bindings?.runtimeAgent;

  if (runtimeAgent === undefined) {
    return null;
  }

  await inspectVercelAiSdkPackage(session, runtimeAgent.path, evidence, diagnostics, agent.id);

  if (!isSupportedTypeScriptSourcePath(runtimeAgent.path)) {
    return null;
  }

  evidence.add(() =>
    createVercelAiSdkEvidence({
      agentId: agent.id,
      capabilityId: null,
      capabilityKind: null,
      details: { language: 'typescript' },
      kind: 'language',
      references: [
        runtimeAgent.symbol === undefined
          ? { path: runtimeAgent.path }
          : {
              path: runtimeAgent.path,
              ...(runtimeAgent.symbol === undefined ? {} : { symbol: runtimeAgent.symbol }),
            },
      ],
      runtimeName: null,
      source: VERCEL_AI_SDK_ADAPTER_ID,
    }),
  );

  if (runtimeAgent.symbol === undefined) {
    return null;
  }

  const analysis = await analyzeVercelAiSdkBoundReference(
    session,
    runtimeAgent,
    diagnostics,
    agent.id,
  );

  if (analysis === null) {
    return null;
  }

  if (!analysis.exports.has(runtimeAgent.symbol)) {
    if (analysis.hasUnresolvedExports) {
      return null;
    }
    addVercelAiSdkDiagnostic(
      diagnostics,
      'VERCEL_AI_SDK_RUNTIME_AGENT_SYMBOL_NOT_FOUND',
      runtimeAgent.path,
      agent.id,
    );
    return null;
  }

  const definition = getVercelAiSdkToolLoopAgentDefinition(analysis, runtimeAgent.symbol);

  if (definition.kind === 'present-supported') {
    const staticId =
      definition.definition.id.kind === 'present'
        ? await resolveVercelAiSdkStaticString(
            session,
            analysis,
            definition.definition.id.expression,
          )
        : null;
    const runtimeName =
      staticId?.kind === 'supported' && isVercelAiSdkMachineString(staticId.value)
        ? staticId.value
        : null;
    evidence.add(() =>
      createVercelAiSdkEvidence({
        agentId: agent.id,
        capabilityId: null,
        capabilityKind: null,
        details: { targetId: VERCEL_AI_SDK_TOOL_LOOP_AGENT_TARGET_ID },
        kind: 'agent-definition',
        references: [
          {
            path: runtimeAgent.path,
            ...(runtimeAgent.symbol === undefined ? {} : { symbol: runtimeAgent.symbol }),
          },
        ],
        runtimeName,
        source: VERCEL_AI_SDK_ADAPTER_ID,
      }),
    );

    return Object.freeze({
      agent,
      analysis,
      definition: definition.definition,
      kind: 'tool-loop-agent',
    });
  }

  const wrapper = getVercelAiSdkGenerationWrapper(analysis, runtimeAgent.symbol);

  if (wrapper.kind !== 'present-supported') {
    return null;
  }

  const runtimeSymbol = runtimeAgent.symbol;
  evidence.add(() =>
    createVercelAiSdkEvidence({
      agentId: agent.id,
      capabilityId: null,
      capabilityKind: null,
      details: {
        calls: [...new Set(wrapper.wrapper.requests.map(({ call }) => call))].join(','),
        targetId: VERCEL_AI_SDK_GENERATION_TARGET_ID,
      },
      kind: 'runtime-pattern',
      references: [
        {
          path: runtimeAgent.path,
          ...(runtimeAgent.symbol === undefined ? {} : { symbol: runtimeAgent.symbol }),
        },
      ],
      runtimeName: isVercelAiSdkMachineString(runtimeSymbol) ? runtimeSymbol : null,
      source: VERCEL_AI_SDK_ADAPTER_ID,
    }),
  );

  return Object.freeze({
    agent,
    analysis,
    kind: 'generation-wrapper',
    wrapper: wrapper.wrapper,
  });
};

/**
 * Inspects all scoped Vercel AI SDK agents through one deterministic session.
 * @param context The Core-provided immutable adapter context.
 * @returns A promise resolving to source-grounded evidence and diagnostics.
 * @throws
 * - INVALID_REPOSITORY_PATH: The repository path is invalid.
 * - ENTRY_NOT_FOUND: The requested repository entry was not found.
 * - ENTRY_NOT_FILE: The requested repository entry is not a file.
 * - ACCESS_DENIED: Access to the repository source was denied.
 * - SOURCE_UNAVAILABLE: The repository source is unavailable.
 * - PROVIDER_INCOMPLETE: The repository provider cannot expose a complete result.
 * - SNAPSHOT_CHANGED: The repository snapshot changed during the operation.
 * - INVALID_SOURCE_DATA: The repository source returned invalid data.
 * - RESOURCE_LIMIT_EXCEEDED: A named repository resource limit was exceeded.
 * - RESOURCE_LIMIT_EXCEEDED: A Core resource limit was exceeded.
 * - ABORTED: The repository operation was aborted.
 * - ABORTED: The Core operation was aborted.
 */
export const inspectVercelAiSdk = async (
  context: IRuntimeAdapterContext,
): Promise<IRuntimeAdapterResult> => {
  context.signal?.throwIfAborted();
  const session = createVercelAiSdkInspectionSession(context);
  const collector = createRuntimeAdapterResultCollector(context);
  const relationships = createDeclaredVercelAiSdkRelationships(context, collector, session);
  const { evidence, diagnostics } = relationships;
  await relationships.inspectExports();
  await relationships.inspectInstructionSource();
  const agents = [context.agent];
  const inspectedAgents: IVercelAiSdkInspectedAgent[] = [];

  for (const agent of agents) {
    context.signal?.throwIfAborted();
    const inspected = await inspectAgent(session, agent, evidence, diagnostics);

    if (inspected !== null) {
      inspectedAgents.push(inspected);
    }
  }

  context.signal?.throwIfAborted();
  await inspectVercelAiSdkRelationships(session, inspectedAgents, evidence, diagnostics);

  context.signal?.throwIfAborted();
  relationships.finalize();
  return collector.finalize();
};

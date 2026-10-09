import { createRuntimeAdapterResultCollector } from '@moldea.ai/core/adapter';
import type { IRuntimeAdapterRecordCollector } from '@moldea.ai/core/adapter';
import { isSupportedTypeScriptSourcePath } from '@moldea.ai/adapter-static-analysis';
import type { IIndexedAgent } from '@moldea.ai/core/adapter';
import type {
  IAdapterDiagnostic,
  IRuntimeAdapterContext,
  IRuntimeAdapterResult,
} from '@moldea.ai/core/adapter';

import type { IClaudeAgentSdkEvidenceCollector } from '../contracts/index.js';
import { CLAUDE_AGENT_SDK_ADAPTER_ID } from '../constants/index.js';
import type { IClaudeAgentSdkInspectionSession } from '../contracts/index.js';
import {
  applyClaudeAgentSdkAgentMutations,
  collectClaudeAgentSdkAgentDefinitionReferences,
  getClaudeAgentSdkAgentDefinition,
  getClaudeAgentSdkQueryWrapper,
} from '../source-analysis/index.js';

import { createDeclaredClaudeAgentSdkRelationships } from './declared-relationships.js';
import {
  addClaudeAgentSdkDiagnostic,
  analyzeClaudeAgentSdkBoundReference,
  createClaudeAgentSdkEvidence,
  isClaudeAgentSdkMachineString,
} from './common.js';
import { inspectClaudeAgentSdkHandoffs } from './handoffs.js';
import { inspectClaudeAgentSdkPackage } from './package-inspection.js';
import { inspectClaudeAgentSdkRelationships } from './relationships.js';
import { createClaudeAgentSdkInspectionSession } from './session.js';
import { inspectClaudeAgentSdkTools } from './tools.js';
import type { IClaudeAgentSdkInspectedAgent } from './types.js';

const inspectAgent = async (
  session: IClaudeAgentSdkInspectionSession,
  agent: IIndexedAgent,
  evidence: IClaudeAgentSdkEvidenceCollector,
  diagnostics: IRuntimeAdapterRecordCollector<IAdapterDiagnostic>,
): Promise<IClaudeAgentSdkInspectedAgent | null> => {
  const runtimeAgent = agent.declaration.bindings?.runtimeAgent;

  if (runtimeAgent === undefined) {
    return null;
  }

  await inspectClaudeAgentSdkPackage(session, runtimeAgent.path, evidence, diagnostics, agent.id);

  if (!isSupportedTypeScriptSourcePath(runtimeAgent.path)) {
    return null;
  }

  evidence.add(() =>
    createClaudeAgentSdkEvidence({
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
      source: CLAUDE_AGENT_SDK_ADAPTER_ID,
    }),
  );

  if (runtimeAgent.symbol === undefined) {
    return null;
  }

  const analysis = await analyzeClaudeAgentSdkBoundReference(
    session,
    runtimeAgent,
    diagnostics,
    agent.id,
  );

  if (analysis === null) {
    return null;
  }

  if (!analysis.exports.has(runtimeAgent.symbol)) {
    if (analysis.hasUnresolvedExports) return null;
    addClaudeAgentSdkDiagnostic(
      diagnostics,
      'CLAUDE_AGENT_SDK_RUNTIME_AGENT_SYMBOL_NOT_FOUND',
      runtimeAgent.path,
      agent.id,
    );
    return null;
  }

  const queryResult = getClaudeAgentSdkQueryWrapper(analysis, runtimeAgent.symbol);
  const runtimeSymbol = runtimeAgent.symbol;

  if (queryResult.kind === 'present-supported') {
    evidence.add(() =>
      createClaudeAgentSdkEvidence({
        agentId: agent.id,
        capabilityId: null,
        capabilityKind: null,
        details: { call: 'query', patternId: 'direct-query-wrapper' },
        kind: 'runtime-pattern',
        references: [
          {
            path: runtimeAgent.path,
            ...(runtimeAgent.symbol === undefined ? {} : { symbol: runtimeAgent.symbol }),
          },
        ],
        runtimeName: isClaudeAgentSdkMachineString(runtimeSymbol) ? runtimeSymbol : null,
        source: CLAUDE_AGENT_SDK_ADAPTER_ID,
      }),
    );

    return Object.freeze({
      agent,
      analysis,
      kind: 'query-wrapper',
      wrapper: queryResult.wrapper,
    });
  }

  const definitionResult = getClaudeAgentSdkAgentDefinition(analysis, runtimeAgent.symbol);

  if (definitionResult.kind !== 'present-supported') {
    return null;
  }

  const definition = applyClaudeAgentSdkAgentMutations(
    analysis,
    definitionResult.definition,
    collectClaudeAgentSdkAgentDefinitionReferences(analysis),
  );
  evidence.add(() =>
    createClaudeAgentSdkEvidence({
      agentId: agent.id,
      capabilityId: null,
      capabilityKind: null,
      details: { patternId: 'programmatic-agent-definition' },
      kind: 'agent-definition',
      references: [
        {
          path: runtimeAgent.path,
          ...(runtimeAgent.symbol === undefined ? {} : { symbol: runtimeAgent.symbol }),
        },
      ],
      runtimeName: isClaudeAgentSdkMachineString(runtimeSymbol) ? runtimeSymbol : null,
      source: CLAUDE_AGENT_SDK_ADAPTER_ID,
    }),
  );

  return Object.freeze({
    agent,
    analysis,
    definition,
    kind: 'programmatic-agent-definition',
  });
};

/**
 * Inspects all scoped Claude Agent SDK agents through one deterministic session.
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
export const inspectClaudeAgentSdk = async (
  context: IRuntimeAdapterContext,
): Promise<IRuntimeAdapterResult> => {
  context.signal?.throwIfAborted();
  const session = createClaudeAgentSdkInspectionSession(context);
  const collector = createRuntimeAdapterResultCollector(context);
  const relationships = createDeclaredClaudeAgentSdkRelationships(context, collector, session);
  const { evidence, diagnostics } = relationships;
  await relationships.inspectExports();
  await relationships.inspectInstructionSource();
  const inspectedAgents: IClaudeAgentSdkInspectedAgent[] = [];
  const inspected = await inspectAgent(session, context.agent, evidence, diagnostics);

  if (inspected !== null) {
    inspectedAgents.push(inspected);
  }

  if (inspected !== null) {
    context.signal?.throwIfAborted();
    await inspectClaudeAgentSdkRelationships(session, inspected, evidence, diagnostics);

    if (inspected.kind === 'query-wrapper') {
      inspectedAgents.push(
        ...(await inspectClaudeAgentSdkHandoffs(
          context,
          session,
          inspected,
          evidence,
          diagnostics,
        )),
      );
    }
  }

  await inspectClaudeAgentSdkTools(session, inspectedAgents, evidence, diagnostics);
  context.signal?.throwIfAborted();

  relationships.finalize();
  return collector.finalize();
};

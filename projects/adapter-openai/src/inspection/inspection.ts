import { createRuntimeAdapterResultCollector } from '@moldea.ai/core/adapter';
import type { IRuntimeAdapterRecordCollector } from '@moldea.ai/core/adapter';
import {
  getRuntimeExport,
  isSupportedTypeScriptSourcePath,
} from '@moldea.ai/adapter-static-analysis';
import type { IIndexedAgent } from '@moldea.ai/core/adapter';
import type {
  IAdapterDiagnostic,
  IRuntimeAdapterContext,
  IRuntimeAdapterResult,
} from '@moldea.ai/core/adapter';

import type { IOpenAiEvidenceCollector } from '../contracts/index.js';
import { OPENAI_ADAPTER_ID } from '../constants/index.js';
import type { IOpenAiInspectionSession } from '../contracts/index.js';
import { analyzeOpenAiResponses } from '../source-analysis/index.js';

import { createDeclaredOpenAiRelationships } from './declared-relationships.js';
import {
  addOpenAiDiagnostic,
  analyzeOpenAiBoundReference,
  createOpenAiEvidence,
} from './common.js';
import { inspectOpenAiPackage } from './package-inspection.js';
import { inspectOpenAiRelationships } from './relationships.js';
import { createOpenAiInspectionSession } from './session.js';

const inspectAgent = async (
  session: IOpenAiInspectionSession,
  agent: IIndexedAgent,
  evidence: IOpenAiEvidenceCollector,
  diagnostics: IRuntimeAdapterRecordCollector<IAdapterDiagnostic>,
): Promise<void> => {
  const runtimeAgent = agent.declaration.bindings?.runtimeAgent;

  if (runtimeAgent === undefined) {
    return;
  }

  await inspectOpenAiPackage(session, runtimeAgent.path, evidence, diagnostics, agent.id);

  if (!isSupportedTypeScriptSourcePath(runtimeAgent.path)) {
    return;
  }

  evidence.add(() =>
    createOpenAiEvidence({
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
      source: OPENAI_ADAPTER_ID,
    }),
  );

  if (runtimeAgent.symbol === undefined) {
    return;
  }

  const analysis = await analyzeOpenAiBoundReference(session, runtimeAgent, diagnostics, agent.id);

  if (analysis === null) {
    return;
  }

  const runtimeExport = getRuntimeExport(analysis, runtimeAgent.symbol);

  if (runtimeExport.kind === 'absent') {
    addOpenAiDiagnostic(
      diagnostics,
      'OPENAI_RUNTIME_AGENT_SYMBOL_NOT_FOUND',
      runtimeAgent.path,
      agent.id,
    );
    return;
  }

  if (runtimeExport.kind === 'present-unsupported' || runtimeExport.body === undefined) {
    return;
  }

  const responses = analyzeOpenAiResponses(analysis, runtimeExport.body, session.signal);

  if (responses.requests.length === 0) {
    return;
  }

  for (const methodName of [
    ...new Set(responses.requests.map((request) => request.methodName)),
  ].sort()) {
    evidence.add(() =>
      createOpenAiEvidence({
        agentId: agent.id,
        capabilityId: null,
        capabilityKind: null,
        details: { api: 'responses' },
        kind: 'runtime-pattern',
        references: [
          {
            path: runtimeAgent.path,
            ...(runtimeAgent.symbol === undefined ? {} : { symbol: runtimeAgent.symbol }),
          },
        ],
        runtimeName: `responses.${methodName}`,
        source: OPENAI_ADAPTER_ID,
      }),
    );
  }

  await inspectOpenAiRelationships(session, agent, analysis, responses, evidence, diagnostics);
};

/**
 * Inspects all scoped OpenAI agents through one operation-local deterministic session.
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
export const inspectOpenAi = async (
  context: IRuntimeAdapterContext,
): Promise<IRuntimeAdapterResult> => {
  context.signal?.throwIfAborted();
  const session = createOpenAiInspectionSession(context);
  const collector = createRuntimeAdapterResultCollector(context);
  const relationships = createDeclaredOpenAiRelationships(context, collector, session);
  const { evidence, diagnostics } = relationships;
  await relationships.inspectExports();
  await relationships.inspectInstructionSource();
  const agents = [context.agent];

  for (const agent of agents) {
    context.signal?.throwIfAborted();
    await inspectAgent(session, agent, evidence, diagnostics);
  }

  context.signal?.throwIfAborted();
  relationships.finalize();
  return collector.finalize();
};

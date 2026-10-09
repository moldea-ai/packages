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

import type { IGoogleGenAiEvidenceCollector } from '../contracts/index.js';
import { GOOGLE_GENAI_ADAPTER_ID } from '../constants/index.js';
import type { IGoogleGenAiInspectionSession } from '../contracts/index.js';
import { analyzeGoogleGenAiGenerateContent } from '../source-analysis/index.js';

import { createDeclaredGoogleGenAiRelationships } from './declared-relationships.js';
import {
  addGoogleGenAiDiagnostic,
  analyzeGoogleGenAiBoundReference,
  createGoogleGenAiEvidence,
} from './common.js';
import { inspectGoogleGenAiPackage } from './package-inspection.js';
import { inspectGoogleGenAiRelationships } from './relationships.js';
import { createGoogleGenAiInspectionSession } from './session.js';

const inspectAgent = async (
  session: IGoogleGenAiInspectionSession,
  agent: IIndexedAgent,
  evidence: IGoogleGenAiEvidenceCollector,
  diagnostics: IRuntimeAdapterRecordCollector<IAdapterDiagnostic>,
): Promise<void> => {
  const runtimeAgent = agent.declaration.bindings?.runtimeAgent;

  if (runtimeAgent === undefined) {
    return;
  }

  await inspectGoogleGenAiPackage(session, runtimeAgent.path, evidence, diagnostics, agent.id);

  if (!isSupportedTypeScriptSourcePath(runtimeAgent.path)) {
    return;
  }

  evidence.add(() =>
    createGoogleGenAiEvidence({
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
      source: GOOGLE_GENAI_ADAPTER_ID,
    }),
  );

  if (runtimeAgent.symbol === undefined) {
    return;
  }

  const analysis = await analyzeGoogleGenAiBoundReference(
    session,
    runtimeAgent,
    diagnostics,
    agent.id,
  );

  if (analysis === null) {
    return;
  }

  const runtimeExport = getRuntimeExport(analysis, runtimeAgent.symbol);

  if (runtimeExport.kind === 'absent') {
    addGoogleGenAiDiagnostic(
      diagnostics,
      'GOOGLE_GENAI_RUNTIME_AGENT_SYMBOL_NOT_FOUND',
      runtimeAgent.path,
      agent.id,
    );
    return;
  }

  if (runtimeExport.kind === 'present-unsupported' || runtimeExport.body === undefined) {
    return;
  }

  const generateContent = analyzeGoogleGenAiGenerateContent(
    analysis,
    runtimeExport.body,
    session.signal,
  );

  if (generateContent.requests.length === 0) {
    return;
  }

  for (const methodName of [
    ...new Set(generateContent.requests.map((request) => request.methodName)),
  ].sort()) {
    evidence.add(() =>
      createGoogleGenAiEvidence({
        agentId: agent.id,
        capabilityId: null,
        capabilityKind: null,
        details: { api: 'models' },
        kind: 'runtime-pattern',
        references: [
          {
            path: runtimeAgent.path,
            ...(runtimeAgent.symbol === undefined ? {} : { symbol: runtimeAgent.symbol }),
          },
        ],
        runtimeName: `models.${methodName}`,
        source: GOOGLE_GENAI_ADAPTER_ID,
      }),
    );
  }

  await inspectGoogleGenAiRelationships(
    session,
    agent,
    analysis,
    generateContent,
    evidence,
    diagnostics,
  );
};

/**
 * Inspects all scoped Google Gen AI agents through one deterministic operation-local session.
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
export const inspectGoogleGenAi = async (
  context: IRuntimeAdapterContext,
): Promise<IRuntimeAdapterResult> => {
  context.signal?.throwIfAborted();
  const session = createGoogleGenAiInspectionSession(context);
  const collector = createRuntimeAdapterResultCollector(context);
  const relationships = createDeclaredGoogleGenAiRelationships(context, collector, session);
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

import { RepositoryPathException, RepositorySourceException } from '@moldea.ai/repository';

import type {
  IRuntimeAdapterAgentResolution,
  IRuntimeAdapterContext,
  IRuntimeAdapterEvidence,
  IRuntimeAdapterRepository,
  IRuntimeAdapterResolvedAgent,
} from '../adapter/index.js';
import type { IIndexedAgent, IMoldeaProjectIndex } from '../contracts/index.js';
import {
  normalizeRuntimeAdapterEvidence,
  validateRuntimeAdapterResult,
  type IRuntimeAdapterOutputCounts,
} from '../adapter-validation/index.js';
import { normalizeDiagnostics } from '../diagnostic-utilities/index.js';
import type { IAdapterDiagnostic } from '../diagnostics/index.js';
import { CoreOperationException } from '../exceptions/index.js';
import { freezeRecursively } from '../immutable/index.js';
import type { ICoreOptionsSnapshot, IRuntimeAdapterSnapshot } from '../options/index.js';
import type { IRepositoryReference } from '../format/index.js';
import type { IRepositoryInspectionSession } from '../repository-inspection-session/index.js';

// complete normalized output from every applicable runtime adapter
export interface IRuntimeAdapterInspectionResult {
  readonly evidence: readonly IRuntimeAdapterEvidence[];
  readonly diagnostics: readonly IAdapterDiagnostic[];
}

const isInspectionBoundaryFailure = (error: unknown): boolean => {
  return (
    error instanceof RepositoryPathException ||
    error instanceof RepositorySourceException ||
    (error instanceof CoreOperationException &&
      error.operation === 'validate-project' &&
      (error.code === 'ABORTED' || error.code === 'RESOURCE_LIMIT_EXCEEDED'))
  );
};

interface IRuntimeAgentBindingEntry {
  readonly agent: IIndexedAgent;
  readonly resolved: IRuntimeAdapterResolvedAgent;
}

type IRuntimeAgentBindingResolution =
  | { readonly candidateCount: number; readonly kind: 'ambiguous' }
  | ({ readonly kind: 'matched' } & IRuntimeAgentBindingEntry);

type IRuntimeAgentBindingIndex = ReadonlyMap<string, IRuntimeAgentBindingResolution>;

const getRuntimeBindingKey = (reference: IRepositoryReference): string =>
  JSON.stringify([reference.path, reference.symbol ?? null]);

/** Builds one compact exact-binding index for a single configured runtime. */
const createRuntimeAgentBindingIndex = (
  agents: readonly IIndexedAgent[],
): IRuntimeAgentBindingIndex => {
  const candidates = new Map<string, IRuntimeAgentBindingResolution>();

  for (const agent of agents) {
    const runtimeAgent = agent.declaration.bindings?.runtimeAgent;

    if (runtimeAgent === undefined) {
      continue;
    }

    const key = getRuntimeBindingKey(runtimeAgent);
    const existing = candidates.get(key);

    if (existing !== undefined) {
      candidates.set(key, {
        candidateCount: existing.kind === 'matched' ? 2 : existing.candidateCount + 1,
        kind: 'ambiguous',
      });
      continue;
    }

    candidates.set(key, {
      agent,
      kind: 'matched',
      resolved: freezeRecursively({
        declaration: agent.declaration,
        description: agent.description,
        handoffDescription: agent.handoffDescription,
        id: agent.id,
      }),
    });
  }

  return candidates;
};

const invokeAdapter = async (
  adapter: IRuntimeAdapterSnapshot,
  agent: IIndexedAgent,
  agentBindings: IRuntimeAgentBindingIndex,
  project: IMoldeaProjectIndex,
  session: IRepositoryInspectionSession,
  options: ICoreOptionsSnapshot,
  outputCounts: IRuntimeAdapterOutputCounts,
  signal?: AbortSignal,
): Promise<IRuntimeAdapterInspectionResult> => {
  const scopedAgent = freezeRecursively(agent);
  const resolvedAgents = new Map<string, IIndexedAgent>([[scopedAgent.id, scopedAgent]]);
  const repository: IRuntimeAdapterRepository = session.adapterRepository;
  const resolveAgent = (reference: IRepositoryReference): IRuntimeAdapterAgentResolution => {
    const resolution = agentBindings.get(getRuntimeBindingKey(reference));

    if (resolution === undefined) {
      return Object.freeze({ kind: 'absent' });
    }

    if (resolution.kind === 'ambiguous') {
      return Object.freeze({
        candidateCount: resolution.candidateCount,
        kind: 'ambiguous',
      });
    }

    resolvedAgents.set(resolution.agent.id, resolution.agent);
    return Object.freeze({ agent: resolution.resolved, kind: 'matched' });
  };

  const context: IRuntimeAdapterContext = Object.freeze({
    agent: scopedAgent,
    repository,
    resolveAgent,
    ...(signal === undefined ? {} : { signal }),
  });

  let candidate: unknown;

  try {
    session.throwIfAborted();
    candidate = await adapter.inspect(context);
    session.throwIfAborted();
  } catch (error: unknown) {
    session.throwIfAborted();

    if (isInspectionBoundaryFailure(error)) {
      throw error;
    }

    throw new CoreOperationException({
      adapterId: adapter.id,
      cause: error,
      code: 'ADAPTER_EXECUTION_FAILED',
      operation: 'validate-project',
    });
  }

  return validateRuntimeAdapterResult(
    candidate,
    {
      adapterId: adapter.id,
      agents: [...resolvedAgents.values()],
      limits: options.limits,
      project,
      repository: session.adapterRepository,
      ...(signal === undefined ? {} : { signal }),
    },
    outputCounts,
  );
};

/**
 * Invokes every applicable configured adapter in canonical ID order.
 * @param project The complete frozen universal project index.
 * @param session The shared inspection reader, cache, and resource budget.
 * @param options The immutable Core adapter registry and resource limits.
 * @param signal Optional cancellation shared by the complete inspection.
 * @returns A promise resolving to normalized evidence and adapter diagnostics.
 * @throws
 * - INVALID_REPOSITORY_PATH: An adapter repository path is invalid.
 * - ENTRY_NOT_FOUND: A requested repository entry is absent.
 * - ENTRY_NOT_FILE: A requested repository entry is not a regular file.
 * - ENTRY_NOT_DIRECTORY: A requested repository entry is not a directory.
 * - ACCESS_DENIED: Access to the repository source was denied.
 * - SOURCE_UNAVAILABLE: The repository source is unavailable.
 * - SNAPSHOT_CHANGED: The repository snapshot changed during adapter inspection.
 * - INVALID_SOURCE_DATA: The repository reader returned invalid contract data.
 * - RESOURCE_LIMIT_EXCEEDED: A Core or repository resource limit was exceeded.
 * - ABORTED: Adapter inspection or a repository operation was aborted.
 * - ADAPTER_EXECUTION_FAILED: An adapter failed or returned an invalid result.
 */
export const inspectRuntimeAdapters = async (
  project: IMoldeaProjectIndex,
  session: IRepositoryInspectionSession,
  options: ICoreOptionsSnapshot,
  signal?: AbortSignal,
): Promise<IRuntimeAdapterInspectionResult> => {
  const evidence: IRuntimeAdapterEvidence[] = [];
  const diagnostics: IAdapterDiagnostic[] = [];
  const outputCounts: IRuntimeAdapterOutputCounts = { diagnostics: 0, evidence: 0 };
  const agentsByRuntimeId = new Map<string, IIndexedAgent[]>();

  for (const agent of project.agents) {
    const runtimeAgents = agentsByRuntimeId.get(agent.declaration.runtime.id);

    if (runtimeAgents === undefined) {
      agentsByRuntimeId.set(agent.declaration.runtime.id, [agent]);
    } else {
      runtimeAgents.push(agent);
    }
  }

  for (const adapter of options.adapters) {
    const agents = agentsByRuntimeId.get(adapter.id) ?? [];
    const agentBindings = createRuntimeAgentBindingIndex(agents);

    for (const agent of agents) {
      const result = await invokeAdapter(
        adapter,
        agent,
        agentBindings,
        project,
        session,
        options,
        outputCounts,
        signal,
      );
      evidence.push(...result.evidence);
      diagnostics.push(...result.diagnostics);
    }
  }

  return freezeRecursively({
    diagnostics: normalizeDiagnostics(diagnostics),
    evidence: normalizeRuntimeAdapterEvidence(evidence),
  });
};

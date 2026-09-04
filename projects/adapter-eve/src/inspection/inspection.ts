import type {
  IAdapterDiagnostic,
  IRuntimeAdapterContext,
  IRuntimeAdapterEvidence,
  IRuntimeAdapterResult,
} from '@moldea.ai/core/adapter';
import type { IRepositoryPath } from '@moldea.ai/repository';

import type { IEveAgentDefinition } from '../contracts/index.js';
import { inspectEveAgent } from './agent-inspection.js';
import { inspectEveInstructions } from './instruction-inspection.js';
import { createEveInspectionSession } from './session.js';
import { inspectEveSkills } from './skill-inspection.js';
import { inspectEveSubagents } from './subagent-inspection.js';
import { inspectEveTools } from './tool-inspection.js';

/**
 * Inspects all scoped Eve agents through one deterministic read-only session.
 * @param context The Core-provided immutable adapter context.
 * @returns A promise resolving to source-grounded evidence and diagnostics.
 * @throws
 * - INVALID_REPOSITORY_PATH: The repository path is invalid.
 * - ENTRY_NOT_FOUND: The requested repository entry was not found.
 * - ENTRY_NOT_FILE: The requested repository entry is not a file.
 * - ENTRY_NOT_DIRECTORY: The requested repository entry is not a directory.
 * - ACCESS_DENIED: Access to the repository source was denied.
 * - SOURCE_UNAVAILABLE: The repository source is unavailable.
 * - SNAPSHOT_CHANGED: The repository snapshot changed during the operation.
 * - INVALID_SOURCE_DATA: The repository source returned invalid data.
 * - RESOURCE_LIMIT_EXCEEDED: A repository reading resource limit was exceeded.
 * - ABORTED: The repository operation or inspection signal was aborted.
 */
export const inspectEve = async (
  context: IRuntimeAdapterContext,
): Promise<IRuntimeAdapterResult> => {
  context.signal?.throwIfAborted();
  const session = createEveInspectionSession(context);
  const evidence: IRuntimeAdapterEvidence[] = [];
  const diagnostics: IAdapterDiagnostic[] = [];
  const definitions: IEveAgentDefinition[] = [];
  const definition = await inspectEveAgent(session, context.agent, evidence, diagnostics);

  if (definition !== null) {
    definitions.push(definition);
  }

  const preparedToolNames = new Map<string, ReadonlySet<string>>();

  if (definition !== null) {
    context.signal?.throwIfAborted();
    await inspectEveInstructions(session, definition, evidence, diagnostics);
    preparedToolNames.set(
      definition.agent.id,
      await inspectEveTools(session, definition, evidence, diagnostics),
    );
    await inspectEveSkills(session, definition, evidence, diagnostics);
  }

  const ambiguousParentRoots = new Map<IRepositoryPath, number>();

  if (definition?.root.agentKind === 'root') {
    const runtimeAgent = definition.agent.declaration.bindings?.runtimeAgent;

    if (runtimeAgent !== undefined) {
      const parentResolution = context.resolveAgent(runtimeAgent);

      if (parentResolution.kind === 'ambiguous') {
        ambiguousParentRoots.set(definition.root.agentRoot, parentResolution.candidateCount);
      }
    }

    for (const candidate of definition.rootIndex.subagentCandidates) {
      if (!candidate.isDirectoryBacked || candidate.isExtensionReserved) {
        continue;
      }

      const resolution = context.resolveAgent({ path: candidate.agentPath, symbol: 'default' });

      if (resolution.kind !== 'matched' || resolution.agent.id === definition.agent.id) {
        continue;
      }

      const relatedDefinition = await inspectEveAgent(session, resolution.agent, [], []);

      if (relatedDefinition !== null) {
        definitions.push(relatedDefinition);
      }
    }
  }

  context.signal?.throwIfAborted();
  inspectEveSubagents(definitions, preparedToolNames, ambiguousParentRoots, evidence, diagnostics);

  return Object.freeze({
    diagnostics: Object.freeze(diagnostics),
    evidence: Object.freeze(evidence),
  });
};

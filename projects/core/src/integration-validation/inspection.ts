import type { ICoreResourceLimits } from '../contracts/index.js';
import { createCoreDiagnosticCollector } from '../diagnostic-utilities/index.js';
import type { ICoreDiagnostic } from '../diagnostics/index.js';
import type {
  IRepositoryInspectionReader,
  IRepositoryInstructionView,
} from '../repository-inspection-session/index.js';
import { getRetainedMemory } from '../retained-memory/index.js';

import { inspectAgentsIntegration } from './agents-inspection.js';
import { inspectClaudeIntegration } from './claude-inspection.js';
import type { IIntegrationInspectionContext } from './types.js';

/**
 * Checks the coding-agent integration: root AGENTS.md and the Claude Code instruction files
 * through the instruction view, and the referenced skill installation through the repository
 * reader, with at most six entry lookups, four link resolutions, and five bounded reads.
 * @param reader The repository inspection reader for skill files and the managed asset.
 * @param instructions The instruction view for the coding-agent instruction paths.
 * @param limits The immutable resource limits for the inspection.
 * @param signal Optional cancellation for repository lookups.
 * @returns Completed content-free integration warnings, never an execution or runtime-wiring claim.
 * @throws
 * - RESOURCE_LIMIT_EXCEEDED: A Core resource limit was exceeded.
 * - RESOURCE_LIMIT_EXCEEDED: A named repository resource limit was exceeded.
 * - ABORTED: The Core operation was aborted.
 * - ABORTED: The repository operation was aborted.
 * - ACCESS_DENIED: Access to the repository source was denied.
 * - SOURCE_UNAVAILABLE: The repository source is unavailable.
 * - SNAPSHOT_CHANGED: The repository snapshot changed during the operation.
 * - INVALID_SOURCE_DATA: The repository source returned invalid data.
 */
export const inspectCodingAgentIntegration = async (
  reader: IRepositoryInspectionReader,
  instructions: IRepositoryInstructionView,
  limits: ICoreResourceLimits,
  signal?: AbortSignal,
): Promise<readonly ICoreDiagnostic[]> => {
  const collector = createCoreDiagnosticCollector(limits, 'validate-project');
  const context: IIntegrationInspectionContext = {
    instructions,
    ledger: getRetainedMemory(reader),
    reader,
    report: (code, subject, details) => {
      collector.add({
        code,
        path: subject,
        subject,
        qualifier: null,
        entity: { integrationPath: subject },
        details,
      });
    },
    ...(signal === undefined ? {} : { signal }),
  };
  const agents = await inspectAgentsIntegration(context);
  await inspectClaudeIntegration(context, agents);
  return collector.finalize();
};

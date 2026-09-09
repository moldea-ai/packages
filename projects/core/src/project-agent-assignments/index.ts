import type { IMoldeaProjectIndex, IProjectAgentAssignmentItem } from '../contracts/index.js';
import { compareExactStrings } from '../format-validation/index.js';

/** Collects deterministic content-free agent-to-runtime assignments from a validated project. */
export const collectProjectAgentAssignments = (
  project: IMoldeaProjectIndex,
): readonly IProjectAgentAssignmentItem[] =>
  project.agents
    .map((agent) => ({
      agentId: agent.id,
      runtimeId: agent.declaration.runtime.id,
    }))
    .sort(
      (left, right) =>
        compareExactStrings(left.agentId, right.agentId) ||
        compareExactStrings(left.runtimeId, right.runtimeId),
    );

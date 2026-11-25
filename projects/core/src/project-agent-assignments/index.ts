import type { IMoldeaProjectIndex, IProjectAgentAssignmentItem } from '../contracts/index.js';

/** Iterates content-free agent identities without retaining an intermediate array. */
export const iterateProjectAgentAssignments = function* (
  project: IMoldeaProjectIndex,
): IterableIterator<IProjectAgentAssignmentItem> {
  for (const agent of project.agents) {
    yield {
      agentId: agent.id,
    };
  }
};

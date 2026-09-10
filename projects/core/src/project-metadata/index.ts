import type {
  IIndexedTextAsset,
  IMoldeaProjectIndex,
  IProjectMetadataItem,
  IProjectValidationSummary,
} from '../contracts/index.js';

const createAssetItem = (
  asset: IIndexedTextAsset,
  kind: IProjectMetadataItem['kind'],
  agentId: string | null = null,
  decisionId: string | null = null,
): IProjectMetadataItem => ({
  agentId,
  byteLength: asset.utf8ByteLength,
  canonicalDigest: null,
  decisionId,
  digest: asset.digest,
  kind,
  path: asset.path,
  scalarLength: asset.scalarLength,
});

/** Iterates content-free asset metadata without retaining a second project-sized collection. */
export const iterateProjectMetadata = function* (
  project: IMoldeaProjectIndex,
): IterableIterator<IProjectMetadataItem> {
  yield createAssetItem(project.manifest.asset, 'manifest');
  yield createAssetItem(project.project, 'project');

  for (const context of project.context) {
    yield createAssetItem(context.asset, 'context');
  }

  for (const { decision } of project.decisions) {
    yield createAssetItem(decision.asset, 'decision', null, decision.id);
  }

  for (const runtime of project.runtimes) {
    yield createAssetItem(runtime.asset, 'runtime-guidance');
  }

  for (const agent of project.agents) {
    yield createAssetItem(agent.description.asset, 'agent-description', agent.id);
    yield createAssetItem(agent.instruction, 'agent-instruction', agent.id);

    if (agent.handoffDescription !== null) {
      yield createAssetItem(agent.handoffDescription.asset, 'agent-handoff-description', agent.id);
    }

    for (const mirror of agent.mirrors) {
      yield {
        agentId: agent.id,
        byteLength: mirror.byteLength,
        canonicalDigest: mirror.canonicalDigest,
        decisionId: null,
        digest: mirror.digest,
        kind: 'mirror',
        path: mirror.path,
        scalarLength: mirror.scalarLength,
      };
    }
  }
};

/** Creates the content-free summary for one validated project snapshot. */
export const createProjectSummary = (project: IMoldeaProjectIndex): IProjectValidationSummary =>
  ({
    counts: {
      agents: project.agents.length,
      context: project.context.length,
      decisions: project.decisions.length,
      mirrors: project.agents.reduce((count, agent) => count + agent.mirrors.length, 0),
      runtimes: project.runtimes.length,
      unresolved: Object.keys(project.unresolved).length,
    },
    manifestDigest: project.manifest.asset.digest,
    manifestPath: project.manifest.asset.path,
    projectDigest: project.project.digest,
    projectPath: project.project.path,
  }) satisfies IProjectValidationSummary;

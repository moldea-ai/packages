import type {
  IIndexedTextAsset,
  IMoldeaProjectIndex,
  IProjectMetadataItem,
  IProjectValidationSummary,
} from '../contracts/index.js';
import { compareExactStrings } from '../format-validation/index.js';

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

const compareMetadataItems = (left: IProjectMetadataItem, right: IProjectMetadataItem): number =>
  compareExactStrings(left.path, right.path) ||
  compareExactStrings(left.kind, right.kind) ||
  compareExactStrings(left.agentId ?? '', right.agentId ?? '');

/** Collects deterministic content-free asset metadata from one validated project. */
export const collectProjectMetadata = (
  project: IMoldeaProjectIndex,
): readonly IProjectMetadataItem[] => {
  const items: IProjectMetadataItem[] = [
    createAssetItem(project.manifest.asset, 'manifest'),
    createAssetItem(project.project, 'project'),
  ];

  for (const context of project.context) {
    items.push(createAssetItem(context.asset, 'context'));
  }

  for (const { decision } of project.decisions) {
    items.push(createAssetItem(decision.asset, 'decision', null, decision.id));
  }

  for (const runtime of project.runtimes) {
    items.push(createAssetItem(runtime.asset, 'runtime-guidance'));
  }

  for (const agent of project.agents) {
    items.push(createAssetItem(agent.description.asset, 'agent-description', agent.id));
    items.push(createAssetItem(agent.instruction, 'agent-instruction', agent.id));

    if (agent.handoffDescription !== null) {
      items.push(
        createAssetItem(agent.handoffDescription.asset, 'agent-handoff-description', agent.id),
      );
    }

    for (const mirror of agent.mirrors) {
      items.push({
        agentId: agent.id,
        byteLength: mirror.byteLength,
        canonicalDigest: mirror.canonicalDigest,
        decisionId: null,
        digest: mirror.digest,
        kind: 'mirror',
        path: mirror.path,
        scalarLength: mirror.scalarLength,
      });
    }
  }

  return items.sort(compareMetadataItems);
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

import { compareCodePoints, deepFreeze } from 'jg-utilities';

import { parseRepositoryPath, type IRepositoryPath } from '@moldea.ai/repository';

import {
  validateAgentDescription,
  validateAgentInstruction,
} from '../agent-asset-validation/index.js';
import type { ICanonicalDiscoveryResult } from '../canonical-discovery/index.js';
import type { IIndexedDescriptionAsset, IIndexedTextAsset } from '../contracts/index.js';
import {
  createCoreDiagnosticCollector,
  type ICoreDiagnosticCollector,
} from '../diagnostic-utilities/index.js';
import type { ICoreDiagnostic } from '../diagnostics/index.js';
import type { IAgentManifestEntry, IMoldeaManifestV1 } from '../format/index.js';
import { createCoreOperationOptionsSnapshot, type ICoreOptionsSnapshot } from '../options/index.js';
import type { IRepositoryInspectionReader } from '../repository-inspection-session/index.js';
import { readRepositoryTextAsset } from '../repository-text/index.js';

// internal agent assets retained even when later validation is still required
export interface IInspectedAgentAssets {
  readonly id: string;
  readonly declaration: IAgentManifestEntry;
  readonly description: IIndexedDescriptionAsset | null;
  readonly instruction: IIndexedTextAsset | null;
}

// internal reconciliation result retained for final project indexing
export interface IAgentAssetInspectionResult {
  readonly valid: boolean;
  readonly agents: readonly IInspectedAgentAssets[];
  readonly diagnostics: readonly ICoreDiagnostic[];
}

const addDiagnostics = (
  collector: ICoreDiagnosticCollector,
  diagnostics: readonly ICoreDiagnostic[],
): void => {
  for (const diagnostic of diagnostics) {
    collector.merge(diagnostic);
  }
};

const isBlockedPath = (path: IRepositoryPath, blockedPaths: ReadonlySet<string>): boolean => {
  let candidate: string = path;

  while (candidate.length > 0) {
    if (blockedPaths.has(candidate)) {
      return true;
    }

    const separatorIndex = candidate.lastIndexOf('/');
    if (separatorIndex <= 0) {
      return false;
    }

    candidate = candidate.slice(0, separatorIndex);
  }

  return false;
};

/** Reads and validates the required description asset. */
const readDescription = async (
  repository: IRepositoryInspectionReader,
  path: IRepositoryPath,
  agentId: string,
  options: ICoreOptionsSnapshot,
  collector: ICoreDiagnosticCollector,
  signal?: AbortSignal,
): Promise<IIndexedDescriptionAsset | null> => {
  const readResult = await readRepositoryTextAsset(repository, path, options.limits, signal);
  addDiagnostics(collector, readResult.diagnostics);

  if (readResult.asset === null) {
    return null;
  }

  const validation = validateAgentDescription(readResult.asset, agentId, options.limits);
  addDiagnostics(collector, validation.diagnostics);

  return validation.description;
};

/** Reads and validates a mandatory instruction asset. */
const readInstruction = async (
  repository: IRepositoryInspectionReader,
  path: IRepositoryPath,
  agentId: string,
  options: ICoreOptionsSnapshot,
  collector: ICoreDiagnosticCollector,
  signal?: AbortSignal,
): Promise<IIndexedTextAsset | null> => {
  const readResult = await readRepositoryTextAsset(repository, path, options.limits, signal);
  addDiagnostics(collector, readResult.diagnostics);

  if (readResult.asset === null) {
    return null;
  }

  const validation = validateAgentInstruction(readResult.asset, agentId, options.limits);
  addDiagnostics(collector, validation.diagnostics);

  return validation.instruction;
};

/**
 * Reconciles registered agents with their convention-owned directories and Markdown assets.
 * @param repository The coherent source-neutral repository reader.
 * @param manifest The normalized manifest containing registered agents.
 * @param discovery The canonical inventory and path-owned structural diagnostics.
 * @param options The immutable Core configuration snapshot.
 * @param signal Optional cancellation forwarded to every repository read.
 * @returns Deeply immutable registered-agent assets and deterministic diagnostics.
 * @throws
 * - ENTRY_NOT_FOUND: A discovered agent asset disappeared from the reader snapshot.
 * - ENTRY_NOT_FILE: A discovered agent asset is no longer a regular file.
 * - ACCESS_DENIED: Access to the repository source was denied.
 * - SOURCE_UNAVAILABLE: The repository source is unavailable.
 * - SNAPSHOT_CHANGED: The repository snapshot changed during agent reads.
 * - INVALID_SOURCE_DATA: The repository reader returned invalid contract data.
 * - RESOURCE_LIMIT_EXCEEDED: A Core or repository resource limit was exceeded.
 * - ABORTED: Agent inspection or a repository operation was aborted.
 */
export const inspectAgentAssets = async (
  repository: IRepositoryInspectionReader,
  manifest: IMoldeaManifestV1,
  discovery: ICanonicalDiscoveryResult,
  options: ICoreOptionsSnapshot,
  signal?: AbortSignal,
): Promise<IAgentAssetInspectionResult> => {
  options = createCoreOperationOptionsSnapshot(options);
  const collector = createCoreDiagnosticCollector(options.limits, 'validate-project');
  const agents: IInspectedAgentAssets[] = [];
  const registeredAgents = manifest.agents ?? {};
  const registeredIds = new Set(Object.keys(registeredAgents));
  const discoveredById = new Map(
    discovery.inventory.agents.map((agent) => [agent.id, agent] as const),
  );
  const blockedPaths = new Set(
    discovery.diagnostics.flatMap((diagnostic) =>
      diagnostic.path === null ? [] : [diagnostic.path],
    ),
  );

  for (const discovered of discovery.inventory.agents) {
    if (!registeredIds.has(discovered.id)) {
      collector.add({
        code: 'MOLDEA_AGENT_DIRECTORY_UNREGISTERED',
        entity: { agentId: discovered.id },
        path: discovered.path,
      });
    }
  }

  for (const agentId of [...registeredIds].sort(compareCodePoints)) {
    const declaration = registeredAgents[agentId];

    if (declaration === undefined) {
      continue;
    }

    const discovered = discoveredById.get(agentId);

    if (discovered === undefined) {
      const directoryPath = parseRepositoryPath(`/moldea/agents/${agentId}`);

      if (!isBlockedPath(directoryPath, blockedPaths)) {
        collector.add({
          code: 'MOLDEA_AGENT_DIRECTORY_MISSING',
          entity: { agentId },
          path: directoryPath,
        });
      }

      agents.push({
        declaration,
        description: null,
        id: agentId,
        instruction: null,
      });
      continue;
    }

    let description: IIndexedDescriptionAsset | null = null;
    let instruction: IIndexedTextAsset | null = null;

    if (discovered.description === null) {
      const path = parseRepositoryPath(`${discovered.path}/description.md`);
      if (!isBlockedPath(path, blockedPaths)) {
        collector.add({
          code: 'MOLDEA_AGENT_DESCRIPTION_MISSING',
          entity: { agentId },
          path,
        });
      }
    } else {
      description = await readDescription(
        repository,
        discovered.description,
        agentId,
        options,
        collector,
        signal,
      );
    }

    if (discovered.instruction === null) {
      const path = parseRepositoryPath(`${discovered.path}/instruction.md`);
      if (!isBlockedPath(path, blockedPaths)) {
        collector.add({
          code: 'MOLDEA_AGENT_INSTRUCTION_MISSING',
          entity: { agentId },
          path,
        });
      }
    } else {
      instruction = await readInstruction(
        repository,
        discovered.instruction,
        agentId,
        options,
        collector,
        signal,
      );
    }

    agents.push({
      declaration,
      description,
      id: agentId,
      instruction,
    });
  }

  const diagnostics = collector.finalize();

  return deepFreeze({
    agents,
    diagnostics,
    valid: diagnostics.length === 0,
  });
};

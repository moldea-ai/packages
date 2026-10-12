import {
  parseRepositoryPath,
  RepositorySourceException,
  type IRepositoryPath,
} from '@moldea.ai/repository';

import type { ICoreResourceLimits } from '../contracts/index.js';
import { createCoreDiagnosticCollector } from '../diagnostic-utilities/index.js';
import type { ICoreDiagnostic, IDiagnosticEntity } from '../diagnostics/index.js';
import { CoreOperationException } from '../exceptions/index.js';
import type { IMoldeaManifestV1 } from '../format/index.js';
import { parseDecisionIdFromPath } from '../format-validation/index.js';
import type { IRepositoryInspectionReader } from '../repository-inspection-session/index.js';
import {
  collectManifestScopeDeclarations,
  matchesRepositoryGlob,
  type IManifestScopeOwner,
} from '../scope-matching/index.js';

type IDeclaration = ReturnType<typeof collectManifestScopeDeclarations>[number];
interface IPattern {
  declaration: IDeclaration;
  pattern: string;
  segments: string[];
}

/** Identifies the canonical document owning an impact relationship. */
const getOwner = (
  owner: IManifestScopeOwner,
): { subject: IRepositoryPath; entity: IDiagnosticEntity } => {
  if (owner.kind === 'context')
    return {
      subject: parseRepositoryPath(owner.id),
      entity: { contextPath: parseRepositoryPath(owner.id) },
    };
  if (owner.kind === 'decision')
    return {
      subject: parseRepositoryPath(owner.id),
      entity: { decisionId: parseDecisionIdFromPath(parseRepositoryPath(owner.id)) ?? owner.id },
    };
  const agentId = owner.agentId ?? owner.id;
  return {
    subject: parseRepositoryPath(`/moldea/agents/${agentId}/instruction.md`),
    entity: {
      agentId,
      ...(owner.kind === 'tool' || owner.kind === 'skill'
        ? { capabilityId: owner.id, capabilityKind: owner.kind }
        : {}),
    },
  };
};

/** Groups patterns by their complete fixed directory prefix to share source traversal. */
const groupPatterns = (manifest: IMoldeaManifestV1): Map<IRepositoryPath, IPattern[]> => {
  const groups = new Map<IRepositoryPath, IPattern[]>();
  for (const declaration of collectManifestScopeDeclarations(manifest)) {
    if (declaration.field !== 'affectedBy' || declaration.declaration.kind !== 'glob') continue;
    const pattern = declaration.declaration.pattern;
    const segments = pattern.slice(1).split('/');
    const wildcard = segments.findIndex((segment) => segment.includes('*'));
    const prefix = parseRepositoryPath('/' + segments.slice(0, wildcard).join('/'));
    const group = groups.get(prefix) ?? [];
    group.push({ declaration, pattern, segments });
    groups.set(prefix, group);
  }
  return groups;
};

/**
 * Checks globs only after required inspection, sharing bounded traversals and stopping on matches.
 * @returns Completed warnings, or no warnings when any traversal exhausts its resource budget.
 * @throws
 * - ABORTED: The Core operation was aborted.
 * - ABORTED: The repository operation was aborted.
 * - ENTRY_NOT_FOUND: The requested repository entry was not found.
 * - ENTRY_NOT_DIRECTORY: The requested repository entry is not a directory.
 * - PROVIDER_INCOMPLETE: The repository provider cannot expose a complete result.
 * - ACCESS_DENIED: Access to the repository source was denied.
 * - SOURCE_UNAVAILABLE: The repository source is unavailable.
 * - SNAPSHOT_CHANGED: The repository snapshot changed during the operation.
 * - INVALID_SOURCE_DATA: The repository source returned invalid data.
 * - RESOURCE_LIMIT_EXCEEDED: A Core resource limit was exceeded.
 */
export const inspectImpactPatterns = async (
  reader: IRepositoryInspectionReader,
  manifest: IMoldeaManifestV1,
  limits: ICoreResourceLimits,
  signal?: AbortSignal,
): Promise<{ completed: boolean; diagnostics: readonly ICoreDiagnostic[] }> => {
  const unmatched: IPattern[] = [];
  try {
    for (const [prefix, patterns] of groupPatterns(manifest)) {
      const pending = new Set(patterns);
      const entry = await reader.getEntry(prefix, signal === undefined ? undefined : { signal });
      if (entry?.type === 'directory') {
        for await (const candidate of reader.iterateEntries({
          prefix,
          ...(signal === undefined ? {} : { signal }),
        })) {
          if (candidate.type !== 'file') continue;
          for (const pattern of pending)
            if (matchesRepositoryGlob(pattern.segments, candidate.path)) pending.delete(pattern);
          if (pending.size === 0) break;
        }
      }
      unmatched.push(...pending);
    }
  } catch (error) {
    if (
      (error instanceof CoreOperationException && error.code === 'RESOURCE_LIMIT_EXCEEDED') ||
      (error instanceof RepositorySourceException && error.code === 'RESOURCE_LIMIT_EXCEEDED')
    )
      return { completed: false, diagnostics: [] };
    throw error;
  }
  const collector = createCoreDiagnosticCollector(limits, 'validate-project');
  for (const { declaration, pattern } of unmatched) {
    const { subject, entity } = getOwner(declaration.owner);
    collector.add({
      code: 'MOLDEA_IMPACT_PATTERN_UNMATCHED',
      path: parseRepositoryPath('/moldea/moldea.yaml'),
      pointer: declaration.pointer,
      subject,
      qualifier: pattern,
      entity,
      details: { pattern, owner: subject },
    });
  }
  return { completed: true, diagnostics: collector.finalize() };
};

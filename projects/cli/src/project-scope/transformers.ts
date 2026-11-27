import type { IManifestScopeOwner } from '@moldea.ai/core';

import type { IJsonValue } from '../json-serialization/index.js';
import { calculateMoldeaCliJsonDigest, createMoldeaCliRecordKey } from '../output-page/index.js';
import { createMoldeaCliDiagnosticRecord } from '../presentation/index.js';

import type {
  IMoldeaCliProjectScopeExecutionResult,
  IMoldeaCliScopeOwnerRecord,
  IMoldeaCliScopeProjection,
  IMoldeaCliScopeRelationship,
} from './types.js';

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const getOwnerPath = ({ kind, id, agentId }: IManifestScopeOwner): string =>
  kind === 'context' || kind === 'decision' ? id : `/moldea/agents/${agentId ?? id}/instruction.md`;

/** Projects all Core matches into one row per owner and one entry per matched declaration. */
export const createMoldeaCliScopeProjection = (
  execution: IMoldeaCliProjectScopeExecutionResult,
): IMoldeaCliScopeProjection => {
  const { scope } = execution;
  const owners = new Map<
    string,
    {
      owner: IManifestScopeOwner;
      path: string;
      relationships: Map<string, IMoldeaCliScopeRelationship>;
    }
  >();
  for (const { owner, field, declaration } of scope.matches) {
    const ownerKey = JSON.stringify([owner.kind, owner.agentId, owner.id]);
    let group = owners.get(ownerKey);
    if (group === undefined) {
      group = { owner, path: getOwnerPath(owner), relationships: new Map() };
      owners.set(ownerKey, group);
    }
    const path = declaration.kind === 'exact' ? declaration.path : declaration.pattern;
    const relationshipKey = JSON.stringify([field, path]);
    if (!group.relationships.has(relationshipKey)) {
      group.relationships.set(relationshipKey, { field, path });
    }
  }
  const diagnostics = scope.diagnostics.map(createMoldeaCliDiagnosticRecord);
  const matches = [...owners.values()]
    .sort(
      (left, right) =>
        compareText(left.path, right.path) ||
        compareText(left.owner.kind, right.owner.kind) ||
        compareText(left.owner.id, right.owner.id),
    )
    .map(({ owner, path, relationships }, index): IMoldeaCliScopeOwnerRecord => ({
      key: createMoldeaCliRecordKey(diagnostics.length + index),
      kind: 'match',
      path,
      ownerKind: owner.kind,
      ...(owner.kind === 'tool' || owner.kind === 'skill' ? { capabilityId: owner.id } : {}),
      relationships: [...relationships.values()].sort(
        (left, right) => compareText(left.field, right.field) || compareText(left.path, right.path),
      ),
    }));
  const records = Object.freeze([...diagnostics, ...matches]);
  const snapshotDigest = calculateMoldeaCliJsonDigest({
    inputDigest: scope.inputDigest,
    manifestDigest: scope.manifestDigest,
    records,
    valid: scope.valid,
  } as unknown as IJsonValue);

  return Object.freeze({
    canonicalBodies: Object.freeze([execution.manifestContent]),
    counts: Object.freeze({
      ...scope.counts,
      diagnostics: scope.diagnostics.length,
    }),
    inputDigest: scope.inputDigest,
    records,
    relevant: scope.relevant,
    snapshotDigest,
    valid: scope.valid,
  });
};

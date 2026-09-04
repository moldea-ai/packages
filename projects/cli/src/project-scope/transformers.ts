import type { IManifestScopeMatch } from '@moldea.ai/core';

import { calculateMoldeaCliJsonDigest } from '../output-page/index.js';
import { createMoldeaCliDiagnosticRecord } from '../presentation/index.js';
import type { IJsonValue } from '../json-serialization/index.js';

import type {
  IMoldeaCliScopeProjection,
  IMoldeaCliScopeRecord,
  IMoldeaCliProjectScopeExecutionResult,
} from './types.js';

const compareKeys = (left: IMoldeaCliScopeRecord, right: IMoldeaCliScopeRecord): number =>
  left.key < right.key ? -1 : left.key > right.key ? 1 : 0;

/** Creates one stable key for a relationship-match projection. */
const createMatchKey = (match: IManifestScopeMatch): string =>
  JSON.stringify([
    'match',
    match.owner.kind,
    match.owner.agentId,
    match.owner.id,
    match.field,
    match.declaration.kind === 'exact' ? match.declaration.path : match.declaration.pattern,
    match.inputPath,
    match.pointer,
  ]);

/** Projects complete Core scope output into ordered content-free CLI records. */
export const createMoldeaCliScopeProjection = (
  execution: IMoldeaCliProjectScopeExecutionResult,
): IMoldeaCliScopeProjection => {
  const records: IMoldeaCliScopeRecord[] = [
    ...execution.scope.diagnostics.map((diagnostic, index) =>
      createMoldeaCliDiagnosticRecord(diagnostic, index),
    ),
    ...execution.scope.matches.map((match): IMoldeaCliScopeRecord => ({
      key: createMatchKey(match),
      kind: 'match',
      match,
    })),
  ].sort(compareKeys);
  const snapshotDigest = calculateMoldeaCliJsonDigest({
    inputDigest: execution.scope.inputDigest,
    manifestDigest: execution.scope.manifestDigest,
    records,
    valid: execution.scope.valid,
  } as unknown as IJsonValue);

  return Object.freeze({
    canonicalBodies: Object.freeze([execution.manifestContent]),
    counts: Object.freeze({
      ...execution.scope.counts,
      diagnostics: execution.scope.diagnostics.length,
    }),
    inputDigest: execution.scope.inputDigest,
    manifestDigest: execution.scope.manifestDigest,
    records: Object.freeze(records),
    relevant: execution.scope.relevant,
    snapshotDigest,
    valid: execution.scope.valid,
  });
};

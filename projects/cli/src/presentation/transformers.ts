import type {
  IDiagnostic,
  IProjectInspectionItem,
  IProjectInspectionPageResult,
  IProjectValidationResult,
} from '@moldea.ai/core';

import type { IJsonValue } from '../json-serialization/index.js';
import { calculateMoldeaCliJsonDigest } from '../output-page/index.js';

import { MOLDEA_CLI_GIT_WORKING_TREE_SOURCE } from './constants.js';
import type {
  IMoldeaCliDiagnosticRecord,
  IMoldeaCliEvidenceRecord,
  IMoldeaCliInspectProjection,
  IMoldeaCliInspectProjectMetadata,
  IMoldeaCliInspectRecord,
  IMoldeaCliMetadataRecord,
  IMoldeaCliValidateProjection,
} from './types.js';

/** Rejects a Core validation result whose completion fields contradict its validity. */
const assertProjectValidationInvariant = (validation: IProjectValidationResult): void => {
  const isConsistent = validation.valid
    ? validation.summary !== null && validation.diagnostics.length === 0
    : validation.diagnostics.length > 0;

  if (!isConsistent) {
    throw new TypeError('The Core validation result is internally inconsistent.');
  }
};

/** Creates one stable composite record key. */
const createRecordKey = (kind: string, ...parts: readonly unknown[]): string =>
  JSON.stringify([kind, ...parts]);

/** Projects one diagnostic without retaining arbitrary detail payloads. */
export const createMoldeaCliDiagnosticRecord = (
  diagnostic: IDiagnostic,
  occurrence = 0,
): IMoldeaCliDiagnosticRecord =>
  Object.freeze({
    code: diagnostic.code,
    entity: diagnostic.entity,
    key: createRecordKey(
      'diagnostic',
      diagnostic.source,
      diagnostic.code,
      diagnostic.path,
      diagnostic.pointer,
      occurrence,
    ),
    kind: 'diagnostic',
    message: diagnostic.message,
    path: diagnostic.path,
    pointer: diagnostic.pointer,
    range: diagnostic.range,
    source: diagnostic.source,
  });

/** Projects one bounded Core inspection item through the schema 4 allowlist. */
const createInspectRecord = (
  item: IProjectInspectionItem,
  index: number,
): IMoldeaCliInspectRecord => {
  const order = index.toString().padStart(6, '0');

  if (item.kind === 'diagnostic') {
    return Object.freeze({
      ...createMoldeaCliDiagnosticRecord(item.diagnostic, index),
      key: createRecordKey(order, 'diagnostic', item.diagnostic.source, item.diagnostic.code),
    });
  }

  if (item.kind === 'evidence') {
    const evidence = item.evidence;
    const record: IMoldeaCliEvidenceRecord = {
      agentId: evidence.agentId,
      capabilityId: evidence.capabilityId,
      capabilityKind: evidence.capabilityKind,
      evidenceKind: evidence.kind,
      key: createRecordKey(
        order,
        'evidence',
        evidence.source,
        evidence.kind,
        evidence.agentId,
        evidence.capabilityKind,
        evidence.capabilityId,
        evidence.runtimeName,
      ),
      kind: 'evidence',
      references: Object.freeze(
        evidence.references.map((reference) =>
          Object.freeze({ path: reference.path, symbol: reference.symbol ?? null }),
        ),
      ),
      runtimeName: evidence.runtimeName,
      source: evidence.source,
    };

    return Object.freeze(record);
  }

  const metadata = item.metadata;
  const record: IMoldeaCliMetadataRecord = {
    agentId: metadata.agentId,
    byteLength: metadata.byteLength,
    canonicalDigest: metadata.canonicalDigest,
    decisionId: metadata.decisionId,
    digest: metadata.digest,
    key: createRecordKey(order, 'metadata', metadata.path, metadata.kind, metadata.agentId),
    kind: 'metadata',
    metadataKind: metadata.kind,
    path: metadata.path,
    scalarLength: metadata.scalarLength,
  };

  return Object.freeze(record);
};

/** Creates content-free validation metadata and ordered diagnostic records. */
export const createMoldeaCliValidateProjection = (
  validation: IProjectValidationResult,
): IMoldeaCliValidateProjection => {
  assertProjectValidationInvariant(validation);
  const diagnostics = Object.freeze(
    validation.diagnostics
      .map((diagnostic, index) => createMoldeaCliDiagnosticRecord(diagnostic, index))
      .sort((left, right) => (left.key < right.key ? -1 : left.key > right.key ? 1 : 0)),
  );
  const snapshotDigest = calculateMoldeaCliJsonDigest({
    diagnostics,
    formatVersion: validation.formatVersion,
    summary: validation.summary,
    valid: validation.valid,
  } as unknown as IJsonValue);

  return Object.freeze({
    diagnostics,
    formatVersion: validation.formatVersion,
    snapshotDigest,
    source: MOLDEA_CLI_GIT_WORKING_TREE_SOURCE,
    valid: validation.valid,
  });
};

/** Projects one bounded Core page through the content-free schema 4 allowlist. */
export const createMoldeaCliInspectProjection = (
  inspection: IProjectInspectionPageResult,
): IMoldeaCliInspectProjection => {
  const project: IMoldeaCliInspectProjectMetadata | null =
    inspection.summary === null
      ? null
      : Object.freeze({
          manifest: Object.freeze({
            digest: inspection.summary.manifestDigest,
            path: inspection.summary.manifestPath,
          }),
          project: Object.freeze({
            digest: inspection.summary.projectDigest,
            path: inspection.summary.projectPath,
          }),
        });
  const records = Object.freeze(
    inspection.page.records.map(({ item }, index) => createInspectRecord(item, index)),
  );
  const sourceCursors = new Map(
    inspection.page.records.map((record, index) => {
      const projected = records[index];

      if (projected === undefined) {
        throw new TypeError('A projected inspection record is missing.');
      }

      return [projected.key, record.nextCursor] as const;
    }),
  );
  const snapshotDigest = inspection.inspectionDigest;

  return Object.freeze({
    counts: inspection.counts,
    formatVersion: inspection.formatVersion,
    getSourceCursor: (record: IMoldeaCliInspectRecord): string | null =>
      sourceCursors.get(record.key) ?? null,
    project,
    records,
    snapshotDigest,
    source: MOLDEA_CLI_GIT_WORKING_TREE_SOURCE,
    valid: inspection.valid,
    view: inspection.view,
  });
};

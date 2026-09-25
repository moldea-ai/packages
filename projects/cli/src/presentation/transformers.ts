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
  IMoldeaCliAgentRecord,
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
  const observedErrorCount = validation.diagnostics.filter(
    (diagnostic) => diagnostic.severity === 'error',
  ).length;
  const isConsistent =
    Number.isSafeInteger(validation.errorCount) &&
    Number.isSafeInteger(validation.warningCount) &&
    validation.errorCount === observedErrorCount &&
    validation.warningCount === validation.diagnostics.length - observedErrorCount &&
    validation.valid === (validation.summary !== null && validation.errorCount === 0) &&
    (validation.valid || validation.errorCount > 0);

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
): IMoldeaCliDiagnosticRecord => {
  const record = {
    code: diagnostic.code,
    entity: diagnostic.entity,
    key: createRecordKey(
      'diagnostic',
      diagnostic.source,
      diagnostic.severity,
      diagnostic.code,
      diagnostic.path,
      diagnostic.pointer,
      diagnostic.severity === 'warning' ? diagnostic.details : null,
      occurrence,
    ),
    kind: 'diagnostic' as const,
    message: diagnostic.message,
    path: diagnostic.path,
    pointer: diagnostic.pointer,
    range: diagnostic.range,
    source: diagnostic.source,
  };

  if (diagnostic.severity === 'warning') {
    const details =
      diagnostic.details.reason === 'version-dependent-behavior'
        ? Object.freeze({
            boundaryVersion: diagnostic.details.boundaryVersion,
            declaredRange: diagnostic.details.declaredRange,
            packageName: diagnostic.details.packageName,
            reason: diagnostic.details.reason,
            relationship: diagnostic.details.relationship,
          })
        : Object.freeze({
            reason: diagnostic.details.reason,
            relationship: diagnostic.details.relationship,
          });

    return Object.freeze({ ...record, details, severity: 'warning' as const });
  }

  return Object.freeze({ ...record, severity: 'error' as const });
};

/** Projects one bounded Core inspection item through the schema 5 allowlist. */
const createInspectRecord = (
  item: IProjectInspectionItem,
  index: number,
): IMoldeaCliInspectRecord => {
  const order = index.toString().padStart(6, '0');

  if (item.kind === 'agent') {
    const record: IMoldeaCliAgentRecord = {
      agentId: item.agent.agentId,
      key: createRecordKey(order, 'agent', item.agent.agentId, item.agent.runtimeId),
      kind: 'agent',
      runtimeId: item.agent.runtimeId,
    };

    return Object.freeze(record);
  }

  if (item.kind === 'diagnostic') {
    return Object.freeze({
      ...createMoldeaCliDiagnosticRecord(item.diagnostic, index),
      key: createRecordKey(
        order,
        'diagnostic',
        item.diagnostic.source,
        item.diagnostic.severity,
        item.diagnostic.code,
        item.diagnostic.severity === 'warning' ? item.diagnostic.details : null,
      ),
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
    errorCount: validation.errorCount,
    formatVersion: validation.formatVersion,
    summary: validation.summary,
    valid: validation.valid,
    warningCount: validation.warningCount,
  } as unknown as IJsonValue);

  return Object.freeze({
    diagnostics,
    errorCount: validation.errorCount,
    formatVersion: validation.formatVersion,
    snapshotDigest,
    source: MOLDEA_CLI_GIT_WORKING_TREE_SOURCE,
    valid: validation.valid,
    warningCount: validation.warningCount,
  });
};

/** Projects one bounded Core page through the content-free schema 5 allowlist. */
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

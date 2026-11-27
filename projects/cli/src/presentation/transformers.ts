import type { IDiagnostic, IBindingCoverage, IProjectValidationResult } from '@moldea.ai/core';

import type {
  IMoldeaCliCoreInspectPage,
  IMoldeaCliInspectItem,
} from '../core-composition/index.js';
import type { IJsonValue } from '../json-serialization/index.js';
import { calculateMoldeaCliJsonDigest, createMoldeaCliRecordKey } from '../output-page/index.js';

import type {
  IMoldeaCliDiagnosticRecord,
  IMoldeaCliCoverageRecord,
  IMoldeaCliInspectProjection,
  IMoldeaCliInspectRecord,
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
    validation.acceptedWarningCount ===
      validation.diagnostics.filter(
        (diagnostic) => diagnostic.severity === 'warning' && diagnostic.accepted === true,
      ).length &&
    validation.warningCount ===
      validation.diagnostics.length - observedErrorCount - validation.acceptedWarningCount &&
    validation.diagnosticCount ===
      validation.errorCount + validation.warningCount + validation.acceptedWarningCount &&
    validation.valid === (validation.summary !== null && validation.errorCount === 0) &&
    (validation.valid || validation.errorCount > 0);

  if (!isConsistent) {
    throw new TypeError('The Core validation result is internally inconsistent.');
  }
};

/** Projects one diagnostic without retaining arbitrary detail payloads. */
export const createMoldeaCliDiagnosticRecord = (
  diagnostic: IDiagnostic,
  index: number,
): IMoldeaCliDiagnosticRecord => {
  const record = {
    code: diagnostic.code,
    group: diagnostic.group,
    entity: diagnostic.entity,
    key: createMoldeaCliRecordKey(index),
    kind: 'diagnostic' as const,
    message: diagnostic.message,
    path: diagnostic.path,
    pointer: diagnostic.pointer,
    range: diagnostic.range,
    source: diagnostic.source,
  };

  if (diagnostic.severity === 'warning') {
    return Object.freeze({
      ...record,
      severity: 'warning' as const,
      subject: diagnostic.subject,
      qualifier: diagnostic.qualifier,
      acceptable: diagnostic.acceptable,
      accepted: diagnostic.accepted === true,
      reason: diagnostic.accepted === true ? diagnostic.reason : null,
    });
  }

  return Object.freeze({ ...record, severity: 'error' as const });
};

// Core reports missing and wrong-type binding files as diagnostics.
const hasExceptionalCoverage = (
  coverage: IBindingCoverage,
): coverage is Exclude<IBindingCoverage, { exportCheck: 'passed' }> =>
  coverage.fileCheck !== 'passed' || coverage.exportCheck !== 'passed';

/** Projects one inventory item or diagnostic without exposing file identities. */
const createInspectRecord = (
  item: IMoldeaCliInspectItem,
  index: number,
): IMoldeaCliInspectRecord => {
  if (item.kind === 'diagnostic') return createMoldeaCliDiagnosticRecord(item.diagnostic, index);

  const { agentId, byteLength, decisionId, kind, path } = item.metadata;
  return Object.freeze({
    agentId,
    byteLength,
    decisionId,
    key: createMoldeaCliRecordKey(index),
    kind: 'metadata',
    metadataKind: kind,
    path,
  });
};

/** Creates content-free validation metadata and ordered diagnostic records. */
export const createMoldeaCliValidateProjection = (
  validation: IProjectValidationResult,
): IMoldeaCliValidateProjection => {
  assertProjectValidationInvariant(validation);
  const diagnostics = validation.diagnostics.map(createMoldeaCliDiagnosticRecord);
  const records = Object.freeze([
    ...diagnostics,
    ...validation.coverage
      .filter(hasExceptionalCoverage)
      .map((coverage, index): IMoldeaCliCoverageRecord =>
        Object.freeze({
          entity: coverage.entity,
          relationship: coverage.relationship,
          path: coverage.path,
          symbol: coverage.symbol,
          fileCheck: coverage.fileCheck,
          ...(coverage.exportCheck === 'not-checked'
            ? {
                exportCheck: coverage.exportCheck,
                exportNotCheckedReason: coverage.exportNotCheckedReason,
              }
            : { exportCheck: coverage.exportCheck }),
          key: createMoldeaCliRecordKey(diagnostics.length + index),
          kind: 'coverage',
        }),
      ),
  ]);
  const snapshotDigest = calculateMoldeaCliJsonDigest({
    diagnostics,
    coverage: validation.coverage,
    coverageCounts: validation.coverageCounts,
    acceptedWarningCount: validation.acceptedWarningCount,
    errorCount: validation.errorCount,
    formatVersion: validation.formatVersion,
    summary: validation.summary,
    valid: validation.valid,
    warningCount: validation.warningCount,
  } as unknown as IJsonValue);

  return Object.freeze({
    records,
    diagnosticCount: validation.diagnosticCount,
    acceptedWarningCount: validation.acceptedWarningCount,
    coverageCounts: validation.coverageCounts,
    errorCount: validation.errorCount,
    formatVersion: validation.formatVersion,
    snapshotDigest,
    valid: validation.valid,
    warningCount: validation.warningCount,
  });
};

/** Projects one bounded inspection page through the inventory and diagnostic allowlist. */
export const createMoldeaCliInspectProjection = (
  inspection: IMoldeaCliCoreInspectPage,
): IMoldeaCliInspectProjection => {
  const records = Object.freeze(
    inspection.records.map(({ item }, index) =>
      createInspectRecord(item, inspection.startIndex + index),
    ),
  );
  const sourceCursors = new Map(
    inspection.records.map(({ nextCursor }, index) => [
      createMoldeaCliRecordKey(inspection.startIndex + index),
      nextCursor,
    ]),
  );

  return Object.freeze({
    counts: inspection.counts,
    formatVersion: inspection.formatVersion,
    getSourceCursor: (record: IMoldeaCliInspectRecord): string | null =>
      sourceCursors.get(record.key) ?? null,
    records,
    snapshotDigest: inspection.inspectionDigest,
    coverageCounts: inspection.coverageCounts,
    valid: inspection.valid,
  });
};

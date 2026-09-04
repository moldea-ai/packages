import type { IProjectInspectionPageResult, IProjectValidationResult } from '@moldea.ai/core';

import type { IMoldeaCliCommand } from '../command-line/index.js';
import type { IMoldeaCliCompositionResult } from '../composition/index.js';
import { assertMoldeaCliJsonResultIsContentFree } from '../json-output-contract/index.js';
import {
  createMoldeaCliOutputPage,
  type IMoldeaCliOutputPage,
  type IMoldeaCliOutputRecord,
} from '../output-page/index.js';
import {
  createMoldeaCliContentPage,
  type IMoldeaCliContentResult,
  type IMoldeaCliProjectContentExecutor,
} from '../project-content/index.js';
import {
  createMoldeaCliScopeProjection,
  type IMoldeaCliProjectScopeExecutionResult,
  type IMoldeaCliScopeResult,
} from '../project-scope/index.js';
import {
  createMoldeaCliInspectProjection,
  createMoldeaCliValidateProjection,
  formatMoldeaCliHumanCompositionResult,
  formatMoldeaCliHumanContentResult,
  formatMoldeaCliHumanError,
  formatMoldeaCliHumanInspectResult,
  formatMoldeaCliHumanScopeResult,
  formatMoldeaCliHumanValidateResult,
  formatMoldeaCliJsonCompositionResult,
  formatMoldeaCliJsonContentResult,
  formatMoldeaCliJsonError,
  formatMoldeaCliJsonInspectResult,
  formatMoldeaCliJsonScopeResult,
  formatMoldeaCliJsonValidateResult,
  MOLDEA_CLI_GIT_WORKING_TREE_SOURCE,
  type IMoldeaCliError,
  type IMoldeaCliInspectResult,
  type IMoldeaCliValidateResult,
} from '../presentation/index.js';

import { MOLDEA_CLI_EXIT_CODES } from './constants.js';
import type { IMoldeaCliExecutionResult } from './types.js';

const measureOutput = (output: string): number => Buffer.byteLength(output, 'utf8');

/** Measures a paged result without repeatedly serializing its accumulated JSON records. */
const measurePagedOutput = <TRecord extends IMoldeaCliOutputRecord>(
  page: IMoldeaCliOutputPage<TRecord>,
  serializedRecordsUtf8Bytes: number,
  isJson: boolean,
  formatJson: (candidate: IMoldeaCliOutputPage<TRecord>) => string,
  formatHuman: (candidate: IMoldeaCliOutputPage<TRecord>) => string,
): number => {
  if (!isJson) {
    return measureOutput(formatHuman(page));
  }

  const emptyPage = Object.freeze({
    cursor: page.cursor,
    records: Object.freeze([]),
  });

  return measureOutput(formatJson(emptyPage)) - 2 + serializedRecordsUtf8Bytes;
};

/** Creates one process-neutral result for a valid installed composition. */
export const createMoldeaCliCompositionExecutionResult = (
  result: IMoldeaCliCompositionResult,
  cliVersion: string,
  isJson: boolean,
): IMoldeaCliExecutionResult =>
  Object.freeze({
    exitCode: MOLDEA_CLI_EXIT_CODES.Success,
    stderr: '',
    stdout: isJson
      ? formatMoldeaCliJsonCompositionResult(result, cliVersion)
      : formatMoldeaCliHumanCompositionResult(result, cliVersion),
  });

/** Creates one safe process-neutral error result in the requested output mode. */
export const createMoldeaCliErrorResult = (
  error: IMoldeaCliError,
  command: IMoldeaCliCommand | null,
  cliVersion: string,
  isJson: boolean,
  exitCode: number,
): IMoldeaCliExecutionResult =>
  Object.freeze(
    isJson
      ? {
          exitCode,
          stderr: '',
          stdout: formatMoldeaCliJsonError(error, command, cliVersion),
        }
      : {
          exitCode,
          stderr: formatMoldeaCliHumanError(error),
          stdout: '',
        },
  );

/**
 * Creates one bounded process-neutral result for a completed validate command.
 * @throws
 * - CURSOR_INVALID: The continuation cursor is invalid for this request.
 * - CURSOR_SNAPSHOT_CHANGED: The continuation cursor belongs to a different repository snapshot.
 * - OUTPUT_BUDGET_TOO_SMALL: The output byte budget cannot contain the next complete result.
 */
export const createMoldeaCliValidateExecutionResult = (
  inspection: IProjectValidationResult,
  cliVersion: string,
  isJson: boolean,
  cursor: string | null,
  maxOutputBytes: number,
): IMoldeaCliExecutionResult => {
  const projection = createMoldeaCliValidateProjection(inspection);
  const createResult = (page: IMoldeaCliValidateResult['page']): IMoldeaCliValidateResult => ({
    diagnosticCount: projection.diagnostics.length,
    formatVersion: projection.formatVersion,
    page,
    snapshotDigest: projection.snapshotDigest,
    source: projection.source,
    valid: projection.valid,
  });
  const page = createMoldeaCliOutputPage({
    command: 'validate',
    cursor,
    filters: {},
    maxOutputBytes,
    measure: (candidate, serializedRecordsUtf8Bytes) =>
      measurePagedOutput(
        candidate,
        serializedRecordsUtf8Bytes,
        isJson,
        (page) => formatMoldeaCliJsonValidateResult(createResult(page), cliVersion),
        (page) => formatMoldeaCliHumanValidateResult(createResult(page)),
      ),
    records: projection.diagnostics,
    snapshotDigest: projection.snapshotDigest,
  });
  const result = Object.freeze(createResult(page));

  assertMoldeaCliJsonResultIsContentFree(result);

  return Object.freeze({
    exitCode: result.valid
      ? MOLDEA_CLI_EXIT_CODES.Success
      : MOLDEA_CLI_EXIT_CODES.StructuralInvalid,
    stderr: '',
    stdout: isJson
      ? formatMoldeaCliJsonValidateResult(result, cliVersion)
      : formatMoldeaCliHumanValidateResult(result),
  });
};

/**
 * Creates one bounded content-free result for a completed inspect command.
 * @throws
 * - CURSOR_INVALID: The continuation cursor is invalid for this request.
 * - CURSOR_SNAPSHOT_CHANGED: The continuation cursor belongs to a different repository snapshot.
 * - OUTPUT_BUDGET_TOO_SMALL: The output byte budget cannot contain the next complete result.
 */
export const createMoldeaCliInspectExecutionResult = (
  inspection: IProjectInspectionPageResult,
  cliVersion: string,
  isJson: boolean,
  cursor: string | null,
  maxOutputBytes: number,
): IMoldeaCliExecutionResult => {
  const projection = createMoldeaCliInspectProjection(inspection);
  const createResult = (page: IMoldeaCliInspectResult['page']): IMoldeaCliInspectResult => ({
    counts: projection.counts,
    formatVersion: projection.formatVersion,
    page,
    project: projection.project,
    snapshotDigest: projection.snapshotDigest,
    source: projection.source,
    valid: projection.valid,
    view: projection.view,
  });
  const page = createMoldeaCliOutputPage({
    command: 'inspect',
    cursor,
    filters: {},
    maxOutputBytes,
    measure: (candidate, serializedRecordsUtf8Bytes) =>
      measurePagedOutput(
        candidate,
        serializedRecordsUtf8Bytes,
        isJson,
        (page) => formatMoldeaCliJsonInspectResult(createResult(page), cliVersion),
        (page) => formatMoldeaCliHumanInspectResult(createResult(page)),
      ),
    records: projection.records,
    sourceCursorForRecord: projection.getSourceCursor,
    snapshotDigest: projection.snapshotDigest,
  });
  const result = Object.freeze(createResult(page));

  assertMoldeaCliJsonResultIsContentFree(result);

  return Object.freeze({
    exitCode: inspection.valid
      ? MOLDEA_CLI_EXIT_CODES.Success
      : MOLDEA_CLI_EXIT_CODES.StructuralInvalid,
    stderr: '',
    stdout: isJson
      ? formatMoldeaCliJsonInspectResult(result, cliVersion)
      : formatMoldeaCliHumanInspectResult(result),
  });
};

/**
 * Creates one bounded content-free result for changed-path relationship scope.
 * @throws
 * - CURSOR_INVALID: The continuation cursor is invalid for this request.
 * - CURSOR_SNAPSHOT_CHANGED: The continuation cursor belongs to a different repository snapshot.
 * - OUTPUT_BUDGET_TOO_SMALL: The output byte budget cannot contain the next complete result.
 */
export const createMoldeaCliScopeExecutionResult = (
  execution: IMoldeaCliProjectScopeExecutionResult,
  cliVersion: string,
  isJson: boolean,
  cursor: string | null,
  maxOutputBytes: number,
): IMoldeaCliExecutionResult => {
  const projection = createMoldeaCliScopeProjection(execution);
  const createResult = (page: IMoldeaCliScopeResult['page']): IMoldeaCliScopeResult => ({
    counts: projection.counts,
    inputDigest: projection.inputDigest,
    manifestDigest: projection.manifestDigest,
    page,
    relevant: projection.relevant,
    snapshotDigest: projection.snapshotDigest,
    source: MOLDEA_CLI_GIT_WORKING_TREE_SOURCE,
    valid: projection.valid,
  });
  const page = createMoldeaCliOutputPage({
    command: 'scope',
    cursor,
    filters: { inputDigest: projection.inputDigest },
    maxOutputBytes,
    measure: (candidate, serializedRecordsUtf8Bytes) =>
      measurePagedOutput(
        candidate,
        serializedRecordsUtf8Bytes,
        isJson,
        (page) => formatMoldeaCliJsonScopeResult(createResult(page), cliVersion),
        (page) => formatMoldeaCliHumanScopeResult(createResult(page)),
      ),
    records: projection.records,
    snapshotDigest: projection.snapshotDigest,
  });
  const result = Object.freeze(createResult(page));

  assertMoldeaCliJsonResultIsContentFree(result, projection.canonicalBodies);

  return Object.freeze({
    exitCode: projection.valid
      ? MOLDEA_CLI_EXIT_CODES.Success
      : MOLDEA_CLI_EXIT_CODES.StructuralInvalid,
    stderr: '',
    stdout: isJson
      ? formatMoldeaCliJsonScopeResult(result, cliVersion)
      : formatMoldeaCliHumanScopeResult(result),
  });
};

/**
 * Creates one bounded Unicode-safe explicit canonical content result.
 * @throws
 * - CURSOR_INVALID: The continuation cursor is invalid for this request.
 * - CURSOR_SNAPSHOT_CHANGED: The continuation cursor belongs to a different repository snapshot.
 * - OUTPUT_BUDGET_TOO_SMALL: The output byte budget cannot contain the next complete result.
 */
export const createMoldeaCliContentExecutionResult = (
  pageResult: Awaited<ReturnType<IMoldeaCliProjectContentExecutor>>,
  cliVersion: string,
  isJson: boolean,
  cursor: string | null,
  maxOutputBytes: number,
): IMoldeaCliExecutionResult => {
  const result: IMoldeaCliContentResult = createMoldeaCliContentPage({
    cursor,
    maxOutputBytes,
    measure: (candidate) =>
      measureOutput(
        isJson
          ? formatMoldeaCliJsonContentResult(candidate, cliVersion)
          : formatMoldeaCliHumanContentResult(candidate),
      ),
    page: pageResult,
  });

  return Object.freeze({
    exitCode: MOLDEA_CLI_EXIT_CODES.Success,
    stderr: '',
    stdout: isJson
      ? formatMoldeaCliJsonContentResult(result, cliVersion)
      : formatMoldeaCliHumanContentResult(result),
  });
};

import type { IDiagnosticEntity } from '@moldea.ai/core';

import { MOLDEA_CLI_COMMANDS, type IMoldeaCliCommand } from '../command-line/index.js';
import type { IMoldeaCliCompositionResult } from '../composition/index.js';
import {
  MOLDEA_CLI_JSON_SCHEMA_VERSION,
  serializeMoldeaCliJsonEnvelope,
  type IMoldeaCliJsonStatus,
} from '../json-output-contract/index.js';
import type { IMoldeaCliContentResult } from '../project-content/index.js';
import type { IMoldeaCliScopeResult } from '../project-scope/index.js';

import { MOLDEA_CLI_COMMAND_HELP, MOLDEA_CLI_TOP_LEVEL_HELP } from './constants.js';
import type {
  IMoldeaCliDiagnosticRecord,
  IMoldeaCliError,
  IMoldeaCliInspectResult,
  IMoldeaCliValidateResult,
} from './types.js';

const DIAGNOSTIC_ENTITY_KEYS = [
  'agentId',
  'capabilityKind',
  'capabilityId',
  'decisionId',
  'variableId',
  'adapterId',
] as const satisfies readonly (keyof IDiagnosticEntity)[];

/** Formats one diagnostic entity in the canonical Core field order. */
const formatMoldeaCliHumanDiagnosticEntity = (entity: IDiagnosticEntity): string =>
  DIAGNOSTIC_ENTITY_KEYS.flatMap((key) => {
    const identifier = entity[key];

    return identifier === undefined ? [] : [`${key}=${identifier}`];
  }).join(', ');

/** Formats one projected diagnostic without exposing omitted arbitrary details. */
const formatMoldeaCliHumanDiagnostic = (diagnostic: IMoldeaCliDiagnosticRecord): string => {
  const location =
    diagnostic.path === null
      ? ''
      : diagnostic.range === null
        ? ` ${diagnostic.path}`
        : ` ${diagnostic.path}:${diagnostic.range.start.line}:${diagnostic.range.start.column}`;
  const lines = [`${diagnostic.source}:${diagnostic.code}${location} ${diagnostic.message}`];

  if (diagnostic.pointer !== null) {
    lines.push(`  pointer: ${diagnostic.pointer}`);
  }

  if (diagnostic.entity !== null) {
    lines.push(`  entity: ${formatMoldeaCliHumanDiagnosticEntity(diagnostic.entity)}`);
  }

  if (diagnostic.severity === 'warning') {
    lines.push(`  unverified relationship: ${diagnostic.details.relationship}`);
    lines.push(`  reason: ${diagnostic.details.reason.replaceAll('-', ' ')}`);

    if (diagnostic.details.reason === 'version-dependent-behavior') {
      lines.push(`  package: ${diagnostic.details.packageName}`);
      lines.push(`  declared range: ${diagnostic.details.declaredRange ?? 'unavailable'}`);
      lines.push(`  behavior boundary: ${diagnostic.details.boundaryVersion}`);
    }
  }

  return lines.join('\n');
};

/** Creates shared human status lines for one completed repository command. */
const createMoldeaCliHumanStatusLines = (
  isValid: boolean,
  formatVersion: number | null,
  warningCount = 0,
): string[] => {
  const status = isValid ? (warningCount > 0 ? 'valid with warnings' : 'valid') : 'invalid';
  const lines = [`The moldea project is ${status}.`];

  if (formatVersion !== null) {
    lines.push(`Repository format: ${formatVersion}`);
  }

  return lines;
};

/** Formats one count label with correct singular or plural grammar. */
const formatMoldeaCliHumanCount = (
  count: number,
  singularLabel: string,
  pluralLabel: string,
): string => `${count === 1 ? singularLabel : pluralLabel}: ${count}`;

/** Formats top-level or command-specific help with its required trailing line feed. */
export const formatMoldeaCliHelp = (command: IMoldeaCliCommand | null): string => {
  return command === null ? MOLDEA_CLI_TOP_LEVEL_HELP : MOLDEA_CLI_COMMAND_HELP[command];
};

/** Formats one safe CLI error for human stderr output. */
export const formatMoldeaCliHumanError = (error: IMoldeaCliError): string =>
  `${error.source}:${error.code} ${error.message}\n`;

/** Formats any strict schema 5 JSON envelope. */
export const formatMoldeaCliJsonResult = <TResult>(
  command: IMoldeaCliCommand | null,
  result: TResult | null,
  error: IMoldeaCliError | null,
  status: IMoldeaCliJsonStatus,
  cliVersion: string,
): string => serializeMoldeaCliJsonEnvelope({ cliVersion, command, error, result, status });

/** Formats one safe schema 5 JSON error envelope. */
export const formatMoldeaCliJsonError = (
  error: IMoldeaCliError,
  command: IMoldeaCliCommand | null,
  cliVersion: string,
): string => formatMoldeaCliJsonResult(command, null, error, 'error', cliVersion);

/** Formats one valid composition result for human stdout. */
export const formatMoldeaCliHumanCompositionResult = (
  result: IMoldeaCliCompositionResult,
  cliVersion: string,
): string => {
  const lines = [
    'The installed CLI composition state is valid.',
    `CLI version: ${cliVersion}`,
    `Supported Node.js: ${result.supportedNodeRange}`,
    `JSON output schema: ${MOLDEA_CLI_JSON_SCHEMA_VERSION}`,
    `Minimum Git: ${result.minimumGitVersion}`,
    `Repository formats: ${result.repositoryFormatVersions.join(', ')}`,
    'Packages:',
    ...result.packages.map(({ name, version }) => `  ${name}: ${version}`),
    'Adapters:',
    ...result.adapters.map(
      ({ id, repositoryFormatVersions }) =>
        `  ${id}: repository formats ${repositoryFormatVersions.join(', ')}`,
    ),
  ];

  return `${lines.join('\n')}\n`;
};

/** Formats one composition result in the strict schema 5 envelope. */
export const formatMoldeaCliJsonCompositionResult = (
  result: IMoldeaCliCompositionResult,
  cliVersion: string,
): string =>
  formatMoldeaCliJsonResult(MOLDEA_CLI_COMMANDS.Composition, result, null, 'valid', cliVersion);

/** Formats one completed validation result for human stdout. */
export const formatMoldeaCliHumanValidateResult = (result: IMoldeaCliValidateResult): string => {
  const lines = createMoldeaCliHumanStatusLines(
    result.valid,
    result.formatVersion,
    result.warningCount,
  );

  for (const diagnostic of result.page.records) {
    lines.push(formatMoldeaCliHumanDiagnostic(diagnostic));
  }

  lines.push(formatMoldeaCliHumanCount(result.diagnosticCount, 'Diagnostic', 'Diagnostics'));
  lines.push(formatMoldeaCliHumanCount(result.errorCount, 'Error', 'Errors'));
  lines.push(formatMoldeaCliHumanCount(result.warningCount, 'Warning', 'Warnings'));

  if (result.page.cursor !== null) {
    lines.push('Additional diagnostics are available through JSON pagination.');
  }

  return `${lines.join('\n')}\n`;
};

/** Formats one validation result in the strict schema 5 envelope. */
export const formatMoldeaCliJsonValidateResult = (
  result: IMoldeaCliValidateResult,
  cliVersion: string,
): string =>
  formatMoldeaCliJsonResult(
    MOLDEA_CLI_COMMANDS.Validate,
    result,
    null,
    result.valid ? 'valid' : 'invalid',
    cliVersion,
  );

/** Formats one completed metadata inspection for human stdout. */
export const formatMoldeaCliHumanInspectResult = (result: IMoldeaCliInspectResult): string => {
  const lines = createMoldeaCliHumanStatusLines(
    result.valid,
    result.formatVersion,
    result.counts.warnings,
  );

  for (const [label, count] of Object.entries(result.counts)) {
    lines.push(`${label}: ${count}`);
  }

  return `${lines.join('\n')}\n`;
};

/** Formats one metadata inspection in the strict schema 5 envelope. */
export const formatMoldeaCliJsonInspectResult = (
  result: IMoldeaCliInspectResult,
  cliVersion: string,
): string =>
  formatMoldeaCliJsonResult(
    MOLDEA_CLI_COMMANDS.Inspect,
    result,
    null,
    result.valid ? 'valid' : 'invalid',
    cliVersion,
  );

/** Formats one changed-path scope result for human stdout. */
export const formatMoldeaCliHumanScopeResult = (result: IMoldeaCliScopeResult): string => {
  const lines = [
    `The moldea scope result is ${result.valid ? 'valid' : 'invalid'}.`,
    `Relevant: ${result.relevant ? 'yes' : 'no'}`,
    ...Object.entries(result.counts).map(([label, count]) => `${label}: ${count}`),
  ];

  return `${lines.join('\n')}\n`;
};

/** Formats one changed-path scope result in the strict schema 5 envelope. */
export const formatMoldeaCliJsonScopeResult = (
  result: IMoldeaCliScopeResult,
  cliVersion: string,
): string =>
  formatMoldeaCliJsonResult(
    MOLDEA_CLI_COMMANDS.Scope,
    result,
    null,
    result.valid ? 'valid' : 'invalid',
    cliVersion,
  );

/** Formats one explicit canonical content chunk for human stdout. */
export const formatMoldeaCliHumanContentResult = (result: IMoldeaCliContentResult): string => {
  const lines = [
    `Path: ${result.asset.path}`,
    `Content identity: ${result.asset.contentIdentity ?? 'unavailable'}`,
    `Bytes: ${result.chunk.byteStart}-${result.chunk.byteEnd} of ${result.asset.totalBytes}`,
    result.cursor === null ? 'Cursor: none' : `Cursor: ${result.cursor}`,
    ...(result.cursor === null
      ? []
      : ['Continue this asset by passing the cursor to a JSON content request.']),
    '',
    result.chunk.content,
  ];

  return `${lines.join('\n')}\n`;
};

/** Formats one explicit canonical content chunk in the strict schema 5 envelope. */
export const formatMoldeaCliJsonContentResult = (
  result: IMoldeaCliContentResult,
  cliVersion: string,
): string =>
  formatMoldeaCliJsonResult(MOLDEA_CLI_COMMANDS.Content, result, null, 'valid', cliVersion);

// @vitest-environment node
import { describe, expect, test } from 'vitest';

import type { ICoreDiagnostic } from '@moldea.ai/core';
import { parseRepositoryPath } from '@moldea.ai/repository';

import type { IMoldeaCliCompositionResult } from '../composition/index.js';

import { MOLDEA_CLI_COMMAND_HELP, MOLDEA_CLI_TOP_LEVEL_HELP } from './constants.js';
import { createMoldeaCliOwnedError } from './errors.js';
import {
  formatMoldeaCliHelp,
  formatMoldeaCliHumanCompositionResult,
  formatMoldeaCliHumanError,
  formatMoldeaCliHumanValidateResult,
  formatMoldeaCliJsonCompositionResult,
  formatMoldeaCliJsonError,
  formatMoldeaCliJsonValidateResult,
} from './formatters.js';
import { createMoldeaCliDiagnosticRecord } from './transformers.js';
import type { IMoldeaCliValidateResult } from './types.js';

const createDiagnostic = (): ICoreDiagnostic => ({
  code: 'MOLDEA_MANIFEST_MISSING',
  group: 'discovery',
  details: {},
  entity: null,
  message: 'The project manifest is missing.',
  path: parseRepositoryPath('/moldea/moldea.yaml'),
  pointer: null,
  range: null,
  severity: 'error',
  source: 'core',
});

describe('schema 7 CLI presentation formatters', () => {
  test('returns help for every command', () => {
    expect(formatMoldeaCliHelp(null)).toBe(MOLDEA_CLI_TOP_LEVEL_HELP);

    for (const command of ['composition', 'content', 'inspect', 'scope', 'validate'] as const) {
      expect(formatMoldeaCliHelp(command)).toBe(MOLDEA_CLI_COMMAND_HELP[command]);
    }
  });

  test('formats safe human and strict schema 7 JSON errors', () => {
    const error = createMoldeaCliOwnedError('CURSOR_INVALID');

    expect(formatMoldeaCliHumanError(error)).toBe(
      'cli:CURSOR_INVALID The continuation cursor is invalid for this request.\n',
    );
    expect(JSON.parse(formatMoldeaCliJsonError(error, 'inspect', '10.0.0'))).toStrictEqual({
      cliVersion: '10.0.0',
      command: 'inspect',
      error,
      result: null,
      schemaVersion: 7,
      status: 'error',
    });
  });

  test('formats composition in human and schema 7 JSON forms', () => {
    const result: IMoldeaCliCompositionResult = {
      minimumGitVersion: '2.30.0',
      packages: [{ name: '@moldea.ai/core', version: '5.0.0' }],
      repositoryFormatVersions: [1],
      supportedNodeRange: '>=22.12.0',
    };

    expect(formatMoldeaCliHumanCompositionResult(result, '10.0.0')).toContain(
      'JSON output schema: 7',
    );
    expect(JSON.parse(formatMoldeaCliJsonCompositionResult(result, '10.0.0'))).toMatchObject({
      command: 'composition',
      result,
      schemaVersion: 7,
      status: 'valid',
    });
  });

  test('formats paginated validation diagnostics in both output modes', () => {
    const diagnostic = createMoldeaCliDiagnosticRecord(createDiagnostic());
    const result: IMoldeaCliValidateResult = {
      coverageCounts: { bindings: 0, exportsPassed: 0, exportsFailed: 0, exportsNotChecked: 0 },
      acceptedWarningCount: 0,
      diagnosticCount: 1,
      errorCount: 1,
      formatVersion: null,
      page: { cursor: 'opaque_cursor', records: [diagnostic] },
      snapshotDigest: `sha256:${'b'.repeat(64)}`,
      source: { kind: 'git-working-tree' },
      valid: false,
      warningCount: 0,
    };

    expect(formatMoldeaCliHumanValidateResult(result)).toBe(
      'The moldea project is invalid.\nCoverage: 0 bindings, 0 exports confirmed, 0 exports missing, 0 not checked\ncore:MOLDEA_MANIFEST_MISSING /moldea/moldea.yaml The project manifest is missing.\nDiagnostic: 1\nError: 1\nWarnings: 0\n0 accepted warnings\nAdditional records are available through JSON pagination.\n',
    );
    expect(JSON.parse(formatMoldeaCliJsonValidateResult(result, '10.0.0'))).toMatchObject({
      command: 'validate',
      result: { diagnosticCount: 1 },
      schemaVersion: 7,
      status: 'invalid',
    });
  });

  test('shows unaccepted warning identity and keeps accepted findings out of the warning list', () => {
    const warning: ICoreDiagnostic = {
      code: 'MOLDEA_IMPACT_PATTERN_UNMATCHED',
      group: 'references',
      severity: 'warning',
      source: 'core',
      subject: parseRepositoryPath('/moldea/project.md'),
      qualifier: '/future/**',
      acceptable: true,
      details: {},
      entity: null,
      message: 'The impact pattern matches no files.',
      path: parseRepositoryPath('/moldea/moldea.yaml'),
      pointer: null,
      range: null,
    };
    const base: IMoldeaCliValidateResult = {
      coverageCounts: { bindings: 9, exportsPassed: 6, exportsFailed: 0, exportsNotChecked: 3 },
      acceptedWarningCount: 0,
      diagnosticCount: 1,
      errorCount: 0,
      warningCount: 1,
      formatVersion: 1,
      page: { cursor: null, records: [createMoldeaCliDiagnosticRecord(warning)] },
      snapshotDigest: `sha256:${'c'.repeat(64)}`,
      source: { kind: 'git-working-tree' },
      valid: true,
    };
    const human = formatMoldeaCliHumanValidateResult(base);
    expect(human).toContain('The moldea project is valid with warnings.');
    expect(human).toContain('subject: /moldea/project.md');
    expect(human).toContain('qualifier: /future/**');
    expect(human).toContain(
      'Coverage: 9 bindings, 6 exports confirmed, 0 exports missing, 3 not checked',
    );
    const accepted = { ...warning, accepted: true as const, reason: 'Reserved for later.' };
    const result = {
      ...base,
      warningCount: 0,
      acceptedWarningCount: 1,
      page: { cursor: null, records: [createMoldeaCliDiagnosticRecord(accepted)] },
    };
    expect(formatMoldeaCliHumanValidateResult(result)).toContain('1 accepted warning');
    expect(formatMoldeaCliHumanValidateResult(result)).not.toContain(warning.code);
    expect(JSON.parse(formatMoldeaCliJsonValidateResult(result, '11.0.0'))).toMatchObject({
      status: 'valid',
      result: { page: { records: [{ accepted: true, reason: 'Reserved for later.' }] } },
    });
  });
});

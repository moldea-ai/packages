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
  details: {},
  entity: null,
  message: 'The project manifest is missing.',
  path: parseRepositoryPath('/moldea/moldea.yaml'),
  pointer: null,
  range: null,
  source: 'core',
});

describe('schema 3 CLI presentation formatters', () => {
  test('returns help for every command', () => {
    expect(formatMoldeaCliHelp(null)).toBe(MOLDEA_CLI_TOP_LEVEL_HELP);

    for (const command of ['composition', 'content', 'inspect', 'scope', 'validate'] as const) {
      expect(formatMoldeaCliHelp(command)).toBe(MOLDEA_CLI_COMMAND_HELP[command]);
    }
  });

  test('formats safe human and strict schema 3 JSON errors', () => {
    const error = createMoldeaCliOwnedError('CURSOR_INVALID');

    expect(formatMoldeaCliHumanError(error)).toBe(
      'cli:CURSOR_INVALID The continuation cursor is invalid for this request.\n',
    );
    expect(JSON.parse(formatMoldeaCliJsonError(error, 'inspect', '6.0.0'))).toStrictEqual({
      cliVersion: '6.0.0',
      command: 'inspect',
      error,
      result: null,
      schemaVersion: 3,
      status: 'error',
    });
  });

  test('formats composition in human and schema 3 JSON forms', () => {
    const result: IMoldeaCliCompositionResult = {
      adapters: [{ id: 'custom', repositoryFormatVersions: [1] }],
      minimumGitVersion: '2.30.0',
      packages: [{ name: '@moldea.ai/core', version: '2.1.0' }],
      repositoryFormatVersions: [1],
      supportedNodeRange: '>=22.11.0',
    };

    expect(formatMoldeaCliHumanCompositionResult(result, '6.0.0')).toContain(
      'JSON output schema: 3',
    );
    expect(JSON.parse(formatMoldeaCliJsonCompositionResult(result, '6.0.0'))).toMatchObject({
      command: 'composition',
      result,
      schemaVersion: 3,
      status: 'valid',
    });
  });

  test('formats paginated validation diagnostics in both output modes', () => {
    const diagnostic = createMoldeaCliDiagnosticRecord(createDiagnostic());
    const result: IMoldeaCliValidateResult = {
      diagnosticCount: 1,
      formatVersion: null,
      page: { cursor: 'opaque_cursor', records: [diagnostic] },
      snapshotDigest: `sha256:${'b'.repeat(64)}`,
      source: { kind: 'git-working-tree' },
    };

    expect(formatMoldeaCliHumanValidateResult(result)).toBe(
      'The moldea project is invalid.\ncore:MOLDEA_MANIFEST_MISSING /moldea/moldea.yaml The project manifest is missing.\nDiagnostic: 1\nAdditional diagnostics are available through JSON pagination.\n',
    );
    expect(JSON.parse(formatMoldeaCliJsonValidateResult(result, '6.0.0'))).toMatchObject({
      command: 'validate',
      result: { diagnosticCount: 1 },
      schemaVersion: 3,
      status: 'invalid',
    });
  });
});

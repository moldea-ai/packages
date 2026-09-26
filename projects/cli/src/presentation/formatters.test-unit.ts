// @vitest-environment node
import { describe, expect, test } from 'vitest';

import type { IAdapterWarningDiagnostic, ICoreDiagnostic } from '@moldea.ai/core';
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
  severity: 'error',
  source: 'core',
});

describe('schema 5 CLI presentation formatters', () => {
  test('returns help for every command', () => {
    expect(formatMoldeaCliHelp(null)).toBe(MOLDEA_CLI_TOP_LEVEL_HELP);

    for (const command of ['composition', 'content', 'inspect', 'scope', 'validate'] as const) {
      expect(formatMoldeaCliHelp(command)).toBe(MOLDEA_CLI_COMMAND_HELP[command]);
    }
  });

  test('formats safe human and strict schema 5 JSON errors', () => {
    const error = createMoldeaCliOwnedError('CURSOR_INVALID');

    expect(formatMoldeaCliHumanError(error)).toBe(
      'cli:CURSOR_INVALID The continuation cursor is invalid for this request.\n',
    );
    expect(JSON.parse(formatMoldeaCliJsonError(error, 'inspect', '9.0.0'))).toStrictEqual({
      cliVersion: '9.0.0',
      command: 'inspect',
      error,
      result: null,
      schemaVersion: 5,
      status: 'error',
    });
  });

  test('formats composition in human and schema 5 JSON forms', () => {
    const result: IMoldeaCliCompositionResult = {
      adapters: [{ id: 'custom', repositoryFormatVersions: [1] }],
      minimumGitVersion: '2.30.0',
      packages: [{ name: '@moldea.ai/core', version: '5.0.0' }],
      repositoryFormatVersions: [1],
      supportedNodeRange: '>=22.11.0',
    };

    expect(formatMoldeaCliHumanCompositionResult(result, '9.0.0')).toContain(
      'JSON output schema: 5',
    );
    expect(JSON.parse(formatMoldeaCliJsonCompositionResult(result, '9.0.0'))).toMatchObject({
      command: 'composition',
      result,
      schemaVersion: 5,
      status: 'valid',
    });
  });

  test('formats paginated validation diagnostics in both output modes', () => {
    const diagnostic = createMoldeaCliDiagnosticRecord(createDiagnostic());
    const result: IMoldeaCliValidateResult = {
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
      'The moldea project is invalid.\ncore:MOLDEA_MANIFEST_MISSING /moldea/moldea.yaml The project manifest is missing.\nDiagnostic: 1\nError: 1\nWarnings: 0\nAdditional diagnostics are available through JSON pagination.\n',
    );
    expect(JSON.parse(formatMoldeaCliJsonValidateResult(result, '9.0.0'))).toMatchObject({
      command: 'validate',
      result: { diagnosticCount: 1 },
      schemaVersion: 5,
      status: 'invalid',
    });
  });

  test('shows a nonblocking unverified relationship and safe version context', () => {
    const warning: IAdapterWarningDiagnostic = {
      code: 'ANTHROPIC_RUNTIME_RELATIONSHIP_UNVERIFIED',
      details: {
        boundaryVersion: '1.2.3',
        declaredRange: null,
        packageName: '@anthropic-ai/sdk',
        reason: 'version-dependent-behavior',
        relationship: 'instruction-loader',
      },
      entity: { agentId: 'support' },
      message: 'The declared runtime relationship could not be verified.',
      path: parseRepositoryPath('/src/agent.ts'),
      pointer: null,
      range: null,
      severity: 'warning',
      source: 'anthropic',
    };
    const result: IMoldeaCliValidateResult = {
      diagnosticCount: 1,
      errorCount: 0,
      formatVersion: 1,
      page: { cursor: null, records: [createMoldeaCliDiagnosticRecord(warning)] },
      snapshotDigest: `sha256:${'c'.repeat(64)}`,
      source: { kind: 'git-working-tree' },
      valid: true,
      warningCount: 1,
    };
    const human = formatMoldeaCliHumanValidateResult(result);
    const json = JSON.parse(formatMoldeaCliJsonValidateResult(result, '9.0.0')) as {
      result: IMoldeaCliValidateResult;
      status: string;
    };

    expect(human).toContain('The moldea project is valid with warnings.');
    expect(human).toContain('unverified relationship: instruction-loader');
    expect(human).toContain('declared range: unavailable');
    expect(human).toContain('behavior boundary: 1.2.3');
    expect(json.status).toBe('valid');
    expect(json.result.page.records[0]).toMatchObject({
      severity: 'warning',
      details: warning.details,
    });
  });
});

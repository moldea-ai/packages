// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { MOLDEA_CLI_DEFAULT_OUTPUT_BYTES } from '../output-page/index.js';

import { DEFAULT_MOLDEA_CLI_RESOURCE_LIMITS } from './constants.js';
import { parseMoldeaCliArguments } from './parser.js';

describe('parseMoldeaCliArguments', () => {
  test.each([
    [[], null],
    [['--help'], null],
    [['validate', '--help'], 'validate'],
    [['inspect', '--help'], 'inspect'],
    [['composition', '--help'], 'composition'],
    [['scope', '--help'], 'scope'],
    [['content', '--help'], 'content'],
  ])('parses help arguments %o', (commandLineArguments, expectedCommand) => {
    expect(parseMoldeaCliArguments(commandLineArguments)).toStrictEqual({
      command: expectedCommand,
      kind: 'help',
    });
  });

  test('parses the exact version invocation', () => {
    expect(parseMoldeaCliArguments(['--version'])).toStrictEqual({ kind: 'version' });
  });

  test.each(['validate', 'inspect', 'composition'])(
    'parses the %s command with default options',
    (command) => {
      const result = parseMoldeaCliArguments([command]);

      expect(result).toStrictEqual({
        invocation: {
          command,
          options: {
            cursor: null,
            isColorDisabled: false,
            isJson: false,
            maxOutputBytes: MOLDEA_CLI_DEFAULT_OUTPUT_BYTES,
            path: null,
            pathsInput: 'none',
            repositoryDirectory: null,
            resourceLimits: DEFAULT_MOLDEA_CLI_RESOURCE_LIMITS,
          },
        },
        kind: 'command',
      });

      if (result.kind !== 'command') {
        throw new TypeError('Expected a normalized command result.');
      }

      expect(Object.isFrozen(result.invocation)).toBe(true);
      expect(Object.isFrozen(result.invocation.options)).toBe(true);
      expect(Object.isFrozen(result.invocation.options.resourceLimits)).toBe(true);
    },
  );

  test('normalizes every inspection option without mutating its input', () => {
    const commandLineArguments = [
      'inspect',
      '--repository',
      './fixture',
      '--json',
      '--no-color',
      '--max-entries',
      '32',
      '--max-file-bytes',
      '8',
      '--max-total-bytes',
      '16',
      '--max-manifest-bytes',
      '4',
      '--max-diagnostics',
      '64',
      '--max-evidence',
      '128',
    ];
    const originalArguments = [...commandLineArguments];

    expect(parseMoldeaCliArguments(commandLineArguments)).toStrictEqual({
      invocation: {
        command: 'inspect',
        options: {
          cursor: null,
          isColorDisabled: true,
          isJson: true,
          maxOutputBytes: MOLDEA_CLI_DEFAULT_OUTPUT_BYTES,
          path: null,
          pathsInput: 'none',
          repositoryDirectory: './fixture',
          resourceLimits: {
            maxDiagnostics: 64,
            maxEntries: 32,
            maxEvidence: 128,
            maxFileBytes: 8,
            maxManifestBytes: 4,
            maxTotalBytes: 16,
          },
        },
      },
      kind: 'command',
    });
    expect(commandLineArguments).toStrictEqual(originalArguments);
  });

  test('normalizes every composition option', () => {
    expect(parseMoldeaCliArguments(['composition', '--json', '--no-color'])).toStrictEqual({
      invocation: {
        command: 'composition',
        options: {
          cursor: null,
          isColorDisabled: true,
          isJson: true,
          maxOutputBytes: MOLDEA_CLI_DEFAULT_OUTPUT_BYTES,
          path: null,
          pathsInput: 'none',
          repositoryDirectory: null,
          resourceLimits: DEFAULT_MOLDEA_CLI_RESOURCE_LIMITS,
        },
      },
      kind: 'command',
    });
  });

  test.each([
    [['scope', '--path', '/src/index.ts'], 'scope', '/src/index.ts', 'path'],
    [['scope', '--paths-stdin'], 'scope', null, 'stdin'],
    [['content', '--path', '/moldea/project.md'], 'content', '/moldea/project.md', 'path'],
  ] as const)('normalizes path command %o', (arguments_, command, path, pathsInput) => {
    expect(parseMoldeaCliArguments(arguments_)).toMatchObject({
      invocation: {
        command,
        options: { path, pathsInput },
      },
      kind: 'command',
    });
  });

  test('normalizes bounded JSON pagination options', () => {
    expect(
      parseMoldeaCliArguments([
        'inspect',
        '--json',
        '--max-output-bytes',
        '4096',
        '--cursor',
        'opaque_cursor',
      ]),
    ).toMatchObject({
      invocation: {
        options: { cursor: 'opaque_cursor', maxOutputBytes: 4096 },
      },
      kind: 'command',
    });
  });

  test.each([
    [['unknown'], null, false],
    [['compatibility'], null, false],
    [['--json'], null, true],
    [['--help', '--json'], null, true],
    [['--version', '--json'], null, true],
    [['validate', '--help', '--json'], 'validate', true],
    [['validate', '--version'], 'validate', false],
    [['validate', '--unknown'], 'validate', false],
    [['validate', 'extra'], 'validate', false],
    [['validate', '--json', '--json'], 'validate', true],
    [['validate', '--repository'], 'validate', false],
    [['validate', '--repository', '--json'], 'validate', true],
    [['validate', '--repository', ''], 'validate', false],
    [['validate', '--repository', 'before\0after'], 'validate', false],
    [['composition', '--repository', '.'], 'composition', false],
    [['composition', '--max-entries', '1'], 'composition', false],
    [['scope'], 'scope', false],
    [['scope', '--path', '/src/a.ts', '--paths-stdin'], 'scope', false],
    [['content'], 'content', false],
    [['content', '--paths-stdin'], 'content', false],
    [['content', '--path', '/moldea/project.md', '--paths-stdin'], 'content', false],
    [['scope', '--path', '/src/a.ts', '--max-evidence', '1'], 'scope', false],
    [['content', '--path', '/moldea/project.md', '--max-manifest-bytes', '1'], 'content', false],
    [['content', '--path', '/moldea/project.md', '--max-diagnostics', '1'], 'content', false],
    [['content', '--path', '/moldea/project.md', '--max-evidence', '1'], 'content', false],
    [['validate', '--path', '/src/a.ts'], 'validate', false],
    [['inspect', '--cursor', 'opaque_cursor'], 'inspect', false],
    [['inspect', '--max-output-bytes', '4096'], 'inspect', false],
  ])(
    'rejects invalid argument shape %o',
    (commandLineArguments, expectedCommand, expectedIsJson) => {
      expect(parseMoldeaCliArguments(commandLineArguments)).toStrictEqual({
        code: 'INVALID_ARGUMENT',
        command: expectedCommand,
        isJson: expectedIsJson,
        kind: 'error',
      });
    },
  );

  test.each(['0', '-1', '+1', '1.0', '1e3', '1_000', '9007199254740992'])(
    'rejects invalid resource value %s',
    (resourceValue) => {
      expect(parseMoldeaCliArguments(['validate', '--max-entries', resourceValue])).toStrictEqual({
        code: 'RESOURCE_LIMIT_CONFIGURATION_INVALID',
        command: 'validate',
        isJson: false,
        kind: 'error',
      });
    },
  );

  test('rejects duplicate value options and inconsistent byte limits', () => {
    expect(
      parseMoldeaCliArguments(['validate', '--max-entries', '1', '--max-entries', '2']),
    ).toStrictEqual({
      code: 'INVALID_ARGUMENT',
      command: 'validate',
      isJson: false,
      kind: 'error',
    });
    expect(parseMoldeaCliArguments(['validate', '--max-file-bytes', '1'])).toStrictEqual({
      code: 'RESOURCE_LIMIT_CONFIGURATION_INVALID',
      command: 'validate',
      isJson: false,
      kind: 'error',
    });
  });

  test('accepts the maximum safe integer when byte limits remain consistent', () => {
    const maximumSafeInteger = String(Number.MAX_SAFE_INTEGER);
    const result = parseMoldeaCliArguments([
      'validate',
      '--max-manifest-bytes',
      maximumSafeInteger,
      '--max-file-bytes',
      maximumSafeInteger,
      '--max-total-bytes',
      maximumSafeInteger,
    ]);

    expect(result).toMatchObject({
      invocation: {
        options: {
          resourceLimits: {
            maxFileBytes: Number.MAX_SAFE_INTEGER,
            maxManifestBytes: Number.MAX_SAFE_INTEGER,
            maxTotalBytes: Number.MAX_SAFE_INTEGER,
          },
        },
      },
      kind: 'command',
    });
  });

  test.each(['4095', '1048577'])('rejects out-of-range output budget %s', (outputBytes) => {
    expect(
      parseMoldeaCliArguments(['inspect', '--json', '--max-output-bytes', outputBytes]),
    ).toStrictEqual({
      code: 'RESOURCE_LIMIT_CONFIGURATION_INVALID',
      command: 'inspect',
      isJson: true,
      kind: 'error',
    });
  });
});

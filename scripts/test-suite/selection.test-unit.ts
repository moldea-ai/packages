import { expect, test, vi } from 'vitest';

import { createTestConfig } from '../../configs/vitest/test.config.js';

import {
  createVitestSuiteOptions,
  isEssentialTestSuite,
  parseTestSuiteArguments,
} from '#test-suite/index';

test.each([
  [undefined, false],
  ['full', false],
  ['essential', true],
] as const)('isEssentialTestSuite(%s) -> %s', (suite, expected) => {
  const env: NodeJS.ProcessEnv = suite === undefined ? {} : { MOLDEA_TEST_SUITE: suite };
  expect(isEssentialTestSuite(env)).toBe(expected);
});

test.each(['', 'FULL', 'unknown'])('rejects invalid granular mode %s', (suite) => {
  expect(() => isEssentialTestSuite({ MOLDEA_TEST_SUITE: suite })).toThrow(
    'MOLDEA_TEST_SUITE must be essential or full when set.',
  );
});

test.each(['essential', 'full'] as const)('parses %s root stages in order', (suite) => {
  expect(parseTestSuiteArguments([suite])).toStrictEqual({
    suite,
    stages: ['unit', 'integration', 'e2e'],
  });
  expect(parseTestSuiteArguments([suite, 'integration'])).toStrictEqual({
    suite,
    stages: ['integration'],
  });
});

test.each([[[]], [['invalid']], [['essential', 'other']], [['full', 'unit', 'extra']]])(
  'rejects malformed arguments %o',
  (args) => {
    expect(() => parseTestSuiteArguments(args)).toThrow(
      'Expected essential or full and optionally unit, integration, or e2e.',
    );
  },
);

test('essential configuration excludes full files before import and keeps empty discovery failing', () => {
  vi.stubEnv('MOLDEA_TEST_SUITE', 'essential');
  const config = createTestConfig({ suite: 'unit', fullOnlyFiles: ['fixture/full.test-unit.ts'] });
  expect(config.test?.exclude).toContain('fixture/full.test-unit.ts');
  expect(config.test?.exclude).toContain('**/{_archive,_archives,_backup,_backups}/**');
  expect(config.test?.tags).toStrictEqual([{ name: 'full', skip: true }]);
  expect(config.test?.passWithNoTests).toBe(false);
});

test.each([undefined, 'full'])('granular %s keeps all files and full tags available', (suite) => {
  vi.stubEnv('MOLDEA_TEST_SUITE', suite);
  expect(createVitestSuiteOptions({ fullOnlyFiles: ['secondary.ts'] })).toStrictEqual({
    tags: [{ name: 'full', skip: false }],
    exclude: [],
  });
});

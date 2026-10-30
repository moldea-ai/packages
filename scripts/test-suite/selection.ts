import type { TestTagDefinition } from 'vitest/config';

import { TEST_STAGE_VALUES, TEST_SUITE_VALUES } from '#test-suite/constants';
import type { ITestStage, ITestSuite, ITestSuiteRun } from '#test-suite/types';

/**
 * Reads granular selection; unset retains complete coverage.
 * @returns Whether essential selection is active.
 * @throws
 * - MOLDEA_TEST_SUITE must be essential or full when set.
 */
export const isEssentialTestSuite = (environment: NodeJS.ProcessEnv = process.env): boolean => {
  const suite = environment['MOLDEA_TEST_SUITE'];
  if (suite === undefined || suite === 'full') return false;
  if (suite === 'essential') return true;
  throw new TypeError('MOLDEA_TEST_SUITE must be essential or full when set.');
};

/**
 * Selects native full-only tags and excludes files before Vitest imports them.
 * @returns Selection options without weakening empty-discovery failures.
 * @throws
 * - MOLDEA_TEST_SUITE must be essential or full when set.
 */
export const createVitestSuiteOptions = ({
  fullOnlyFiles = [],
}: { fullOnlyFiles?: readonly string[] } = {}): {
  tags: TestTagDefinition[];
  exclude: string[];
} => {
  const isEssential = isEssentialTestSuite();
  return {
    tags: [{ name: 'full', skip: isEssential }],
    exclude: isEssential ? [...fullOnlyFiles] : [],
  };
};

/**
 * Parses one root mode and optional stage before starting preparation.
 * @returns The forced mode and ordered stages.
 * @throws
 * - Expected essential or full and optionally unit, integration, or e2e.
 */
export const parseTestSuiteArguments = (args: string[]): ITestSuiteRun => {
  const [suite, stage] = args;
  if (
    args.length < 1 ||
    args.length > 2 ||
    !TEST_SUITE_VALUES.some((candidate) => candidate === suite) ||
    (stage !== undefined && !TEST_STAGE_VALUES.some((candidate) => candidate === stage))
  )
    throw new TypeError('Expected essential or full and optionally unit, integration, or e2e.');
  return {
    suite: suite as ITestSuite,
    stages: stage === undefined ? [...TEST_STAGE_VALUES] : [stage as ITestStage],
  };
};

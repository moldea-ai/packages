import type { TEST_STAGE_VALUES, TEST_SUITE_VALUES } from '#test-suite/constants';

// validated root-command selection
export type ITestSuite = (typeof TEST_SUITE_VALUES)[number];
export type ITestStage = (typeof TEST_STAGE_VALUES)[number];
export interface ITestSuiteRun {
  suite: ITestSuite;
  stages: ITestStage[];
}

// contracts
export type { ITestStage, ITestSuite, ITestSuiteRun } from '#test-suite/types';

// suite policy
export {
  isEssentialTestSuite,
  createVitestSuiteOptions,
  parseTestSuiteArguments,
} from '#test-suite/selection';

// shared whole-file classification
export { FULL_ONLY_TEST_FILES } from '#test-suite/constants';

// execution
export { runTestSuite } from '#test-suite/runner';

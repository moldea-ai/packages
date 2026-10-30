import { relative, resolve, sep } from 'node:path';

import { configDefaults, defineConfig, type ViteUserConfig } from 'vitest/config';

import { createVitestSuiteOptions, FULL_ONLY_TEST_FILES } from '#test-suite';

// cross-platform budget for package, filesystem, compiler, and process integration work
const INTEGRATION_TEST_TIMEOUT_MS = 120_000;

// supported correctness-test categories and shared test-config inputs
export type ITestSuiteKind = 'e2e' | 'integration' | 'unit';

export interface ITestConfigOptions {
  readonly include?: readonly string[];
  readonly suite: ITestSuiteKind;
  readonly fullOnlyFiles?: readonly string[];
}

/**
 * Creates the shared Node.js Vitest configuration for one package test suite.
 * @param options The suite kind and optional package-specific file patterns.
 * @returns A deterministic Vitest configuration without global test APIs.
 * @throws
 * - MOLDEA_TEST_SUITE must be essential or full when set.
 */
export const createTestConfig = (options: ITestConfigOptions): ViteUserConfig => {
  const include = options.include ?? [`src/**/*.test-${options.suite}.ts`];
  const workspace = relative(resolve(import.meta.dirname, '../..'), process.cwd())
    .split(sep)
    .join('/');
  const selection = createVitestSuiteOptions({
    fullOnlyFiles: [...(FULL_ONLY_TEST_FILES[workspace] ?? []), ...(options.fullOnlyFiles ?? [])],
  });

  return defineConfig({
    test: {
      clearMocks: true,
      environment: 'node',
      exclude: [
        ...configDefaults.exclude,
        '**/{_archive,_archives,_backup,_backups}/**',
        ...selection.exclude,
      ],
      tags: selection.tags,
      globals: false,
      include: [...include],
      passWithNoTests: false,
      restoreMocks: true,
      ...(options.suite === 'integration'
        ? {
            hookTimeout: INTEGRATION_TEST_TIMEOUT_MS,
            testTimeout: INTEGRATION_TEST_TIMEOUT_MS,
          }
        : {}),
      sequence: {
        shuffle: false,
      },
      unstubEnvs: true,
      unstubGlobals: true,
    },
  });
};

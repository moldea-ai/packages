// closed suite selections and ordered correctness stages
export const TEST_SUITE_VALUES = ['essential', 'full'] as const;
export const TEST_STAGE_VALUES = ['unit', 'integration', 'e2e'] as const;

// secondary presentation and calibration files excluded before imports in essential runs
export const FULL_ONLY_TEST_FILES: Record<string, readonly string[]> = {
  '': ['scripts/resource-calibration/**/*.test-integration.ts'],
  'projects/website-ui': [
    'src/{code-diff,code-presentation,evaluation-replay,inspection-presentation,runtime-catalog,site,theme}/**/*.test-unit.ts',
  ],
};

// whole workspace categories whose setup is unnecessary for essential guarantees
export const ESSENTIAL_WORKSPACE_FILTERS = {
  unit: ['--filter=!@moldea.ai/packages-website'],
  integration: ['--filter=!@moldea.ai/packages-website', '--filter=!@moldea.ai/website-ui'],
  e2e: ['--filter=!@moldea.ai/packages-website'],
} as const;

// @vitest-environment node
import { readFileSync } from 'node:fs';

import { parse } from 'yaml';
import { expect, test } from 'vitest';

import { CI_COMPATIBILITY_LANES, createCiMatrices, createCiPlan } from '../../scripts/ci/index.ts';

// workflow wiring complements real planner, runner, and final-gate behavior tests
interface IJob {
  name?: string;
  if?: string;
  container?: { image?: string; options?: string };
  needs?: string | string[];
  env?: Record<string, string>;
  outputs?: Record<string, string>;
  strategy?: { matrix?: unknown };
  steps?: { name?: string; run?: string; if?: string; env?: Record<string, string> }[];
}
const source = readFileSync(new URL('./ci.yml', import.meta.url), 'utf8');
const workflow = parse(source) as {
  on: Record<string, { inputs?: Record<string, unknown> }>;
  env: Record<string, string>;
  jobs: Record<string, IJob>;
  permissions: Record<string, string>;
};

test('packed consumers use the reviewed registry snapshot unless the canary requests live', () => {
  expect(workflow.env['MOLDEA_LIVE_REGISTRY']).toBe(
    "${{ inputs.live_registry == true && 'true' || 'false' }}",
  );
  const consumerSteps = Object.values(workflow.jobs).flatMap(({ steps = [] }) =>
    steps.flatMap((step, index) =>
      step.name?.startsWith('Test Packed ') ? [{ step, previous: steps[index - 1] }] : [],
    ),
  );

  // the existing-Vitest CLI check and the CLI and Repository FS runtime checks
  expect(consumerSteps).toHaveLength(3);
  for (const { previous } of consumerSteps) {
    expect(previous).toStrictEqual({
      name: 'Pin Registry Snapshot',
      if: "${{ env.MOLDEA_LIVE_REGISTRY != 'true' }}",
      run: 'node configs/registry-snapshot/write-environment.mjs >> "$GITHUB_ENV"',
    });
  }
  // the Skill consumer lanes receive the same snapshot, or none when the canary resolves live
  expect(
    workflow.jobs['plan']?.steps?.find(({ name }) => name === 'Resolve Registry Snapshot'),
  ).toMatchObject({ if: "${{ env.MOLDEA_LIVE_REGISTRY != 'true' }}" });
  expect(workflow.jobs['plan']?.outputs?.['registry_snapshot']).toBe(
    '${{ steps.registry.outputs.registry_snapshot }}',
  );
});

test('planner uses the tested merge checkout and explicit main comparison, with closed outputs', () => {
  const step = workflow.jobs['plan']?.steps?.find(
    ({ name }) => name === 'Select Verification Workspaces',
  );
  expect(step).toMatchObject({
    run: 'node scripts/ci/plan.ts',
    env: {
      CI_BASE_COMMIT:
        "${{ inputs.comparison_commit || github.event.pull_request.base.sha || github.event.before || '' }}",
      CI_TESTED_COMMIT: '${{ github.sha }}',
      CI_RELEASE_BUILD: "${{ inputs.release_build == true && 'true' || 'false' }}",
      CI_TEST_SUITE: "${{ inputs.test_suite || 'essential' }}",
    },
  });
  expect(workflow.jobs['plan']?.outputs?.['plan']).toBe('${{ steps.selection.outputs.plan }}');
  expect(source).toContain('RELEASE_CURRENT_COMMIT: ${{ github.event.pull_request.head.sha }}');
});

test('heavy checks consume the validated plan without packing artifacts', () => {
  const checks = workflow.jobs['checks'];
  expect(checks?.needs).toBe('plan');
  expect(checks?.env?.['MOLDEA_CI_PLAN']).toBe('${{ needs.plan.outputs.plan }}');
  expect(
    checks?.steps?.find(({ name }) => name === 'Verify Selected Workspaces and Shared Contracts')
      ?.run,
  ).toBe('pnpm ci:run checks');
  expect(checks?.steps?.map(({ name }) => name)).not.toContain('Pack Public Package Artifacts');
  expect(source).not.toContain('run: pnpm docs:check');
});

test('a conditional pack job builds the complete artifacts in the checks image', () => {
  const pack = workflow.jobs['pack'];
  expect(pack).toMatchObject({
    needs: 'plan',
    if: "${{ needs.plan.outputs.artifacts == 'true' }}",
    container: workflow.jobs['checks']?.container,
  });
  expect(pack?.steps?.map(({ name }) => name).slice(-3)).toStrictEqual([
    'Build Public Packages',
    'Pack Public Package Artifacts',
    'Upload Public Package Artifacts',
  ]);
  expect(pack?.steps?.find(({ name }) => name === 'Build Public Packages')?.run).toBe(
    'pnpm exec turbo run build --filter=@moldea.ai/cli... --filter=@moldea.ai/website-ui',
  );
  expect(source).toContain('expected_tarball_count=5');
});

test('each compatibility lane depends on the packed artifacts and its matching selection output', () => {
  for (const lane of CI_COMPATIBILITY_LANES) {
    expect(workflow.jobs[lane]?.needs).toStrictEqual(['plan', 'pack']);
    expect(workflow.jobs[lane]?.if).toBe(
      `\${{ needs.plan.outputs.${lane.replaceAll('-', '_')} == 'true' }}`,
    );
  }
  expect(workflow.jobs['test-cross-platform']).toMatchObject({
    needs: 'plan',
    if: "${{ needs.plan.outputs.cross_platform == 'true' }}",
    env: { MOLDEA_CI_PLAN: '${{ needs.plan.outputs.plan }}' },
  });
  expect(
    workflow.jobs['test-cross-platform']?.steps?.find(
      ({ name }) => name === 'Test Selected Workspaces',
    )?.run,
  ).toBe('pnpm ci:run test');
});

test('stable required gate always evaluates every lane without gaining publication permissions', () => {
  expect(workflow.permissions).toStrictEqual({ contents: 'read' });
  expect(workflow.jobs['verify']).toMatchObject({
    name: 'Verify Repository',
    if: '${{ always() }}',
    needs: ['plan', 'checks', 'pack', ...CI_COMPATIBILITY_LANES, 'test-cross-platform'],
  });
  expect(
    workflow.jobs['verify']?.steps?.find(({ name }) => name === 'Require Successful Selected Jobs'),
  ).toMatchObject({
    run: 'node scripts/ci/run.ts gate',
    env: { MOLDEA_CI_PLAN: '${{ needs.plan.outputs.plan }}', GITHUB_NEEDS: '${{ toJSON(needs) }}' },
  });
});

test('routine suite inputs and closed matrices preserve native platform eligibility', () => {
  const essential = createCiPlan({
    testedCommit: 'a'.repeat(40),
    comparisonCommit: null,
    current: new Map(),
    previous: new Map(),
    changedPaths: [],
    testSuite: 'essential',
  });
  expect(createCiMatrices(essential).cli['node-version']).toStrictEqual([
    workflow.env['NODE_VERSION'],
  ]);
  expect(workflow.on['workflow_call']?.inputs?.['test_suite']).toMatchObject({
    type: 'string',
    default: 'essential',
  });
  expect(workflow.on['workflow_dispatch']?.inputs?.['test_suite']).toMatchObject({
    type: 'choice',
    default: 'essential',
    options: ['essential', 'full'],
  });
  expect(workflow.jobs['cli-runtime-compatibility']?.strategy?.matrix).toBe(
    '${{ fromJSON(needs.plan.outputs.cli_runtime_matrix) }}',
  );
  expect(workflow.jobs['repository-fs-runtime-compatibility']?.strategy?.matrix).toBe(
    '${{ fromJSON(needs.plan.outputs.repository_fs_runtime_matrix) }}',
  );
  expect(workflow.jobs['test-cross-platform']?.strategy?.matrix).toStrictEqual({
    os: ['macos-latest', 'windows-latest'],
  });
  expect(workflow.jobs['test-cross-platform']?.if).toBe(
    "${{ needs.plan.outputs.cross_platform == 'true' }}",
  );
  expect(
    workflow.jobs['test-cross-platform']?.steps?.find(
      ({ name }) => name === 'Install Website Browser',
    )?.if,
  ).toBe("${{ needs.plan.outputs.website == 'true' && needs.plan.outputs.test_suite == 'full' }}");
  for (const name of ['test_suite', 'cli_runtime_matrix', 'repository_fs_runtime_matrix'])
    expect(workflow.jobs['plan']?.outputs?.[name]).toBe(
      '' + '${{ steps.selection.outputs.' + name + ' }}',
    );
});

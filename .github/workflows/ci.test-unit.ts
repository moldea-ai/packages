// @vitest-environment node
import { readFileSync } from 'node:fs';

import { parse } from 'yaml';
import { expect, test } from 'vitest';

import { CI_COMPATIBILITY_LANES } from '../../scripts/ci/index.ts';

// workflow wiring complements real planner, runner, and final-gate behavior tests
interface IJob {
  name?: string;
  if?: string;
  needs?: string | string[];
  env?: Record<string, string>;
  outputs?: Record<string, string>;
  steps?: { name?: string; run?: string; if?: string; env?: Record<string, string> }[];
}
const source = readFileSync(new URL('./ci.yml', import.meta.url), 'utf8');
const workflow = parse(source) as {
  jobs: Record<string, IJob>;
  permissions: Record<string, string>;
};

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
    },
  });
  expect(workflow.jobs['plan']?.outputs?.['plan']).toBe('${{ steps.selection.outputs.plan }}');
  expect(source).toContain('RELEASE_CURRENT_COMMIT: ${{ github.event.pull_request.head.sha }}');
});

test('heavy checks consume the validated plan and retain conditional complete artifacts', () => {
  const checks = workflow.jobs['checks'];
  expect(checks?.needs).toBe('plan');
  expect(checks?.env?.['MOLDEA_CI_PLAN']).toBe('${{ needs.plan.outputs.plan }}');
  expect(
    checks?.steps?.find(({ name }) => name === 'Verify Selected Workspaces and Shared Contracts')
      ?.run,
  ).toBe('pnpm ci:run checks');
  for (const name of ['Pack Public Package Artifacts', 'Upload Public Package Artifacts'])
    expect(checks?.steps?.find((step) => step.name === name)?.if).toBe(
      "${{ needs.plan.outputs.artifacts == 'true' }}",
    );
  expect(source).not.toContain('run: pnpm docs:check');
  expect(source).toContain('expected_tarball_count=15');
});

test('each compatibility lane depends on successful checks and its matching selection output', () => {
  for (const lane of CI_COMPATIBILITY_LANES) {
    expect(workflow.jobs[lane]?.needs).toStrictEqual(['plan', 'checks']);
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
    needs: ['plan', 'checks', ...CI_COMPATIBILITY_LANES, 'test-cross-platform'],
  });
  expect(
    workflow.jobs['verify']?.steps?.find(({ name }) => name === 'Require Successful Selected Jobs'),
  ).toMatchObject({
    run: 'node scripts/ci/run.ts gate',
    env: { MOLDEA_CI_PLAN: '${{ needs.plan.outputs.plan }}', GITHUB_NEEDS: '${{ toJSON(needs) }}' },
  });
});

// @vitest-environment node
import { readFileSync } from 'node:fs';

import { parse } from 'yaml';
import { expect, test } from 'vitest';

// the canary reuses selected CI verification against the live registry and only reports failures
interface IJob {
  if?: string;
  needs?: string;
  permissions?: Record<string, string>;
  uses?: string;
  with?: Record<string, unknown>;
  steps?: { run?: string; env?: Record<string, string> }[];
}
const workflow = parse(readFileSync(new URL('./registry-canary.yml', import.meta.url), 'utf8')) as {
  on: { schedule: { cron: string }[]; workflow_dispatch: { inputs: Record<string, unknown> } };
  permissions: Record<string, string>;
  jobs: Record<string, IJob>;
};

test('runs on a daily schedule and on demand without default permissions', () => {
  expect(workflow.on.schedule).toHaveLength(1);
  expect(Object.keys(workflow.on)).toStrictEqual(['schedule', 'workflow_dispatch']);
  expect(workflow.permissions).toStrictEqual({});
});

test('defaults to essential live qualification and exposes explicit full verification against the live registry', () => {
  expect(workflow.jobs['verify']).toMatchObject({
    uses: './.github/workflows/ci.yml',
    permissions: { contents: 'read' },
    with: {
      test_suite: "${{ inputs.test_suite || 'essential' }}",
      live_registry: true,
      release_project: 'registry-canary',
    },
  });
});

test('reports only verification failures, with issue permissions alone', () => {
  const report = workflow.jobs['report'];

  expect(report).toMatchObject({
    needs: 'verify',
    if: "${{ always() && needs.verify.result == 'failure' }}",
    permissions: { issues: 'write' },
  });
  expect(report?.steps?.[0]?.env?.['GH_TOKEN']).toBe('${{ github.token }}');
  expect(report?.steps?.[0]?.run).toContain('gh issue comment');
  expect(report?.steps?.[0]?.run).toContain('gh issue create');
});

test('full qualification is explicit and cannot acquire publication permissions', () => {
  expect(workflow.on.workflow_dispatch.inputs['test_suite']).toMatchObject({
    default: 'essential',
    options: ['essential', 'full'],
  });
  expect(workflow.jobs['verify']?.with).not.toHaveProperty('release_build');
  expect(workflow.jobs['report']?.steps?.[0]?.run).toContain(
    'Daily essential checks do not replace explicit full live qualification.',
  );
});

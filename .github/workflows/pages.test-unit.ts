// @vitest-environment node
import { readFileSync } from 'node:fs';

import { parse } from 'yaml';
import { expect, test } from 'vitest';

// only the workflow fields that define when and what the site deploys
interface IWorkflow {
  name: string;
  on: Record<string, unknown>;
  concurrency?: { group?: string; 'cancel-in-progress'?: boolean };
  jobs: Record<
    string,
    {
      if?: string;
      needs?: string | string[];
      steps?: { name?: string; run?: string; with?: Record<string, unknown> }[];
    }
  >;
}

const workflow = parse(readFileSync(new URL('pages.yml', import.meta.url), 'utf8')) as IWorkflow;
const publish = parse(readFileSync(new URL('publish.yml', import.meta.url), 'utf8')) as IWorkflow;

test('deploys after every completed main publish run and retains manual dispatch', () => {
  expect(workflow.on).toStrictEqual({
    workflow_run: { workflows: [publish.name], types: ['completed'], branches: ['main'] },
    workflow_dispatch: null,
  });
  // publication runs on every main push, so every website input change reaches a deployment
  expect(publish.on['push']).toStrictEqual({ branches: ['main'] });
  expect(workflow.jobs['build']?.if).toBe(
    "${{ github.event_name == 'workflow_dispatch' || github.event.workflow_run.conclusion == 'success' }}",
  );
});

test('builds, verifies and announces the exact published commit', () => {
  const checkouts = Object.values(workflow.jobs).flatMap(({ steps = [] }) =>
    steps.filter(({ name }) => name === 'Checkout exact main commit'),
  );
  expect(checkouts).toHaveLength(3);
  for (const checkout of checkouts)
    expect(checkout.with).toStrictEqual({
      ref: '${{ github.event.workflow_run.head_sha || github.sha }}',
    });
  expect(workflow.jobs['submit-sitemap']?.if).toBe("${{ github.event_name == 'workflow_run' }}");
});

test('requires npm availability before deploying the built artifact', () => {
  expect(workflow.jobs['deploy']?.needs).toStrictEqual(['build', 'availability']);
  expect(
    workflow.jobs['availability']?.steps?.some(({ run }) => run === 'pnpm release:availability'),
  ).toBe(true);
});

test('queues a newer deployment instead of cancelling one in progress', () => {
  expect(workflow.concurrency).toStrictEqual({
    group: 'github-pages',
    'cancel-in-progress': false,
  });
});

test('keeps source, quality, artifact validation and publication safety without frontend test permutations', () => {
  const runs =
    workflow.jobs['build']?.steps?.flatMap(({ run }) => (run === undefined ? [] : [run])) ?? [];
  for (const required of [
    'pnpm docs:check',
    'pnpm --filter @moldea.ai/packages-website typecheck',
    'pnpm --filter @moldea.ai/packages-website lint',
    'pnpm website:build',
  ])
    expect(runs).toContain(required);
  expect(runs.some((run) => /test:(unit|integration|e2e)/u.test(run))).toBe(false);
});

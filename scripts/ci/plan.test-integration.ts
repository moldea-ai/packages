// @vitest-environment node
import { execFileSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, expect, test } from 'vitest';

import { parseCiPlan } from './index.ts';

const entry = fileURLToPath(new URL('./plan.ts', import.meta.url));
let directory: string;
let base: string;
let head: string;
const git = (...args: string[]) =>
  execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim();
const write = async (path: string, source: string) => {
  await mkdir(dirname(join(directory, path)), { recursive: true });
  await writeFile(join(directory, path), source);
  git('add', '--', path);
};
const commit = () => {
  git('commit', '--quiet', '--no-gpg-sign', '-m', 'fixture');
  return git('rev-parse', 'HEAD');
};
const run = (env: Record<string, string> = {}) =>
  spawnSync(process.execPath, [entry], {
    cwd: directory,
    encoding: 'utf8',
    env: {
      ...process.env,
      CI_BASE_COMMIT: base,
      CI_TESTED_COMMIT: head,
      CI_RELEASE_BUILD: 'false',
      GITHUB_OUTPUT: join(directory, 'outputs.txt'),
      GITHUB_STEP_SUMMARY: join(directory, 'summary.md'),
      ...env,
    },
  });

beforeEach(async () => {
  directory = join(tmpdir(), `moldea-ci-plan-${randomUUID()}`);
  await mkdir(directory);
  git('init', '--quiet');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.com');
  git('config', 'core.hooksPath', join(directory, 'no-hooks'));
  await write(
    'apps/website/package.json',
    JSON.stringify({
      name: '@moldea.ai/packages-website',
      private: true,
      scripts: { build: 'astro build' },
    }),
  );
  base = commit();
  await write('apps/website/page.astro', '<h1>Example</h1>');
  head = commit();
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

test('planner binds actual checkout, validates outputs and reports website-only selection', async () => {
  const result = run();
  expect(result.status).toBe(0);
  const plan = parseCiPlan(result.stdout.trim());
  expect(plan).toMatchObject({
    testedCommit: head,
    comparisonCommit: base,
    mode: 'affected',
    workspaces: ['@moldea.ai/packages-website'],
    rootIntegration: false,
    lanes: [],
    artifacts: false,
  });
  const outputs = await readFile(join(directory, 'outputs.txt'), 'utf8');
  expect(outputs).toContain(`plan=${JSON.stringify(plan)}\n`);
  expect(outputs).toContain('cross_platform=true\n');
  expect(outputs).toContain('cli_runtime_compatibility=false\n');
  expect(await readFile(join(directory, 'summary.md'), 'utf8')).toContain(head);
});

test.each(['', '0'.repeat(40), 'f'.repeat(40)])(
  'planner uses full verification for absent/initial/unavailable base (%s)',
  (comparison) => {
    const result = run({ CI_BASE_COMMIT: comparison });
    expect(result.status).toBe(0);
    expect(parseCiPlan(result.stdout.trim())).toMatchObject({
      mode: 'full',
      comparisonCommit: null,
      artifacts: true,
    });
  },
);

test('actual release candidates force full verification for otherwise website-only changes', () => {
  const result = run({ CI_RELEASE_BUILD: 'true' });
  expect(result.status).toBe(0);
  expect(parseCiPlan(result.stdout.trim())).toMatchObject({
    mode: 'full',
    comparisonCommit: base,
    artifacts: true,
  });
});

test.each([
  { CI_BASE_COMMIT: '--all' },
  { CI_TESTED_COMMIT: 'f'.repeat(40) },
  { CI_RELEASE_BUILD: 'yes' },
])('planner rejects malformed workflow inputs %o', (env) => {
  const result = run(env);
  expect(result.status).not.toBe(0);
  expect(result.stderr).toMatch(/invalid|does not match/u);
});

test('planner traverses old removed edges after a dependency workspace is deleted', async () => {
  await write('packages/input/package.json', JSON.stringify({ name: 'input', private: true }));
  await write(
    'apps/website/package.json',
    JSON.stringify({
      name: '@moldea.ai/packages-website',
      private: true,
      devDependencies: { input: 'workspace:*' },
    }),
  );
  base = commit();
  git('rm', '--', 'packages/input/package.json');
  await write(
    'apps/website/package.json',
    JSON.stringify({ name: '@moldea.ai/packages-website', private: true }),
  );
  head = commit();
  const result = run();
  expect(result.status).toBe(0);
  expect(parseCiPlan(result.stdout.trim()).workspaces).toStrictEqual([
    '@moldea.ai/packages-website',
  ]);
});

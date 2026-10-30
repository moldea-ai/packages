// @vitest-environment node
import { execFileSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { afterEach, beforeEach, expect, test } from 'vitest';

import { getGitHead, loadGitWorkspaceSnapshot } from '../workspace-graph/index.ts';

import { createCiPlan } from './index.ts';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const entry = fileURLToPath(new URL('./run.ts', import.meta.url));
const packageManager = process.env['npm_execpath'];
const turboCli = fileURLToPath(new URL('../../node_modules/turbo/bin/turbo', import.meta.url));
let directory: string;
const git = (...args: string[]) =>
  execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim();
const write = async (path: string, source: string) => {
  await mkdir(dirname(join(directory, path)), { recursive: true });
  await writeFile(join(directory, path), source);
  git('add', '--', path);
};
const planFor = (
  paths: string[],
  fullReason?: string,
  testSuite: 'essential' | 'full' = 'full',
) => {
  const root = pathToFileURL(`${directory}${sep}`);
  const testedCommit = getGitHead(root);
  const current = loadGitWorkspaceSnapshot(root, testedCommit);
  return createCiPlan({
    testedCommit,
    comparisonCommit: testedCommit,
    current,
    previous: current,
    changedPaths: paths,
    testSuite,
    ...(fullReason === undefined ? {} : { fullReason }),
  });
};
const run = (
  plan = planFor(['apps/website/example.ts']),
  stage = 'checks',
  extraEnv: Record<string, string> = {},
) =>
  spawnSync(process.execPath, [entry, stage], {
    cwd: directory,
    encoding: 'utf8',
    env: {
      ...process.env,
      npm_execpath: packageManager,
      MOLDEA_CI_PLAN: JSON.stringify(plan),
      TURBO_TELEMETRY_DISABLED: '1',
      MOLDEA_TEST_SUITE: 'invalid-parent',
      ...extraEnv,
    },
    maxBuffer: 4 * 1024 * 1024,
  });

beforeEach(async () => {
  directory = join(repositoryRoot, `.ci-run-${randomUUID()}`);
  await mkdir(directory);
  git('init', '--quiet');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@example.com');
  git('config', 'core.hooksPath', join(directory, 'no-hooks'));
  const scripts = Object.fromEntries(
    [
      'website:prepare',
      'test:root:unit',
      'test:root:integration',
      'format:check',
      'lint:root',
      'typecheck:root',
    ].map((name) => [name, `node root.mjs ${name}`]),
  );
  await write(
    'package.json',
    JSON.stringify({
      name: 'ci-fixture',
      private: true,
      type: 'module',
      packageManager: 'pnpm@11.9.0',
      scripts,
    }),
  );
  await write('pnpm-workspace.yaml', 'packages:\n  - apps/*\n  - projects/*\n  - packages/*\n');
  await write(
    'pnpm-lock.yaml',
    "lockfileVersion: '9.0'\nimporters:\n  .: {}\n  projects/website-ui: {}\n  projects/cli: {}\n  packages/runtime: {}\n  apps/website:\n    dependencies:\n      '@moldea.ai/website-ui':\n        specifier: workspace:*\n        version: link:../../projects/website-ui\n",
  );
  await write(
    'turbo.json',
    JSON.stringify({
      tasks: {
        build: { dependsOn: ['^build'], outputs: ['build.out'] },
        'test:unit': { dependsOn: ['^test:unit'] },
        'test:integration': { dependsOn: ['build', '^test:integration'] },
        'test:e2e': { dependsOn: ['build', '^build'] },
        lint: { dependsOn: ['^lint'] },
        typecheck: { dependsOn: ['^typecheck'] },
      },
    }),
  );
  await write(
    'root.mjs',
    `import {appendFileSync,writeFileSync} from 'node:fs'; appendFileSync('execution.log',process.argv[2]+'\\n'); appendFileSync('selection.log',process.env.MOLDEA_TEST_SUITE+'\\n'); if(process.argv[2]==='website:prepare')writeFileSync('prepared','yes');`,
  );
  for (const [path, name, dependencies] of [
    ['projects/website-ui', '@moldea.ai/website-ui', {}],
    ['projects/cli', '@moldea.ai/cli', {}],
    ['apps/website', '@moldea.ai/packages-website', { '@moldea.ai/website-ui': 'workspace:*' }],
  ] as const) {
    const taskScripts = Object.fromEntries(
      ['build', 'test:unit', 'test:integration', 'test:e2e', 'lint', 'typecheck'].map((task) => [
        task,
        `node task.mjs ${task}`,
      ]),
    );
    await write(
      `${path}/package.json`,
      JSON.stringify({ name, private: true, scripts: taskScripts, dependencies }),
    );
    await write(
      `${path}/task.mjs`,
      `import {appendFileSync,writeFileSync,readFileSync} from 'node:fs'; const task=process.argv[2]; appendFileSync('../../execution.log',${JSON.stringify(name)}+':'+task+'\\n'); if(task==='build')writeFileSync('build.out','built'); if(${JSON.stringify(name)}==='@moldea.ai/website-ui' && task==='test:integration')process.exit(73); if(${JSON.stringify(name)}==='@moldea.ai/packages-website' && task.startsWith('test:')){readFileSync('build.out'); readFileSync('../../projects/website-ui/build.out');}`,
    );
  }
  await write(
    'packages/runtime/package.json',
    JSON.stringify({ name: '@moldea.ai/ci-runtime-fixture', private: true }),
  );
  git('commit', '--quiet', '--no-gpg-sign', '-m', 'fixture');
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

test('real Turbo builds dependencies but never executes their unselected tests or quality tasks', async () => {
  const dry = spawnSync(
    process.execPath,
    [turboCli, 'run', 'test:unit', '--only', '--filter=@moldea.ai/packages-website', '--dry=json'],
    { cwd: directory, encoding: 'utf8' },
  );
  expect(dry.status, dry.stderr).toBe(0);
  const graph = JSON.parse(dry.stdout) as { tasks: { taskId: string }[] };
  expect(graph.tasks.map(({ taskId }) => taskId)).toStrictEqual([
    '@moldea.ai/packages-website#test:unit',
  ]);
  const result = run();
  expect(result.stderr, result.stdout).not.toMatch(/Error|ELIFECYCLE/u);
  expect(result.status, result.stdout + result.stderr).toBe(0);
  const log = await readFile(join(directory, 'execution.log'), 'utf8');
  expect(log).toContain('@moldea.ai/website-ui:build');
  for (const task of ['lint', 'typecheck', 'test:unit', 'test:integration']) {
    expect(log).toContain(`@moldea.ai/packages-website:${task}`);
    expect(log).not.toContain(`@moldea.ai/website-ui:${task}`);
  }
  expect(log).not.toContain('@moldea.ai/packages-website:test:e2e');
  expect(log).toContain('website:prepare\n');
  expect(log).not.toMatch(/test:root:integration|upstream:check/u);
});

test.each([
  [[]],
  [['apps/website/_archive/ignored.ts']],
  [['apps/website/page.astro']],
  [['packages/runtime/source.ts']],
])('checks retain root verification after preparation for %o', async (paths) => {
  const result = run(planFor(paths));
  expect(result.status, result.stdout + result.stderr).toBe(0);
  const log = await readFile(join(directory, 'execution.log'), 'utf8');
  expect(log).toContain(
    'website:prepare\ntest:root:unit\nformat:check\nlint:root\ntypecheck:root\n',
  );
});

test('cross-platform runner executes selected correctness tasks and propagates real Turbo failures', async () => {
  const selected = planFor(['apps/website/page.astro']);
  const success = run(selected, 'test');
  expect(success.status, success.stdout + success.stderr).toBe(0);
  const log = await readFile(join(directory, 'execution.log'), 'utf8');
  expect(log).toContain('@moldea.ai/packages-website:test:integration');
  expect(log).not.toContain('@moldea.ai/packages-website:test:e2e');
  await writeFile(join(directory, 'apps/website/task.mjs'), 'process.exit(19);');
  const failed = run(selected, 'test');
  expect(failed.status).not.toBe(0);
  expect(failed.stdout + failed.stderr).toMatch(/failed|19/u);
});

test('full verification includes root integration and propagates a selected dependency test failure', async () => {
  const result = run(planFor([], 'Shared tooling changed.'));
  expect(result.status).not.toBe(0);
  const log = await readFile(join(directory, 'execution.log'), 'utf8');
  expect(log).toContain('test:root:integration');
  expect(log.indexOf('@moldea.ai/website-ui:test:unit')).toBeLessThan(
    log.indexOf('test:root:integration'),
  );
  expect(log.indexOf('test:root:integration')).toBeLessThan(
    log.indexOf('@moldea.ai/website-ui:test:integration'),
  );
});

test('runner refuses a stale commit or unknown workspace before starting any task', async () => {
  const stale = { ...planFor([]), testedCommit: 'f'.repeat(40) };
  expect(run(stale).stderr).toContain('checked-out commit');
  const invalid = { ...planFor([]), workspaces: ['@moldea.ai/website-ui'] };
  expect(
    run({
      ...invalid,
      workspaces: ['@moldea.ai/website-ui', '@moldea.ai/z-unknown'],
      rootIntegration: true,
    }).status,
  ).not.toBe(0);
  await expect(readFile(join(directory, 'execution.log'))).rejects.toThrow();
});

test('cross-platform full verification builds prerequisites before root integration', async () => {
  const result = run(planFor([], 'Full verification.'), 'test');
  expect(result.status).not.toBe(0); // the deliberately failing selected UI test remains real
  const log = await readFile(join(directory, 'execution.log'), 'utf8');
  expect(log.indexOf('@moldea.ai/website-ui:build')).toBeLessThan(
    log.indexOf('test:root:integration'),
  );
  expect(log.indexOf('website:prepare')).toBeLessThan(log.indexOf('test:root:unit'));
});

test.each(['checks', 'test'])(
  'essential %s retains quality/platform work while omitting full-only setup and tasks',
  async (stage) => {
    const selected = planFor([], 'Global tooling changed.', 'essential');
    const result = run(selected, stage);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const log = await readFile(join(directory, 'execution.log'), 'utf8');
    expect(log).not.toContain('website:prepare');
    expect(log).not.toContain('@moldea.ai/packages-website:test:');
    expect(log).not.toContain('@moldea.ai/website-ui:test:integration');
    expect(log).toContain('@moldea.ai/website-ui:test:unit');
    expect(log).toContain('@moldea.ai/cli:test:e2e');
    expect(log).toContain('test:root:integration');
    if (stage === 'checks')
      for (const task of ['lint', 'typecheck', 'build'])
        expect(log).toContain('@moldea.ai/packages-website:' + task);
    expect(
      (await readFile(join(directory, 'selection.log'), 'utf8'))
        .trim()
        .split('\n')
        .every((suite) => suite === 'essential'),
    ).toBe(true);
  },
);

test('real final gate fails closed on cancelled, skipped, failed and missing native platform results', () => {
  const plan = planFor(['apps/website/page.astro'], undefined, 'essential');
  const results = Object.fromEntries(
    [
      'plan',
      'checks',
      'pack',
      'consumer-conformance',
      'cli-testing-peer-compatibility',
      'repository-fs-runtime-compatibility',
      'cli-runtime-compatibility',
      'test-cross-platform',
    ].map((name) => [
      name,
      { result: ['plan', 'checks', 'test-cross-platform'].includes(name) ? 'success' : 'skipped' },
    ]),
  );
  expect(run(plan, 'gate', { GITHUB_NEEDS: JSON.stringify(results) }).status).toBe(0);
  for (const result of ['cancelled', 'skipped', 'failure'])
    expect(
      run(plan, 'gate', {
        GITHUB_NEEDS: JSON.stringify({ ...results, 'test-cross-platform': { result } }),
      }).status,
    ).not.toBe(0);
  delete results['test-cross-platform'];
  expect(run(plan, 'gate', { GITHUB_NEEDS: JSON.stringify(results) }).status).not.toBe(0);
});

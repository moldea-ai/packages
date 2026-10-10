import { spawnSync } from 'node:child_process';
import { extname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import { getGitHead, loadGitWorkspaceSnapshot } from '../workspace-graph/index.ts';

import { parseCiPlan, validateCiJobResults, validateCiWorkspaceSelection } from './selection.ts';

const repositoryRoot = pathToFileURL(`${resolve(process.cwd())}${sep}`);
const plan = parseCiPlan(process.env['MOLDEA_CI_PLAN'] ?? '');
if (getGitHead(repositoryRoot) !== plan.testedCommit)
  throw new TypeError('The CI plan does not match the checked-out commit.');
const snapshot = loadGitWorkspaceSnapshot(repositoryRoot, plan.testedCommit);
validateCiWorkspaceSelection(plan, snapshot);
const stage = process.argv[2];
if (stage !== 'checks' && stage !== 'test' && stage !== 'gate')
  throw new TypeError('The CI stage is invalid.');

/**
 * Executes package-manager arguments without a shell, preserving failures and signals.
 * @throws
 * - The package-manager entry point is missing.
 * - If the package-manager process cannot be started.
 */
const runPnpm = (args: string[]): void => {
  const packageManager = process.env['npm_execpath'];
  if (packageManager === undefined || packageManager === '')
    throw new TypeError('The package-manager entry point is missing.');
  // pnpm may expose a JavaScript CLI or its standalone native executable.
  const isJavaScriptCli = ['.js', '.mjs', '.cjs'].includes(extname(packageManager));
  const result = spawnSync(
    isJavaScriptCli ? process.execPath : packageManager,
    isJavaScriptCli ? [packageManager, ...args] : args,
    { stdio: 'inherit', env: process.env },
  );
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};

/** Builds prerequisites when requested and isolates quality tasks to their selected owners. */
const runSelectedTask = (task: string, includeDependencies: boolean): void => {
  const selected = plan.workspaces.filter((name) => snapshot.get(name)?.scripts.includes(task));
  if (selected.length === 0) return;
  runPnpm([
    'exec',
    'turbo',
    'run',
    task,
    ...(includeDependencies ? [] : ['--only']),
    ...(task === 'test:integration' || task === 'test:e2e' ? ['--concurrency=1'] : []),
    ...selected.map((name) => `--filter=${name}`),
  ]);
};

if (stage === 'gate') validateCiJobResults(plan, process.env['GITHUB_NEEDS'] ?? '');
else {
  if (stage === 'checks') {
    runPnpm(['website:prepare']);
    runPnpm(['compatibility:check']);
    runPnpm(['test:root:unit']);
    if (plan.rootIntegration) runPnpm(['upstream:check']);
    runPnpm(['format:check']);
    runPnpm(['lint:root']);
    runPnpm(['typecheck:root']);
  } else {
    if (plan.rootIntegration) runPnpm(['website:prepare']);
    runSelectedTask('build', true);
    if (plan.mode === 'full') runPnpm(['test:root:unit']);
  }
  if (stage === 'checks') {
    runSelectedTask('build', true);
    runSelectedTask('lint', false);
    runSelectedTask('typecheck', false);
  }
  runSelectedTask('test:unit', false);
  if (plan.rootIntegration) runPnpm(['test:root:integration']);
  runSelectedTask('test:integration', false);
  runSelectedTask('test:e2e', false);
}

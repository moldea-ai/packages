import {
  isExcludedPath,
  requireGitCommit,
  type IWorkspacePackageState,
} from '../workspace-graph/index.ts';

import type { ICiPlan, ICiRuntimeMatrices, ICiSelectionSources } from './types.ts';

import type { ITestSuite } from '#test-suite/types';

// artifact consumers kept in step with the existing compatibility jobs
export const CI_COMPATIBILITY_LANES = [
  'consumer-conformance',
  'cli-testing-peer-compatibility',
  'repository-fs-runtime-compatibility',
  'cli-runtime-compatibility',
];
// the packages website, whose browser suite runs locally instead of in CI
export const CI_WEBSITE_WORKSPACE = '@moldea.ai/packages-website';
// literal lowercase identifiers prevent Turbo filter expressions from entering a plan
const PACKAGE_NAME_PATTERN = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u;
const PLAN_FIELDS = [
  'testedCommit',
  'comparisonCommit',
  'mode',
  'testSuite',
  'reasons',
  'workspaces',
  'rootIntegration',
  'lanes',
  'artifacts',
];

const isRuntimePackage = (name: string): boolean =>
  name !== CI_WEBSITE_WORKSPACE && name !== '@moldea.ai/website-ui';

/** Maps selected package identities to the existing packed-consumer jobs. */
const selectLanes = (workspaces: string[], full: boolean, testSuite: ITestSuite): string[] => {
  const selected = new Set(workspaces);
  return CI_COMPATIBILITY_LANES.filter((lane) => {
    if (
      testSuite === 'essential' &&
      (lane === 'consumer-conformance' || lane === 'cli-testing-peer-compatibility')
    )
      return false;
    if (full) return true;
    if (lane === 'consumer-conformance' || lane.startsWith('cli-'))
      return selected.has('@moldea.ai/cli');
    return selected.has(`@moldea.ai/${lane.replace(/-runtime-compatibility$/u, '')}`);
  });
};

/**
 * Validates workflow priority without changing affected-workspace scope.
 * @returns The explicit suite, defaulting ordinary workflows to essential.
 * @throws
 * - The CI test-suite input is invalid.
 */
export const parseCiTestSuite = (suite: string | undefined): ITestSuite => {
  if (suite === undefined || suite === 'essential') return 'essential';
  if (suite === 'full') return 'full';
  throw new TypeError('The CI test-suite input is invalid.');
};

/**
 * Creates the closed packed-consumer matrices for a validated priority.
 * @returns Compact essential or complete supported runtime/OS dimensions.
 */
export const createCiMatrices = (plan: ICiPlan): ICiRuntimeMatrices => {
  const nodes =
    plan.testSuite === 'essential' ? ['24.15.0'] : ['22.17.0', '22.x', '24.11.0', '24.x', '26.8.1'];
  return {
    cli: {
      os:
        plan.testSuite === 'essential'
          ? ['ubuntu-latest']
          : ['ubuntu-latest', 'macos-latest', 'windows-latest'],
      'node-version': nodes,
    },
    repositoryFs: { 'node-version': nodes },
  };
};

/**
 * Builds the current execution set from the union of old and new reverse dependency edges.
 * @throws
 * - The Git commit is invalid.
 * - The CI test-suite input is invalid.
 */
export const createCiPlan = (sources: ICiSelectionSources): ICiPlan => {
  const testSuite = parseCiTestSuite(sources.testSuite);
  requireGitCommit(sources.testedCommit);
  if (sources.comparisonCommit !== null) requireGitCommit(sources.comparisonCommit);
  const changedPaths = sources.changedPaths.filter((path) => !isExcludedPath(path));
  const snapshots = [sources.previous, sources.current];
  const owners = new Map<string, Set<string>>();
  const consumers = new Map<string, Set<string>>();
  for (const snapshot of snapshots) {
    for (const workspace of snapshot.values()) {
      const names = owners.get(workspace.directory) ?? new Set<string>();
      names.add(workspace.name);
      owners.set(workspace.directory, names);
      for (const dependency of workspace.workspaceDependencies) {
        const names = consumers.get(dependency) ?? new Set<string>();
        names.add(workspace.name);
        consumers.set(dependency, names);
      }
    }
  }
  const selected = new Set<string>();
  const reasons = new Set<string>();
  if (sources.fullReason !== undefined) reasons.add(sources.fullReason);
  if (sources.comparisonCommit === null) reasons.add('No comparison commit is available.');
  let firstGlobalPath: string | undefined;
  for (const path of changedPaths) {
    if (path === 'specifications/repository-format.md') {
      selected.add(CI_WEBSITE_WORKSPACE);
      continue;
    }
    const segments = path.split('/');
    const owner = owners.get(segments.slice(0, 2).join('/'));
    if (owner === undefined) {
      if (firstGlobalPath === undefined || path < firstGlobalPath) firstGlobalPath = path;
    } else for (const name of owner) selected.add(name);
  }
  if (firstGlobalPath !== undefined) reasons.add(`Global or unknown input: ${firstGlobalPath}`);
  const full = reasons.size > 0;
  if (full) for (const name of sources.current.keys()) selected.add(name);
  else {
    const pending = [...selected];
    for (let index = 0; index < pending.length; index += 1) {
      for (const consumer of consumers.get(pending[index] ?? '') ?? []) {
        if (!selected.has(consumer)) {
          selected.add(consumer);
          pending.push(consumer);
        }
      }
    }
  }
  const workspaces = [...selected].filter((name) => sources.current.has(name)).sort();
  const lanes = selectLanes(workspaces, full, testSuite);
  return {
    testedCommit: sources.testedCommit,
    comparisonCommit: sources.comparisonCommit,
    mode: full ? 'full' : 'affected',
    testSuite,
    reasons: full ? [...reasons].sort() : ['Changed workspaces and all downstream consumers.'],
    workspaces,
    rootIntegration: full || workspaces.some(isRuntimePackage),
    lanes,
    artifacts: lanes.length > 0,
  };
};

const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.every((entry: unknown) => typeof entry === 'string' && entry.length > 0);

/**
 * Rejects malformed plans and flags inconsistent with their execution set.
 * @throws
 * - If the source is not valid JSON.
 * - The CI plan is invalid.
 * - The Git commit is invalid.
 */
export const parseCiPlan = (source: string): ICiPlan => {
  const value: unknown = JSON.parse(source);
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new TypeError('The CI plan is invalid.');
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).length !== PLAN_FIELDS.length ||
    PLAN_FIELDS.some((field) => !(field in record)) ||
    typeof record['testedCommit'] !== 'string' ||
    !(record['comparisonCommit'] === null || typeof record['comparisonCommit'] === 'string') ||
    !(record['mode'] === 'full' || record['mode'] === 'affected') ||
    !(record['testSuite'] === 'essential' || record['testSuite'] === 'full') ||
    !isStringList(record['reasons']) ||
    record['reasons'].length === 0 ||
    !isStringList(record['workspaces']) ||
    !isStringList(record['lanes']) ||
    !record['workspaces'].every(
      (name) => PACKAGE_NAME_PATTERN.test(name) && !name.includes('...'),
    ) ||
    typeof record['rootIntegration'] !== 'boolean' ||
    typeof record['artifacts'] !== 'boolean'
  )
    throw new TypeError('The CI plan is invalid.');
  requireGitCommit(record['testedCommit']);
  if (record['comparisonCommit'] !== null) requireGitCommit(record['comparisonCommit']);
  const full = record['mode'] === 'full';
  const workspaces = record['workspaces'];
  if (
    JSON.stringify(workspaces) !== JSON.stringify([...new Set(workspaces)].sort()) ||
    JSON.stringify(record['lanes']) !==
      JSON.stringify(selectLanes(workspaces, full, record['testSuite'])) ||
    record['artifacts'] !== record['lanes'].length > 0 ||
    record['rootIntegration'] !== (full || workspaces.some(isRuntimePackage)) ||
    (!full && record['comparisonCommit'] === null)
  )
    throw new TypeError('The CI plan is invalid.');
  return {
    testedCommit: record['testedCommit'],
    comparisonCommit: record['comparisonCommit'],
    mode: record['mode'],
    testSuite: record['testSuite'],
    reasons: record['reasons'],
    workspaces,
    rootIntegration: record['rootIntegration'],
    lanes: record['lanes'],
    artifacts: record['artifacts'],
  };
};

/**
 * Binds selected task names to the current committed workspace inventory.
 * @throws
 * - The CI plan does not match the checked-out workspace inventory.
 */
export const validateCiWorkspaceSelection = (
  plan: ICiPlan,
  snapshot: Map<string, IWorkspacePackageState>,
): void => {
  if (
    plan.workspaces.some((name) => !snapshot.has(name)) ||
    (plan.mode === 'full' &&
      JSON.stringify(plan.workspaces) !== JSON.stringify([...snapshot.keys()].sort()))
  ) {
    throw new TypeError('The CI plan does not match the checked-out workspace inventory.');
  }
};

/**
 * Requires every selected job to succeed and every unselected lane to remain skipped.
 * @throws
 * - If the source is not valid JSON.
 * - The CI job results are invalid or incomplete.
 * - If a required job did not succeed or an unselected job did not skip.
 */
export const validateCiJobResults = (plan: ICiPlan, source: string): void => {
  const value: unknown = JSON.parse(source);
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new TypeError('The CI job results are invalid or incomplete.');
  const results = value as Record<string, unknown>;
  const required = new Set([
    'plan',
    'checks',
    ...(plan.artifacts ? ['pack'] : []),
    ...plan.lanes,
    ...(plan.workspaces.length > 0 ? ['test-cross-platform'] : []),
  ]);
  const jobs = ['plan', 'checks', 'pack', ...CI_COMPATIBILITY_LANES, 'test-cross-platform'];
  if (Object.keys(results).length !== jobs.length)
    throw new TypeError('The CI job results are invalid or incomplete.');
  for (const job of jobs) {
    const result = results[job];
    if (typeof result !== 'object' || result === null || !('result' in result))
      throw new TypeError('The CI job results are invalid or incomplete.');
    const expected = required.has(job) ? 'success' : 'skipped';
    if (result.result !== expected) throw new Error(`The ${job} CI job must be ${expected}.`);
  }
};

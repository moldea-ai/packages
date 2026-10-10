import {
  isExcludedPath,
  requireGitCommit,
  type IWorkspacePackageState,
} from '../workspace-graph/index.ts';

import type { ICiPlan, ICiSelectionSources } from './types.ts';

// artifact consumers kept in step with the existing compatibility jobs
export const CI_COMPATIBILITY_LANES = [
  'consumer-conformance',
  'repository-testing-peer-compatibility',
  'cli-testing-peer-compatibility',
  'repository-fs-runtime-compatibility',
  'cli-runtime-compatibility',
  ...[
    'anthropic',
    'google-genai',
    'openai',
    'openai-agents-sdk',
    'claude-agent-sdk',
    'cloudflare-agents',
    'eve',
    'langchain',
    'langgraph',
    'vercel-ai-sdk',
  ].map((id) => `adapter-${id}-runtime-compatibility`),
];
const WEBSITE = '@moldea.ai/packages-website';
// literal lowercase identifiers prevent Turbo filter expressions from entering a plan
const PACKAGE_NAME_PATTERN = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u;
const PLAN_FIELDS = [
  'testedCommit',
  'comparisonCommit',
  'mode',
  'reasons',
  'workspaces',
  'rootIntegration',
  'lanes',
  'artifacts',
];

const isRuntimePackage = (name: string): boolean =>
  name !== WEBSITE && name !== '@moldea.ai/website-ui';

/** Maps selected package identities to the existing packed-consumer jobs. */
const selectLanes = (workspaces: string[], full: boolean): string[] => {
  const selected = new Set(workspaces);
  return CI_COMPATIBILITY_LANES.filter((lane) => {
    if (full) return true;
    if (lane === 'consumer-conformance' || lane.startsWith('cli-'))
      return selected.has('@moldea.ai/cli');
    if (lane === 'repository-testing-peer-compatibility')
      return selected.has('@moldea.ai/repository');
    return selected.has(`@moldea.ai/${lane.replace(/-runtime-compatibility$/u, '')}`);
  });
};

/**
 * Builds the current execution set from the union of old and new reverse dependency edges.
 * @throws
 * - The Git commit is invalid.
 */
export const createCiPlan = (sources: ICiSelectionSources): ICiPlan => {
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
      selected.add(WEBSITE);
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
  const lanes = selectLanes(workspaces, full);
  return {
    testedCommit: sources.testedCommit,
    comparisonCommit: sources.comparisonCommit,
    mode: full ? 'full' : 'affected',
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
    JSON.stringify(record['lanes']) !== JSON.stringify(selectLanes(workspaces, full)) ||
    record['artifacts'] !== record['lanes'].length > 0 ||
    record['rootIntegration'] !== (full || workspaces.some(isRuntimePackage)) ||
    (!full && record['comparisonCommit'] === null)
  )
    throw new TypeError('The CI plan is invalid.');
  return {
    testedCommit: record['testedCommit'],
    comparisonCommit: record['comparisonCommit'],
    mode: record['mode'],
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
    ...plan.lanes,
    ...(plan.workspaces.length > 0 ? ['test-cross-platform'] : []),
  ]);
  const jobs = ['plan', 'checks', ...CI_COMPATIBILITY_LANES, 'test-cross-platform'];
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

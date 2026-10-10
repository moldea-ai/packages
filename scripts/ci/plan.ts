import { appendFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  getGitHead,
  hasGitCommit,
  listGitChangedPaths,
  loadGitWorkspaceSnapshot,
  requireGitCommit,
  type IWorkspacePackageState,
} from '../workspace-graph/index.ts';

import { CI_COMPATIBILITY_LANES, createCiPlan, parseCiPlan } from './selection.ts';

const repositoryRoot = pathToFileURL(`${resolve(process.cwd())}${sep}`);
const testedCommit = getGitHead(repositoryRoot);
const expectedCommit = process.env['CI_TESTED_COMMIT'];
if (expectedCommit !== undefined && expectedCommit !== testedCommit)
  throw new TypeError('The CI tested commit does not match the checkout.');
const releaseBuild = process.env['CI_RELEASE_BUILD'] ?? 'false';
if (releaseBuild !== 'true' && releaseBuild !== 'false')
  throw new TypeError('The CI release-build input is invalid.');
const baseInput = process.env['CI_BASE_COMMIT'] ?? '';
let comparisonCommit: string | null = null;
let fullReason: string | undefined;
if (baseInput !== '' && !/^0{40}$/u.test(baseInput)) {
  requireGitCommit(baseInput);
  if (hasGitCommit(repositoryRoot, baseInput)) comparisonCommit = baseInput;
  else fullReason = 'The comparison commit is unavailable locally.';
}
if (releaseBuild === 'true') fullReason = 'Release candidates require complete verification.';
const current = loadGitWorkspaceSnapshot(repositoryRoot, testedCommit);
const previous =
  comparisonCommit === null
    ? new Map<string, IWorkspacePackageState>()
    : loadGitWorkspaceSnapshot(repositoryRoot, comparisonCommit);
const plan = parseCiPlan(
  JSON.stringify(
    createCiPlan({
      testedCommit,
      comparisonCommit,
      current,
      previous,
      changedPaths:
        comparisonCommit === null
          ? []
          : listGitChangedPaths(repositoryRoot, comparisonCommit, testedCommit),
      ...(fullReason === undefined ? {} : { fullReason }),
    }),
  ),
);
const outputs = {
  plan: JSON.stringify(plan),
  artifacts: String(plan.artifacts),
  cross_platform: String(plan.workspaces.length > 0),
  website: String(plan.workspaces.includes('@moldea.ai/packages-website')),
  ...Object.fromEntries(
    CI_COMPATIBILITY_LANES.map((lane) => [
      lane.replaceAll('-', '_'),
      String(plan.lanes.includes(lane)),
    ]),
  ),
};
if (process.env['GITHUB_OUTPUT'] !== undefined) {
  await appendFile(
    process.env['GITHUB_OUTPUT'],
    `${Object.entries(outputs)
      .map(([name, value]) => `${name}=${value}`)
      .join('\n')}\n`,
  );
}
if (process.env['GITHUB_STEP_SUMMARY'] !== undefined) {
  await appendFile(
    process.env['GITHUB_STEP_SUMMARY'],
    `## CI selection\n\nMode: ${plan.mode}\n\nTested commit: ${testedCommit}\n\nComparison: ${comparisonCommit ?? 'unavailable'}\n\nWorkspaces: ${plan.workspaces.join(', ') || 'none'}\n\n${plan.reasons.join('\n')}\n`,
  );
}
process.stdout.write(`${JSON.stringify(plan)}\n`);

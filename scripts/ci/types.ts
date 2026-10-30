import type { IWorkspacePackageState } from '../workspace-graph/index.ts';

import type { ITestSuite } from '#test-suite/types';

// closed internal plan exchanged by jobs for one exact checked-out commit
export interface ICiPlan {
  testedCommit: string;
  comparisonCommit: string | null;
  mode: 'full' | 'affected';
  testSuite: ITestSuite;
  reasons: string[];
  workspaces: string[];
  rootIntegration: boolean;
  lanes: string[];
  artifacts: boolean;
}

// graph snapshots and path metadata used by the deterministic selection policy
export interface ICiSelectionSources {
  testedCommit: string;
  comparisonCommit: string | null;
  current: Map<string, IWorkspacePackageState>;
  previous: Map<string, IWorkspacePackageState>;
  changedPaths: string[];
  fullReason?: string;
  testSuite?: ITestSuite;
}

// closed matrix dimensions emitted by the source-bound planner
export interface ICiRuntimeMatrices {
  cli: { os: string[]; 'node-version': string[] };
  repositoryFs: { 'node-version': string[] };
}

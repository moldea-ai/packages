// roles supported by reusable evaluation replay messages
export type IEvaluationReplayRole =
  'coding-agent' | 'developer' | 'deterministic-verifier' | 'independent-judge';

// ordered presentation steps supported by the shared replay renderer
export type IEvaluationReplayStep =
  | IEvaluationReplayCommandStep
  | IEvaluationReplayMessageStep
  | IEvaluationReplayVerdictStep
  | IEvaluationReplayWorkspaceStep;

// one exact or deterministically normalized replay message
export interface IEvaluationReplayMessageStep {
  readonly content: string;
  readonly kind: 'message';
  readonly role: IEvaluationReplayRole;
  readonly source: 'derived' | 'recorded';
}

// one safe command result or a contiguous aggregate of unprojected commands
export interface IEvaluationReplayCommandStep {
  readonly commandCount: number;
  readonly exitCode: number | null;
  readonly isAggregate: boolean;
  readonly kind: 'command';
  readonly operation: string;
  readonly results: readonly string[];
  readonly status: 'failed' | 'passed';
}

// path statuses and entry types retained in the public workspace projection
export type IEvaluationReplayWorkspaceChangeStatus = 'created' | 'deleted' | 'modified';
export type IEvaluationReplayWorkspaceEntryType = 'file' | 'symlink';

// one recorded workspace path without contents or filesystem metadata
export interface IEvaluationReplayWorkspaceChange {
  readonly path: string;
  readonly type: IEvaluationReplayWorkspaceEntryType;
}

// one structural folder or recorded path in a workspace tree
export interface IEvaluationReplayPathTreeNode {
  readonly changeCount: number;
  readonly children: readonly IEvaluationReplayPathTreeNode[];
  readonly kind: 'file' | 'folder' | 'symlink';
  readonly name: string;
  readonly path: string;
}

// one complete path-only workspace delta
export interface IEvaluationReplayWorkspaceStep {
  readonly groups: readonly {
    readonly changes: readonly IEvaluationReplayWorkspaceChange[];
    readonly status: IEvaluationReplayWorkspaceChangeStatus;
    readonly tree: readonly IEvaluationReplayPathTreeNode[];
  }[];
  readonly kind: 'workspace';
}

// one deterministic trial outcome
export interface IEvaluationReplayVerdictStep {
  readonly kind: 'verdict';
  readonly rationale: string;
  readonly role: Extract<IEvaluationReplayRole, 'deterministic-verifier' | 'independent-judge'>;
  readonly source: 'derived' | 'recorded';
  readonly status: 'failed' | 'passed';
}

// one ordered initial or confirmation trial
export interface IEvaluationReplayTrial {
  readonly confirmationIndex: 1 | 2 | null;
  readonly evaluatedAt: string;
  readonly id: string;
  readonly kind: 'confirmation' | 'initial';
  readonly steps: readonly IEvaluationReplayStep[];
  readonly title: string;
}

// evidence-grounded reconstruction shown for one evaluation scenario
export interface IEvaluationReplayModel {
  readonly trials: readonly IEvaluationReplayTrial[];
}

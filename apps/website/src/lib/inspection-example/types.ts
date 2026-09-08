import type { IDiagnostic } from '@moldea.ai/core';

// the three authored states of the homepage reference check
export type IInspectionExampleId = 'connected' | 'broken' | 'repaired';

export interface IInspectionSnapshot {
  id: IInspectionExampleId;
  label: string;
  explanation: string;
  manifest: string;
  project: string;
  sourcePath: string;
  source: string;
}

// only the content-free validation fields shown publicly, not the complete Core result
export interface IInspectionResultExcerpt {
  valid: boolean;
  diagnostics: Pick<IDiagnostic, 'code' | 'message' | 'path' | 'pointer' | 'details'>[];
}

export interface IInspectionExampleState {
  id: IInspectionExampleId;
  label: string;
  explanation: string;
  projectPath: string;
  declaredPath: string;
  sourcePath: string;
  result: IInspectionResultExcerpt;
}

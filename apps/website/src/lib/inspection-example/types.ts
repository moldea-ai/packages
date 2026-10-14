import type { IProjectValidationResult } from '@moldea.ai/core';

import type { ICapabilityFile } from '../capabilities/index.ts';

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

export interface IInspectionExampleState {
  id: IInspectionExampleId;
  label: string;
  explanation: string;
  projectPath: string;
  declaredPath: string;
  sourcePath: string;
  result: IProjectValidationResult;
  files: ICapabilityFile[];
}

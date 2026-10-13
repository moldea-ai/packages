import type { AstroComponentFactory } from 'astro/runtime/server/index.js';

// shared inspection subjects and severity use the same ids in Astro and React
export type IInspectionSeverity = 'error' | 'warning';
export type IDiagnosticGroup =
  'discovery' | 'manifest' | 'references' | 'agents' | 'mirrors' | 'integration';
export type IFindingCategory =
  | 'responsibility'
  | 'scope'
  | 'inputs'
  | 'outputs'
  | 'capabilities'
  | 'handoffs'
  | 'variables'
  | 'failureBehavior'
  | 'context'
  | 'connection'
  | 'unclassified';
export interface IInspectionPresentation {
  label: string;
  icon: AstroComponentFactory;
}

// websites supply captured evidence; missing targets have no invented source content
export interface IInspectionEvidence {
  path: string;
  label?: string;
  language: string;
  content?: string;
  isExcerpt?: boolean;
}

export interface IInspectionFindingView {
  id: string;
  title: string;
  code: string;
  severity: IInspectionSeverity;
  group: IDiagnosticGroup;
  message: string;
  path?: string;
  pointer?: string;
  accepted?: boolean;
  reason?: string;
  evidence: IInspectionEvidence[];
}

// reusable result presentation contains no Core or CLI domain dependency
export interface IInspectionResultView {
  title: string;
  label: string;
  tone: 'danger' | 'info' | 'neutral' | 'success' | 'warning';
  findings: IInspectionFindingView[];
  outputLabel: string;
  output: string;
  redactions: string[];
  command?: string;
  exitStatus?: number;
  limitation?: string;
}

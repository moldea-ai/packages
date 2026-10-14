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
  // an explicitly supplied revision of this same file; requires current content
  beforeContent?: string;
  isExcerpt?: boolean;
  isMissing?: boolean;
  // identifies the affected evidence explicitly, independently of the diagnostic's reported path
  issueLabel?: string;
}

export type IInspectionFindingView = {
  id: string;
  title: string;
  code: string;
  severity: IInspectionSeverity;
  message: string;
  path?: string;
  pointer?: string;
  accepted?: boolean;
  reason?: string;
  evidence: IInspectionEvidence[];
} & ({ group: IDiagnosticGroup; category?: never } | { category: IFindingCategory; group?: never });

// reusable result presentation contains no Core or CLI domain dependency
export type IInspectionResultView = {
  title: string;
  label: string;
  tone: 'danger' | 'info' | 'neutral' | 'success' | 'warning';
  findings: IInspectionFindingView[];
  redactions: string[];
  command?: string;
  exitStatus?: number;
  limitation?: string;
} & (
  | { output: string; outputLabel: string }
  // illustrative findings omit output rather than inventing a captured response
  | { output?: never; outputLabel?: never }
);

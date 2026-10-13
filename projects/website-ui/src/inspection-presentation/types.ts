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

import type { AstroComponentFactory } from 'astro/runtime/server/index.js';

// shared subjects retain the platform's identifiers without depending on Core
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
  | 'failureBehavior'
  | 'context'
  | 'connection'
  | 'unclassified';
export type IInspectionTone = 'danger' | 'info' | 'neutral' | 'success' | 'warning';
export interface IInspectionPresentation {
  label: string;
  icon: AstroComponentFactory;
}
export type IInspectionJsonValue =
  | string
  | number
  | boolean
  | null
  | IInspectionJsonValue[]
  | { [key: string]: IInspectionJsonValue };

// metadata names semantic roles; components resolve their platform-owned icons
export type IInspectionMetadataIcon =
  | 'code'
  | 'file'
  | 'scope'
  | 'runtime'
  | 'mirror'
  | 'integration'
  | 'decision'
  | 'capability'
  | 'agent'
  | 'context'
  | 'declaration'
  | 'export'
  | 'relationship'
  | 'reason'
  | 'type'
  | 'entryType'
  | 'owner'
  | 'qualifier'
  | 'count'
  | 'cycle'
  | 'status'
  | 'missingFile'
  | 'tag'
  | 'runtime-agent'
  | 'instruction-loader'
  | 'agent-input-schema'
  | 'agent-output-schema'
  | 'tool-implementation'
  | 'tool-input-schema'
  | 'tool-output-schema'
  | 'skill-implementation'
  | 'context-binding'
  | 'decision-binding';
export interface IInspectionMetadataItem {
  label: string;
  value: string;
  icon: IInspectionMetadataIcon;
}

// only captured source receives coordinates; representations and missing sources remain explicit
export interface IInspectionEvidence {
  path: string;
  label: string;
  language: string;
  content?: string;
  beforeContent?: string;
  isExcerpt?: boolean;
  isMissing?: boolean;
  startingLineNumber?: number;
  highlightedLines?: number[];
  notice?: string;
}

interface IInspectionFindingBase {
  id: string;
  code: string;
  severity: IInspectionSeverity;
  message: string;
  path?: string;
  target?: IInspectionMetadataItem;
  related?: IInspectionMetadataItem;
  declaration?: IInspectionEvidence;
  evidence: IInspectionEvidence[];
}

// recorded structural findings and authored behavior illustrations never impersonate each other
export type IInspectionFindingView = IInspectionFindingBase &
  (
    | {
        kind: 'structural';
        category?: never;
        group: IDiagnosticGroup;
        record: IInspectionJsonValue;
        field: string[];
        facts: IInspectionMetadataItem[];
        guidanceHref: string;
        accepted?: boolean;
        reason?: string;
        acceptance?: string;
        revision?: string;
      }
    | {
        kind: 'illustrative';
        category: IFindingCategory;
        group?: never;
        record?: never;
        guidanceHref?: never;
        accepted?: never;
        reason?: never;
      }
  );

// only retained binding checks are supplied, independently of findings and coverage counts
export interface IInspectionBindingView {
  relationship: string;
  path: string;
  symbol?: string;
  owner?: IInspectionMetadataItem;
  outcome: 'passed' | 'failed' | 'not-checked';
  reason?: string;
}

// result summaries and coverage stay separate from each finding's native evaluation record
export interface IInspectionResultView {
  title: string;
  label: string;
  tone: IInspectionTone;
  findings: IInspectionFindingView[];
  bindings: IInspectionBindingView[];
  code?: string;
  limitation?: string;
}

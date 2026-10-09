import type { IStaticAnalysisReference } from '../types.js';

// declared relationships accounted for by provider-owned evidence and diagnostics
export type IDeclaredRelationship =
  | 'runtime-agent'
  | 'instruction-loader'
  | 'agent-input-schema'
  | 'agent-output-schema'
  | 'tool-implementation'
  | 'tool-registration'
  | 'tool-input-schema'
  | 'tool-output-schema'
  | 'skill-implementation'
  | 'skill-registration'
  | 'variable-provider';

export interface IDeclaredRelationshipSubject {
  relationship: IDeclaredRelationship;
  reference: IStaticAnalysisReference;
  capabilityId?: string;
  capabilityKind?: 'tool' | 'skill';
  variableId?: string;
}

export interface IRelationshipDeclaration {
  bindings?: {
    runtimeAgent?: IStaticAnalysisReference;
    instructionLoader?: IStaticAnalysisReference;
    inputSchema?: IStaticAnalysisReference;
    outputSchema?: IStaticAnalysisReference;
    variableProviders?: Readonly<Record<string, IStaticAnalysisReference>>;
  };
  tools?: Readonly<
    Record<
      string,
      {
        implementation: IStaticAnalysisReference;
        registration?: IStaticAnalysisReference;
        inputSchema?: IStaticAnalysisReference;
        outputSchema?: IStaticAnalysisReference;
      }
    >
  >;
  skills?: Readonly<
    Record<
      string,
      {
        implementation: IStaticAnalysisReference;
        registration?: IStaticAnalysisReference;
      }
    >
  >;
}

export interface IRelationshipDiagnostic {
  code: string;
  severity: string;
  details: Readonly<Record<string, unknown>>;
  entity: {
    agentId?: string;
    capabilityId?: string;
    capabilityKind?: 'tool' | 'skill';
    variableId?: string;
  } | null;
}

export interface IRelationshipEvidence {
  agentId: string | null;
  capabilityId: string | null;
  capabilityKind: 'tool' | 'skill' | null;
  kind: string;
  details: Readonly<Record<string, unknown>>;
  references: readonly IStaticAnalysisReference[];
}

// canonical instruction evidence is admitted separately from other source evidence
export interface IRelationshipEvidenceCollector<T> {
  add(factory: () => T): void;
  some(predicate: (record: T) => boolean): boolean;
  instruction(factory: () => T): void;
}

import type {
  ICore,
  ICoreDiagnosticCode,
  IDiagnostic,
  IRuntimeAdapterEvidence,
  IRuntimeAdapterEvidenceKind,
} from '@moldea.ai/core';

import type { IRuntimeCompatibilityPublicationTarget } from '../runtime-compatibility-publication/index.ts';

// release-owned groups, operations, and explicitly selected display facts
export type ICapabilityGroupId =
  'structure' | 'agents' | 'decisions' | 'runtime-wiring' | 'repository-access' | 'command-line';
export type ICoreOperation = keyof ICore;
export type ICapabilityFact =
  | string
  | number
  | boolean
  | null
  | ICapabilityFact[]
  | {
      [key: string]: ICapabilityFact;
    };

// result excerpts remain distinct from the complete public package contracts
export type ICapabilityResult =
  | { kind: 'validation'; valid: boolean; diagnostics: IDiagnostic[] }
  | {
      kind: 'adapter';
      valid: boolean;
      diagnostics: IDiagnostic[];
      evidence: IRuntimeAdapterEvidence[];
    }
  | { kind: 'inspection'; facts: Record<string, ICapabilityFact> }
  | { kind: 'reader'; facts: Record<string, ICapabilityFact> }
  | {
      kind: 'cli';
      command: string;
      exitStatus: number;
      schemaVersion: 4;
      status: 'valid' | 'invalid' | 'error';
      facts: Record<string, ICapabilityFact>;
    };

// a visible excerpt always points to the exact synthetic input that was executed
export interface ICapabilityFile {
  path: string;
  language: string;
  content: string;
  isExcerpt: boolean;
  representation: 'source' | 'json-string' | 'bytes';
}

// one executed case; several cases can share a visual group in the page
export interface ICapabilityCase {
  id: string;
  groupId: ICapabilityGroupId;
  title: string;
  description: string;
  limitation: string;
  packageName: string;
  operation: string;
  sourcePaths: string[];
  files: ICapabilityFile[];
  result: ICapabilityResult;
}

// concise coverage and selected illustrations, with the full contract linked separately
export interface ICapabilityGroup {
  id: ICapabilityGroupId;
  label: string;
  title: string;
  description: string;
  coverage: string[];
  exampleIds: [string, ...string[]];
  reference: { route: string; label: string };
}

// domain-owned outcomes map into the shared UI's semantic presentation props
export interface ICapabilityOutcome {
  title: string;
  description: string;
  label: string;
  tone: 'danger' | 'info' | 'neutral' | 'success' | 'warning';
}

// a claimed source form and its independent, executed public-result witness
export interface IRuntimePatternProof {
  caseId: string;
  source: { path: string; contains: string };
  witness:
    | {
        kind: 'evidence';
        evidenceKind: IRuntimeAdapterEvidenceKind;
        agentId: string;
        details?: Record<string, string | number | boolean>;
      }
    | { kind: 'absence'; evidenceKind: IRuntimeAdapterEvidenceKind; agentId: string }
    | { kind: 'diagnostic'; code: string }
    | { kind: 'validation' };
}

// accounting distinguishes exact demonstrated diagnostics from documented, unexecuted variants
export interface IDiagnosticCoverage {
  caseIds: string[];
  mode: 'demonstrated' | 'documented-boundary';
  note: string;
  sourcePath: string;
}

// target support and maturity are copied from the authoritative publication model
export interface ICapabilityRuntimeTarget {
  adapterId: string;
  target: IRuntimeCompatibilityPublicationTarget;
  scopeRoute: string;
  patterns: { id: string; proofs: IRuntimePatternProof[] }[];
}

// internal generated content model, not a separately published capability API
export interface ICapabilities {
  groups: ICapabilityGroup[];
  cases: ICapabilityCase[];
  coreOperations: Record<ICoreOperation, string[]>;
  diagnostics: Record<ICoreDiagnosticCode, IDiagnosticCoverage>;
  runtimeTargets: ICapabilityRuntimeTarget[];
}

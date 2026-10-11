import type {
  ICore,
  ICoreDiagnosticCode,
  IDiagnostic,
  IBindingCoverage,
  IBindingCoverageCounts,
} from '@moldea.ai/core';

// release-owned groups, operations, and explicitly selected display facts
export type ICapabilityGroupId =
  'structure' | 'agents' | 'decisions' | 'binding-coverage' | 'repository-access' | 'command-line';
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
  | {
      kind: 'validation';
      valid: boolean;
      errorCount?: number;
      warningCount?: number;
      acceptedWarningCount?: number;
      coverage?: IBindingCoverage[];
      coverageCounts?: IBindingCoverageCounts;
      diagnostics: IDiagnostic[];
    }
  | { kind: 'inspection'; facts: Record<string, ICapabilityFact> }
  | { kind: 'reader'; facts: Record<string, ICapabilityFact> }
  | {
      kind: 'cli';
      command: string;
      exitStatus: number;
      schemaVersion: 7;
      status: 'valid' | 'invalid' | 'error';
      facts: Record<string, ICapabilityFact>;
      envelopeExcerpt: {
        cliVersion: string;
        command: string;
        error: ICapabilityFact;
        result: ICapabilityFact;
        schemaVersion: 7;
        status: 'valid' | 'invalid' | 'error';
      };
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
  featuredExampleIds: [string, string, string, string];
  reference: { route: string; label: string };
}

// domain-owned outcomes map into the shared UI's semantic presentation props
export interface ICapabilityOutcome {
  title: string;
  description: string;
  label: string;
  tone: 'danger' | 'info' | 'neutral' | 'success' | 'warning';
}

// accounting distinguishes exact demonstrated diagnostics from documented, unexecuted variants
export interface IDiagnosticCoverage {
  caseIds: string[];
  mode: 'demonstrated' | 'documented-boundary';
  note: string;
  sourcePath: string;
}

// internal generated content model, not a separately published capability API
export interface ICapabilities {
  groups: ICapabilityGroup[];
  cases: ICapabilityCase[];
  coreOperations: Record<ICoreOperation, string[]>;
  diagnostics: Record<ICoreDiagnosticCode, IDiagnosticCoverage>;
}

import type { IRepositoryPath } from '@moldea.ai/repository';

import type { IContentDigest, ITextDocumentInput } from '../contracts/index.js';
import type { ICoreDiagnostic } from '../diagnostics/index.js';

// manifest owners that can declare changed-path relationships
export type IManifestScopeOwnerKind =
  'agent' | 'context' | 'decision' | 'skill' | 'tool' | 'unresolved';

// exact version 1 fields whose repository paths can establish relevance
export type IManifestScopeRelationshipField =
  | 'affectedBy'
  | 'bindings'
  | 'implementation'
  | 'inputSchema'
  | 'instructionLoader'
  | 'mirrors'
  | 'outputSchema'
  | 'registration'
  | 'related'
  | 'runtimeAgent'
  | 'variableProvider';

export interface IManifestScopeOwner {
  readonly kind: IManifestScopeOwnerKind;
  readonly id: string;
  readonly agentId: string | null;
}

export interface IExactManifestScopeDeclaration {
  readonly kind: 'exact';
  readonly path: IRepositoryPath;
  readonly symbol: string | null;
}

export interface IGlobManifestScopeDeclaration {
  readonly kind: 'glob';
  readonly pattern: string;
}

export type IManifestScopeDeclaration =
  IExactManifestScopeDeclaration | IGlobManifestScopeDeclaration;

// content-free match, aggregate, operation-input, and result contracts
export interface IManifestScopeMatch {
  readonly inputPath: IRepositoryPath;
  readonly owner: IManifestScopeOwner;
  readonly field: IManifestScopeRelationshipField;
  readonly pointer: string;
  readonly declaration: IManifestScopeDeclaration;
}

export interface IManifestScopeCounts {
  readonly declarations: number;
  readonly inputPaths: number;
  readonly matchedOwners: number;
  readonly matchedPaths: number;
  readonly matches: number;
}

export interface IManifestScopeInput {
  readonly manifest: ITextDocumentInput;
  readonly paths: readonly string[];
}

export interface IManifestScopeResult {
  readonly valid: boolean;
  readonly relevant: boolean;
  readonly manifestDigest: IContentDigest | null;
  readonly inputDigest: IContentDigest;
  readonly counts: IManifestScopeCounts;
  readonly matches: readonly IManifestScopeMatch[];
  readonly diagnostics: readonly ICoreDiagnostic[];
}

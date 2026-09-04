import type {
  IRepositoryPath,
  IRepositoryReader,
  IRepositorySnapshot,
} from '@moldea.ai/repository';

import type { IRuntimeAdapter, IRuntimeAdapterEvidence } from '../adapter/index.js';
import type { ICoreDiagnostic, IDiagnostic } from '../diagnostics/index.js';
import type {
  IAgentManifestEntry,
  IMoldeaManifestV1,
  IParsedDecision,
  IRelationshipManifestEntry,
  IRepositoryFormatVersion,
  IUnresolvedRequirementManifestEntry,
} from '../format/index.js';
import type { IManifestScopeInput, IManifestScopeResult } from '../scope-matching/types.js';

// immutable operation budgets and Core construction inputs
export interface ICoreResourceLimits {
  readonly maxEntries: number;
  readonly maxTotalBytesRead: number;
  readonly maxFileBytes: number;
  readonly maxManifestBytes: number;
  readonly maxDiagnostics: number;
  readonly maxEvidence: number;
}

export interface ICoreOptions {
  readonly adapters?: readonly IRuntimeAdapter[];
  readonly limits?: Partial<ICoreResourceLimits>;
}

// caller-supplied text input and deterministic normalization output
export type ITextDocumentContent = string | Uint8Array;

export interface ITextDocumentInput {
  readonly path: IRepositoryPath;
  readonly content: ITextDocumentContent;
}

export interface INormalizedText {
  readonly value: string;
  readonly utf8ByteLength: number;
  readonly scalarLength: number;
}

export interface ITextNormalizationResult {
  readonly valid: boolean;
  readonly text: INormalizedText | null;
  readonly diagnostics: readonly ICoreDiagnostic[];
}

declare const contentDigestBrand: unique symbol;

// normalized SHA-256 digest and the result that owns it
export type IContentDigest = string & {
  readonly [contentDigestBrand]: true;
};

export interface IContentDigestResult {
  readonly valid: boolean;
  readonly text: INormalizedText | null;
  readonly digest: IContentDigest | null;
  readonly diagnostics: readonly ICoreDiagnostic[];
}

// all-or-nothing document parsing results reserved by the public contract
export interface IManifestParseResult {
  readonly valid: boolean;
  readonly asset: IIndexedTextAsset | null;
  readonly manifest: IMoldeaManifestV1 | null;
  readonly diagnostics: readonly ICoreDiagnostic[];
}

export interface IDecisionParseResult {
  readonly valid: boolean;
  readonly decision: IParsedDecision | null;
  readonly diagnostics: readonly ICoreDiagnostic[];
}

// repository-level validation input and content-free structural result
export interface IProjectValidationInput {
  readonly repository: IRepositoryReader;
  readonly signal?: AbortSignal;
}

export type IProjectMetadataKind =
  | 'agent-description'
  | 'agent-handoff-description'
  | 'agent-instruction'
  | 'context'
  | 'decision'
  | 'manifest'
  | 'mirror'
  | 'project'
  | 'runtime-guidance';

export interface IProjectMetadataItem {
  readonly agentId: string | null;
  readonly byteLength: number;
  readonly canonicalDigest: IContentDigest | null;
  readonly decisionId: string | null;
  readonly digest: IContentDigest;
  readonly kind: IProjectMetadataKind;
  readonly path: IRepositoryPath;
  readonly scalarLength: number | null;
}

// closed content-free views supported by paged project inspection
export type IProjectInspectionView = 'all' | 'diagnostics' | 'evidence' | 'metadata';

export interface IProjectInspectionPageInput extends IProjectValidationInput {
  readonly cursor?: string;
  readonly maxItems: number;
  readonly view: IProjectInspectionView;
}

export type IProjectInspectionItem =
  | { readonly diagnostic: IDiagnostic; readonly kind: 'diagnostic' }
  | { readonly evidence: IRuntimeAdapterEvidence; readonly kind: 'evidence' }
  | { readonly kind: 'metadata'; readonly metadata: IProjectMetadataItem };

export interface IProjectInspectionPageRecord {
  readonly item: IProjectInspectionItem;
  readonly nextCursor: string | null;
}

export interface IProjectInspectionPage {
  readonly isComplete: boolean;
  readonly records: readonly IProjectInspectionPageRecord[];
  readonly nextCursor: string | null;
  readonly totalItems: number;
}

export interface IProjectSummaryCounts {
  readonly agents: number;
  readonly context: number;
  readonly decisions: number;
  readonly mirrors: number;
  readonly runtimes: number;
  readonly unresolved: number;
}

export interface IProjectValidationSummary {
  readonly counts: IProjectSummaryCounts;
  readonly manifestDigest: IContentDigest;
  readonly manifestPath: IRepositoryPath;
  readonly projectDigest: IContentDigest;
  readonly projectPath: IRepositoryPath;
}

export interface IProjectValidationResult {
  readonly valid: boolean;
  readonly formatVersion: IRepositoryFormatVersion | null;
  readonly summary: IProjectValidationSummary | null;
  readonly source: IRepositorySnapshot;
  readonly evidence: readonly IRuntimeAdapterEvidence[];
  readonly diagnostics: readonly IDiagnostic[];
}

export interface IProjectInspectionCounts extends IProjectSummaryCounts {
  readonly diagnostics: number;
  readonly evidence: number;
  readonly metadata: number;
}

export interface IProjectInspectionPageResult {
  readonly counts: IProjectInspectionCounts;
  readonly formatVersion: IRepositoryFormatVersion | null;
  readonly inspectionDigest: string;
  readonly page: IProjectInspectionPage;
  readonly source: IRepositorySnapshot;
  readonly summary: IProjectValidationSummary | null;
  readonly valid: boolean;
  readonly view: IProjectInspectionView;
}

// explicit Unicode-safe canonical content range contracts
export interface ICanonicalContentPageInput extends IProjectValidationInput {
  readonly maxBytes: number;
  readonly offset: number;
  readonly path: IRepositoryPath;
}

export interface ICanonicalContentPageResult {
  readonly byteEnd: number;
  readonly byteStart: number;
  readonly content: string;
  readonly contentIdentity: string | null;
  readonly isComplete: boolean;
  readonly nextOffset: number | null;
  readonly path: IRepositoryPath;
  readonly source: IRepositorySnapshot;
  readonly totalBytes: number;
}

// normalized immutable assets that compose a valid project index
export interface IIndexedTextAsset {
  readonly path: IRepositoryPath;
  readonly content: string;
  readonly digest: IContentDigest;
  readonly utf8ByteLength: number;
  readonly scalarLength: number;
}

export interface IIndexedDescriptionAsset {
  readonly asset: IIndexedTextAsset;
  readonly value: string;
  readonly scalarLength: number;
}

export interface IIndexedContextAsset {
  readonly asset: IIndexedTextAsset;
  readonly relationships: IRelationshipManifestEntry | null;
}

export interface IIndexedDecision {
  readonly decision: IParsedDecision;
  readonly relationships: IRelationshipManifestEntry | null;
}

export interface IIndexedRuntimeGuidance {
  readonly asset: IIndexedTextAsset;
}

export interface IIndexedMirror {
  readonly path: IRepositoryPath;
  readonly byteLength: number;
  readonly digest: IContentDigest;
  readonly canonicalDigest: IContentDigest;
  readonly scalarLength: number;
}

export interface IIndexedAgent {
  readonly id: string;
  readonly declaration: IAgentManifestEntry;
  readonly description: IIndexedDescriptionAsset;
  readonly instruction: IIndexedTextAsset;
  readonly handoffDescription: IIndexedDescriptionAsset | null;
  readonly context: readonly IRepositoryPath[];
  readonly decisions: readonly IRepositoryPath[];
  readonly mirrors: readonly IIndexedMirror[];
}

export interface IIndexedManifest {
  readonly asset: IIndexedTextAsset;
  readonly value: IMoldeaManifestV1;
}

export interface IMoldeaProjectIndex {
  readonly formatVersion: 1;
  readonly manifest: IIndexedManifest;
  readonly project: IIndexedTextAsset;
  readonly context: readonly IIndexedContextAsset[];
  readonly decisions: readonly IIndexedDecision[];
  readonly runtimes: readonly IIndexedRuntimeGuidance[];
  readonly agents: readonly IIndexedAgent[];
  readonly unresolved: Readonly<Record<string, IUnresolvedRequirementManifestEntry>>;
}

// immutable source-neutral Core operations
export interface ICore {
  /**
   * Validates and normalizes one supplied text document.
   * @param input The logical path and decoded string or exact source bytes.
   * @returns The frozen normalized text or structural text diagnostics.
   * @throws
   * - INVALID_REPOSITORY_PATH: The repository path is invalid.
   * - INVALID_ARGUMENT: The Core operation received an invalid argument.
   * - RESOURCE_LIMIT_EXCEEDED: A Core resource limit was exceeded.
   */
  normalizeText(input: ITextDocumentInput): ITextNormalizationResult;

  /**
   * Calculates a normalized SHA-256 digest for one supplied text document.
   * @param input The logical path and decoded string or exact source bytes.
   * @returns A promise resolving to the frozen digest result or structural text diagnostics.
   * @throws
   * - INVALID_REPOSITORY_PATH: The repository path is invalid.
   * - INVALID_ARGUMENT: The Core operation received an invalid argument.
   * - RESOURCE_LIMIT_EXCEEDED: A Core resource limit was exceeded.
   */
  calculateContentDigest(input: ITextDocumentInput): Promise<IContentDigestResult>;

  /**
   * Parses and validates one complete version 1 manifest document.
   * @param input The canonical logical path and exact manifest text or bytes.
   * @returns A promise resolving to the frozen all-or-nothing manifest result.
   * @throws
   * - INVALID_REPOSITORY_PATH: The repository path is invalid.
   * - INVALID_ARGUMENT: The Core operation received an invalid argument.
   * - RESOURCE_LIMIT_EXCEEDED: A Core resource limit was exceeded.
   */
  parseManifest(input: ITextDocumentInput): Promise<IManifestParseResult>;

  /**
   * Matches changed repository paths against one complete version 1 manifest document.
   * @param input The canonical manifest document and repository-logical changed paths.
   * @returns A promise resolving to frozen content-free relationship matches and stable metadata.
   * @throws
   * - INVALID_REPOSITORY_PATH: The manifest path or a changed repository path is invalid.
   * - INVALID_ARGUMENT: The Core operation received an invalid argument.
   * - RESOURCE_LIMIT_EXCEEDED: A Core resource limit was exceeded.
   */
  matchManifestScope(input: IManifestScopeInput): Promise<IManifestScopeResult>;

  /**
   * Parses and validates one complete decision document.
   * @param input The canonical logical path and exact decision text or bytes.
   * @returns A promise resolving to the frozen all-or-nothing decision result.
   * @throws
   * - INVALID_REPOSITORY_PATH: The repository path is invalid.
   * - INVALID_ARGUMENT: The Core operation received an invalid argument.
   * - RESOURCE_LIMIT_EXCEEDED: A Core resource limit was exceeded.
   */
  parseDecision(input: ITextDocumentInput): Promise<IDecisionParseResult>;

  /**
   * Returns one bounded content-free view over a validated project snapshot.
   * @param input The reader, view, page size, optional cursor, and cancellation signal.
   * @returns A promise resolving to one immutable metadata, diagnostic, or evidence page.
   * @throws
   * - INVALID_ARGUMENT: The Core operation received an invalid argument.
   * - INVALID_REPOSITORY_PATH: A repository path is invalid.
   * - ENTRY_NOT_FOUND: A discovered file disappeared from the reader snapshot.
   * - ENTRY_NOT_FILE: A discovered file changed type during inspection.
   * - ENTRY_NOT_DIRECTORY: A discovered directory changed type during inspection.
   * - ACCESS_DENIED: Access to the repository source was denied.
   * - SOURCE_UNAVAILABLE: The repository source is unavailable.
   * - SNAPSHOT_CHANGED: The repository snapshot changed during inspection.
   * - INVALID_SOURCE_DATA: The repository reader returned invalid contract data.
   * - RESOURCE_LIMIT_EXCEEDED: A Core or repository resource limit was exceeded.
   * - ABORTED: Project inspection or a repository operation was aborted.
   * - ADAPTER_EXECUTION_FAILED: A runtime adapter failed or returned an invalid result.
   */
  inspectProjectPage(input: IProjectInspectionPageInput): Promise<IProjectInspectionPageResult>;

  /**
   * Reads one explicit canonical file range without materializing the complete file.
   * @param input The reader, canonical path, byte range, and optional cancellation signal.
   * @returns A promise resolving to one immutable Unicode-safe content page.
   * @throws
   * - INVALID_ARGUMENT: The Core operation received an invalid argument.
   * - INVALID_REPOSITORY_PATH: The repository path is invalid.
   * - ENTRY_NOT_FOUND: The requested repository entry was not found.
   * - ENTRY_NOT_FILE: The requested repository entry is not a file.
   * - ACCESS_DENIED: Access to the repository source was denied.
   * - SOURCE_UNAVAILABLE: The repository source is unavailable.
   * - SNAPSHOT_CHANGED: The repository snapshot changed during the operation.
   * - INVALID_SOURCE_DATA: The repository source returned invalid data.
   * - RESOURCE_LIMIT_EXCEEDED: A Core or repository resource limit was exceeded.
   * - ABORTED: The Core or repository operation was aborted.
   * - CONTENT_INVALID: The canonical content is not valid UTF-8 text.
   */
  readCanonicalContentPage(input: ICanonicalContentPageInput): Promise<ICanonicalContentPageResult>;

  /**
   * Inspects one coherent repository snapshot through universal and configured adapter validation.
   * @param input The source-neutral reader and optional shared cancellation signal.
   * @returns A promise resolving to the frozen content-free project validation result.
   * @throws
   * - INVALID_ARGUMENT: The Core operation received an invalid argument.
   * - INVALID_REPOSITORY_PATH: A repository path is invalid.
   * - ENTRY_NOT_FOUND: A discovered file disappeared from the reader snapshot.
   * - ENTRY_NOT_FILE: A discovered file changed type during inspection.
   * - ENTRY_NOT_DIRECTORY: A discovered directory changed type during inspection.
   * - ACCESS_DENIED: Access to the repository source was denied.
   * - SOURCE_UNAVAILABLE: The repository source is unavailable.
   * - SNAPSHOT_CHANGED: The repository snapshot changed during inspection.
   * - INVALID_SOURCE_DATA: The repository reader returned invalid contract data.
   * - RESOURCE_LIMIT_EXCEEDED: A Core or repository resource limit was exceeded.
   * - ABORTED: Project inspection or a repository operation was aborted.
   * - ADAPTER_EXECUTION_FAILED: A runtime adapter failed or returned an invalid result.
   */
  validateProject(input: IProjectValidationInput): Promise<IProjectValidationResult>;
}

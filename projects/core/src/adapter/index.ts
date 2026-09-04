import type {
  IRepositoryEntry,
  IRepositoryEntryPage,
  IRepositoryEntryPageOptions,
  IRepositoryFilePage,
  IRepositoryFilePageOptions,
  IRepositoryOperationOptions,
  IRepositoryPath,
  IRepositorySnapshot,
} from '@moldea.ai/repository';

import type { IIndexedAgent, IIndexedDescriptionAsset } from '../contracts/index.js';
import type { IAdapterDiagnostic, IDiagnosticDetails } from '../diagnostics/index.js';
import type { IRepositoryFormatVersion, IRepositoryReference } from '../format/index.js';

// deterministic runtime extension registered with one Core instance
export interface IRuntimeAdapter {
  readonly id: string;
  readonly supportedRepositoryFormatVersions: readonly IRepositoryFormatVersion[];

  /**
   * Inspects the trusted provisional project through the supplied budget-aware reader.
   * @param context The immutable agent closure, reader, and cancellation signal.
   * @returns A promise resolving to deterministic evidence and adapter diagnostics.
   * @throws
   * - INVALID_REPOSITORY_PATH: The repository path is invalid.
   * - ENTRY_NOT_FOUND: The requested repository entry was not found.
   * - ENTRY_NOT_FILE: The requested repository entry is not a file.
   * - ENTRY_NOT_DIRECTORY: The requested repository entry is not a directory.
   * - ACCESS_DENIED: Access to the repository source was denied.
   * - SOURCE_UNAVAILABLE: The repository source is unavailable.
   * - SNAPSHOT_CHANGED: The repository snapshot changed during the operation.
   * - INVALID_SOURCE_DATA: The repository source returned invalid data.
   * - RESOURCE_LIMIT_EXCEEDED: A named repository resource limit was exceeded.
   * - ABORTED: The repository operation was aborted.
   */
  inspect(context: IRuntimeAdapterContext): Promise<IRuntimeAdapterResult>;
}

// immutable invocation context supplied only after universal validation succeeds
export interface IRuntimeAdapterContext {
  readonly agent: IIndexedAgent;
  readonly repository: IRuntimeAdapterRepository;
  readonly signal?: AbortSignal;

  /**
   * Resolves one exact same-runtime manifest agent binding without exposing an agent index.
   * @param reference The runtime-agent source reference to match exactly.
   * @returns The absent, ambiguous, or content-minimal matched agent result.
   */
  resolveAgent(reference: IRepositoryReference): IRuntimeAdapterAgentResolution;
}

// content-minimal agent metadata returned only for one exact runtime binding
export interface IRuntimeAdapterResolvedAgent {
  readonly declaration: IIndexedAgent['declaration'];
  readonly description: IIndexedDescriptionAsset;
  readonly handoffDescription: IIndexedDescriptionAsset | null;
  readonly id: string;
}

// bounded exact-match result for a runtime binding reference
export type IRuntimeAdapterAgentResolution =
  | { readonly kind: 'absent' }
  | { readonly candidateCount: number; readonly kind: 'ambiguous' }
  | { readonly agent: IRuntimeAdapterResolvedAgent; readonly kind: 'matched' };

// bounded repository capability available only during one adapter invocation
export interface IRuntimeAdapterRepository {
  readonly limits: IRuntimeAdapterRepositoryLimits;
  readonly snapshot: IRepositorySnapshot;

  /**
   * Looks up one exact logical path without following symlinks.
   * @param path The validated repository-logical path.
   * @param options Optional cancellation controls.
   * @returns The detached entry or `null` when it is absent.
   * @throws
   * - INVALID_REPOSITORY_PATH: The repository path is invalid.
   * - ACCESS_DENIED: Access to the repository source was denied.
   * - SOURCE_UNAVAILABLE: The repository source is unavailable.
   * - SNAPSHOT_CHANGED: The repository snapshot changed during inspection.
   * - INVALID_SOURCE_DATA: The repository reader returned invalid contract data.
   * - RESOURCE_LIMIT_EXCEEDED: A Core or repository resource limit was exceeded.
   * - ABORTED: Adapter inspection or the repository operation was aborted.
   */
  getEntry(
    path: IRepositoryPath,
    options?: IRepositoryOperationOptions,
  ): Promise<IRepositoryEntry | null>;

  /**
   * Returns one deterministic bounded descendant page.
   * @param options The prefix, keyset cursor, page bound, and cancellation controls.
   * @returns One immutable source-bound page and continuation state.
   * @throws
   * - INVALID_REPOSITORY_PATH: The repository path is invalid.
   * - ENTRY_NOT_FOUND: The requested repository entry was not found.
   * - ENTRY_NOT_DIRECTORY: The requested repository entry is not a directory.
   * - INVALID_PAGE_REQUEST: The repository page request is invalid.
   * - ACCESS_DENIED: Access to the repository source was denied.
   * - SOURCE_UNAVAILABLE: The repository source is unavailable.
   * - SNAPSHOT_CHANGED: The repository snapshot changed during the operation.
   * - INVALID_SOURCE_DATA: The repository source returned invalid data.
   * - RESOURCE_LIMIT_EXCEEDED: A named repository resource limit was exceeded.
   * - ABORTED: The repository operation was aborted.
   */
  listEntriesPage(options: IRepositoryEntryPageOptions): Promise<IRepositoryEntryPage>;

  /**
   * Reads one bounded regular-file byte range without following symlinks.
   * @param path The validated repository-logical file path.
   * @param options The offset, byte bound, and cancellation controls.
   * @returns One detached source-bound byte page and continuation offset.
   * @throws
   * - INVALID_REPOSITORY_PATH: The repository path is invalid.
   * - ENTRY_NOT_FOUND: The requested repository entry was not found.
   * - ENTRY_NOT_FILE: The requested repository entry is not a file.
   * - INVALID_PAGE_REQUEST: The repository page request is invalid.
   * - ACCESS_DENIED: Access to the repository source was denied.
   * - SOURCE_UNAVAILABLE: The repository source is unavailable.
   * - SNAPSHOT_CHANGED: The repository snapshot changed during the operation.
   * - INVALID_SOURCE_DATA: The repository source returned invalid data.
   * - RESOURCE_LIMIT_EXCEEDED: A named repository resource limit was exceeded.
   * - ABORTED: The repository operation was aborted.
   */
  readFilePage(
    path: IRepositoryPath,
    options: IRepositoryFilePageOptions,
  ): Promise<IRepositoryFilePage>;
}

// hard per-invocation bounds used by adapter-side page composition
export interface IRuntimeAdapterRepositoryLimits {
  readonly maxEntries: number;
  readonly maxFileBytes: number;
  readonly maxPageBytes: number;
  readonly maxPageEntries: number;
  readonly maxTotalBytesRead: number;
}

// normalized runtime observation kinds and evidence records
export type IRuntimeAdapterEvidenceKind =
  | 'runtime-package'
  | 'language'
  | 'agent-definition'
  | 'instruction-loader'
  | 'schema'
  | 'tool-registration'
  | 'skill-registration'
  | 'handoff-registration'
  | 'variable-provider'
  | 'runtime-pattern';

export interface IRuntimeAdapterEvidence {
  readonly source: string;
  readonly kind: IRuntimeAdapterEvidenceKind;
  readonly agentId: string | null;
  readonly capabilityKind: 'tool' | 'skill' | null;
  readonly capabilityId: string | null;
  readonly runtimeName: string | null;
  readonly references: readonly IRepositoryReference[];
  readonly details: IDiagnosticDetails;
}

// complete all-or-nothing output from one adapter invocation
export interface IRuntimeAdapterResult {
  readonly evidence: readonly IRuntimeAdapterEvidence[];
  readonly diagnostics: readonly IAdapterDiagnostic[];
}

// adapter diagnostic contract
export type { IAdapterDiagnostic } from '../diagnostics/index.js';

// adapter-only canonical composition contracts
export type {
  IIndexedAgent,
  IIndexedContextAsset,
  IIndexedDecision,
  IIndexedDescriptionAsset,
  IIndexedManifest,
  IIndexedMirror,
  IIndexedRuntimeGuidance,
  IIndexedTextAsset,
} from '../contracts/index.js';

// bounded repository composition
export {
  iterateRuntimeAdapterEntries,
  readRuntimeAdapterFile,
} from '../adapter-repository/index.js';

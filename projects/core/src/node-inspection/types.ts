import type { IRepositoryReader, IRepositorySnapshot } from '@moldea.ai/repository';

import type { IRepositoryFormatVersion } from '../format/index.js';

import type {
  ICoreResourceLimits,
  IProjectInspection,
  IProjectInspectionPageInput,
  IProjectInspectionPageResult,
} from '../contracts/index.js';

// installed adapter identities, without executable functions or repository content
export interface INodeInspectionAdapter {
  readonly id: string;
  readonly supportedRepositoryFormatVersions: readonly IRepositoryFormatVersion[];
}

// callers own the reader and select a registry from trusted installed code
export interface INodeProjectInspectionInput {
  repository: IRepositoryReader;
  adapterRegistryUrl: URL;
  limits?: Partial<ICoreResourceLimits>;
  signal?: AbortSignal;
  deadline?: number;
}

// content-free prepared state retained inside the analysis worker
export type INodeInspectionMetadata = Omit<IProjectInspection, 'readPage'> & {
  readonly adapters: readonly INodeInspectionAdapter[];
  readonly maxAnalysisHeapBytes: number;
};

export interface INodeProjectInspection extends INodeInspectionMetadata {
  /**
   * Reads one content-free page while this inspection owns process admission.
   * @returns The bounded page from the existing prepared inspection.
   * @throws
   * - INVALID_ARGUMENT: The Core operation received an invalid argument.
   * - ABORTED: The Core operation was aborted.
   * - RESOURCE_LIMIT_EXCEEDED: A Core resource limit was exceeded.
   * - INSPECTION_TIMEOUT: The isolated project inspection timed out.
   * - INSPECTION_PROCESS_FAILED: The isolated project inspection failed.
   */
  readPage(input: IProjectInspectionPageInput): Promise<IProjectInspectionPageResult>;

  /**
   * Closes the child and settles actual reader work before releasing admission.
   * @returns A promise resolving after idempotent ownership cleanup.
   * @throws
   * - INVALID_ARGUMENT: The Core operation received an invalid argument.
   * - ABORTED: The Core operation was aborted.
   * - RESOURCE_LIMIT_EXCEEDED: A Core resource limit was exceeded.
   * - INSPECTION_TIMEOUT: The isolated project inspection timed out.
   * - INSPECTION_PROCESS_FAILED: The isolated project inspection failed.
   */
  dispose(): Promise<void>;
}

// closed, bounded transport records shared by both message bridges
export type INodeReaderRequest =
  | { method: 'getEntry'; path: string }
  | { method: 'listEntriesPage'; maxEntries: number; cursor?: string; prefix?: string }
  | { method: 'readFilePage'; path: string; maxBytes: number; offset: number };

export interface INodeInspectionFailure {
  family: 'configuration' | 'operation' | 'repository' | 'path';
  options: Record<string, unknown>;
}

export type INodeInspectionMessage = { attemptId: string } & (
  | {
      kind: 'start';
      registryUrl: string;
      snapshot: IRepositorySnapshot;
      limits: ICoreResourceLimits;
      deadline: number;
    }
  | { kind: 'ready'; maxAnalysisHeapBytes: number }
  | { kind: 'run' }
  | { kind: 'prepared'; inspection: INodeInspectionMetadata }
  | { kind: 'read-page'; requestId: number; input: IProjectInspectionPageInput }
  | { kind: 'page'; requestId: number; result: IProjectInspectionPageResult }
  | { kind: 'reader-request'; requestId: number; request: INodeReaderRequest }
  | { kind: 'reader-response'; requestId: number; result: unknown }
  | { kind: 'failure'; failure: INodeInspectionFailure }
  | { kind: 'dispose' }
);

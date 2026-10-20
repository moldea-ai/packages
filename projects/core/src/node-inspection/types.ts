import type { IRepositoryReader, IRepositorySnapshot } from '@moldea.ai/repository';

import type {
  ICoreResourceLimits,
  IProjectInspection,
  IProjectInspectionPageInput,
  IProjectInspectionPageResult,
} from '../contracts/index.js';

// callers own the source-neutral reader and the optional instruction reader
export interface INodeProjectInspectionInput {
  repository: IRepositoryReader;
  instructions?: IRepositoryReader;
  limits?: Partial<ICoreResourceLimits>;
  signal?: AbortSignal;
  deadline?: number;
}

// content-free prepared state retained inside the analysis worker
export type INodeInspectionMetadata = Omit<IProjectInspection, 'readPage'> & {
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

// the caller-owned source one entry or file request targets
export type INodeReaderSource = 'instructions' | 'repository';

// the caller-owned readers one inspection serves over the bridge
export interface INodeReaderSources {
  readonly instructions?: IRepositoryReader;
  readonly repository: IRepositoryReader;
}

// what the worker knows about the instruction reader
export interface INodeInstructionSourceMetadata {
  snapshot: IRepositorySnapshot;
}

// closed, bounded transport records shared by both message bridges
export type INodeReaderRequest =
  | { method: 'getEntry'; path: string; source: INodeReaderSource }
  | { method: 'readLinkText'; path: string; source: INodeReaderSource }
  | { method: 'listEntriesPage'; maxEntries: number; cursor?: string; prefix?: string }
  | {
      method: 'readFilePage';
      path: string;
      maxBytes: number;
      offset: number;
      source: INodeReaderSource;
    };

export interface INodeInspectionFailure {
  family: 'configuration' | 'operation' | 'repository' | 'path';
  options: Record<string, unknown>;
}

export type INodeInspectionMessage = { attemptId: string } & (
  | {
      kind: 'start';
      snapshot: IRepositorySnapshot;
      instructions: INodeInstructionSourceMetadata | null;
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
  | { kind: 'reader-failure'; requestId: number; failure: INodeInspectionFailure }
  | { kind: 'failure'; failure: INodeInspectionFailure }
  | { kind: 'dispose' }
);

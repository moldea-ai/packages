import type { IRepositoryLinkResolution, IRepositoryPath } from '@moldea.ai/repository';

import type { ICoreWarningCode } from '../diagnostics/index.js';
import type {
  IRepositoryInspectionReader,
  IRepositoryInstructionView,
} from '../repository-inspection-session/index.js';
import type { IRetainedMemory } from '../retained-memory/index.js';

// a managed region and its detected marker-line ending, retained only during comparison
export interface IManagedIntegrationRegion {
  start: number;
  end: number;
  lineEnding: '\n' | '\r\n';
}

// the public parser reports only an installation path or a safe failure reason
export type IIntegrationBlockResult =
  | { kind: 'found'; skillPath: string }
  | {
      kind: 'missing';
      reason: 'block-missing' | 'block-invalid' | 'skill-path-missing' | 'skill-path-invalid';
    };

// why a linked instruction file cannot be verified, reported only in Core-internal details
export type IInstructionLinkState =
  | 'broken'
  | 'denied'
  | 'directory'
  | 'loop'
  | 'not-file'
  | 'not-link'
  | 'other'
  | 'unavailable'
  | 'unsafe';

// shared state for one integration check; `report` records one completed integration warning
export interface IIntegrationInspectionContext {
  readonly instructions: IRepositoryInstructionView;
  readonly ledger: IRetainedMemory;
  readonly reader: IRepositoryInspectionReader;
  readonly report: (
    code: ICoreWarningCode,
    subject: IRepositoryPath,
    details: Record<string, string>,
  ) => void;
  readonly signal?: AbortSignal;
}

// what root AGENTS.md is, as the Claude Code check needs it to recognize links to it
export type IAgentsInstructionTarget =
  | { readonly kind: 'directory' | 'file' | 'missing' }
  | { readonly kind: 'link'; readonly resolution: IRepositoryLinkResolution | null };

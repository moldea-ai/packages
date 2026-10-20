import type { IRepositoryLinkResolution, IRepositoryPath } from '@moldea.ai/repository';

import type { ICoreWarningCode } from '../diagnostics/index.js';
import type {
  IRepositoryInspectionReader,
  IRepositoryInstructionView,
} from '../repository-inspection-session/index.js';
import type { IRetainedMemory } from '../retained-memory/index.js';

// the public parser reports only an installation path or a safe failure reason
export type IIntegrationBlockResult =
  | { kind: 'found'; skillPath: string }
  | {
      kind: 'missing';
      reason: 'block-missing' | 'block-invalid' | 'skill-path-missing' | 'skill-path-invalid';
    };

// why an instruction file's link doesn't lead to a file in the repository, used as its qualifier
export type IUnresolvedLinkState = Exclude<IRepositoryLinkResolution['state'], 'file'>;

/*
 * Shared state for one integration check. `report` records one completed integration warning;
 * its qualifier is null for every code except `MOLDEA_INTEGRATION_LINK_UNRESOLVED`.
 */
export interface IIntegrationInspectionContext {
  readonly instructions: IRepositoryInstructionView;
  readonly ledger: IRetainedMemory;
  readonly reader: IRepositoryInspectionReader;
  readonly report: (
    code: ICoreWarningCode,
    subject: IRepositoryPath,
    details: Record<string, string>,
    qualifier?: IUnresolvedLinkState,
  ) => void;
  readonly signal?: AbortSignal;
}

// what root AGENTS.md is, as the Claude Code check needs it to recognize links to it
export type IAgentsInstructionTarget =
  | { readonly kind: 'directory' | 'file' | 'missing' }
  | { readonly kind: 'link'; readonly resolution: IRepositoryLinkResolution };

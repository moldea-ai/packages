import type { BigIntStats } from 'node:fs';
import type path from 'node:path';

// the platform path API, POSIX or Windows, whose semantics a link walk follows
export type ILinkPathApi = path.PlatformPath;

// where a walk continues after following the text of one link
export interface ILinkWalkStart {
  readonly components: readonly string[];
  readonly directory: string;
}

// terminal link states that end a walk without a target
export type ILinkRefusedState = 'broken' | 'denied' | 'loop' | 'unsafe';

// outcome of walking one link chain: a terminal state or the observed final target
export type ILinkWalkOutcome =
  | { readonly kind: 'refused'; readonly state: ILinkRefusedState }
  | { readonly hostPath: string; readonly kind: 'target'; readonly statistics: BigIntStats };

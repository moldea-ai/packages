import type { IGitInventoryCandidate, IGitInventoryProbeFailedResult } from '../types.js';

// raw Git candidates entering link-ancestor shadowing, before ownership filtering
export interface IGitLinkAncestorShadowInput {
  readonly candidates: readonly IGitInventoryCandidate[];
  readonly repositoryRoot: string;
  readonly signal?: AbortSignal;
}

// candidates left once every candidate beneath a working-tree link is replaced by the link
export interface IGitLinkAncestorShadowedResult {
  readonly candidates: readonly IGitInventoryCandidate[];
  readonly kind: 'shadowed';
}

// shadowed candidates, or a safe failure from observing an ancestor
export type IGitLinkAncestorShadowResult =
  IGitInventoryProbeFailedResult | IGitLinkAncestorShadowedResult;

// injectable link-ancestor shadowing step
export type IGitLinkAncestorShadower = (
  input: IGitLinkAncestorShadowInput,
) => Promise<IGitLinkAncestorShadowResult>;

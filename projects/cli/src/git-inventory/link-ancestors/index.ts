// types
export type {
  IGitLinkAncestorShadowedResult,
  IGitLinkAncestorShadower,
  IGitLinkAncestorShadowInput,
  IGitLinkAncestorShadowResult,
} from './types.js';

// link-ancestor shadowing
export { createGitLinkAncestorShadower, shadowGitLinkAncestors } from './shadower.js';

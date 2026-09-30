// types
export type {
  ICodeDiffLine,
  ICodeDiffModel,
  ICodeDiffRow,
  ICodeDiffSection,
  ICodeDiffToken,
} from './types.js';

// build-time comparison
export { buildCodeDiff } from './utilities.js';
export { buildCodePatch } from './patch.js';

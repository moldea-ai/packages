// relationship classification
export {
  classifyDirectCallRelationship,
  classifySchemaRelationship,
  classifyToolRelationships,
} from './relationships.js';
// declared relationship accounting
export { createRelationshipCoverage, iterateDeclaredRelationships } from './coverage.js';
export type {
  IDeclaredRelationship,
  IDeclaredRelationshipSubject,
  IRelationshipDeclaration,
  IRelationshipEvidenceCollector,
} from './types.js';
// independent declared export checks
export { inspectDeclaredExports } from './exports.js';
// canonical instruction provenance
export { classifyInstructionSource } from './instruction-source.js';
export type { IInstructionSourceResult } from './instruction-source.js';

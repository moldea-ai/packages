// types
export type {
  IExactManifestScopeDeclaration,
  IGlobManifestScopeDeclaration,
  IManifestScopeCounts,
  IManifestScopeDeclaration,
  IManifestScopeInput,
  IManifestScopeMatch,
  IManifestScopeOwner,
  IManifestScopeOwnerKind,
  IManifestScopeRelationshipField,
  IManifestScopeResult,
} from './types.js';

// scope matching
export {
  calculateManifestScopeInputDigest,
  matchParsedManifestScope,
  collectManifestScopeDeclarations,
} from './matching.js';

// public operation
export { matchManifestScope } from './scope.js';

// validation
export { normalizeManifestScopeInput } from './validations.js';

// shared simple-glob matching
export { matchesRepositoryGlob } from './patterns.js';

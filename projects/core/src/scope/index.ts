// scope contracts
export type {
  IManifestScopeInput,
  IManifestScopeResult,
  IManifestScopeCounts,
  IManifestScopeDeclaration,
  IManifestScopeMatch,
  IManifestScopeOwner,
  IManifestScopeOwnerKind,
  IManifestScopeRelationshipField,
  IExactManifestScopeDeclaration,
  IGlobManifestScopeDeclaration,
} from '../scope-matching/index.js';

// standalone manifest-only matcher
export { matchManifestScope } from './scope.js';

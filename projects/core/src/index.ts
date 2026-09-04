// runtime adapter evidence contracts
export type { IRuntimeAdapterEvidence, IRuntimeAdapterEvidenceKind } from './adapter/index.js';

// supported versions and default resource limits
export {
  DEFAULT_CORE_RESOURCE_LIMITS,
  SUPPORTED_REPOSITORY_FORMAT_VERSIONS,
} from './constants/index.js';

// Core operation, result, and project-index contracts
export type {
  IContentDigest,
  IContentDigestResult,
  ICanonicalContentPageInput,
  ICanonicalContentPageResult,
  ICore,
  ICoreOptions,
  ICoreResourceLimits,
  IDecisionParseResult,
  IManifestParseResult,
  INormalizedText,
  IProjectMetadataItem,
  IProjectMetadataKind,
  IProjectInspectionItem,
  IProjectInspectionCounts,
  IProjectInspectionPage,
  IProjectInspectionPageInput,
  IProjectInspectionPageRecord,
  IProjectInspectionPageResult,
  IProjectInspectionView,
  IProjectSummaryCounts,
  IProjectValidationInput,
  IProjectValidationResult,
  IProjectValidationSummary,
  ITextDocumentContent,
  ITextDocumentInput,
  ITextNormalizationResult,
} from './contracts/index.js';

// manifest scope contracts
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
} from './scope-matching/index.js';

// Core construction
export { createCore } from './core/index.js';

// diagnostic contracts
export type {
  IAdapterDiagnostic,
  ICoreDiagnostic,
  ICoreDiagnosticCode,
  IDiagnostic,
  IDiagnosticDetails,
  IDiagnosticEntity,
  ISourcePosition,
  ISourceRange,
} from './diagnostics/index.js';

// exception contracts
export type {
  ICoreConfigurationErrorCode,
  ICoreConfigurationExceptionOptions,
  ICoreOperation,
  ICoreOperationErrorCode,
  ICoreOperationExceptionOptions,
} from './exceptions/index.js';

// exceptions
export { CoreConfigurationException, CoreOperationException } from './exceptions/index.js';

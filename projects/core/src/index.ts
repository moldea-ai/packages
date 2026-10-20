// binding check contracts
export type {
  IBindingRelationship,
  IExportNotCheckedReason,
  IBindingCoverage,
  IBindingCoverageCounts,
} from './binding-coverage/index.js';

// supported versions and default resource limits
export {
  DEFAULT_CORE_RESOURCE_LIMITS,
  RECOGNIZED_RUNTIME_IDS,
  ACCEPTABLE_WARNING_CODES,
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
  IProjectAgentAssignmentItem,
  IProjectInspection,
  IProjectInspectionItem,
  IProjectInspectionCounts,
  IProjectInspectionInput,
  IProjectInspectionPage,
  IProjectInspectionPageInput,
  IProjectInspectionPageRecord,
  IProjectInspectionPageResult,
  IProjectInspectionResourceUsage,
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
  ICoreResourceLimitNextAction,
} from './exceptions/index.js';

// exceptions
export { CoreConfigurationException, CoreOperationException } from './exceptions/index.js';

// coding-agent integration parser
export type { IIntegrationBlockResult } from './integration-validation/index.js';
export { parseIntegrationBlock } from './integration-validation/index.js';

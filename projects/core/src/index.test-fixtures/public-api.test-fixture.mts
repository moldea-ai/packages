import { parseRepositoryPath, type IRepositoryReader } from '@moldea.ai/repository';
// @ts-expect-error The Core package has no default root export.
import coreDefault from '@moldea.ai/core';
import {
  CoreConfigurationException,
  CoreOperationException,
  DEFAULT_CORE_RESOURCE_LIMITS,
  SUPPORTED_REPOSITORY_FORMAT_VERSIONS,
  createCore,
  type IAdapterDiagnostic,
  type ICanonicalContentPageInput,
  type ICanonicalContentPageResult,
  type IContentDigest,
  type IContentDigestResult,
  type ICore,
  type ICoreConfigurationErrorCode,
  type ICoreConfigurationExceptionOptions,
  type ICoreDiagnostic,
  type ICoreDiagnosticCode,
  type ICoreOperation,
  type ICoreOperationErrorCode,
  type ICoreOperationExceptionOptions,
  type ICoreOptions,
  type ICoreResourceLimits,
  type ICoreResourceLimitNextAction,
  type IDecisionParseResult,
  type IDiagnostic,
  type IDiagnosticDetails,
  type IDiagnosticEntity,
  type IExactManifestScopeDeclaration,
  type IGlobManifestScopeDeclaration,
  type IRuntimeAdapterEvidence,
  type IRuntimeAdapterEvidenceKind,
  type IManifestParseResult,
  type IManifestScopeCounts,
  type IManifestScopeDeclaration,
  type IManifestScopeInput,
  type IManifestScopeMatch,
  type IManifestScopeOwner,
  type IManifestScopeOwnerKind,
  type IManifestScopeRelationshipField,
  type IManifestScopeResult,
  type INormalizedText,
  type IProjectMetadataItem,
  type IProjectMetadataKind,
  type IProjectInspection,
  type IProjectInspectionCounts,
  type IProjectInspectionInput,
  type IProjectInspectionItem,
  type IProjectInspectionPage,
  type IProjectInspectionPageInput,
  type IProjectInspectionPageRecord,
  type IProjectInspectionPageResult,
  type IProjectInspectionResourceUsage,
  type IProjectInspectionView,
  type IProjectSummaryCounts,
  type IProjectValidationInput,
  type IProjectValidationResult,
  type IProjectValidationSummary,
  type ISourcePosition,
  type ISourceRange,
  type ITextDocumentContent,
  type ITextDocumentInput,
  type ITextNormalizationResult,
} from '@moldea.ai/core';
// @ts-expect-error Runtime adapter contracts belong to the adapter subpath.
import type { IRuntimeAdapter as IRootRuntimeAdapter } from '@moldea.ai/core';
// @ts-expect-error Repository-format contracts belong to the format subpath.
import type { IMoldeaManifestV1 as IRootManifest } from '@moldea.ai/core';
// @ts-expect-error The adapter subpath has no default export.
import adapterDefault from '@moldea.ai/core/adapter';
import { iterateRuntimeAdapterEntries, readRuntimeAdapterFile } from '@moldea.ai/core/adapter';
import type {
  IAdapterDiagnostic as IAdapterSubpathDiagnostic,
  IRuntimeAdapter,
  IRuntimeAdapterContext,
  IRuntimeAdapterEvidence as IAdapterSubpathEvidence,
  IRuntimeAdapterEvidenceKind as IAdapterSubpathEvidenceKind,
  IRuntimeAdapterResult,
  IRuntimeAdapterRepository,
  IRuntimeAdapterRepositoryLimits,
  IRuntimeAdapterAgentResolution,
  IRuntimeAdapterResolvedAgent,
  IIndexedAgent,
  IIndexedContextAsset,
  IIndexedDecision,
  IIndexedDescriptionAsset,
  IIndexedManifest,
  IIndexedMirror,
  IIndexedRuntimeGuidance,
  IIndexedTextAsset,
} from '@moldea.ai/core/adapter';
// @ts-expect-error The format subpath has no default export.
import formatDefault from '@moldea.ai/core/format';
import type {
  IAgentBindingsManifestEntry,
  IAgentManifestEntry,
  IDecisionStatus,
  IRuntimeManifestEntry,
  IMoldeaManifestV1,
  IParsedDecision,
  IRelationshipManifestEntry,
  IRepositoryFormatVersion,
  IRepositoryReference,
  IRuntimeVariableManifestEntry,
  ISkillManifestEntry,
  IToolManifestEntry,
  IUnresolvedRequirementEffect,
  IUnresolvedRequirementManifestEntry,
} from '@moldea.ai/core/format';
// @ts-expect-error Repository format version 1 has no manifest handoff relationship.
import type { IHandoffManifestEntry } from '@moldea.ai/core/format';

type IRootSurface = readonly [
  IAdapterDiagnostic,
  ICanonicalContentPageInput,
  ICanonicalContentPageResult,
  IContentDigest,
  IContentDigestResult,
  ICore,
  ICoreConfigurationErrorCode,
  ICoreConfigurationExceptionOptions,
  ICoreDiagnostic,
  ICoreDiagnosticCode,
  ICoreOperation,
  ICoreOperationErrorCode,
  ICoreOperationExceptionOptions,
  ICoreOptions,
  ICoreResourceLimits,
  ICoreResourceLimitNextAction,
  IDecisionParseResult,
  IDiagnostic,
  IDiagnosticDetails,
  IDiagnosticEntity,
  IExactManifestScopeDeclaration,
  IGlobManifestScopeDeclaration,
  IRuntimeAdapterEvidence,
  IRuntimeAdapterEvidenceKind,
  IManifestParseResult,
  IManifestScopeCounts,
  IManifestScopeDeclaration,
  IManifestScopeInput,
  IManifestScopeMatch,
  IManifestScopeOwner,
  IManifestScopeOwnerKind,
  IManifestScopeRelationshipField,
  IManifestScopeResult,
  INormalizedText,
  IProjectMetadataItem,
  IProjectMetadataKind,
  IProjectInspection,
  IProjectInspectionCounts,
  IProjectInspectionInput,
  IProjectInspectionItem,
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
  ISourcePosition,
  ISourceRange,
  ITextDocumentContent,
  ITextDocumentInput,
  ITextNormalizationResult,
];

type IFormatSurface = readonly [
  IAgentBindingsManifestEntry,
  IAgentManifestEntry,
  IDecisionStatus,
  IRuntimeManifestEntry,
  IMoldeaManifestV1,
  IParsedDecision,
  IRelationshipManifestEntry,
  IRepositoryFormatVersion,
  IRepositoryReference,
  IRuntimeVariableManifestEntry,
  ISkillManifestEntry,
  IToolManifestEntry,
  IUnresolvedRequirementEffect,
  IUnresolvedRequirementManifestEntry,
];

type IAdapterSurface = readonly [
  IAdapterSubpathDiagnostic,
  IRuntimeAdapter,
  IRuntimeAdapterContext,
  IAdapterSubpathEvidence,
  IAdapterSubpathEvidenceKind,
  IRuntimeAdapterResult,
  IRuntimeAdapterRepository,
  IRuntimeAdapterRepositoryLimits,
  IRuntimeAdapterAgentResolution,
  IRuntimeAdapterResolvedAgent,
  IIndexedAgent,
  IIndexedContextAsset,
  IIndexedDecision,
  IIndexedDescriptionAsset,
  IIndexedManifest,
  IIndexedMirror,
  IIndexedRuntimeGuidance,
  IIndexedTextAsset,
];

type IRemovedHandoffSurface = IHandoffManifestEntry;
type IWrongRootAdapterSurface = IRootRuntimeAdapter;
type IWrongRootFormatSurface = IRootManifest;
type ICapabilityKind = NonNullable<IDiagnosticEntity['capabilityKind']>;

declare const rootSurface: IRootSurface;
declare const formatSurface: IFormatSurface;
declare const adapterSurface: IAdapterSurface;
declare const removedHandoffSurface: IRemovedHandoffSurface;
declare const wrongRootAdapterSurface: IWrongRootAdapterSurface;
declare const wrongRootFormatSurface: IWrongRootFormatSurface;
declare const repository: IRepositoryReader;

const path = parseRepositoryPath('/moldea/project.md');
const adapter: IRuntimeAdapter = {
  id: 'openai',
  inspect: (context) => {
    const adapterRepository: IRuntimeAdapterRepository = context.repository;
    const adapterResult: IRuntimeAdapterResult = { diagnostics: [], evidence: [] };

    void adapterRepository;

    return Promise.resolve(adapterResult);
  },
  supportedRepositoryFormatVersions: [1],
};
// @ts-expect-error Runtime adapters require an inspect operation.
const incompleteAdapter: IRuntimeAdapter = {
  id: 'incomplete-adapter',
  supportedRepositoryFormatVersions: [1],
};
const options: ICoreOptions = { adapters: [adapter], limits: { maxFileBytes: 1024 } };
const core: ICore = createCore(options);
const input: ITextDocumentInput = { content: 'project\n', path };
const normalized: ITextNormalizationResult = core.normalizeText(input);
const digested: Promise<IContentDigestResult> = core.calculateContentDigest(input);
const parsedManifest: Promise<IManifestParseResult> = core.parseManifest({
  content: 'version: 1\n',
  path: parseRepositoryPath('/moldea/moldea.yaml'),
});
const parsedDecision: Promise<IDecisionParseResult> = core.parseDecision({
  content: '---\nstatus: accepted\ncreatedAt: "2026-08-07T19:42:03.456Z"\n---\nBody.\n',
  path: parseRepositoryPath('/moldea/decisions/1786131723456-use-postgresql.md'),
});
const inspectedProject: Promise<IProjectValidationResult> = core.validateProject({ repository });
const inspection: Promise<IProjectInspection> = core.createProjectInspection({ repository });
const inspectionPage: IProjectInspectionPageResult = (
  await core.createProjectInspection({ repository })
).readPage({ maxItems: 16, view: 'metadata' });
const contentPage: Promise<ICanonicalContentPageResult> = core.readCanonicalContentPage({
  maxBytes: 4096,
  offset: 0,
  path,
  repository,
});
const matchedScope: Promise<IManifestScopeResult> = core.matchManifestScope({
  manifest: {
    content: 'version: 1\n',
    path: parseRepositoryPath('/moldea/moldea.yaml'),
  },
  paths: ['/src/index.ts'],
});
const configurationException = new CoreConfigurationException({
  code: 'INVALID_RESOURCE_LIMIT',
  operation: 'create-core',
});
const operationException = new CoreOperationException({
  code: 'RESOURCE_LIMIT_EXCEEDED',
  limit: 'maxFileBytes',
  limitMaximum: 1024,
  nextAction: 'reduce-input-or-increase-limit',
  observedUsage: 1025,
  operation: 'normalize-text',
});
const repositoryFormatVersion: IRepositoryFormatVersion = 1;
const decisionStatus: IDecisionStatus = 'accepted';
const unresolvedEffect: IUnresolvedRequirementEffect = 'warning';
const evidenceKind: IRuntimeAdapterEvidenceKind = 'tool-registration';
const capabilityKind: ICapabilityKind = 'tool';
const diagnosticCode: ICoreDiagnosticCode = 'MOLDEA_TEXT_EMPTY';
const configurationErrorCode: ICoreConfigurationErrorCode = 'INVALID_RESOURCE_LIMIT';
const operationErrorCode: ICoreOperationErrorCode = 'RESOURCE_LIMIT_EXCEEDED';
const resourceLimitNextAction: ICoreResourceLimitNextAction = 'reduce-input-or-increase-limit';
const operation: ICoreOperation = 'validate-project';
const scopeOperation: ICoreOperation = 'match-manifest-scope';

// @ts-expect-error Repository format version 2 is not part of the version 1 contract.
const unsupportedRepositoryFormatVersion: IRepositoryFormatVersion = 2;
// @ts-expect-error Decision statuses are a closed public union.
const unsupportedDecisionStatus: IDecisionStatus = 'active';
// @ts-expect-error Unresolved-requirement effects are a closed public union.
const unsupportedUnresolvedEffect: IUnresolvedRequirementEffect = 'error';
// @ts-expect-error Adapter evidence kinds are a closed public union.
const unsupportedEvidenceKind: IRuntimeAdapterEvidenceKind = 'unknown';
// @ts-expect-error Diagnostic capability kinds are limited to tools and skills.
const unsupportedCapabilityKind: ICapabilityKind = 'handoff';
// @ts-expect-error Built-in diagnostic codes are closed for this Core major version.
const unsupportedDiagnosticCode: ICoreDiagnosticCode = 'MOLDEA_UNKNOWN';
// @ts-expect-error Configuration error codes are a closed public union.
const unsupportedConfigurationErrorCode: ICoreConfigurationErrorCode = 'UNKNOWN';
// @ts-expect-error Operation error codes are a closed public union.
const unsupportedOperationErrorCode: ICoreOperationErrorCode = 'UNKNOWN';
// @ts-expect-error Core operations are a closed public union.
const unsupportedOperation: ICoreOperation = 'unknown-operation';
// @ts-expect-error Core options expose a read-only adapter collection.
options.adapters = [];
// @ts-expect-error Core diagnostics expose a read-only result collection.
normalized.diagnostics.push();

if (SUPPORTED_REPOSITORY_FORMAT_VERSIONS[0] !== 1) {
  throw new Error('The packaged Core does not advertise repository format version 1.');
}

void [
  rootSurface,
  formatSurface,
  adapterSurface,
  adapterDefault,
  capabilityKind,
  configurationErrorCode,
  coreDefault,
  DEFAULT_CORE_RESOURCE_LIMITS,
  decisionStatus,
  diagnosticCode,
  digested,
  evidenceKind,
  formatDefault,
  incompleteAdapter,
  inspection,
  iterateRuntimeAdapterEntries,
  contentPage,
  inspectionPage,
  inspectedProject,
  matchedScope,
  normalized,
  operation,
  operationErrorCode,
  resourceLimitNextAction,
  scopeOperation,
  parsedDecision,
  parsedManifest,
  readRuntimeAdapterFile,
  configurationException,
  operationException,
  removedHandoffSurface,
  repositoryFormatVersion,
  unresolvedEffect,
  unsupportedCapabilityKind,
  unsupportedConfigurationErrorCode,
  unsupportedDecisionStatus,
  unsupportedDiagnosticCode,
  unsupportedEvidenceKind,
  unsupportedOperation,
  unsupportedOperationErrorCode,
  unsupportedRepositoryFormatVersion,
  unsupportedUnresolvedEffect,
  wrongRootAdapterSurface,
  wrongRootFormatSurface,
];

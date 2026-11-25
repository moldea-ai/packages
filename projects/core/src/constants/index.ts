import type { ICoreResourceLimits } from '../contracts/index.js';
import type { IRepositoryFormatVersion } from '../format/index.js';

// warning codes whose findings may be explicitly accepted in the manifest
export const ACCEPTABLE_WARNING_CODES = Object.freeze([
  'MOLDEA_IMPACT_PATTERN_UNMATCHED',
  'MOLDEA_INTEGRATION_BLOCK_MISSING',
  'MOLDEA_INTEGRATION_SKILL_MISSING',
  'MOLDEA_INTEGRATION_BLOCK_STALE',
  'MOLDEA_INTEGRATION_LINK_UNRESOLVED',
  'MOLDEA_INTEGRATION_CLAUDE_IMPORT_MISSING',
] as const);

// repository-format major versions interpreted by this Core release
export const SUPPORTED_REPOSITORY_FORMAT_VERSIONS: readonly IRepositoryFormatVersion[] =
  Object.freeze([1]);

// default safety budgets applied independently to each Core operation
export const DEFAULT_CORE_RESOURCE_LIMITS: ICoreResourceLimits = Object.freeze({
  maxDiagnostics: 10_000,
  maxEntries: 100_000,
  maxCoverage: 10_000,
  maxAcceptedWarnings: 256,
  maxFileBytes: 8_388_608,
  maxManifestBytes: 2_097_152,
  maxRetainedBytes: 536_870_912,
  maxTotalBytesRead: 134_217_728,
});

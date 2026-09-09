// generated content contracts
export type {
  ICapabilities,
  ICapabilityCase,
  ICapabilityFact,
  ICapabilityFile,
  ICapabilityGroupId,
  ICapabilityGroup,
  ICapabilityResult,
  ICapabilityOutcome,
  ICapabilityRuntimeTarget,
  ICoreOperation,
  IDiagnosticCoverage,
  IRuntimePatternProof,
} from './types.ts';

// catalog generation
export { createCapabilities } from './capabilities.ts';

// shared page and discovery presentation
export {
  getCapabilityShowcase,
  getCapabilityOutcome,
  getCapabilityResultExcerpt,
  getCapabilityFactRows,
} from './presentation.ts';

// shared example projection and assertion boundaries
export { projectDiagnostics, projectEntry, projectEvidence, projectFile } from './transformers.ts';
export {
  assertCapabilityFacts,
  captureOperationalRefusal,
  validateCapabilities,
  validateRuntimeSourceProofs,
  validateRuntimeWitness,
} from './validations.ts';

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
  ICoreOperation,
  IDiagnosticCoverage,
} from './types.ts';

// catalog generation
export { createCapabilities } from './capabilities.ts';

// shared page and discovery presentation
export {
  getCapabilityShowcase,
  getCapabilityVisualFamily,
  getCapabilityOutcome,
  getCapabilityResultExcerpt,
  getCapabilityFactRows,
} from './presentation.ts';

// shared example projection and assertion boundaries
export { projectDiagnostics, projectEntry, projectFile } from './transformers.ts';
export {
  assertCapabilityFacts,
  captureOperationalRefusal,
  validateCapabilities,
} from './validations.ts';

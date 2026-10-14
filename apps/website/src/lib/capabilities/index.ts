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
  getValidationOutcome,
  getCapabilityFactRows,
} from './presentation.ts';

// shared example projection and assertion boundaries
export { projectDiagnostics, projectEntry, projectFile } from './transformers.ts';
export { createRecordedOutput, assertRecordedOutput } from './output/index.ts';
export type { IRecordedOutput, IOutputRedaction } from './output/index.ts';
export {
  assertCapabilityFacts,
  captureOperationalRefusal,
  validateCapabilities,
} from './validations.ts';

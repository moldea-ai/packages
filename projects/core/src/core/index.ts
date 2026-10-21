import { deepFreeze } from 'jg-utilities';

import type {
  ICanonicalContentPageInput,
  ICore,
  ICoreOptions,
  IProjectInspectionInput,
  IProjectValidationInput,
  ITextDocumentInput,
} from '../contracts/index.js';
import { readCanonicalContentPage } from '../canonical-content-page/index.js';
import { parseDecisionDocument } from '../decision/index.js';
import { parseManifestDocument } from '../manifest/index.js';
import { createCoreOperationOptionsSnapshot, normalizeCoreOptions } from '../options/index.js';
import { createProjectInspection } from '../project-inspection/index.js';
import { validateProject } from '../project-validation/index.js';
import { matchManifestScope } from '../scope-matching/index.js';
import type { IManifestScopeInput } from '../scope-matching/types.js';
import { calculateContentDigest, normalizeTextDocument } from '../text/index.js';

/**
 * Creates one immutable Core instance from detached configuration snapshots.
 * @param options Optional resource-limit overrides.
 * @returns A frozen Core instance safe for concurrent independent operations.
 * @throws
 * - INVALID_RESOURCE_LIMIT: A Core resource limit is invalid.
 */
export const createCore = (options?: ICoreOptions): ICore => {
  const snapshot = normalizeCoreOptions(options);

  return deepFreeze({
    calculateContentDigest: (input: ITextDocumentInput) => {
      const operation = createCoreOperationOptionsSnapshot(snapshot);
      return calculateContentDigest(input, operation.limits);
    },
    createProjectInspection: (input: IProjectInspectionInput) =>
      createProjectInspection(input, createCoreOperationOptionsSnapshot(snapshot)),
    validateProject: (input: IProjectValidationInput) =>
      validateProject(input, createCoreOperationOptionsSnapshot(snapshot)),
    matchManifestScope: (input: IManifestScopeInput) =>
      matchManifestScope(input, createCoreOperationOptionsSnapshot(snapshot)),
    normalizeText: (input: ITextDocumentInput) => {
      const operation = createCoreOperationOptionsSnapshot(snapshot);
      return normalizeTextDocument(input, operation.limits, 'normalize-text');
    },
    parseDecision: (input: ITextDocumentInput) =>
      parseDecisionDocument(input, createCoreOperationOptionsSnapshot(snapshot)),
    parseManifest: (input: ITextDocumentInput) =>
      parseManifestDocument(input, createCoreOperationOptionsSnapshot(snapshot)),
    readCanonicalContentPage: (input: ICanonicalContentPageInput) =>
      readCanonicalContentPage(input, createCoreOperationOptionsSnapshot(snapshot)),
  });
};

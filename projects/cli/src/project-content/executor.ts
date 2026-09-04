import { createCore } from '@moldea.ai/core';

import type {
  IMoldeaCliProjectContentCoreFactory,
  IMoldeaCliProjectContentExecutor,
} from './types.js';

/** Creates an adapter-free executor for one bounded canonical content range. */
export const createMoldeaCliProjectContentExecutor = (
  coreFactory: IMoldeaCliProjectContentCoreFactory = createCore,
): IMoldeaCliProjectContentExecutor => {
  return async (input) => {
    const core = coreFactory({
      limits: Object.freeze({
        maxDiagnostics: input.resourceLimits.maxDiagnostics,
        maxEntries: input.resourceLimits.maxEntries,
        maxEvidence: input.resourceLimits.maxEvidence,
        maxFileBytes: input.resourceLimits.maxFileBytes,
        maxManifestBytes: input.resourceLimits.maxManifestBytes,
        maxTotalBytesRead: input.resourceLimits.maxTotalBytes,
      }),
    });

    return core.readCanonicalContentPage({
      maxBytes: input.maxBytes,
      offset: input.offset,
      path: input.path,
      repository: input.repository,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    });
  };
};

/** Executes one adapter-free explicit canonical content range read. */
export const executeMoldeaCliProjectContent = createMoldeaCliProjectContentExecutor();

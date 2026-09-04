import { createCore } from '@moldea.ai/core';

import { MOLDEA_MANIFEST_PATH } from './constants.js';
import type { IMoldeaCliProjectScopeCoreFactory, IMoldeaCliProjectScopeExecutor } from './types.js';

/** Creates an adapter-free manifest-only Core scope executor. */
export const createMoldeaCliProjectScopeExecutor = (
  coreFactory: IMoldeaCliProjectScopeCoreFactory = createCore,
): IMoldeaCliProjectScopeExecutor => {
  return async (input) => {
    const manifestBytes = await input.repository.readFile(
      MOLDEA_MANIFEST_PATH,
      input.signal === undefined ? undefined : { signal: input.signal },
    );
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
    const scope = await core.matchManifestScope({
      manifest: { content: manifestBytes, path: MOLDEA_MANIFEST_PATH },
      paths: input.paths,
    });

    return Object.freeze({
      manifestContent: new TextDecoder('utf-8').decode(manifestBytes),
      scope,
    });
  };
};

/** Executes one adapter-free manifest-only changed-path scope match. */
export const executeMoldeaCliProjectScope = createMoldeaCliProjectScopeExecutor();

import { createCore } from '@moldea.ai/core';

import { MoldeaCliProjectContentException } from './exception.js';
import type {
  IMoldeaCliProjectContentCoreFactory,
  IMoldeaCliProjectContentExecutor,
} from './types.js';

/** Creates an adapter-free executor for one explicit canonical content asset. */
export const createMoldeaCliProjectContentExecutor = (
  coreFactory: IMoldeaCliProjectContentCoreFactory = createCore,
): IMoldeaCliProjectContentExecutor => {
  return async (input) => {
    const bytes = await input.repository.readFile(
      input.path,
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
    const result = await core.calculateContentDigest({ content: bytes, path: input.path });

    if (!result.valid || result.digest === null || result.text === null) {
      throw new MoldeaCliProjectContentException('CONTENT_INVALID');
    }

    return Object.freeze({
      content: result.text.value,
      digest: result.digest,
      path: input.path,
      scalarLength: result.text.scalarLength,
      utf8ByteLength: result.text.utf8ByteLength,
    });
  };
};

/** Executes one adapter-free explicit canonical content read. */
export const executeMoldeaCliProjectContent = createMoldeaCliProjectContentExecutor();

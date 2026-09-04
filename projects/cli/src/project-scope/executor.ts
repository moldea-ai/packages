import { createCore } from '@moldea.ai/core';
import { RepositorySourceException } from '@moldea.ai/repository';

import { MOLDEA_MANIFEST_PATH } from './constants.js';
import type {
  IMoldeaCliProjectScopeCoreFactory,
  IMoldeaCliProjectScopeExecutor,
  IMoldeaCliProjectScopeInput,
} from './types.js';

/** Reads the complete manifest within its explicit small-file resource bound. */
const readBoundedManifest = async (input: IMoldeaCliProjectScopeInput): Promise<Uint8Array> => {
  const operationOptions = input.signal === undefined ? undefined : { signal: input.signal };
  const entry = await input.repository.getEntry(MOLDEA_MANIFEST_PATH, operationOptions);

  if (entry === null) {
    throw new RepositorySourceException({
      code: 'ENTRY_NOT_FOUND',
      operation: 'read-file-page',
      path: MOLDEA_MANIFEST_PATH,
      retryable: false,
    });
  }

  if (entry.type !== 'file' || entry.byteLength === null) {
    throw new RepositorySourceException({
      code: 'ENTRY_NOT_FILE',
      operation: 'read-file-page',
      path: MOLDEA_MANIFEST_PATH,
      retryable: false,
    });
  }

  const maxBytes = Math.min(
    input.resourceLimits.maxManifestBytes,
    input.resourceLimits.maxTotalBytes,
  );

  if (entry.byteLength > maxBytes) {
    throw new RepositorySourceException({
      code: 'RESOURCE_LIMIT_EXCEEDED',
      operation: 'read-file-page',
      path: MOLDEA_MANIFEST_PATH,
      retryable: false,
    });
  }

  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  let nextOffset = 0;
  let isComplete = false;

  while (!isComplete) {
    const page = await input.repository.readFilePage(MOLDEA_MANIFEST_PATH, {
      maxBytes: Math.max(1, entry.byteLength - byteLength),
      offset: nextOffset,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    });

    if (
      page.snapshot.id !== input.repository.snapshot.id ||
      page.offset !== nextOffset ||
      page.totalBytes !== entry.byteLength ||
      page.bytes.byteLength > entry.byteLength - byteLength ||
      (page.bytes.byteLength === 0 && !page.isComplete) ||
      (!page.isComplete && page.nextOffset !== page.offset + page.bytes.byteLength)
    ) {
      throw new RepositorySourceException({
        code: 'INVALID_SOURCE_DATA',
        operation: 'read-file-page',
        path: MOLDEA_MANIFEST_PATH,
        retryable: false,
      });
    }

    chunks.push(page.bytes);
    byteLength += page.bytes.byteLength;
    nextOffset = page.nextOffset ?? byteLength;
    isComplete = page.isComplete;
  }

  if (byteLength !== entry.byteLength) {
    throw new RepositorySourceException({
      code: 'PROVIDER_INCOMPLETE',
      operation: 'read-file-page',
      path: MOLDEA_MANIFEST_PATH,
      retryable: false,
    });
  }

  const manifestBytes = new Uint8Array(byteLength);
  let writeOffset = 0;

  for (const chunk of chunks) {
    manifestBytes.set(chunk, writeOffset);
    writeOffset += chunk.byteLength;
  }

  return manifestBytes;
};

/** Creates an adapter-free manifest-only Core scope executor. */
export const createMoldeaCliProjectScopeExecutor = (
  coreFactory: IMoldeaCliProjectScopeCoreFactory = createCore,
): IMoldeaCliProjectScopeExecutor => {
  return async (input) => {
    const manifestBytes = await readBoundedManifest(input);
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

import type { IDiagnostic, IProjectValidationResult, IBindingCoverage } from '@moldea.ai/core';
import { createNodeProjectInspection } from '@moldea.ai/core/node';

import {
  MoldeaCliCompositionException,
  resolveInstalledMoldeaCliComposition,
} from '../composition/index.js';

import type { IMoldeaCliCoreInspectionExecutor, IMoldeaCliNodeInspectionFactory } from './types.js';

const calculateRetainedByteLimit = (maxTotalBytes: number): number =>
  maxTotalBytes > Math.floor(Number.MAX_SAFE_INTEGER / 4)
    ? Number.MAX_SAFE_INTEGER
    : maxTotalBytes * 4;

/**
 * Creates one isolated inspection per snapshot attempt, with no in-process fallback.
 * @param nodeInspectionFactory The supervised Node inspection boundary.
 * @returns An executor that disposes its worker before returning any successful result.
 */
export const createMoldeaCliCoreInspectionExecutor =
  (
    nodeInspectionFactory: IMoldeaCliNodeInspectionFactory = createNodeProjectInspection,
  ): IMoldeaCliCoreInspectionExecutor =>
  async (input) => {
    const inspection = await nodeInspectionFactory({
      repository: input.repository,
      ...(input.instructions === undefined ? {} : { instructions: input.instructions }),
      limits: {
        maxDiagnostics: input.resourceLimits.maxDiagnostics,
        maxEntries: input.resourceLimits.maxEntries,
        maxCoverage: input.resourceLimits.maxCoverage,
        maxFileBytes: input.resourceLimits.maxFileBytes,
        maxManifestBytes: input.resourceLimits.maxManifestBytes,
        maxRetainedBytes: calculateRetainedByteLimit(input.resourceLimits.maxTotalBytes),
        maxTotalBytesRead: input.resourceLimits.maxTotalBytes,
      },
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    });
    try {
      if (
        resolveInstalledMoldeaCliComposition({
          packageMetadata: input.packageMetadata,
        }).kind === 'invalid'
      )
        throw new MoldeaCliCompositionException();
      if (input.command === 'inspect')
        return await inspection.readPage({
          ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
          maxItems: Math.min(256, input.resourceLimits.maxEntries),
          view: 'all',
        });
      const diagnostics: IDiagnostic[] = [];
      const coverage: IBindingCoverage[] = [];
      for (const view of ['diagnostics', 'coverage'] as const) {
        let cursor: string | undefined;
        do {
          const result = await inspection.readPage({
            view,
            maxItems: Math.min(256, input.resourceLimits.maxEntries),
            ...(cursor === undefined ? {} : { cursor }),
          });
          for (const { item } of result.page.records) {
            if (item.kind === 'diagnostic') diagnostics.push(item.diagnostic);
            else if (item.kind === 'coverage') coverage.push(item.coverage);
          }
          cursor = result.page.nextCursor ?? undefined;
        } while (cursor !== undefined);
      }
      return Object.freeze({
        diagnostics: Object.freeze(diagnostics),
        coverage: Object.freeze(coverage),
        coverageCounts: inspection.coverageCounts,
        diagnosticCount: inspection.counts.diagnostics,
        acceptedWarningCount: inspection.counts.acceptedWarnings,
        errorCount: inspection.counts.errors,
        warningCount: inspection.counts.warnings,
        valid: inspection.valid,
        formatVersion: inspection.formatVersion,
        source: inspection.source,
        summary: inspection.summary,
      } satisfies IProjectValidationResult);
    } finally {
      await inspection.dispose();
    }
  };

/**
 * Executes one project inspection through the isolated CLI-configured Node boundary.
 * @returns A promise resolving to Core's complete immutable inspection result.
 * @throws
 * - INVALID_RESOURCE_LIMIT: A Core resource limit is invalid.
 * - INVALID_ARGUMENT: The Core operation received an invalid argument.
 * - INVALID_REPOSITORY_PATH: The repository path is invalid.
 * - ENTRY_NOT_FOUND: The requested repository entry was not found.
 * - ENTRY_NOT_FILE: The requested repository entry is not a file.
 * - ENTRY_NOT_DIRECTORY: The requested repository entry is not a directory.
 * - INVALID_PAGE_REQUEST: The repository page request is invalid.
 * - ACCESS_DENIED: Access to the repository source was denied.
 * - SOURCE_UNAVAILABLE: The repository source is unavailable.
 * - SNAPSHOT_CHANGED: The repository snapshot changed during the operation.
 * - PROVIDER_INCOMPLETE: The repository provider cannot expose a complete result.
 * - INVALID_SOURCE_DATA: The repository source returned invalid data.
 * - RESOURCE_LIMIT_EXCEEDED: A named repository resource limit was exceeded.
 * - RESOURCE_LIMIT_EXCEEDED: A Core resource limit was exceeded.
 * - ABORTED: The repository operation was aborted.
 * - ABORTED: The Core operation was aborted.
 * - INSPECTION_BUSY: Project inspection capacity is busy. Try again shortly.
 * - INSPECTION_TIMEOUT: The isolated project inspection timed out.
 * - INSPECTION_PROCESS_FAILED: The isolated project inspection failed.
 * - COMPOSITION_STATE_INVALID: The installed composition state is invalid.
 */
export const executeMoldeaCliCoreInspection = createMoldeaCliCoreInspectionExecutor();

import { CoreOperationException } from '@moldea.ai/core';
import type { INodeProjectInspection } from '@moldea.ai/core/node';

import {
  createMoldeaCliRecordKey,
  MoldeaCliOutputPageException,
  type IMoldeaCliCursorState,
} from '../output-page/index.js';

import type { IMoldeaCliCoreInspectPage } from './types.js';

// marks the switch between Core views without exposing or fabricating a Core cursor
const DIAGNOSTICS_START = 'diagnostics-start';

/**
 * Reads one bounded page of inventory and diagnostics, omitting Core agent assignments.
 * @throws
 * - CURSOR_INVALID: The continuation cursor is invalid for this request.
 * - CURSOR_SNAPSHOT_CHANGED: The continuation cursor belongs to a different repository snapshot.
 * - INVALID_ARGUMENT: The Core operation received an invalid argument.
 */
export const readMoldeaCliInspectPage = async (
  inspection: INodeProjectInspection,
  maxItems: number,
  cursor: IMoldeaCliCursorState | undefined,
): Promise<IMoldeaCliCoreInspectPage> => {
  const { counts, coverageCounts, formatVersion, inspectionDigest, valid } = inspection;
  const totalItems = counts.metadata + counts.diagnostics;
  const priorIndex = cursor === undefined ? -1 : Number.parseInt(cursor.lastKey, 36);
  const startIndex = priorIndex + 1;
  let sourceCursor = cursor?.sourceCursor ?? null;

  if (cursor !== undefined) {
    if (cursor.snapshotDigest !== inspectionDigest) {
      throw new MoldeaCliOutputPageException('CURSOR_SNAPSHOT_CHANGED');
    }
    if (
      !Number.isSafeInteger(priorIndex) ||
      priorIndex < 0 ||
      createMoldeaCliRecordKey(priorIndex) !== cursor.lastKey ||
      startIndex >= totalItems ||
      sourceCursor === null ||
      (sourceCursor === DIAGNOSTICS_START) !== (startIndex === counts.metadata)
    ) {
      throw new MoldeaCliOutputPageException('CURSOR_INVALID');
    }
  }

  if (sourceCursor === DIAGNOSTICS_START) sourceCursor = null;
  const records: IMoldeaCliCoreInspectPage['records'][number][] = [];
  for (const [view, endIndex] of [
    ['metadata', counts.metadata],
    ['diagnostics', totalItems],
  ] as const) {
    const nextIndex = startIndex + records.length;
    const requestItems = Math.min(maxItems - records.length, endIndex - nextIndex);
    if (requestItems <= 0) continue;

    const result = await inspection
      .readPage({
        view,
        maxItems: requestItems,
        ...(sourceCursor === null ? {} : { cursor: sourceCursor }),
      })
      .catch((error: unknown) => {
        if (
          sourceCursor !== null &&
          error instanceof CoreOperationException &&
          error.code === 'INVALID_ARGUMENT'
        ) {
          throw new MoldeaCliOutputPageException('CURSOR_INVALID', { cause: error });
        }
        throw error;
      });

    if (result.page.records.length !== requestItems) {
      if (sourceCursor !== null) throw new MoldeaCliOutputPageException('CURSOR_INVALID');
      throw new TypeError('The Core inspection view ended before its reported count.');
    }
    for (const { item, nextCursor } of result.page.records) {
      if (
        (item.kind !== 'metadata' && item.kind !== 'diagnostic') ||
        (view === 'metadata' ? item.kind !== 'metadata' : item.kind !== 'diagnostic')
      ) {
        if (sourceCursor !== null) throw new MoldeaCliOutputPageException('CURSOR_INVALID');
        throw new TypeError('The Core inspection view returned an unexpected record.');
      }
      const followingIndex = startIndex + records.length + 1;
      const continuation =
        followingIndex === totalItems
          ? null
          : followingIndex === counts.metadata
            ? DIAGNOSTICS_START
            : nextCursor;
      if (followingIndex < totalItems && continuation === null) {
        if (sourceCursor !== null) throw new MoldeaCliOutputPageException('CURSOR_INVALID');
        throw new TypeError('The Core inspection view is missing a continuation.');
      }
      records.push({ item, nextCursor: continuation });
    }
    sourceCursor = null;
  }
  return { counts, coverageCounts, formatVersion, inspectionDigest, records, startIndex, valid };
};

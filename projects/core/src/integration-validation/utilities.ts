import { RepositorySourceException, type IRepositoryLinkResolution } from '@moldea.ai/repository';

import type { IRetainedMemory, IRetainedSource } from '../retained-memory/index.js';

import type { IInstructionLinkState } from './types.js';

/**
 * Reads bounded untrusted text with a reservation for decoding and temporary string copies.
 * @param ledger The session ledger that owns the reservation.
 * @param load Loads the complete bounded source buffer.
 * @returns Decoded text or null for invalid UTF-8, with its reservation-release operation.
 * @throws
 * - ENTRY_NOT_FOUND: The requested repository entry was not found.
 * - ENTRY_NOT_FILE: The requested repository entry is not a file.
 * - RESOURCE_LIMIT_EXCEEDED: A Core resource limit was exceeded.
 * - RESOURCE_LIMIT_EXCEEDED: A named repository resource limit was exceeded.
 * - ABORTED: The Core operation was aborted.
 * - ABORTED: The repository operation was aborted.
 * - ACCESS_DENIED: Access to the repository source was denied.
 * - SOURCE_UNAVAILABLE: The repository source is unavailable.
 * - SNAPSHOT_CHANGED: The repository snapshot changed during the operation.
 * - INVALID_SOURCE_DATA: The repository source returned invalid data.
 */
export const readRetainedText = async (
  ledger: IRetainedMemory,
  load: () => Promise<IRetainedSource>,
): Promise<{ text: string | null; release: () => void }> => {
  const source = await load();
  const reservation = source.bytes.byteLength * 8;
  let isReserved = false;
  try {
    ledger.reserve(reservation);
    isReserved = true;
    let text: string | null;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(source.bytes);
    } catch {
      text = null;
    }
    return { text, release: () => ledger.release(reservation) };
  } catch (error) {
    if (isReserved) ledger.release(reservation);
    throw error;
  } finally {
    source.release();
  }
};

/** Distinguishes missing and non-regular files without an extra entry lookup or following symlinks. */
export const getAbsentKind = (error: unknown): 'missing' | 'non-regular' | null =>
  error instanceof RepositorySourceException
    ? error.code === 'ENTRY_NOT_FOUND'
      ? 'missing'
      : error.code === 'ENTRY_NOT_FILE'
        ? 'non-regular'
        : null
    : null;

/**
 * Explains why a linked instruction file cannot be read, or returns null for a readable link.
 * @param resolution The resolver's classification, or null when no resolver is available.
 * @returns The content-free link state, or null when the final target is a regular file.
 */
export const getUnreadableLinkState = (
  resolution: IRepositoryLinkResolution | null,
): IInstructionLinkState | null => {
  if (resolution === null) {
    return 'unavailable';
  }

  if (resolution.state === 'inside' || resolution.state === 'outside') {
    return resolution.targetType === 'file' ? null : resolution.targetType;
  }

  return resolution.state;
};

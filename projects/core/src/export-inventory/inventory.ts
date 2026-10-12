import { RepositorySourceException, type IRepositoryPath } from '@moldea.ai/repository';

import type { IRepositoryInspectionReader } from '../repository-inspection-session/index.js';
import { getRetainedMemory } from '../retained-memory/index.js';

import type { IExportInventory } from './types.js';

// 512 bytes per potential syntax node, conservatively bounded by source byte length
const NODE_BYTES_PER_SOURCE_BYTE = 512;

/** Identifies syntax-only source formats with explicit runtime export semantics. */
export const isSupportedExportSource = (path: string): boolean =>
  !/\.d\.(?:ts|tsx|mts|cts)$/.test(path) && /\.(?:ts|tsx|mts|cts|js|mjs|jsx)$/.test(path);

/**
 * Checks a declared source when budgets allow, retaining only its export-name set.
 * @returns A conclusive inventory or the precise reason analysis could not run.
 * @throws
 * - RESOURCE_LIMIT_EXCEEDED: A Core resource limit was exceeded.
 * - RESOURCE_LIMIT_EXCEEDED: A named repository resource limit was exceeded.
 * - ABORTED: The Core operation was aborted.
 * - ABORTED: The repository operation was aborted.
 * - ACCESS_DENIED: Access to the repository source was denied.
 * - SOURCE_UNAVAILABLE: The repository source is unavailable.
 * - SNAPSHOT_CHANGED: The repository snapshot changed during the operation.
 * - INVALID_SOURCE_DATA: The repository source returned invalid data.
 * - ENTRY_NOT_FOUND: The requested repository entry was not found.
 * - ENTRY_NOT_FILE: The requested repository entry is not a file.
 */
export const readExportInventory = async (
  reader: IRepositoryInspectionReader,
  path: IRepositoryPath,
  byteLength: number,
  maxFileBytes: number,
): Promise<IExportInventory> => {
  if (!isSupportedExportSource(path))
    return { kind: 'not-checked', reason: 'unsupported-file-type' };
  const ledger = getRetainedMemory(reader);
  const reservation = 65_536 + byteLength * (8 + NODE_BYTES_PER_SOURCE_BYTE);
  // source bytes and the first page coexist with the syntax reservation during the read
  const readHeadroom = Math.max(1, byteLength + Math.min(65_536, byteLength));
  if (byteLength > maxFileBytes || !ledger.tryReserve(reservation + readHeadroom))
    return { kind: 'not-checked', reason: 'resource-limit' };
  ledger.release(readHeadroom);
  try {
    const source = await ledger.readSourceFile(path);
    try {
      if (source.bytes.byteLength !== byteLength)
        throw new RepositorySourceException({
          code: 'INVALID_SOURCE_DATA',
          operation: 'read-file-page',
          path,
          retryable: false,
        });
      const { inventoryExports } = await import('./syntax.js');
      const result = inventoryExports(path, source.bytes);
      if (result.kind === 'parsed') {
        let bytes = 64;
        for (const name of result.names) bytes += 64 + name.length * 2;
        // Admission includes the inventory while the syntax reservation is still live.
        ledger.reserve(bytes);
      }
      return result;
    } finally {
      source.release();
    }
  } finally {
    ledger.release(reservation);
  }
};

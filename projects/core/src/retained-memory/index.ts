import type { IRepositoryPath } from '@moldea.ai/repository';

import type { IRepositoryInspectionReader } from '../repository-inspection-session/index.js';

// private session-owned admission and temporary source-buffer lifetime
export interface IRetainedMemory {
  reserve(bytes: number): void;
  tryReserve(bytes: number): boolean;
  release(bytes: number): void;
  readSourceFile(path: IRepositoryPath): Promise<{ bytes: Uint8Array; release: () => void }>;
}

const ledgers = new WeakMap<IRepositoryInspectionReader, IRetainedMemory>();

/** Registers the sole memory owner for one internal reader. */
export const registerRetainedMemory = (
  reader: IRepositoryInspectionReader,
  ledger: IRetainedMemory,
): void => {
  if (ledgers.has(reader)) throw new TypeError('The inspection reader is already registered.');
  ledgers.set(reader, ledger);
};

/** Returns the ledger shared by all phases of a repository inspection. */
export const getRetainedMemory = (reader: IRepositoryInspectionReader): IRetainedMemory => {
  const ledger = ledgers.get(reader);
  if (ledger === undefined)
    throw new TypeError('The inspection reader has no retained-memory ledger.');
  return ledger;
};

/** Reserves retained coverage in production sessions and leaves standalone file-check readers untracked. */
export const reserveRetainedBytesIfTracked = (
  reader: IRepositoryInspectionReader,
  bytes: number,
): void => {
  ledgers.get(reader)?.reserve(bytes);
};

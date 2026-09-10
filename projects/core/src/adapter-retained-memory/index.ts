import type { IRuntimeAdapterRepository } from '../adapter/index.js';
type IRetainedByteReservation = (byteLength: number) => void;

// reservations belong to Core-created adapter repositories and remain private to the session
const retainedByteReservations = new WeakMap<IRuntimeAdapterRepository, IRetainedByteReservation>();

/** Registers the retained-memory reservation owned by one inspection session. */
export const registerRuntimeAdapterRetainedByteReservation = (
  repository: IRuntimeAdapterRepository,
  reserve: IRetainedByteReservation,
): void => {
  if (retainedByteReservations.has(repository)) {
    throw new TypeError('The runtime adapter repository is already registered.');
  }

  retainedByteReservations.set(repository, reserve);
};

/** Reserves a complete adapter-owned buffer when Core owns the repository session. */
export const reserveRuntimeAdapterRetainedBytesIfTracked = (
  repository: IRuntimeAdapterRepository,
  byteLength: number,
): void => {
  const reserve = retainedByteReservations.get(repository);

  if (reserve !== undefined) {
    reserve(byteLength);
  }
};

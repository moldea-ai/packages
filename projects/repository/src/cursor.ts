import { createRepositoryIdentity } from './identity.js';

interface IRepositoryCursorEnvelope {
  readonly checksum: string;
  readonly payload: string;
  readonly version: 1;
}

const encoder = new TextEncoder();
const ENVELOPE_KEYS = new Set(['checksum', 'payload', 'version']);

const isRecord = (candidate: unknown): candidate is Readonly<Record<string, unknown>> =>
  typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate);

/** Encodes one versioned repository cursor with a deterministic integrity checksum. */
export const createRepositoryCursor = (payload: unknown): string => {
  const serializedPayload = JSON.stringify(payload);

  return JSON.stringify({
    checksum: createRepositoryIdentity([encoder.encode(serializedPayload)]),
    payload: serializedPayload,
    version: 1,
  } satisfies IRepositoryCursorEnvelope);
};

/** Decodes one closed repository cursor and rejects corrupted envelope or payload bytes. */
export const decodeRepositoryCursor = (cursor: string): unknown => {
  const envelope: unknown = JSON.parse(cursor);

  if (
    !isRecord(envelope) ||
    Reflect.ownKeys(envelope).some((key) => typeof key !== 'string' || !ENVELOPE_KEYS.has(key)) ||
    envelope['version'] !== 1 ||
    typeof envelope['payload'] !== 'string' ||
    typeof envelope['checksum'] !== 'string' ||
    envelope['checksum'] !== createRepositoryIdentity([encoder.encode(envelope['payload'])])
  ) {
    throw new TypeError('The repository cursor is invalid.');
  }

  return JSON.parse(envelope['payload']) as unknown;
};

import { createHash, timingSafeEqual } from 'node:crypto';

import { serializeJsonDeterministically, type IJsonValue } from '../json-serialization/index.js';

import { MOLDEA_CLI_CURSOR_VERSION } from './constants.js';
import { MoldeaCliOutputPageException } from './exception.js';
import type {
  IMoldeaCliCursorInput,
  IMoldeaCliCursorState,
  IMoldeaCliPageCommand,
} from './types.js';

interface IMoldeaCliCursorPayload {
  readonly command: IMoldeaCliPageCommand;
  readonly filtersDigest: string;
  readonly lastKey: string;
  readonly snapshotDigest: string;
  readonly version: typeof MOLDEA_CLI_CURSOR_VERSION;
}

interface IMoldeaCliCursorDocument extends IMoldeaCliCursorPayload {
  readonly checksum: string;
}

const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;
const CURSOR_DOCUMENT_KEYS = Object.freeze([
  'checksum',
  'command',
  'filtersDigest',
  'lastKey',
  'snapshotDigest',
  'version',
]);

/** Calculates one stable SHA-256 identifier for deterministic JSON text. */
export const calculateMoldeaCliJsonDigest = (value: IJsonValue): string => {
  return `sha256:${createHash('sha256').update(serializeJsonDeterministically(value), 'utf8').digest('hex')}`;
};

/** Calculates the checksum for one cursor payload without its checksum field. */
const calculateCursorChecksum = (payload: IMoldeaCliCursorPayload): string => {
  return calculateMoldeaCliJsonDigest(payload as unknown as IJsonValue);
};

/** Compares fixed-format checksums without data-dependent early termination. */
const areChecksumsEqual = (left: string, right: string): boolean => {
  const leftBytes = Buffer.from(left, 'utf8');
  const rightBytes = Buffer.from(right, 'utf8');

  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
};

/** Determines whether an unknown value is one strict cursor document. */
const isCursorDocument = (value: unknown): value is IMoldeaCliCursorDocument => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Readonly<Record<string, unknown>>;
  const keys = Object.keys(record).sort();

  return (
    keys.length === CURSOR_DOCUMENT_KEYS.length &&
    keys.every((key, index) => key === CURSOR_DOCUMENT_KEYS[index]) &&
    record['version'] === MOLDEA_CLI_CURSOR_VERSION &&
    (record['command'] === 'content' ||
      record['command'] === 'inspect' ||
      record['command'] === 'scope' ||
      record['command'] === 'validate') &&
    typeof record['filtersDigest'] === 'string' &&
    SHA256_PATTERN.test(record['filtersDigest']) &&
    typeof record['lastKey'] === 'string' &&
    record['lastKey'].length > 0 &&
    typeof record['snapshotDigest'] === 'string' &&
    SHA256_PATTERN.test(record['snapshotDigest']) &&
    typeof record['checksum'] === 'string' &&
    SHA256_PATTERN.test(record['checksum'])
  );
};

/** Encodes one command-, filter-, and snapshot-bound continuation cursor. */
export const encodeMoldeaCliCursor = (
  command: IMoldeaCliPageCommand,
  filters: IJsonValue,
  snapshotDigest: string,
  lastKey: string,
): string => {
  const payload: IMoldeaCliCursorPayload = {
    command,
    filtersDigest: calculateMoldeaCliJsonDigest(filters),
    lastKey,
    snapshotDigest,
    version: MOLDEA_CLI_CURSOR_VERSION,
  };
  const document: IMoldeaCliCursorDocument = {
    ...payload,
    checksum: calculateCursorChecksum(payload),
  };

  return Buffer.from(serializeJsonDeterministically(document), 'utf8').toString('base64url');
};

/**
 * Decodes and validates one opaque continuation cursor.
 * @param input The current command state and untrusted cursor.
 * @returns The validated last composite record key.
 * @throws
 * - CURSOR_INVALID: The continuation cursor is invalid for this request.
 * - CURSOR_SNAPSHOT_CHANGED: The continuation cursor belongs to a different repository snapshot.
 */
export const decodeMoldeaCliCursor = (input: IMoldeaCliCursorInput): IMoldeaCliCursorState => {
  let decoded: unknown;

  try {
    if (!BASE64URL_PATTERN.test(input.cursor)) {
      throw new TypeError('The cursor is not canonical base64url.');
    }

    const bytes = Buffer.from(input.cursor, 'base64url');

    if (bytes.toString('base64url') !== input.cursor) {
      throw new TypeError('The cursor is not canonical base64url.');
    }

    const text = bytes.toString('utf8');
    decoded = JSON.parse(text) as unknown;
  } catch {
    throw new MoldeaCliOutputPageException('CURSOR_INVALID');
  }

  if (!isCursorDocument(decoded)) {
    throw new MoldeaCliOutputPageException('CURSOR_INVALID');
  }

  const { checksum, ...payload } = decoded;

  if (
    !areChecksumsEqual(checksum, calculateCursorChecksum(payload)) ||
    decoded.command !== input.command ||
    decoded.filtersDigest !== calculateMoldeaCliJsonDigest(input.filters)
  ) {
    throw new MoldeaCliOutputPageException('CURSOR_INVALID');
  }

  if (decoded.snapshotDigest !== input.snapshotDigest) {
    throw new MoldeaCliOutputPageException('CURSOR_SNAPSHOT_CHANGED');
  }

  return Object.freeze({ lastKey: decoded.lastKey });
};

// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { serializeJsonDeterministically, type IJsonValue } from '../json-serialization/index.js';

import {
  calculateMoldeaCliJsonDigest,
  decodeMoldeaCliCursor,
  encodeMoldeaCliCursor,
} from './cursor.js';
import { MoldeaCliOutputPageException } from './exception.js';
import { createMoldeaCliOutputPage } from './page.js';

const SNAPSHOT_DIGEST = `sha256:${'1'.repeat(64)}`;

const measurePage = (
  page: { readonly cursor: string | null },
  serializedRecordsUtf8Bytes: number,
): number =>
  Buffer.byteLength(serializeJsonDeterministically({ cursor: page.cursor, records: [] }), 'utf8') -
  2 +
  serializedRecordsUtf8Bytes;

describe('output pages', () => {
  test('selects an exact first page and continues without gaps or duplicates', () => {
    const records = Object.freeze([
      Object.freeze({ key: 'a', text: 'a'.repeat(128) }),
      Object.freeze({ key: 'b', text: 'b'.repeat(128) }),
      Object.freeze({ key: 'c', text: 'c'.repeat(128) }),
    ]);
    const firstRecord = records[0];

    if (firstRecord === undefined) {
      throw new TypeError('The first record fixture is missing.');
    }

    const firstCursor = encodeMoldeaCliCursor('inspect', {}, SNAPSHOT_DIGEST, firstRecord.key);
    const exactFirstPageBytes = Buffer.byteLength(
      serializeJsonDeterministically({ cursor: firstCursor, records: [firstRecord] }),
      'utf8',
    );
    const firstPage = createMoldeaCliOutputPage({
      command: 'inspect',
      cursor: null,
      filters: {},
      maxOutputBytes: exactFirstPageBytes,
      measure: measurePage,
      records,
      snapshotDigest: SNAPSHOT_DIGEST,
    });
    const secondPage = createMoldeaCliOutputPage({
      command: 'inspect',
      cursor: firstPage.cursor,
      filters: {},
      maxOutputBytes: 16_384,
      measure: measurePage,
      records,
      snapshotDigest: SNAPSHOT_DIGEST,
    });

    expect(Buffer.byteLength(serializeJsonDeterministically(firstPage), 'utf8')).toBe(
      exactFirstPageBytes,
    );
    expect(firstPage.records.map(({ key }) => key)).toStrictEqual(['a']);
    expect(secondPage.records.map(({ key }) => key)).toStrictEqual(['b', 'c']);
    expect(secondPage.cursor).toBeNull();
  });

  test('returns a bounded empty page after the final record', () => {
    const records = Object.freeze([Object.freeze({ key: 'a' })]);
    const cursor = encodeMoldeaCliCursor('validate', {}, SNAPSHOT_DIGEST, 'a');

    expect(
      createMoldeaCliOutputPage({
        command: 'validate',
        cursor,
        filters: {},
        maxOutputBytes: 4096,
        measure: measurePage,
        records,
        snapshotDigest: SNAPSHOT_DIGEST,
      }),
    ).toStrictEqual({ cursor: null, records: [] });
  });

  test('rejects malformed ordering and an insufficient envelope budget', () => {
    expect(() =>
      createMoldeaCliOutputPage({
        command: 'inspect',
        cursor: null,
        filters: {},
        maxOutputBytes: 4096,
        measure: measurePage,
        records: [{ key: 'b' }, { key: 'a' }],
        snapshotDigest: SNAPSHOT_DIGEST,
      }),
    ).toThrow(TypeError);
    expect(() =>
      createMoldeaCliOutputPage({
        command: 'inspect',
        cursor: null,
        filters: {},
        maxOutputBytes: 1,
        measure: measurePage,
        records: [],
        snapshotDigest: SNAPSHOT_DIGEST,
      }),
    ).toThrow(MoldeaCliOutputPageException);
  });

  test('processes a large collection with one measurement per record', () => {
    const records = Object.freeze(
      Array.from({ length: 8192 }, (_, index) =>
        Object.freeze({ key: String(index).padStart(8, '0') }),
      ),
    );
    let measurementCount = 0;

    const page = createMoldeaCliOutputPage({
      command: 'inspect',
      cursor: null,
      filters: {},
      maxOutputBytes: 1_048_576,
      measure: (candidate, serializedRecordsUtf8Bytes) => {
        measurementCount += 1;

        return measurePage(candidate, serializedRecordsUtf8Bytes);
      },
      records,
      snapshotDigest: SNAPSHOT_DIGEST,
    });

    expect(page.records).toHaveLength(records.length);
    expect(measurementCount).toBe(records.length);
  });
});

describe('output cursors', () => {
  test('round-trips one command-, filter-, and snapshot-bound cursor', () => {
    const cursor = encodeMoldeaCliCursor(
      'scope',
      { inputDigest: 'sha256:input' },
      SNAPSHOT_DIGEST,
      'last-key',
    );

    expect(
      decodeMoldeaCliCursor({
        command: 'scope',
        cursor,
        filters: { inputDigest: 'sha256:input' },
        snapshotDigest: SNAPSHOT_DIGEST,
      }),
    ).toStrictEqual({ lastKey: 'last-key' });
  });

  test.each([
    [
      'tampered',
      (cursor: string) => `${cursor.startsWith('A') ? 'B' : 'A'}${cursor.slice(1)}`,
      'scope',
      'sha256:input',
    ],
    ['non-canonical', (cursor: string) => `${cursor}=`, 'scope', 'sha256:input'],
    ['cross-command', (cursor: string) => cursor, 'inspect', 'sha256:input'],
    ['filter-mismatch', (cursor: string) => cursor, 'scope', 'sha256:other'],
  ] as const)('rejects a %s cursor', (_description, mutate, command, inputDigest) => {
    const cursor = encodeMoldeaCliCursor(
      'scope',
      { inputDigest: 'sha256:input' },
      SNAPSHOT_DIGEST,
      'last-key',
    );

    expect(() =>
      decodeMoldeaCliCursor({
        command,
        cursor: mutate(cursor),
        filters: { inputDigest },
        snapshotDigest: SNAPSHOT_DIGEST,
      }),
    ).toThrow(MoldeaCliOutputPageException);
  });

  test('distinguishes a changed source snapshot', () => {
    const cursor = encodeMoldeaCliCursor(
      'content',
      { path: '/moldea/project.md' },
      SNAPSHOT_DIGEST,
      'scalar:8',
    );

    try {
      decodeMoldeaCliCursor({
        command: 'content',
        cursor,
        filters: { path: '/moldea/project.md' },
        snapshotDigest: `sha256:${'2'.repeat(64)}`,
      });
      throw new TypeError('Expected the cursor to be rejected.');
    } catch (error) {
      expect(error).toBeInstanceOf(MoldeaCliOutputPageException);
      expect((error as MoldeaCliOutputPageException).code).toBe('CURSOR_SNAPSHOT_CHANGED');
    }
  });

  test('rejects an unsupported cursor format version with a valid checksum', () => {
    const payload = {
      command: 'inspect',
      filtersDigest: calculateMoldeaCliJsonDigest({}),
      lastKey: 'last-key',
      snapshotDigest: SNAPSHOT_DIGEST,
      version: 2,
    } satisfies IJsonValue;
    const unsupportedCursor = Buffer.from(
      serializeJsonDeterministically({
        ...payload,
        checksum: calculateMoldeaCliJsonDigest(payload),
      }),
      'utf8',
    ).toString('base64url');

    expect(() =>
      decodeMoldeaCliCursor({
        command: 'inspect',
        cursor: unsupportedCursor,
        filters: {},
        snapshotDigest: SNAPSHOT_DIGEST,
      }),
    ).toThrow(MoldeaCliOutputPageException);
  });
});

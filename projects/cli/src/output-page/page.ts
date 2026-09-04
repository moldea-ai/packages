import { serializeJsonDeterministically } from '../json-serialization/index.js';

import { decodeMoldeaCliCursor, encodeMoldeaCliCursor } from './cursor.js';
import { MoldeaCliOutputPageException } from './exception.js';
import type {
  IMoldeaCliOutputPage,
  IMoldeaCliOutputPageInput,
  IMoldeaCliOutputRecord,
} from './types.js';

/** Ensures records have unique keys in strict ascending order. */
const assertRecordOrder = (records: readonly IMoldeaCliOutputRecord[]): void => {
  for (let index = 0; index < records.length; index += 1) {
    const key = records[index]?.key;
    const previousKey = records[index - 1]?.key;

    if (
      key === undefined ||
      key.length === 0 ||
      (previousKey !== undefined && key <= previousKey)
    ) {
      throw new TypeError('Output records must have unique keys in ascending order.');
    }
  }
};

/**
 * Selects the largest exact serialized output page that fits its byte budget.
 * @param input Ordered records, continuation state, and an exact final-document measurement.
 * @returns A frozen record page with a snapshot-bound continuation cursor when needed.
 * @throws
 * - CURSOR_INVALID: The continuation cursor is invalid for this request.
 * - CURSOR_SNAPSHOT_CHANGED: The continuation cursor belongs to a different repository snapshot.
 * - OUTPUT_BUDGET_TOO_SMALL: The output byte budget cannot contain the next complete result.
 */
export const createMoldeaCliOutputPage = <TRecord extends IMoldeaCliOutputRecord>(
  input: IMoldeaCliOutputPageInput<TRecord>,
): IMoldeaCliOutputPage<TRecord> => {
  assertRecordOrder(input.records);

  const cursorState =
    input.cursor === null
      ? null
      : decodeMoldeaCliCursor({
          command: input.command,
          cursor: input.cursor,
          filters: input.filters,
          snapshotDigest: input.snapshotDigest,
        });
  const startIndex =
    cursorState === null
      ? 0
      : cursorState.sourceCursor !== null
        ? 0
        : input.records.findIndex(({ key }) => key === cursorState.lastKey) + 1;

  if (cursorState !== null && cursorState.sourceCursor === null && startIndex === 0) {
    throw new MoldeaCliOutputPageException('CURSOR_INVALID');
  }

  const emptyRecords = Object.freeze([]) as readonly TRecord[];
  const emptyPage = Object.freeze({ cursor: null, records: emptyRecords });

  if (startIndex === input.records.length) {
    if (input.measure(emptyPage, 2) > input.maxOutputBytes) {
      throw new MoldeaCliOutputPageException('OUTPUT_BUDGET_TOO_SMALL');
    }

    return emptyPage;
  }

  const selectedRecords: TRecord[] = [];
  let selectedCursor: string | null = null;
  let serializedRecordsUtf8Bytes = 2;

  for (let endIndex = startIndex + 1; endIndex <= input.records.length; endIndex += 1) {
    const record = input.records[endIndex - 1];

    if (record === undefined) {
      throw new TypeError('An output page record is missing.');
    }

    const serializedRecordUtf8Bytes = Buffer.byteLength(
      serializeJsonDeterministically(record),
      'utf8',
    );

    serializedRecordsUtf8Bytes += serializedRecordUtf8Bytes + (endIndex > startIndex + 1 ? 1 : 0);
    selectedRecords.push(record);

    const sourceCursor = input.sourceCursorForRecord?.(record) ?? null;
    const hasMore =
      input.sourceCursorForRecord === undefined
        ? endIndex < input.records.length
        : sourceCursor !== null;
    const cursor = hasMore
      ? encodeMoldeaCliCursor(
          input.command,
          input.filters,
          input.snapshotDigest,
          record.key,
          sourceCursor,
        )
      : null;
    const candidate = Object.freeze({ cursor, records: selectedRecords });

    if (input.measure(candidate, serializedRecordsUtf8Bytes) > input.maxOutputBytes) {
      selectedRecords.pop();
      break;
    }

    selectedCursor = cursor;
  }

  if (selectedRecords.length === 0) {
    throw new MoldeaCliOutputPageException('OUTPUT_BUDGET_TOO_SMALL');
  }

  return Object.freeze({
    cursor: selectedCursor,
    records: Object.freeze([...selectedRecords]),
  });
};

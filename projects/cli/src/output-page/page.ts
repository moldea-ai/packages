import { takeWithinByteBudget } from 'jg-utilities';

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

  /** Creates the cursor that continues after a page ending with the record at this end index. */
  const createCursor = (record: TRecord, endIndex: number): string | null => {
    const sourceCursor = input.sourceCursorForRecord?.(record) ?? null;
    const hasMore =
      input.sourceCursorForRecord === undefined
        ? endIndex < input.records.length
        : sourceCursor !== null;

    return hasMore
      ? encodeMoldeaCliCursor(
          input.command,
          input.filters,
          input.snapshotDigest,
          record.key,
          sourceCursor,
        )
      : null;
  };

  const selectedRecords = takeWithinByteBudget(input.records.slice(startIndex), {
    maxBytes: input.maxOutputBytes,
    measurePage: (page, itemsBytes) =>
      input.measure(
        Object.freeze({
          cursor: createCursor(page[page.length - 1] as TRecord, startIndex + page.length),
          records: page,
        }),
        itemsBytes,
      ),
  });
  const lastRecord = selectedRecords[selectedRecords.length - 1];

  if (lastRecord === undefined) {
    throw new MoldeaCliOutputPageException('OUTPUT_BUDGET_TOO_SMALL');
  }

  return Object.freeze({
    cursor: createCursor(lastRecord, startIndex + selectedRecords.length),
    records: Object.freeze(selectedRecords),
  });
};

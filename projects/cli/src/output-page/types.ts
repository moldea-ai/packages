import type { IJsonValue } from '../json-serialization/index.js';

// commands whose ordered results can continue through an opaque cursor
export type IMoldeaCliPageCommand = 'content' | 'inspect' | 'scope' | 'validate';

export interface IMoldeaCliOutputRecord {
  readonly key: string;
}

export interface IMoldeaCliOutputPage<TRecord extends IMoldeaCliOutputRecord> {
  readonly cursor: string | null;
  readonly records: readonly TRecord[];
}

export interface IMoldeaCliOutputPageInput<TRecord extends IMoldeaCliOutputRecord> {
  readonly command: IMoldeaCliPageCommand;
  readonly cursor: string | null;
  readonly filters: IJsonValue;
  readonly maxOutputBytes: number;
  readonly measure: (
    page: IMoldeaCliOutputPage<TRecord>,
    serializedRecordsUtf8Bytes: number,
  ) => number;
  readonly records: readonly TRecord[];
  readonly snapshotDigest: string;
}

export type IMoldeaCliOutputPageErrorCode =
  'CURSOR_INVALID' | 'CURSOR_SNAPSHOT_CHANGED' | 'OUTPUT_BUDGET_TOO_SMALL';

export interface IMoldeaCliCursorInput {
  readonly command: IMoldeaCliPageCommand;
  readonly cursor: string;
  readonly filters: IJsonValue;
  readonly snapshotDigest: string;
}

export interface IMoldeaCliCursorState {
  readonly lastKey: string;
}

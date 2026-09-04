import type {
  IRepositoryComparison,
  IRepositoryEntry,
  IRepositoryEntryPage,
  IRepositoryEntryPageOptions,
  IRepositoryFilePage,
  IRepositoryFilePageOptions,
  IRepositoryOperationOptions,
  IRepositoryPath,
  IRepositoryReader,
} from '@moldea.ai/repository';
import {
  createMemoryRepositoryReader as createSourceMemoryRepositoryReader,
  type IMemoryRepositoryEntry,
} from '@moldea.ai/repository/memory';

export type { IMemoryRepositoryEntry } from '@moldea.ai/repository/memory';

import { DEFAULT_CORE_RESOURCE_LIMITS } from './constants/index.js';
import {
  createRepositoryInspectionSession,
  type IRepositoryInspectionListOptions,
  type IRepositoryInspectionReader,
} from './repository-inspection-session/index.js';

export interface ICoreTestRepositoryReader extends IRepositoryReader, IRepositoryInspectionReader {}

/** Creates a complete Core test reader while replacing selected observable operations. */
export const overrideCoreTestRepositoryReader = (
  source: ICoreTestRepositoryReader,
  overrides: Partial<ICoreTestRepositoryReader>,
): ICoreTestRepositoryReader => {
  const getEntry = overrides.getEntry ?? ((path, options) => source.getEntry(path, options));
  const iterateEntries = overrides.iterateEntries ?? ((options) => source.iterateEntries(options));
  const readCompleteFile =
    overrides.readCompleteFile ?? ((path, options) => source.readCompleteFile(path, options));
  const listEntriesPage =
    overrides.listEntriesPage ??
    (overrides.iterateEntries === undefined
      ? (options) => source.listEntriesPage(options)
      : async (options: IRepositoryEntryPageOptions): Promise<IRepositoryEntryPage> => {
          const offset = options.cursor === undefined ? 0 : Number(options.cursor);
          const entries: IRepositoryEntry[] = [];

          for await (const entry of iterateEntries(options)) {
            entries.push(entry);
          }

          const pageEntries = entries.slice(offset, offset + options.maxEntries);
          const nextOffset = offset + pageEntries.length;
          const isComplete = nextOffset >= entries.length;

          return Object.freeze({
            entries: Object.freeze(pageEntries),
            isComplete,
            nextCursor: isComplete ? null : String(nextOffset),
            snapshot: source.snapshot,
          });
        });
  const readFilePage =
    overrides.readFilePage ??
    (overrides.readCompleteFile === undefined
      ? (path, options) => source.readFilePage(path, options)
      : async (
          path: IRepositoryPath,
          options: IRepositoryFilePageOptions,
        ): Promise<IRepositoryFilePage> => {
          const content = await readCompleteFile(path, options);
          const bytes = content.slice(options.offset, options.offset + options.maxBytes);
          const nextOffset = options.offset + bytes.byteLength;
          const isComplete = nextOffset >= content.byteLength;

          return Object.freeze({
            bytes,
            isComplete,
            nextOffset: isComplete ? null : nextOffset,
            offset: options.offset,
            snapshot: source.snapshot,
            totalBytes: content.byteLength,
          });
        });

  return Object.freeze({
    snapshot: source.snapshot,
    compare: overrides.compare ?? ((candidate, options) => source.compare(candidate, options)),
    getEntry,
    iterateEntries,
    listEntriesPage,
    readCompleteFile,
    readFilePage,
  });
};

/** Creates a memory reader that exposes both public pages and Core-private validation helpers. */
export const createMemoryRepositoryReader = (
  entries: readonly IMemoryRepositoryEntry[],
): ICoreTestRepositoryReader => {
  const source = createSourceMemoryRepositoryReader(entries);
  const inspection = createRepositoryInspectionSession(source, DEFAULT_CORE_RESOURCE_LIMITS).reader;

  return Object.freeze({
    snapshot: source.snapshot,
    compare: (
      candidate: IRepositoryReader,
      options?: IRepositoryOperationOptions,
    ): Promise<IRepositoryComparison> => source.compare(candidate, options),
    getEntry: (
      path: IRepositoryPath,
      options?: IRepositoryOperationOptions,
    ): Promise<IRepositoryEntry | null> => source.getEntry(path, options),
    iterateEntries: (options?: IRepositoryInspectionListOptions): AsyncIterable<IRepositoryEntry> =>
      inspection.iterateEntries(options),
    listEntriesPage: (options: IRepositoryEntryPageOptions): Promise<IRepositoryEntryPage> =>
      source.listEntriesPage(options),
    readCompleteFile: (
      path: IRepositoryPath,
      options?: IRepositoryOperationOptions,
    ): Promise<Uint8Array> => inspection.readCompleteFile(path, options),
    readFilePage: (
      path: IRepositoryPath,
      options: IRepositoryFilePageOptions,
    ): Promise<IRepositoryFilePage> => source.readFilePage(path, options),
  });
};

import { createRepositoryIdentity } from '@moldea.ai/repository';

import type {
  IProjectInspectionItem,
  IProjectInspectionPageInput,
  IProjectInspectionPageRecord,
  IProjectInspectionPageResult,
  IProjectInspectionView,
} from '../contracts/index.js';
import { CoreOperationException } from '../exceptions/index.js';
import { freezeRecursively } from '../immutable/index.js';
import type { ICoreOptionsSnapshot } from '../options/index.js';
import { collectProjectMetadata } from '../project-metadata/index.js';
import { validateProjectState } from '../project-validation/index.js';

interface IKeyedInspectionItem {
  readonly item: IProjectInspectionItem;
  readonly key: string;
}

const CURSOR_PREFIX = 'core3';
const encoder = new TextEncoder();

const invalidArgument = (): never => {
  throw new CoreOperationException({
    code: 'INVALID_ARGUMENT',
    operation: 'inspect-project-page',
  });
};

/** Serializes the closed inspection records with recursively sorted object keys. */
const serializeDeterministically = (candidate: unknown): string => {
  if (candidate === null || typeof candidate !== 'object') {
    const serialized = JSON.stringify(candidate);

    return serialized === undefined ? 'null' : serialized;
  }

  if (Array.isArray(candidate)) {
    return `[${candidate.map((item) => serializeDeterministically(item)).join(',')}]`;
  }

  const entries = Object.entries(candidate as Readonly<Record<string, unknown>>)
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));

  return `{${entries
    .map(([key, value]) => `${JSON.stringify(key)}:${serializeDeterministically(value)}`)
    .join(',')}}`;
};

const createIdentity = (parts: readonly string[]): string =>
  createRepositoryIdentity(parts.map((part) => encoder.encode(part)));

const createItemBaseKey = (item: IProjectInspectionItem): string => {
  if (item.kind === 'metadata') {
    return [
      '0',
      item.metadata.path,
      item.metadata.kind,
      item.metadata.agentId ?? '',
      item.metadata.decisionId ?? '',
      item.metadata.digest,
    ].join(':');
  }

  if (item.kind === 'diagnostic') {
    return [
      '1',
      item.diagnostic.source,
      item.diagnostic.code,
      item.diagnostic.path ?? '',
      createIdentity([serializeDeterministically(item.diagnostic)]),
    ].join(':');
  }

  return [
    '2',
    item.evidence.source,
    item.evidence.kind,
    item.evidence.agentId ?? '',
    createIdentity([serializeDeterministically(item.evidence)]),
  ].join(':');
};

/** Assigns stable unique keys without relying on collection offsets. */
const createKeyedItems = (
  items: readonly IProjectInspectionItem[],
): readonly IKeyedInspectionItem[] => {
  const sorted = items
    .map((item) => ({ baseKey: createItemBaseKey(item), item }))
    .sort((left, right) =>
      left.baseKey < right.baseKey ? -1 : left.baseKey > right.baseKey ? 1 : 0,
    );
  const occurrences = new Map<string, number>();

  return sorted.map(({ baseKey, item }) => {
    const occurrence = occurrences.get(baseKey) ?? 0;
    occurrences.set(baseKey, occurrence + 1);

    return { item, key: `${baseKey}:${String(occurrence).padStart(10, '0')}` };
  });
};

const createCursorChecksum = (
  inspectionDigest: string,
  lastKey: string,
  view: IProjectInspectionView,
): string => createIdentity([CURSOR_PREFIX, inspectionDigest, lastKey, view]);

const encodeCursor = (
  inspectionDigest: string,
  view: IProjectInspectionView,
  lastKey: string,
): string =>
  [
    CURSOR_PREFIX,
    view,
    encodeURIComponent(lastKey),
    inspectionDigest,
    createCursorChecksum(inspectionDigest, lastKey, view),
  ].join(':');

const decodeCursor = (
  cursor: string | undefined,
  inspectionDigest: string,
  view: IProjectInspectionView,
): string | null => {
  if (cursor === undefined) {
    return null;
  }

  const match =
    /^core3:(all|diagnostics|evidence|metadata):([^:]+):(sha256:[0-9a-f]{64}):(sha256:[0-9a-f]{64})$/u.exec(
      cursor,
    );

  if (match === null || match[1] !== view || match[3] !== inspectionDigest) {
    return invalidArgument();
  }

  let lastKey: string;

  try {
    lastKey = decodeURIComponent(match[2] as string);
  } catch {
    return invalidArgument();
  }

  if (lastKey.length === 0 || match[4] !== createCursorChecksum(inspectionDigest, lastKey, view)) {
    return invalidArgument();
  }

  return lastKey;
};

const selectViewItems = (
  items: readonly IKeyedInspectionItem[],
  view: IProjectInspectionView,
): readonly IKeyedInspectionItem[] =>
  view === 'all'
    ? items
    : items.filter(({ item }) => {
        if (view === 'diagnostics') {
          return item.kind === 'diagnostic';
        }

        return item.kind === view;
      });

/** Returns one bounded content-free view over a completely validated project snapshot. */
export const inspectProjectPage = async (
  input: IProjectInspectionPageInput,
  options: ICoreOptionsSnapshot,
): Promise<IProjectInspectionPageResult> => {
  if (
    typeof input !== 'object' ||
    input === null ||
    Reflect.ownKeys(input).some(
      (key) =>
        key !== 'cursor' &&
        key !== 'maxItems' &&
        key !== 'repository' &&
        key !== 'signal' &&
        key !== 'view',
    ) ||
    !Number.isSafeInteger(input.maxItems) ||
    input.maxItems < 1 ||
    input.maxItems > options.limits.maxEntries ||
    (input.cursor !== undefined && typeof input.cursor !== 'string') ||
    (input.view !== 'all' &&
      input.view !== 'diagnostics' &&
      input.view !== 'evidence' &&
      input.view !== 'metadata')
  ) {
    return invalidArgument();
  }

  const state = await validateProjectState(
    {
      repository: input.repository,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    },
    options,
  );
  const metadata = state.project === null ? [] : collectProjectMetadata(state.project);
  const allItems = createKeyedItems([
    ...metadata.map((metadataItem) => ({ kind: 'metadata' as const, metadata: metadataItem })),
    ...state.result.diagnostics.map((diagnostic) => ({ diagnostic, kind: 'diagnostic' as const })),
    ...state.result.evidence.map((evidence) => ({ evidence, kind: 'evidence' as const })),
  ]);
  const counts = {
    agents: state.result.summary?.counts.agents ?? 0,
    context: state.result.summary?.counts.context ?? 0,
    decisions: state.result.summary?.counts.decisions ?? 0,
    diagnostics: state.result.diagnostics.length,
    evidence: state.result.evidence.length,
    metadata: metadata.length,
    mirrors: state.result.summary?.counts.mirrors ?? 0,
    runtimes: state.result.summary?.counts.runtimes ?? 0,
    unresolved: state.result.summary?.counts.unresolved ?? 0,
  };
  const inspectionDigest = createIdentity([
    serializeDeterministically({
      counts,
      formatVersion: state.result.formatVersion,
      itemKeys: allItems.map(({ key }) => key),
      summary: state.result.summary,
      valid: state.result.valid,
    }),
  ]);
  const items = selectViewItems(allItems, input.view);
  const lastKey = decodeCursor(input.cursor, inspectionDigest, input.view);
  const startIndex = lastKey === null ? 0 : items.findIndex(({ key }) => key === lastKey) + 1;

  if (lastKey !== null && startIndex === 0) {
    return invalidArgument();
  }

  const selected = items.slice(startIndex, startIndex + input.maxItems);
  const records: IProjectInspectionPageRecord[] = selected.map(({ item, key }, index) => {
    const isLastItem = startIndex + index + 1 >= items.length;

    return {
      item,
      nextCursor: isLastItem ? null : encodeCursor(inspectionDigest, input.view, key),
    };
  });
  const nextCursor = records.at(-1)?.nextCursor ?? null;

  return freezeRecursively({
    counts,
    formatVersion: state.result.formatVersion,
    inspectionDigest,
    page: {
      isComplete: nextCursor === null,
      nextCursor,
      records,
      totalItems: items.length,
    },
    source: state.result.source,
    summary: state.result.summary,
    valid: state.result.valid,
    view: input.view,
  });
};

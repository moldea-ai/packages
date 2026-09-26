import { createRepositoryIdentity } from '@moldea.ai/repository';

import type {
  IProjectInspection,
  IProjectInspectionInput,
  IProjectInspectionItem,
  IProjectInspectionPageInput,
  IProjectInspectionPageRecord,
  IProjectInspectionPageResult,
  IProjectInspectionResourceUsage,
  IProjectInspectionView,
} from '../contracts/index.js';
import { CoreOperationException } from '../exceptions/index.js';
import { freezeRecursively } from '../immutable/index.js';
import type { ICoreOptionsSnapshot } from '../options/index.js';
import { iterateProjectAgentAssignments } from '../project-agent-assignments/index.js';
import { iterateProjectMetadata } from '../project-metadata/index.js';
import { validateProjectState, type IProjectValidationState } from '../project-validation/index.js';

interface IKeyedInspectionItem {
  readonly item: IProjectInspectionItem;
  readonly key: string;
}

type IInspectionViews = Readonly<Record<IProjectInspectionView, readonly IKeyedInspectionItem[]>>;

interface IPreparedProjectInspectionInput {
  readonly counts: IProjectInspection['counts'];
  readonly formatVersion: IProjectInspection['formatVersion'];
  readonly items: readonly IKeyedInspectionItem[];
  readonly maxEntries: number;
  readonly preparedBytes: number;
  readonly resourceUsage: {
    readonly canonicalBytes: number;
    readonly peakRetainedBytes: number;
    readonly retainedBytes: number;
    readonly totalBytesRead: number;
  };
  readonly source: IProjectInspection['source'];
  readonly summary: IProjectInspection['summary'];
  readonly valid: boolean;
}

const CURSOR_PREFIX = 'core5';
const PREPARED_FIXED_BYTES = 512;
const PREPARED_ITEM_FIXED_BYTES = 64;
const PREPARED_TEXT_BYTE_MULTIPLIER = 2;
const PREPARED_VIEW_REFERENCE_BYTES = 8;
const encoder = new TextEncoder();

const invalidArgument = (): never => {
  throw new CoreOperationException({
    code: 'INVALID_ARGUMENT',
    operation: 'create-project-inspection',
  });
};

const resourceLimitExceeded = (limitMaximum: number, observedUsage: number): never => {
  throw new CoreOperationException({
    code: 'RESOURCE_LIMIT_EXCEEDED',
    limit: 'maxRetainedBytes',
    limitMaximum,
    nextAction: 'reduce-input-or-increase-limit',
    observedUsage,
    operation: 'create-project-inspection',
  });
};

/** Serializes content-free inspection state with recursively sorted object keys. */
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

const createIdentity = (parts: Iterable<string>): string =>
  createRepositoryIdentity(
    (function* (): IterableIterator<Uint8Array> {
      for (const part of parts) {
        yield encoder.encode(part);
      }
    })(),
  );

const createItemBaseKey = (item: IProjectInspectionItem): string => {
  if (item.kind === 'agent') {
    return ['3', item.agent.agentId, item.agent.runtimeId].join('\0');
  }

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

/** Assigns stable unique keys once without relying on collection offsets. */
const createKeyedItems = (
  items: Iterable<IProjectInspectionItem>,
): readonly IKeyedInspectionItem[] => {
  const sorted = Array.from(items, (item) => ({ item, key: createItemBaseKey(item) })).sort(
    (left, right) => (left.key < right.key ? -1 : left.key > right.key ? 1 : 0),
  );
  let previousBaseKey: string | null = null;
  let occurrence = 0;

  for (const item of sorted) {
    const baseKey = item.key;
    occurrence = baseKey === previousBaseKey ? occurrence + 1 : 0;
    previousBaseKey = baseKey;
    item.key = `${baseKey}:${String(occurrence).padStart(10, '0')}`;
  }

  return sorted;
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
    /^core5:(all|diagnostics|evidence|metadata):([^:]+):(sha256:[0-9a-f]{64}):(sha256:[0-9a-f]{64})$/u.exec(
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

const createViews = (items: readonly IKeyedInspectionItem[]): IInspectionViews =>
  freezeRecursively({
    all: items,
    diagnostics: items.filter(({ item }) => item.kind === 'diagnostic'),
    evidence: items.filter(({ item }) => item.kind === 'evidence'),
    metadata: items.filter(({ item }) => item.kind === 'metadata' || item.kind === 'agent'),
  });

const addRetainedBytes = (
  current: number,
  additional: number,
  retainedBeforePreparation: number,
  maximum: number,
): number => {
  const projectedUsage = retainedBeforePreparation + current + additional;

  if (
    !Number.isSafeInteger(additional) ||
    additional < 0 ||
    !Number.isSafeInteger(projectedUsage) ||
    projectedUsage > maximum
  ) {
    return resourceLimitExceeded(
      maximum,
      Number.isSafeInteger(projectedUsage) ? projectedUsage : Number.MAX_SAFE_INTEGER,
    );
  }

  return current + additional;
};

/** Iterates every content-free inspection item without retaining preparation state. */
const iterateProjectInspectionItems = function* (
  state: IProjectValidationState,
): IterableIterator<IProjectInspectionItem> {
  if (state.project !== null) {
    for (const metadata of iterateProjectMetadata(state.project)) {
      yield { kind: 'metadata', metadata };
    }
  }

  for (const diagnostic of state.result.diagnostics) {
    yield { diagnostic, kind: 'diagnostic' };
  }

  for (const evidence of state.result.evidence) {
    yield { evidence, kind: 'evidence' };
  }

  if (state.project !== null) {
    for (const agent of iterateProjectAgentAssignments(state.project)) {
      yield { agent, kind: 'agent' };
    }
  }
};

interface IPreparedProjectInspectionEstimate {
  readonly counts: IProjectInspection['counts'];
  readonly preparedBytes: number;
}

/** Preflights the complete logical prepared-state cost before retaining its collections. */
const estimatePreparedProjectInspection = (
  state: IProjectValidationState,
  baseCounts: Omit<IProjectInspection['counts'], 'metadata'>,
  maximum: number,
): IPreparedProjectInspectionEstimate => {
  const retainedBeforePreparation = state.resourceUsage.retainedBytes;
  let bytes = addRetainedBytes(0, PREPARED_FIXED_BYTES, retainedBeforePreparation, maximum);
  let metadataCount = 0;

  for (const item of iterateProjectInspectionItems(state)) {
    const key = `${createItemBaseKey(item)}:0000000000`;
    const encodedBytes =
      encoder.encode(key).byteLength + encoder.encode(serializeDeterministically(item)).byteLength;
    bytes = addRetainedBytes(
      bytes,
      PREPARED_ITEM_FIXED_BYTES +
        encodedBytes * PREPARED_TEXT_BYTE_MULTIPLIER +
        PREPARED_VIEW_REFERENCE_BYTES,
      retainedBeforePreparation,
      maximum,
    );

    if (item.kind === 'metadata') {
      metadataCount += 1;
    }
  }

  const counts = {
    agents: baseCounts.agents,
    context: baseCounts.context,
    decisions: baseCounts.decisions,
    diagnostics: baseCounts.diagnostics,
    errors: baseCounts.errors,
    evidence: baseCounts.evidence,
    metadata: metadataCount,
    mirrors: baseCounts.mirrors,
    runtimes: baseCounts.runtimes,
    unresolved: baseCounts.unresolved,
    warnings: baseCounts.warnings,
  };
  bytes = addRetainedBytes(
    bytes,
    encoder.encode(
      serializeDeterministically({
        counts,
        formatVersion: state.result.formatVersion,
        inspectionDigest: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
        source: state.result.source,
        summary: state.result.summary,
        valid: state.result.valid,
      }),
    ).byteLength * PREPARED_TEXT_BYTE_MULTIPLIER,
    retainedBeforePreparation,
    maximum,
  );

  return { counts, preparedBytes: bytes };
};

/** Creates the inspection digest without materializing a project-sized key projection. */
const createInspectionDigest = (
  counts: IProjectInspection['counts'],
  formatVersion: IProjectInspection['formatVersion'],
  items: readonly IKeyedInspectionItem[],
  summary: IProjectInspection['summary'],
  valid: boolean,
): string =>
  createIdentity(
    (function* (): IterableIterator<string> {
      yield 'core5-prepared-inspection';
      yield serializeDeterministically({ counts, formatVersion, summary, valid });

      for (const { key } of items) {
        yield key;
      }
    })(),
  );

const findStartIndex = (items: readonly IKeyedInspectionItem[], lastKey: string | null): number => {
  if (lastKey === null) {
    return 0;
  }

  let lower = 0;
  let upper = items.length - 1;

  while (lower <= upper) {
    const middle = lower + Math.floor((upper - lower) / 2);
    const candidate = items[middle];

    if (candidate === undefined) {
      return invalidArgument();
    }

    if (candidate.key === lastKey) {
      return middle + 1;
    }

    if (candidate.key < lastKey) {
      lower = middle + 1;
    } else {
      upper = middle - 1;
    }
  }

  return invalidArgument();
};

/** Creates the returned inspection from content-free state only. */
const createPreparedProjectInspection = (
  input: IPreparedProjectInspectionInput,
): IProjectInspection => {
  const {
    counts,
    formatVersion,
    items,
    maxEntries,
    preparedBytes,
    resourceUsage: validationUsage,
    source,
    summary,
    valid,
  } = input;
  const views = createViews(items);
  const inspectionDigest = createInspectionDigest(counts, formatVersion, items, summary, valid);
  const resourceUsage: IProjectInspectionResourceUsage = freezeRecursively({
    canonicalBytes: validationUsage.canonicalBytes,
    peakRetainedBytes: Math.max(
      validationUsage.peakRetainedBytes,
      validationUsage.retainedBytes + preparedBytes,
    ),
    preparedBytes,
    retainedBytes: preparedBytes,
    totalBytesRead: validationUsage.totalBytesRead,
  });

  const readPage = (pageInput: IProjectInspectionPageInput): IProjectInspectionPageResult => {
    if (
      typeof pageInput !== 'object' ||
      pageInput === null ||
      Reflect.ownKeys(pageInput).some(
        (key) => key !== 'cursor' && key !== 'maxItems' && key !== 'view',
      ) ||
      !Number.isSafeInteger(pageInput.maxItems) ||
      pageInput.maxItems < 1 ||
      pageInput.maxItems > maxEntries ||
      (pageInput.cursor !== undefined && typeof pageInput.cursor !== 'string') ||
      (pageInput.view !== 'all' &&
        pageInput.view !== 'diagnostics' &&
        pageInput.view !== 'evidence' &&
        pageInput.view !== 'metadata')
    ) {
      return invalidArgument();
    }

    const viewItems = views[pageInput.view];
    const lastKey = decodeCursor(pageInput.cursor, inspectionDigest, pageInput.view);
    const startIndex = findStartIndex(viewItems, lastKey);
    const selected = viewItems.slice(startIndex, startIndex + pageInput.maxItems);
    const records: IProjectInspectionPageRecord[] = selected.map(({ item, key }, index) => {
      const isLastItem = startIndex + index + 1 >= viewItems.length;

      return {
        item,
        nextCursor: isLastItem ? null : encodeCursor(inspectionDigest, pageInput.view, key),
      };
    });
    const nextCursor = records.at(-1)?.nextCursor ?? null;

    return freezeRecursively({
      counts,
      formatVersion,
      inspectionDigest,
      page: {
        isComplete: nextCursor === null,
        nextCursor,
        records,
        totalItems: viewItems.length,
      },
      source,
      summary,
      valid,
      view: pageInput.view,
    });
  };

  return freezeRecursively({
    counts,
    formatVersion,
    inspectionDigest,
    readPage,
    resourceUsage,
    source,
    summary,
    valid,
  });
};

/** Prepares one immutable content-free inspection for synchronous bounded page reads. */
export const createProjectInspection = async (
  input: IProjectInspectionInput,
  options: ICoreOptionsSnapshot,
): Promise<IProjectInspection> => {
  const state = await validateProjectState(input, options);
  const baseCounts = {
    agents: state.result.summary?.counts.agents ?? 0,
    context: state.result.summary?.counts.context ?? 0,
    decisions: state.result.summary?.counts.decisions ?? 0,
    diagnostics: state.result.diagnostics.length,
    errors: state.result.errorCount,
    evidence: state.result.evidence.length,
    mirrors: state.result.summary?.counts.mirrors ?? 0,
    runtimes: state.result.summary?.counts.runtimes ?? 0,
    unresolved: state.result.summary?.counts.unresolved ?? 0,
    warnings: state.result.warningCount,
  };
  const estimate = estimatePreparedProjectInspection(
    state,
    baseCounts,
    options.limits.maxRetainedBytes,
  );
  const counts = freezeRecursively(estimate.counts);
  const items = freezeRecursively(createKeyedItems(iterateProjectInspectionItems(state)));

  return createPreparedProjectInspection({
    counts,
    formatVersion: state.result.formatVersion,
    items,
    maxEntries: options.limits.maxEntries,
    preparedBytes: estimate.preparedBytes,
    resourceUsage: state.resourceUsage,
    source: state.result.source,
    summary: state.result.summary,
    valid: state.result.valid,
  });
};

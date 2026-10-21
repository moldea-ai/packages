import { listUntrackedFiles, readIndexEntries, type IIndexEntry } from 'jg-git-commands';
import { countUtf8Bytes } from 'jg-utilities';

import {
  GIT_TIMEOUT_SECONDS,
  readGit,
  runGitCommand,
  type IGitFailureReason,
} from '../git-command/index.js';

import {
  GIT_IGNORED_INVENTORY_ARGUMENTS,
  GIT_TRACKED_ENTRY_MODES,
  GIT_TRACKED_RECORD_OVERHEAD_BYTES,
} from './constants.js';
import {
  createGitContentTransformationClassifier,
  type IGitContentTransformationClassifier,
} from './content-transformation/index.js';
import {
  createGitInventoryEntryTypeNormalizer,
  createGitSymlinkConfigurationResolver,
  inspectGitInventoryEntry,
  type IGitInventoryEntryTypeNormalizer,
} from './entry-type/index.js';
import {
  filterGitInventoryCandidateLogicalPaths,
  normalizeGitInventoryLogicalPaths,
  type IGitInventoryLogicalPathNormalizer,
} from './logical-path/index.js';
import { createUntrackedGitInventoryParser } from './parser.js';
import {
  createGitInventoryBoundaryInspector,
  createGitInventoryOwnershipFilter,
  type IGitInventoryOwnershipFilter,
} from './repository-ownership/index.js';
import type {
  IGitInventoryCandidate,
  IGitInventoryListingReads,
  IGitInventoryParserResult,
  IGitInventoryProbe,
  IGitInventoryProbeErrorCode,
  IGitInventoryProbeFailedResult,
  IGitInventoryProbeResult,
  IGitTrackedEntryMode,
  IGitTrackedInventoryCandidate,
  IGitUntrackedInventoryCandidate,
} from './types.js';

// the typed Git reads and command the probe uses outside tests
const GIT_INVENTORY_LISTING_READS: IGitInventoryListingReads = Object.freeze({
  listUntrackedFiles,
  readIndexEntries,
  runGit: runGitCommand,
});

/** Maps one normalized Git failure to a safe inventory error. */
const mapGitFailure = (reason: IGitFailureReason): IGitInventoryProbeErrorCode => {
  switch (reason) {
    case 'aborted':
      return 'GIT_OPERATION_ABORTED';
    case 'not-found':
      return 'GIT_NOT_FOUND';
    case 'repository-not-found':
      return 'GIT_REPOSITORY_NOT_FOUND';
    case 'access-denied':
      return 'GIT_ACCESS_DENIED';
    case 'output-invalid':
      return 'GIT_OUTPUT_INVALID';
    case 'output-limit-exceeded':
      return 'RESOURCE_LIMIT_EXCEEDED';
    case 'command-failed':
      return 'GIT_COMMAND_FAILED';
  }
};

/** Determines whether one index mode belongs to the version 1 inventory grammar. */
const isTrackedEntryMode = (mode: string): mode is IGitTrackedEntryMode =>
  (GIT_TRACKED_ENTRY_MODES as readonly string[]).includes(mode);

/** Converts index entries into tracked candidates, or null when one has an unsupported mode. */
const toTrackedCandidates = (
  entries: readonly IIndexEntry[],
): readonly IGitTrackedInventoryCandidate[] | null => {
  const candidates: IGitTrackedInventoryCandidate[] = [];

  for (const { mode, path, stage } of entries) {
    if (!isTrackedEntryMode(mode)) {
      return null;
    }

    candidates.push(Object.freeze({ kind: 'tracked', mode, path, stage }));
  }

  return Object.freeze(candidates);
};

/** Measures the stdout `ls-files --stage -z` wrote for the index entries. */
const measureTrackedOutput = (entries: readonly IIndexEntry[]): number =>
  entries.reduce(
    (bytes, { path }) => bytes + GIT_TRACKED_RECORD_OVERHEAD_BYTES + countUtf8Bytes(path),
    0,
  );

/** Measures the stdout `ls-files --others -z` wrote for the untracked paths. */
const measureUntrackedOutput = (paths: readonly string[]): number =>
  paths.reduce((bytes, path) => bytes + countUtf8Bytes(path) + 1, 0);

/** Creates one immutable inventory-probe failure. */
const createProbeFailure = (
  errorCode: IGitInventoryProbeErrorCode,
): IGitInventoryProbeFailedResult => Object.freeze({ errorCode, kind: 'failed' });

/** Maps one completed parser result into immutable candidates or a safe failure. */
const resolveParserResult = <TCandidate extends IGitInventoryCandidate>(
  parserResult: IGitInventoryParserResult<TCandidate>,
): readonly TCandidate[] | IGitInventoryProbeFailedResult => {
  if (parserResult.kind === 'completed') {
    return parserResult.candidates;
  }

  return createProbeFailure(
    parserResult.reason === 'entry-limit-exceeded'
      ? 'RESOURCE_LIMIT_EXCEEDED'
      : 'GIT_OUTPUT_INVALID',
  );
};

/** Identifies a parser resolution failure without relying on array contents. */
const isProbeFailure = (
  result: readonly IGitInventoryCandidate[] | IGitInventoryProbeFailedResult,
): result is IGitInventoryProbeFailedResult => !Array.isArray(result);

/**
 * Creates the strict normalized Git inventory probe around injectable boundaries.
 * @param git The typed Git reads and command that list raw candidates.
 * @param ownershipFilter The submodule and nested-repository ownership filter.
 * @param entryTypeNormalizer The current filesystem and Git mode entry-type normalizer.
 * @param contentTransformationClassifier The bounded effective Git attribute classifier.
 * @param logicalPathNormalizer The portable repository logical-path normalizer.
 * @returns An all-or-nothing selected-repository entry probe.
 */
export const createGitInventoryProbe =
  (
    git: IGitInventoryListingReads = GIT_INVENTORY_LISTING_READS,
    ownershipFilter: IGitInventoryOwnershipFilter = createGitInventoryOwnershipFilter(
      createGitInventoryBoundaryInspector(),
    ),
    entryTypeNormalizer: IGitInventoryEntryTypeNormalizer = createGitInventoryEntryTypeNormalizer(
      inspectGitInventoryEntry,
      createGitSymlinkConfigurationResolver(),
    ),
    contentTransformationClassifier: IGitContentTransformationClassifier = createGitContentTransformationClassifier(),
    logicalPathNormalizer: IGitInventoryLogicalPathNormalizer = normalizeGitInventoryLogicalPaths,
  ): IGitInventoryProbe =>
  async (input): Promise<IGitInventoryProbeResult> => {
    if (input.signal?.aborted) {
      return createProbeFailure('GIT_OPERATION_ABORTED');
    }

    // Git reads these paths literally, from the repository root the commands run in
    const selectionPaths = (input.selectionPaths ?? []).map((selectionPath) =>
      selectionPath.slice(1),
    );
    let remainingMetadataBytes = input.maxMetadataBytes;

    /*
     * Each read may use the rest of the shared metadata budget for its stdout and stderr together.
     * Git needs a positive limit, so an exhausted budget still allows one byte, and the read fails
     * once its measured output leaves the budget negative.
     */
    const createReadOptions = () => ({
      maxOutputBytes: Math.max(remainingMetadataBytes, 1),
      timeoutSeconds: GIT_TIMEOUT_SECONDS,
      ...(selectionPaths.length === 0 ? {} : { paths: selectionPaths }),
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    });

    const trackedResult = await readGit(
      () => git.readIndexEntries(input.repositoryRoot, createReadOptions()),
      input.signal,
    );

    if (trackedResult.kind === 'failed') {
      return createProbeFailure(mapGitFailure(trackedResult.reason));
    }

    remainingMetadataBytes -= measureTrackedOutput(trackedResult.value);

    if (trackedResult.value.length > input.maxEntries || remainingMetadataBytes < 0) {
      return createProbeFailure('RESOURCE_LIMIT_EXCEEDED');
    }

    const trackedCandidates = toTrackedCandidates(trackedResult.value);

    if (trackedCandidates === null) {
      return createProbeFailure('GIT_OUTPUT_INVALID');
    }

    const untrackedResult = await readGit(
      () => git.listUntrackedFiles(input.repositoryRoot, createReadOptions()),
      input.signal,
    );

    if (untrackedResult.kind === 'failed') {
      return createProbeFailure(mapGitFailure(untrackedResult.reason));
    }

    remainingMetadataBytes -= measureUntrackedOutput(untrackedResult.value);

    if (
      trackedCandidates.length + untrackedResult.value.length > input.maxEntries ||
      remainingMetadataBytes < 0
    ) {
      return createProbeFailure('RESOURCE_LIMIT_EXCEEDED');
    }

    if (untrackedResult.value.some((path) => path.length === 0)) {
      return createProbeFailure('GIT_OUTPUT_INVALID');
    }

    const untrackedCandidates: readonly IGitUntrackedInventoryCandidate[] = Object.freeze(
      untrackedResult.value.map((path) => Object.freeze({ kind: 'untracked', path })),
    );
    let ignoredCandidates: readonly IGitInventoryCandidate[] = [];

    // ignored files enter only an explicit selection, never the general inventory
    if (input.includeIgnored === true && selectionPaths.length > 0) {
      const ignoredResult = await git.runGit(
        [...GIT_IGNORED_INVENTORY_ARGUMENTS, ...selectionPaths],
        {
          cwd: input.repositoryRoot,
          maxOutputBytes: Math.max(remainingMetadataBytes, 1),
          ...(input.signal === undefined ? {} : { signal: input.signal }),
        },
      );

      if (ignoredResult.kind === 'failed') {
        return createProbeFailure(mapGitFailure(ignoredResult.reason));
      }

      remainingMetadataBytes -= ignoredResult.value.byteLength;

      if (remainingMetadataBytes < 0) {
        return createProbeFailure('RESOURCE_LIMIT_EXCEEDED');
      }

      const ignoredParser = createUntrackedGitInventoryParser(
        input.maxEntries - trackedCandidates.length - untrackedCandidates.length,
      );

      ignoredParser.consume(ignoredResult.value);

      const parsedIgnoredCandidates = resolveParserResult(ignoredParser.finish());

      if (isProbeFailure(parsedIgnoredCandidates)) {
        return parsedIgnoredCandidates;
      }

      const untrackedPaths = new Set(untrackedCandidates.map((candidate) => candidate.path));
      ignoredCandidates = parsedIgnoredCandidates.filter(
        (candidate) => !untrackedPaths.has(candidate.path),
      );
    }

    const candidates = Object.freeze([
      ...trackedCandidates,
      ...untrackedCandidates,
      ...ignoredCandidates,
    ]);
    const logicalPathFilterResult = filterGitInventoryCandidateLogicalPaths({ candidates });

    if (logicalPathFilterResult.kind === 'failed') {
      return logicalPathFilterResult;
    }

    const ownershipResult = await ownershipFilter({
      candidates: logicalPathFilterResult.candidates,
      maxMetadataBytes: remainingMetadataBytes,
      repositoryRoot: input.repositoryRoot,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    });

    if (ownershipResult.kind === 'failed') {
      return ownershipResult;
    }

    const entryTypeResult = await entryTypeNormalizer({
      candidates: ownershipResult.candidates,
      maxMetadataBytes: remainingMetadataBytes - ownershipResult.gitMetadataBytes,
      repositoryRoot: input.repositoryRoot,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    });

    if (entryTypeResult.kind === 'failed') {
      return entryTypeResult;
    }

    const contentTransformationResult = await contentTransformationClassifier({
      entries: entryTypeResult.entries,
      maxMetadataBytes:
        remainingMetadataBytes -
        ownershipResult.gitMetadataBytes -
        entryTypeResult.gitMetadataBytes,
      repositoryRoot: input.repositoryRoot,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    });

    if (contentTransformationResult.kind === 'failed') {
      return contentTransformationResult;
    }

    const logicalPathResult = logicalPathNormalizer({
      entries: contentTransformationResult.entries,
    });

    if (logicalPathResult.kind === 'failed') {
      return logicalPathResult;
    }

    return Object.freeze({ entries: logicalPathResult.entries, kind: 'probed' });
  };

// default normalized Git inventory probe used by command execution
export const probeGitInventory = createGitInventoryProbe();

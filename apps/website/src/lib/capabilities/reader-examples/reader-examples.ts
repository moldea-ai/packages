import { parseRepositoryPath } from '@moldea.ai/repository';
import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';
import { createFilesystemRepositoryReader } from '@moldea.ai/repository-fs';

import type { ICapabilityCase, ICapabilityFact } from '../index.ts';
import { assertCapabilityFacts, captureOperationalRefusal } from '../index.ts';
import { projectEntry } from '../index.ts';
import { withFixtureWorkspace } from '../fixture-workspace/index.ts';

/** Describes reader results without assigning a Core validation verdict. */
const readerCase = (
  id: string,
  operation: string,
  title: string,
  description: string,
  facts: Record<string, ICapabilityFact>,
  filesystem = false,
): ICapabilityCase => ({
  id,
  groupId: 'repository-access',
  title,
  description,
  operation,
  packageName: filesystem ? '@moldea.ai/repository-fs' : '@moldea.ai/repository',
  limitation: 'Reader results describe the selected snapshot, not application semantics.',
  sourcePaths: filesystem
    ? [
        'projects/repository-fs/docs/selection-and-snapshots.md',
        'projects/repository-fs/docs/security-and-limits.md',
      ]
    : ['projects/repository/docs/reader-contract.md', 'projects/repository/docs/memory-reader.md'],
  files: [],
  result: { kind: 'reader', facts },
});

/**
 * Exercises source-neutral readers and isolated filesystem selection through public exports.
 * @returns Actual logical metadata, page progress, comparison records, and safe refusals.
 */
export const createReaderExamples = async (): Promise<ICapabilityCase[]> => {
  const examples: ICapabilityCase[] = [];
  const content = new TextEncoder().encode('30 days\n');
  const policyPath = parseRepositoryPath('/policy.md');
  const repository = createMemoryRepositoryReader([
    { path: policyPath, type: 'file', content },
    { path: '/scratch', type: 'directory' },
    { path: '/shortcut', type: 'symlink' },
  ]);
  content.fill(0);
  const firstBytes = await repository.readFilePage(policyPath, { offset: 0, maxBytes: 2 });
  const remainder = await repository.readFilePage(policyPath, { offset: 2, maxBytes: 8 });
  assertCapabilityFacts(new TextDecoder().decode(firstBytes.bytes), '30');
  assertCapabilityFacts(new TextDecoder().decode(remainder.bytes), ' days\n');
  firstBytes.bytes.fill(0);
  const reread = await repository.readFilePage(policyPath, { offset: 0, maxBytes: 2 });
  assertCapabilityFacts([...reread.bytes], [51, 48]);
  examples.push(
    readerCase(
      'memory-immutable-ranges',
      'readFilePage',
      'Read only the requested bytes',
      'Mutating the input buffer or a returned byte array does not change the memory snapshot.',
      {
        firstRange: {
          offset: reread.offset,
          bytes: [...reread.bytes],
          totalBytes: reread.totalBytes,
          nextOffset: reread.nextOffset,
          isComplete: reread.isComplete,
        },
        finalRange: {
          offset: remainder.offset,
          bytes: [...remainder.bytes],
          totalBytes: remainder.totalBytes,
          nextOffset: remainder.nextOffset,
          isComplete: remainder.isComplete,
        },
      },
    ),
  );
  const first = await repository.listEntriesPage({ maxEntries: 2 });
  if (first.nextCursor === null)
    throw new Error('The reader example did not produce continuation.');
  const final = await repository.listEntriesPage({ maxEntries: 2, cursor: first.nextCursor });
  assertCapabilityFacts(
    [...first.entries, ...final.entries].map(({ path, type }) => ({ path, type })),
    [
      { path: '/policy.md', type: 'file' },
      { path: '/scratch', type: 'directory' },
      { path: '/shortcut', type: 'symlink' },
    ],
  );
  assertCapabilityFacts(
    [first.isComplete, final.isComplete, final.nextCursor],
    [false, true, null],
  );
  const exact = await repository.listEntriesPage({ maxEntries: 3 });
  assertCapabilityFacts(
    [exact.entries.length, exact.isComplete, exact.nextCursor],
    [3, true, null],
  );
  const empty = await createMemoryRepositoryReader([]).listEntriesPage({ maxEntries: 2 });
  assertCapabilityFacts([empty.entries, empty.isComplete, empty.nextCursor], [[], true, null]);
  examples.push(
    readerCase(
      'reader-entry-pages',
      'listEntriesPage',
      'List files, directories, and logical links',
      'Stable ordering and explicit continuation let a caller traverse the selected entries without guessing completion.',
      {
        pages: [first, final].map((page) => ({
          entries: page.entries.map(projectEntry),
          isComplete: page.isComplete,
          hasContinuation: page.nextCursor !== null,
        })),
        empty: { entries: [], isComplete: empty.isComplete },
        exactBoundaryComplete: exact.isComplete,
      },
    ),
  );
  const entry = await repository.getEntry(policyPath);
  assertCapabilityFacts(entry?.type, 'file');
  assertCapabilityFacts(await repository.getEntry(parseRepositoryPath('/absent.md')), null);
  if (entry === null) throw new Error('The reader metadata fixture is missing.');
  examples.push(
    readerCase(
      'reader-exact-entry',
      'getEntry',
      'Look up one exact logical path',
      'Entry metadata is separate from reading file bytes.',
      { entry: projectEntry(entry), missingEntry: null },
    ),
  );
  examples.push(
    readerCase(
      'reader-invalid-cursor',
      'listEntriesPage',
      'A malformed cursor is refused',
      'Continuation must come from a compatible reader request.',
      await captureOperationalRefusal(
        () => repository.listEntriesPage({ maxEntries: 2, cursor: 'not-a-reader-cursor' }),
        'INVALID_PAGE_REQUEST',
      ),
    ),
  );
  const otherSnapshot = createMemoryRepositoryReader([
    { path: policyPath, type: 'file', content: '60 days\n' },
  ]);
  examples.push(
    readerCase(
      'reader-snapshot-cursor',
      'listEntriesPage',
      'A cursor cannot mix snapshots',
      'A changed memory snapshot rejects continuation from the earlier snapshot.',
      await captureOperationalRefusal(
        () => otherSnapshot.listEntriesPage({ maxEntries: 2, cursor: first.nextCursor ?? '' }),
        'INVALID_PAGE_REQUEST',
      ),
    ),
  );
  examples.push(
    readerCase(
      'reader-cancellation',
      'readFilePage',
      'A cancelled read does not return partial success',
      'The operation propagates cancellation through the public reader boundary.',
      await captureOperationalRefusal(
        () =>
          repository.readFilePage(policyPath, {
            offset: 0,
            maxBytes: 2,
            signal: AbortSignal.abort(),
          }),
        'ABORTED',
      ),
    ),
  );

  const base = createMemoryRepositoryReader([
    { path: '/return-policy.md', type: 'file', content: '30 days\n' },
    {
      path: '/holiday-returns.md',
      type: 'file',
      content: 'Holiday purchases have a 60-day return window.\n',
    },
    { path: '/shared.md', type: 'file', content: 'Delivery confirmation is required.\n' },
    { path: '/terms', type: 'file', content: 'Terms\n' },
  ]);
  const candidate = createMemoryRepositoryReader([
    {
      path: '/international-returns.md',
      type: 'file',
      content: 'Contact support for international returns.\n',
    },
    { path: '/return-policy.md', type: 'file', content: '60 days\n' },
    { path: '/shared.md', type: 'file', content: 'Delivery confirmation is required.\n' },
    { path: '/terms', type: 'directory' },
  ]);
  const comparison = await base.compare(candidate);
  const changes: { path: string; kind: string }[] = [];
  const pages: ICapabilityFact[] = [];
  const cursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await comparison.listChangesPage({
      maxChanges: 2,
      maxEntriesVisited: 2,
      maxBytesRead: 32,
      ...(cursor === undefined ? {} : { cursor }),
    });
    const selected = page.changes.map(({ path, kind, baseEntry, candidateEntry }) => ({
      path,
      kind,
      ...(kind === 'type-changed'
        ? { fromType: baseEntry?.type ?? null, toType: candidateEntry?.type ?? null }
        : {}),
    }));
    changes.push(...selected.map(({ path, kind }) => ({ path, kind })));
    pages.push({
      changes: selected,
      entriesVisited: page.entriesVisited,
      bytesRead: page.bytesRead,
      isComplete: page.isComplete,
      hasContinuation: page.nextCursor !== null,
    });
    cursor = page.nextCursor ?? undefined;
    if (cursor !== undefined) {
      if (cursors.has(cursor)) throw new Error('A capability comparison did not make progress.');
      cursors.add(cursor);
    }
  } while (cursor !== undefined);
  assertCapabilityFacts(changes, [
    { path: '/holiday-returns.md', kind: 'deleted' },
    { path: '/international-returns.md', kind: 'added' },
    { path: '/return-policy.md', kind: 'modified' },
    { path: '/terms', kind: 'type-changed' },
  ]);
  examples.push(
    readerCase(
      'snapshot-comparison',
      'compare',
      'See what changed between snapshots',
      'Only changed paths are returned. Unchanged files stay out of the result.',
      { pages },
    ),
  );

  const filesystemExamples = await withFixtureWorkspace(
    [
      { path: '/policy.md', content: '30 days\n' },
      { path: '/unselected.md', content: 'A separate draft policy.\n' },
    ],
    async (workspace) => {
      const selected = await createFilesystemRepositoryReader({
        rootDirectory: workspace.directory,
        selection: { kind: 'paths', paths: [policyPath] },
      });
      const directory = await createFilesystemRepositoryReader({
        rootDirectory: workspace.directory,
        selection: { kind: 'directory' },
      });
      const selectedPage = await selected.listEntriesPage({ maxEntries: 2 });
      const directoryPage = await directory.listEntriesPage({ maxEntries: 2 });
      assertCapabilityFacts(
        selectedPage.entries.map(({ path }) => path),
        ['/policy.md'],
      );
      assertCapabilityFacts(
        directoryPage.entries.map(({ path }) => path),
        ['/policy.md', '/unselected.md'],
      );
      const selection = readerCase(
        'filesystem-selection',
        'createFilesystemRepositoryReader',
        'Choose explicit files or a directory snapshot',
        'The reader returns repository-logical paths. Directory selection is not Git ignore selection.',
        {
          explicit: selectedPage.entries.map(projectEntry),
          directory: directoryPage.entries.map(projectEntry),
        },
        true,
      );
      await selected.readFilePage(policyPath, { offset: 0, maxBytes: 2 });
      await workspace.write({ path: '/policy.md', content: 'The return window is now 60 days.\n' });
      const changed = readerCase(
        'filesystem-changed-snapshot',
        'readFilePage',
        'The source changed during inspection',
        'A continued read refuses changed filesystem state instead of mixing old and new bytes.',
        await captureOperationalRefusal(
          () => selected.readFilePage(policyPath, { offset: 2, maxBytes: 2 }),
          'SNAPSHOT_CHANGED',
        ),
        true,
      );
      const resource = readerCase(
        'filesystem-resource-boundary',
        'listEntriesPage',
        'Directory capture stops at its configured limit',
        'A bounded capture reports resource exhaustion instead of publishing an incomplete inventory.',
        await captureOperationalRefusal(async () => {
          const limited = await createFilesystemRepositoryReader({
            rootDirectory: workspace.directory,
            selection: { kind: 'directory' },
            limits: { maxEntries: 1 },
          });
          return limited.listEntriesPage({ maxEntries: 2 });
        }, 'RESOURCE_LIMIT_EXCEEDED'),
        true,
      );
      return [selection, changed, resource];
    },
  );
  return [...examples, ...filesystemExamples];
};

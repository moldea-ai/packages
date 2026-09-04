---
title: Reader contract
description: Snapshot identity, bounded operations, cursors, cancellation, comparison, and exceptions.
order: 20
---

# Reader contract

One `IRepositoryReader` represents one coherent, read-only repository snapshot.

```typescript
import { parseRepositoryPath, type IRepositoryReader } from '@moldea.ai/repository';

export const readManifestPage = async (reader: IRepositoryReader): Promise<Uint8Array> => {
  const result = await reader.readFilePage(parseRepositoryPath('/moldea/moldea.yaml'), {
    maxBytes: 64 * 1024,
    offset: 0,
  });

  return result.bytes;
};
```

## Operations

- `getEntry(path, options?)` performs exact content-free lookup and returns `null` when absent.
- `listEntriesPage(options)` returns at most `maxEntries` deterministic descendants, optionally below `prefix`.
- `readFilePage(path, options)` returns at most `maxBytes` from an explicit byte `offset`.
- `compare(candidate, options?)` creates a source-neutral comparison whose `listChangesPage` method has independent change, entry-visit, and byte-read budgets. `maxBytesRead` must be at least `2`, allowing a source-neutral comparison to read one byte from each snapshot when content identities are unavailable.

Every operation accepts cancellation. Each result identifies the source snapshot it belongs to. File pages report their total length, returned offset, completion state, and next offset.

A non-null file `contentIdentity` is source-defined. Equal identities may prove byte equality only when both snapshots have the same `sourceKind`. Missing identities, unequal identities, and identities from different source kinds require bounded byte comparison; they are never evidence of a modification by themselves.

## Continuation cursors

Listing and comparison cursors are opaque integrity envelopes. They encode content-derived progress rather than positional offsets and are bound to the relevant snapshot identities and request scope. Consumers must not decode, modify, or reuse them with another reader, prefix, or comparison.

Implementations may use their own authenticated cursor representation. Invalid, corrupted, cross-source, or cross-scope cursors fail with `INVALID_PAGE_REQUEST` rather than producing ambiguous output.

## Snapshot consistency

A reader never combines incompatible source observations. If coherence can no longer be established, it fails with `SNAPSHOT_CHANGED` and callers create a new reader. Pagination is bounded continuation over one snapshot, not permission to silently switch to newer source state.

## Exceptions

Malformed logical paths raise `RepositoryPathException`. Operational failures raise `RepositorySourceException` with a stable code, operation, safe logical path when applicable, retryability, and bounded resource details when a named limit is exceeded. Exceptions do not expose host paths, credentials, provider payloads, or raw causes as public data.

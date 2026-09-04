![moldea](cover.png)

# `@moldea.ai/repository-fs`

Lazy, bounded Node.js filesystem access through `@moldea.ai/repository` version 2.

The version 2 reader validates an explicit root and selection, observes entries only as operations need them, returns deterministic metadata pages and byte ranges, enforces independent memory and work limits, and fails when an already-observed source identity changes. It does not build or retain an eager repository-wide inventory.

## Install

```bash
pnpm add @moldea.ai/repository@2 @moldea.ai/repository-fs@2
```

## Responsibility

The reader is read-only and Git-agnostic. Callers provide an absolute host root and choose exact logical paths or recursive directory access. The package does not discover a repository, interpret Git rules, execute content filters, parse `moldea`, follow descendant symlinks, or expose host paths.

Directory selection includes every eligible raw entry reached by the requested pages. It may expose ignored files, credentials, dependencies, caches, and generated output. Trust-sensitive callers should derive an exact path selection outside this package.

## Public reader

```typescript
import { parseRepositoryPath } from '@moldea.ai/repository';
import {
  DEFAULT_FILESYSTEM_REPOSITORY_RESOURCE_LIMITS,
  createFilesystemRepositoryReader,
} from '@moldea.ai/repository-fs';

const reader = await createFilesystemRepositoryReader({
  rootDirectory: '/absolute/path/to/repository',
  selection: {
    kind: 'paths',
    paths: [parseRepositoryPath('/moldea/moldea.yaml')],
  },
});

const entry = await reader.getEntry(parseRepositoryPath('/moldea/moldea.yaml'));
const page = await reader.readFilePage(parseRepositoryPath('/moldea/moldea.yaml'), {
  maxBytes: 64 * 1024,
  offset: 0,
});

DEFAULT_FILESYSTEM_REPOSITORY_RESOURCE_LIMITS;
void entry;
void page;
```

Exact-path construction verifies only selected paths and required parents. Directory traversal is deferred to `listEntriesPage`, and regular-file bytes are read only through `readFilePage`.

## Default limits

| Limit                     |          Default | Purpose                                     |
| ------------------------- | ---------------: | ------------------------------------------- |
| `maxEntries`              |         `131072` | Entries observed during the reader lifetime |
| `maxCachedBytes`          | `67108864` bytes | Retained file-page cache                    |
| `maxConcurrentOperations` |             `16` | Active filesystem operations                |
| `maxDirectoryEntries`     |         `131072` | Names scanned in one directory              |
| `maxPageEntries`          |           `4096` | Entries returned by one listing page        |
| `maxQueuedOperations`     |            `256` | Operations waiting for capacity             |
| `maxReadBytes`            |  `1048576` bytes | Bytes returned by one file page             |

Configured limits are positive safe integers. Requests above a configured limit fail with `RESOURCE_LIMIT_EXCEEDED`; they are never silently truncated. These defaults support large repositories while bounding a single directory, operation, page, queue, and retained cache independently.

## Selection, cursors, and coherence

Paths preserve exact UTF-8 spelling and case. `.git` is excluded during recursive traversal, while similarly named entries remain visible. Descendant symlinks and junctions are metadata entries and are never traversed.

Directory cursors retain bounded traversal frames with the last consumed name and verified directory identities. Exact-path cursors continue from the last returned logical path. Both are versioned, HMAC-authenticated, tied to the reader snapshot and prefix, and limited to 64 KiB encoded. A cursor never contains file bodies.

The reader observes filesystem identity before returning metadata or bytes. Reobserving a changed path fails with `SNAPSHOT_CHANGED`. File reads open without following symlinks where the runtime supports it, verify identity before and after the bounded range, and cache complete verified pages in an LRU bounded by `maxCachedBytes`.

## Runtime support

The package supports Node.js `>=22.11.0` and is not browser-compatible.

## Development

From the monorepo root:

```bash
pnpm --filter @moldea.ai/repository-fs typecheck
pnpm --filter @moldea.ai/repository-fs build
pnpm --filter @moldea.ai/repository-fs test:unit
pnpm --filter @moldea.ai/repository-fs test:integration
pnpm --filter @moldea.ai/repository-fs test
```

Unit and integration tests cover resource ceilings, cursor integrity, snapshot drift, symlink boundaries, cancellation, cache eviction, cross-platform path behavior, and the shared repository reader conformance contract.

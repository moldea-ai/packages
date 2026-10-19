![moldea](cover.png)

# `@moldea.ai/repository-fs`

Lazy, bounded Node.js filesystem access through `@moldea.ai/repository` version 2.

The version 2 reader validates an explicit root and selection, observes entries only as operations need them, returns deterministic metadata pages and byte ranges, enforces independent memory and work limits, and fails when an already-observed source identity changes. It does not build or retain an eager repository-wide inventory.

## Install

```bash
pnpm add @moldea.ai/repository@2 @moldea.ai/repository-fs@2
```

## Responsibility

The reader is read-only and Git-agnostic. Callers provide an absolute host root and choose exact logical paths or recursive directory access. The package does not discover a repository, interpret Git rules, execute content filters, parse `moldea`, or expose host paths. It treats stable descendant symlinks as metadata instead of traversing them; only the separate link resolver follows a link, and only for an entry a caller names.

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

Version `2.0.3` groups exact selections by parent. One bounded scan proves the selected names for a parent, retaining only those names and the parent identity. Later accesses reuse that proof only while the identity remains unchanged. Recursive listing reuses the names already held by its current traversal frames instead of rescanning a parent for each child. This bounds retained names by the selection or active frames; it adds no repository-wide directory cache.

Exact-name lookups skip sibling entries whose names cannot be decoded or validated. Those entries still count against `maxDirectoryEntries`; full directory listings reject them.

## Link resolver

`createFilesystemRepositoryLinkResolver(reader)` returns the Repository `IRepositoryLinkResolver` for a reader this package created. It shares the reader's snapshot, root checks, operation gate, and limits, and follows only the symlink entries a caller names:

```typescript
import { parseRepositoryPath } from '@moldea.ai/repository';
import {
  createFilesystemRepositoryLinkResolver,
  createFilesystemRepositoryReader,
} from '@moldea.ai/repository-fs';

const instructionPath = parseRepositoryPath('/AGENTS.md');
const instructionReader = await createFilesystemRepositoryReader({
  rootDirectory: '/absolute/path/to/repository',
  selection: { kind: 'paths', paths: [instructionPath] },
});
const resolver = createFilesystemRepositoryLinkResolver(instructionReader);
const resolution = await resolver.resolveLink(instructionPath);

void resolution;
```

The resolver walks a chain one link and one component at a time instead of calling `realpath`. On POSIX, `..` moves to the parent of the directory reached so far, exactly as the operating system resolves it; on Windows, relative link text resolves against the link's directory, as Windows does. It refuses UNC, device-namespace, and drive-relative Windows paths and the automount roots `/net` and `/Network` with `unsafe`, checking each link's text, its textual candidate, and every path reached before any filesystem call beneath it. More than 32 hops is `loop`. Resolved targets carry an HMAC identity under a per-resolver key, and `readLinkTargetPage` proves the opened handle is the resolved target before and after each bounded read. Results and exceptions never contain host paths or link text. A network filesystem already mounted at an ordinary path cannot be recognized from its path; reads there stay bounded and content-free.

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

Configured limits are positive safe integers. Requests above a configured limit fail with `RESOURCE_LIMIT_EXCEEDED`; they are never silently truncated. These defaults support large repositories while bounding a single directory, operation, page, queue, and retained cache independently. The cache also retains at most 4,096 nonempty pages, so very small or empty range requests cannot grow its metadata without a separate bound.

The release-5 resource corpus exercises the reader through the real CLI against small, medium, 1,024-file, large-Unicode, binary, broad-relationship, and diagnostic-heavy repositories. The unchanged defaults preserve substantial cumulative headroom for ordinary workloads. Boundary tests independently prove explicit failure for every dimension, so the table describes machine-safety limits rather than a repository-size recommendation.

## Selection, cursors, and coherence

Paths preserve exact UTF-8 spelling and case. `.git` is excluded during recursive traversal, while similarly named entries remain visible. Stable descendant symlinks and junctions are metadata entries and are not traversed.

Directory cursors retain bounded traversal frames with the last consumed name and verified directory identities. Exact-path cursors continue from the last returned logical path. Both are versioned, HMAC-authenticated, tied to the reader snapshot and prefix, and limited to 64 KiB encoded. A cursor never contains file bodies.

The reader observes filesystem identity before returning metadata or bytes. It rechecks the selected root and path ancestors during access, so a root or directory replaced by a symlink fails with `SNAPSHOT_CHANGED`. Reobserving a changed path also fails with `SNAPSHOT_CHANGED`. File reads open without following the final symlink where the runtime supports it, verify identity before and after the bounded range, and cache complete verified pages in an LRU bounded by `maxCachedBytes`. As with other path-based filesystem APIs, concurrent hostile replacement between checks and opens remains outside this reader's containment guarantee; callers must use a repository tree they trust against adversarial mutation during inspection.

## Runtime support

The package supports Node.js `>=22.17.0` and is not browser-compatible.

## Development

From the monorepo root:

```bash
pnpm --filter @moldea.ai/repository-fs typecheck
pnpm --filter @moldea.ai/repository-fs build
pnpm --filter @moldea.ai/repository-fs test:unit
pnpm --filter @moldea.ai/repository-fs test:integration
pnpm --filter @moldea.ai/repository-fs test
```

Unit and integration tests cover resource ceilings, cursor integrity, snapshot drift, symlink boundaries, cancellation, cache eviction, cross-platform path behavior, and the shared repository reader and link-resolver conformance contracts. Link tests use real file links, directory links, and Windows junctions, and check every result against the file the operating system opens through the link. Real 256-, 1,024-, and 4,096-file cases also verify selected-parent and traversal-frame scan reuse without per-child directory scans.

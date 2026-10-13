![moldea](cover.png)

# `@moldea.ai/repository`

Source-neutral, read-only, resource-bounded repository contracts for the `moldea` ecosystem.

Version 2 represents one coherent repository snapshot without assuming a filesystem, Git host, archive, or network protocol. Every collection, comparison, and file read is paged or ranged. Continuation cursors are opaque, integrity-protected, and bound to the source snapshot and request scope.

## Install

```bash
pnpm add @moldea.ai/repository@2
```

## Logical paths

Repository paths are root-absolute inside a logical snapshot, not host paths or URLs:

```typescript
import { REPOSITORY_ROOT, isRepositoryPath, parseRepositoryPath } from '@moldea.ai/repository';

const manifestPath = parseRepositoryPath('/moldea/moldea.yaml');

isRepositoryPath(manifestPath); // true
REPOSITORY_ROOT; // '/'
```

Paths preserve exact case and Unicode. Parsing rejects relative paths, dot segments, control characters, backslashes, drive letters, URLs, trailing separators, and unpaired surrogates. The package performs no Unicode normalization or URL decoding.

## Reader contract

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

An `IRepositoryReader` exposes:

- `snapshot`: immutable source identity shared by every result.
- `getEntry(path)`: exact metadata lookup without content or symlink traversal.
- `listEntriesPage(options)`: deterministic bounded descendant pages.
- `readFilePage(path, options)`: one bounded regular-file byte range.
- `compare(candidate)`: bounded deterministic change pages between snapshots.

Entries include `byteLength` and `contentIdentity` for regular files. Callers must treat cursors as opaque and continue with the same reader, prefix, and operation. Every operation supports cancellation.

Malformed paths use `RepositoryPathException`. Invalid page requests and source, resource, cancellation, or snapshot failures use `RepositorySourceException`.

## Immutable memory reader

The `memory` subpath is the reference implementation for fixtures and already-fetched content:

```typescript
import { parseRepositoryPath } from '@moldea.ai/repository';
import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';

const reader = createMemoryRepositoryReader([
  { path: '/moldea/moldea.yaml', type: 'file', content: 'version: 1\n' },
  { path: '/empty-directory', type: 'directory' },
  { path: '/link', type: 'symlink' },
]);

const page = await reader.readFilePage(parseRepositoryPath('/moldea/moldea.yaml'), {
  maxBytes: 4096,
  offset: 0,
});
```

Construction validates the input, copies buffers, synthesizes missing parent directories, and derives the snapshot identity incrementally. Listing uses a keyset cursor, and comparison retains only bounded page state and unconsumed lookahead.

## Shared reader conformance

Official source implementations use the `testing` subpath to register the same version 2 contract checks. Compatible Vitest and `web-utils-kit` peers are required only when importing this entry point.

```typescript
import {
  describeRepositoryReaderConformance,
  type IRepositoryReaderConformanceFixture,
} from '@moldea.ai/repository/testing';

export const registerReaderConformance = <TPath extends string>(
  fixture: IRepositoryReaderConformanceFixture<TPath>,
): void => {
  describeRepositoryReaderConformance('provider', fixture);
};
```

## Development

From the monorepo root:

```bash
pnpm --filter @moldea.ai/repository typecheck
pnpm --filter @moldea.ai/repository build
pnpm --filter @moldea.ai/repository test:unit
pnpm --filter @moldea.ai/repository test:integration
pnpm --filter @moldea.ai/repository test
```

Repository-format interpretation belongs to `@moldea.ai/core`. Source access belongs to concrete reader packages.

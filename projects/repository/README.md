![moldea](cover.png)

# `@moldea.ai/repository`

Source-neutral, read-only, resource-bounded repository contracts for the `moldea` ecosystem.

Version 3 represents one coherent repository snapshot without assuming a filesystem, Git host, archive, or network protocol. Every collection, comparison, and file read is paged or ranged. Continuation cursors are opaque, integrity-protected, and bound to the source snapshot and request scope.

## Install

```bash
pnpm add @moldea.ai/repository@3
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
- `readLinkText(path)`: the exact text stored for one symlink.
- `compare(candidate)`: bounded deterministic change pages between snapshots.

Entries include `byteLength` and `contentIdentity` for regular files. Callers must treat cursors as opaque and continue with the same reader, prefix, and operation. Every operation supports cancellation.

Malformed paths use `RepositoryPathException`. Invalid page requests and source, resource, cancellation, or snapshot failures use `RepositorySourceException`.

## Links

Reader operations never follow symlinks. `readLinkText(path)` returns a symlink's stored text, and `resolveRepositoryLink` follows links inside one snapshot with only `getEntry` and `readLinkText`:

```typescript
import {
  parseRepositoryPath,
  resolveRepositoryLink,
  type IRepositoryReader,
} from '@moldea.ai/repository';

export const isLinkedFile = async (reader: IRepositoryReader): Promise<boolean> => {
  const resolution = await resolveRepositoryLink(reader, parseRepositoryPath('/AGENTS.md'));

  return resolution.state === 'file';
};
```

A `file` result carries the final logical `targetPath`. Otherwise the state is `outside`, `missing`, `loop`, `not-file`, or `unsupported`. Link text is never read from outside the snapshot or returned in a result.

## Immutable memory reader

The `memory` subpath is the reference implementation for fixtures and already-fetched content:

```typescript
import { parseRepositoryPath } from '@moldea.ai/repository';
import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';

const reader = createMemoryRepositoryReader([
  { path: '/moldea/moldea.yaml', type: 'file', content: 'version: 1\n' },
  { path: '/empty-directory', type: 'directory' },
  { path: '/link', target: 'moldea/moldea.yaml', type: 'symlink' },
]);

const page = await reader.readFilePage(parseRepositoryPath('/moldea/moldea.yaml'), {
  maxBytes: 4096,
  offset: 0,
});
```

Construction validates the input, copies buffers, synthesizes missing parent directories, and derives the snapshot identity incrementally. Listing uses a keyset cursor, and comparison retains only bounded page state and unconsumed lookahead.

## Shared reader conformance

Official source implementations use the `testing` subpath to register the same version 3 contract checks. The suite registers its checks with the `describe`, `test`, and `expect` functions you pass, such as Vitest's, so the package imports no test runner and has no peer dependencies.

```typescript
import {
  describeRepositoryReaderConformance,
  type IRepositoryReaderConformanceFixture,
} from '@moldea.ai/repository/testing';
import { describe, expect, test } from 'vitest';

export const registerReaderConformance = <TPath extends string>(
  fixture: IRepositoryReaderConformanceFixture<TPath>,
): void => {
  describeRepositoryReaderConformance({ describe, expect, test }, 'provider', fixture);
};
```

The runner's type, `IRepositoryReaderConformanceRunner`, names only the calls the suite makes, so any runner whose `expect` offers `toBe`, `toBeGreaterThan`, `toMatchObject`, `toStrictEqual`, `not.toBe`, and the matching `resolves` assertions fits.

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

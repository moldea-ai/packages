---
title: Link resolution
description: The optional capability that follows explicitly named symlinks without exposing host paths.
order: 25
---

# Link resolution

Reader operations never follow symlinks. `IRepositoryLinkResolver` is an optional capability a concrete source may offer beside a reader. It is bound to one reader, exposes that reader's `snapshot`, and follows only the symlink entries a caller names. Sources without one, such as the memory reader and hosted providers, offer none; a missing resolver means "cannot verify", not "not linked".

```typescript
import { parseRepositoryPath, type IRepositoryLinkResolver } from '@moldea.ai/repository';

export const readLinkedText = async (
  resolver: IRepositoryLinkResolver,
): Promise<Uint8Array | null> => {
  const path = parseRepositoryPath('/AGENTS.md');
  const resolution = await resolver.resolveLink(path);

  if (resolution.state !== 'inside' && resolution.state !== 'outside') {
    return null;
  }

  if (resolution.targetType !== 'file') {
    return null;
  }

  const page = await resolver.readLinkTargetPage(path, { maxBytes: 64 * 1024, offset: 0 });

  return page.bytes;
};
```

## Resolutions

| `state`    | Meaning                                                                                              | Fields                                       |
| ---------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `not-link` | The entry exists and is not a symlink                                                                | none                                         |
| `inside`   | The final target lies beneath the repository root                                                    | `targetPath`, `targetType`, `targetIdentity` |
| `outside`  | The final target lies outside the repository root                                                    | `targetType`, `targetIdentity`               |
| `broken`   | A link in the chain names a missing entry                                                            | none                                         |
| `loop`     | The chain repeats or exceeds the source's hop limit                                                  | none                                         |
| `denied`   | Access to a link or the target was denied                                                            | none                                         |
| `unsafe`   | The source refuses the chain, for example a network location or a target without a safe logical path | none                                         |

`targetType` is `file`, `directory`, or `other`. `targetIdentity` is an opaque string, equal for two resolutions from the same resolver exactly when they reach the same final target. It reveals nothing about the target and is meaningless across resolvers, readers, or runs. Use it to recognize two links to one target, never to identify a file.

## Reads and failures

`readLinkTargetPage(path, options)` returns one bounded byte range of the regular file the link resolves to, with the same options, page shape, and bounds as `readFilePage`. A link that does not resolve to a regular file fails with `ENTRY_NOT_FILE`, and a chain or target that changed since resolution fails with `SNAPSHOT_CHANGED`. An absent path fails with `ENTRY_NOT_FOUND`.

Link states are result values. Failures reuse the existing `RepositorySourceException` codes and the `get-entry` and `read-file-page` operation identifiers. Results and exceptions never contain host paths, link text, or outside paths.

## Conformance

Sources that offer a resolver register `describeRepositoryLinkResolverConformance` from `@moldea.ai/repository/testing` with real prepared links. The suite covers inside, outside, multi-hop, directory, other, broken, looping, denied, and refused targets, parent segments after a directory link, comparable identities, bounded reads, cancellation, target and root replacement, and the absence of host paths from every result and exception.

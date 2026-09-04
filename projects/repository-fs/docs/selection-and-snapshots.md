---
title: Selection and snapshots
description: Exact-path and directory selection, lazy observations, symlinks, and cursor-bound coherence.
order: 10
---

# Selection and snapshots

Reader creation requires an absolute `rootDirectory` and an explicit selection strategy.

```typescript
import { parseRepositoryPath } from '@moldea.ai/repository';
import { createFilesystemRepositoryReader } from '@moldea.ai/repository-fs';

const reader = await createFilesystemRepositoryReader({
  rootDirectory: '/absolute/path/to/repository',
  selection: {
    kind: 'paths',
    paths: [parseRepositoryPath('/moldea/moldea.yaml')],
  },
});
```

## Exact-path selection

Exact selection validates the requested entries and directory parents needed to represent them. Input order has no meaning. `/`, duplicates, missing paths, invalid parent types, and unsupported entry types fail creation. Listing uses a keyset cursor based on the last returned logical path rather than a positional offset.

## Directory selection

Directory selection defers traversal until `listEntriesPage`. Each visited directory is streamed with a hard `maxDirectoryEntries` ceiling, then its retained names are sorted for deterministic output. A name exactly equal to `.git` is omitted; `.GIT`, `.gitignore`, `.gitattributes`, and `.github` remain visible.

The continuation cursor contains versioned traversal frames with the last consumed name and directory identities. Restoring a cursor reobserves those directories and rejects changed identity or membership with `SNAPSHOT_CHANGED`. Cursor state is HMAC-authenticated, snapshot-bound, prefix-bound, and capped at 64 KiB.

## Symlinks and redirection

The selected root may itself resolve through a symlink or junction; its resolved target becomes the fixed boundary. Descendant symlinks and junctions remain logical symlink entries and are never traversed. Regular-file range reads revalidate the private observed stat identity and use no-follow opening where the runtime supports it. Entry metadata leaves `contentIdentity` null because stat identity cannot prove portable byte equality; comparisons use bounded file ranges instead.

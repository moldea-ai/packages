---
title: Logical paths and entries
navigationTitle: Paths and entries
description: Portable path grammar and content-free repository metadata.
order: 10
---

# Logical paths and entries

Repository paths are absolute inside one logical snapshot. `/` is the root, and `/moldea/moldea.yaml` identifies one exact entry. These values are neither host paths nor URLs.

```typescript
import { REPOSITORY_ROOT, isRepositoryPath, parseRepositoryPath } from '@moldea.ai/repository';

const manifestPath = parseRepositoryPath('/moldea/moldea.yaml');

isRepositoryPath(manifestPath); // true
REPOSITORY_ROOT; // '/'
```

Parsing rejects empty, relative, dot-segment, trailing-separator, control-character, backslash, drive-letter, URL, and unpaired-surrogate forms. Paths preserve exact case and Unicode scalar values without normalization, case folding, percent decoding, or host-path conversion.

## Entry metadata

`IRepositoryEntry` classifies a path as `file`, `directory`, or `symlink`. Regular-file metadata includes its byte length and a source-defined content identity. Directories and symlinks use `null` for both fields.

Metadata is content-free. It does not include host paths, permissions, timestamps, inode identities, symlink targets, or file bodies. Symlinks remain entries and are never transparent redirections through the common contract.

## Exact bytes

`readFilePage` returns a fresh, caller-owned `Uint8Array` for one bounded range. A caller continues with `nextOffset` until `isComplete` is true. The repository package does not decode or normalize bytes; text interpretation belongs to Core.

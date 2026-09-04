---
title: In-memory reader
description: Immutable bounded access for deterministic fixtures and already-fetched repository content.
order: 30
---

# In-memory reader

The `memory` entry point is the reference implementation for deterministic fixtures and repository content a caller has already fetched.

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

Construction validates the complete input, copies file buffers, and synthesizes missing parent directories. Conflicting paths, invalid entry shapes, impossible hierarchies, and duplicate definitions fail atomically with `INVALID_SOURCE_DATA`.

Snapshot identity is hashed incrementally, so identity construction does not retain a second encoded copy of the repository. The immutable reader stores one ordered entry index, returns detached metadata and byte ranges, and never observes later caller mutations.

Descendant listing uses keyset continuation by the last returned logical path. Repository comparison holds only bounded pages plus unconsumed lookahead, which prevents repeated enumeration when the compared sources have very different sizes or path distributions.

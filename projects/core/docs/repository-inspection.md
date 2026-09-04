---
title: Repository validation and inspection
description: Cheap relationship matching, content-free project output, explicit content ranges, and trust boundaries.
order: 20
---

# Repository validation and inspection

## Changed-path preactivation

Use `matchManifestScope` when a caller needs to decide whether known changed paths intersect declared `moldea` relationships.

```typescript
import { createCore } from '@moldea.ai/core';
import { parseRepositoryPath } from '@moldea.ai/repository';

const result = await createCore().matchManifestScope({
  manifest: {
    content: 'version: 1\n',
    path: parseRepositoryPath('/moldea/moldea.yaml'),
  },
  paths: ['/packages/orders/src/service.ts'],
});
```

Core reads only the supplied manifest, validates and deduplicates repository-logical paths, indexes exact targets, and compiles supported globs once. The result contains stable ownership and match metadata. Empty changes and manifests without relationships return valid non-relevant results. Invalid manifests return structural diagnostics and cannot establish relevance.

This operation creates no repository reader, reads no canonical body beyond the supplied manifest, and invokes no runtime adapter.

## Content-free validation

`validateProject` validates one coherent `IRepositoryReader` snapshot and returns no canonical document body.

```typescript
import { createCore } from '@moldea.ai/core';
import type { IRepositoryReader } from '@moldea.ai/repository';

export const validate = async (repository: IRepositoryReader) => {
  return createCore().validateProject({ repository });
};
```

The result contains source identity, validity, format version, summary counts and digests, diagnostics, and runtime evidence. Core internally composes canonical discovery, project and context validation, decision graphs, registered-agent assets, mirrors, references, relationships, and configured adapters through one budget-aware reader session.

Structural repository errors return diagnostics. Reader access failures, snapshot drift, cancellation, resource exhaustion, invalid operation input, and invalid adapter output reject with typed exceptions.

## Bounded inspection views

`inspectProjectPage` reruns deterministic validation for the supplied snapshot and projects one bounded content-free view:

- `metadata`: canonical paths, kinds, sizes, digests, and agent or decision identity
- `diagnostics`: structural diagnostics
- `evidence`: validated runtime evidence
- `all`: all three item kinds in deterministic order

The caller supplies `maxItems` and an optional opaque semantic cursor. Cursors bind progress to the inspection digest and selected view, so a cursor cannot resume another project state or output shape.

## Explicit canonical content

`readCanonicalContentPage` is the only project-level Core operation that returns canonical text. It requires an explicit `/moldea/**` file path, byte offset, and `maxBytes`. It returns no more than the requested limit and adjusts the end boundary so a UTF-8 scalar is never split.

Callers should request canonical content only after a concrete task requires that exact file. Default validation and inspection must remain content-free.

## Security and source neutrality

Core treats repository bytes as untrusted, executes no repository code, follows no symlink, receives no host path or source credential, and performs no network access. Results use logical paths and bounded data only.

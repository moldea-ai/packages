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

`createProjectInspection` validates the supplied snapshot once and prepares one immutable content-free record set with these views:

- `metadata`: one canonical agent-to-runtime assignment per agent plus canonical asset paths, kinds, sizes, digests, and agent or decision identity
- `diagnostics`: structural diagnostics
- `evidence`: validated runtime evidence
- `all`: every assignment, metadata, diagnostic, and evidence item in deterministic order

Each `agent` item contains exactly the canonical `agentId` and manifest-declared `runtimeId`. It does not contain a path, body, digest, relationship, adapter result, or runtime-publication claim. The aggregate `agents` count describes the complete canonical agent collection, while `metadata` continues to count asset-metadata items only. Page totals include every record in the selected view.

The returned inspection exposes synchronous `readPage({ view, maxItems, cursor? })` calls. Those page reads perform no repository access, validation, adapter execution, sorting, or digesting. Cursors bind progress to the inspection digest and selected view, so a cursor cannot resume another project state or output shape. Agent assignments participate in that digest, which invalidates continuation when a declared runtime changes.

Canonical bodies exist only while the initial validation is being prepared. The returned inspection retains content-free records and indexes only. Its deterministic resource report distinguishes source bytes read, canonical bytes processed, prepared bytes retained after validation, and peak logical retained bytes. Construction fails before exceeding `maxRetainedBytes`; paging remains bounded by `maxItems` and the Core entry limit.

Resource refusals expose the exceeded limit name, configured maximum, observed or projected usage, and the stable `reduce-input-or-increase-limit` next action. Callers can therefore explain a refusal without receiving canonical content or implementation diagnostics.

## Explicit canonical content

`readCanonicalContentPage` is the only project-level Core operation that returns canonical text. It requires an explicit `/moldea/**` file path, byte offset, and `maxBytes`. It returns no more than the requested limit and adjusts the end boundary so a UTF-8 scalar is never split.

Callers should request canonical content only after a concrete task requires that exact file. Default validation and inspection must remain content-free.

## Security and source neutrality

Core treats repository bytes as untrusted, executes no repository code, follows no symlink, receives no host path or source credential, and performs no network access. Results use logical paths and bounded data only.

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

Required `runtimeInspection` distinguishes `complete` checks, `incomplete` checks with scoped unverified-relationship warnings, and `not-run` checks blocked by universal errors or unavailable adapters. Validity still means zero errors. A project with no applicable runtime relationships is complete; business readiness remains a separate decision.

The `unresolved` summary count includes all project-owned and agent-owned requirements, across every effect. Identical IDs under different owners count separately. Validation and every inspection page report the same complete total. Requirements describe readiness gaps; even blocking requirements do not invalidate a structurally valid project.

Structural repository errors return error diagnostics. Adapters may return scoped warnings for unverified declared runtime relationships without invalidating an otherwise valid project. Reader access failures, snapshot drift, cancellation, resource exhaustion, invalid operation input, and invalid adapter output reject with typed exceptions.

## Resource limits

These defaults describe Core `6.0.0`. They apply independently to each Core operation.

| Limit               |                     Default | Counted scope                                                                                                           |
| ------------------- | --------------------------: | ----------------------------------------------------------------------------------------------------------------------- |
| `maxFileBytes`      |     8 MiB (`8388608` bytes) | One complete file read, including runtime source requested by an adapter                                                |
| `maxManifestBytes`  |     2 MiB (`2097152` bytes) | The canonical manifest read                                                                                             |
| `maxEntries`        |                    `100000` | Distinct non-root logical paths encountered or requested during the operation, including absent lookups and directories |
| `maxTotalBytesRead` | 128 MiB (`134217728` bytes) | Source bytes read through the shared operation session, including adapter reads                                         |
| `maxDiagnostics`    |                     `10000` | Diagnostics produced by the operation                                                                                   |
| `maxEvidence`       |                     `10000` | Runtime evidence records produced by the operation                                                                      |
| `maxRetainedBytes`  | 512 MiB (`536870912` bytes) | Logical retained-byte accounting, including prepared records and indexes                                                |

Repeated path observations do not increment the distinct-path count. A file’s presence alone does not consume its complete-file read allowance. The manifest has its own smaller ceiling. Metadata pages and canonical text chunks bound individual responses; continuation does not reset operation budgets or turn full source parsing into streaming analysis.

Callers can supply validated Core limits. These are accounting controls, not a sum or guarantee of total process RAM. The isolated Node boundary reserves 48 MiB of the retained-byte allowance for transport before granting the remainder to Core. The CLI derives its allowance separately; see [CLI resource budgets](/packages/cli/output-and-operations/#resource-budgets).

## Bounded inspection views

`createProjectInspection` validates the supplied snapshot once and prepares one immutable content-free record set with these views:

- `metadata`: one canonical agent-to-runtime assignment per agent plus canonical asset paths, kinds, sizes, digests, and agent or decision identity
- `diagnostics`: structural and adapter diagnostics with required severity
- `evidence`: validated runtime evidence
- `all`: every assignment, metadata, diagnostic, and evidence item in deterministic order

Each `agent` item contains exactly the canonical `agentId` and manifest-declared `runtimeId`. It does not contain a path, body, digest, relationship, adapter result, or runtime-publication claim. The aggregate `agents` count describes the complete canonical agent collection, while `metadata` continues to count asset-metadata items only. Page totals include every record in the selected view.

The returned inspection exposes synchronous `readPage({ view, maxItems, cursor? })` calls. Those page reads perform no repository access, validation, adapter execution, sorting, or digesting. Cursors bind progress to the inspection digest and selected view, so a cursor cannot resume another project state or output shape. Agent assignments participate in that digest, which invalidates continuation when a declared runtime changes.

Every inspection and page carries the complete `runtimeInspection` value, including an empty or filtered view. The status participates in prepared-memory accounting and the `core6-prepared-inspection` identity. Current cursors use the `core6` domain; cursors from another inspection generation are rejected.

Canonical bodies exist only while the initial validation is being prepared. The returned inspection retains content-free records and indexes only. Its deterministic resource report distinguishes source bytes read, canonical bytes processed, prepared bytes retained after validation, and peak logical retained bytes. Construction fails before exceeding `maxRetainedBytes`; paging remains bounded by `maxItems` and the Core entry limit.

Resource refusals expose the exceeded limit name, configured maximum, observed or projected usage, and the stable `reduce-input-or-increase-limit` next action. Callers can therefore explain a refusal without receiving canonical content or implementation diagnostics.

## Isolated Node inspection

The fixed Core `6.0.0` Node profile is independent of configurable input limits:

| Control                 | Fixed value | Scope                                               |
| ----------------------- | ----------: | --------------------------------------------------- |
| Worker old generation   |     512 MiB | V8 worker setting, not total process RSS            |
| Worker young generation |      24 MiB | V8 worker setting                                   |
| Attempt lifetime        | 120 seconds | Startup, reads, preparation, paging, and disposal   |
| Reader requests         |           4 | Outstanding bridge requests                         |
| File page               |      64 KiB | One bridge file page                                |
| Message                 |       1 MiB | One serialized bridge message                       |
| Captured standard I/O   |      32 KiB | Bounded subprocess output                           |
| Transport reservation   |      48 MiB | Logical allowance for simultaneous transport copies |

The startup-reported `maxAnalysisHeapBytes` is the actual V8 maximum. Increasing input limits does not change these fixed controls. An 8 MiB source allowance does not guarantee that every source shape fits the analysis heap.

`createNodeProjectInspection` from `@moldea.ai/core/node` runs Core and trusted installed adapters in one analysis worker inside one supervised subprocess. The existing environment-neutral operations and synchronous prepared-inspection API remain available.

The caller supplies an immutable `IRepositoryReader` and a `file:` URL for a compiled installed registry exporting `adapters`. Resolve that URL from trusted installed code. Repository declarations must never select executable modules. Authentication, provider calls, quotas, accounting, and the real reader stay in the parent. The bridge exposes only entry lookup, entry listing, and file pages, with four outstanding requests, 64 KiB file pages, and 1 MiB messages. It inherits no Node flags, preloads, inspector configuration, or credentials.

The returned handle contains the existing content-free metadata, actual adapter IDs and supported formats, and the startup-reported `maxAnalysisHeapBytes`. `readPage` is asynchronous and may return fewer records than requested to fit the transport bound. Counts, order, digests, and continuation semantics are preserved. A single oversized record fails explicitly. Dispose the handle in `finally` before publishing success or beginning source post-checks. Disposal waits for actual reader work and IPC deliveries, then releases its reader reference. Retaining disposed metadata handles does not retain their input repositories.

```typescript
import { createNodeProjectInspection } from '@moldea.ai/core/node';

const inspection = await createNodeProjectInspection({
  repository,
  adapterRegistryUrl: new URL('./adapter-registry.js', import.meta.url),
  signal,
});
try {
  const page = await inspection.readPage({ view: 'all', maxItems: 128 });
  // Consume this content-free page and follow its continuation when needed.
} finally {
  await inspection.dispose();
}
```

One installed Core owner admits one inspection at a time and rejects overlap with `INSPECTION_BUSY`. The fixed 120-second lifetime includes startup, reads, preparation, paging, and disposal. A caller may supply an earlier absolute Unix-millisecond `deadline` or cancellation signal. Cancellation reaches each real reader call. Cleanup awaits subprocess closure and actual reader settlement before releasing admission; reader implementations remain responsible for settling their work after cancellation. Disposal is idempotent and surfaces a terminal failure rather than allowing a late success.

Logical retained-byte accounting reserves 48 MiB for simultaneous transport copies, including UTF-16 storage, before granting Core its remaining budget. File and total-read budgets remain unchanged. This ledger and the worker heap limit are separate from total process RSS. Verified worker heap exhaustion reports the actual V8 maximum with unknown usage; a timeout or unexplained process exit does not establish capacity exhaustion. Fixed bridge limits have no limit-raising next action. No parser file-size cutoff or heap-tuning option is exposed.

## Explicit canonical content

`readCanonicalContentPage` is the only project-level Core operation that returns canonical text. It requires an explicit `/moldea/**` file path, byte offset, and `maxBytes`. It returns no more than the requested limit and adjusts the end boundary so a UTF-8 scalar is never split.

Callers should request canonical content only after a concrete task requires that exact file. Default validation and inspection must remain content-free.

## Security and source neutrality

Core treats repository bytes as untrusted, executes no repository code, follows no symlink, receives no host path or source credential, and performs no network access. Results use logical paths and bounded data only.

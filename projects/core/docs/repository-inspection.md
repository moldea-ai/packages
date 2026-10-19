---
title: Repository validation and inspection
description: Cheap relationship matching, content-free project output, explicit content ranges, and trust boundaries.
order: 20
---

# Repository validation and inspection

## Changed-path preactivation

Use `matchManifestScope` when a caller needs to decide whether known changed paths intersect declared `moldea` relationships.

```typescript
import { matchManifestScope } from '@moldea.ai/core/scope';
import { parseRepositoryPath } from '@moldea.ai/repository';

const result = await matchManifestScope({
  manifest: {
    content: 'version: 1\n',
    path: parseRepositoryPath('/moldea/moldea.yaml'),
  },
  paths: ['/packages/orders/src/service.ts'],
});
```

Core reads only the supplied manifest, validates and deduplicates repository-logical paths, indexes exact targets, and compiles supported globs once. The result contains stable ownership and match metadata. Empty changes and manifests without relationships return valid non-relevant results. Invalid manifests return structural diagnostics and cannot establish relevance.

This operation creates no repository reader, reads no canonical body beyond the supplied manifest, and loads no TypeScript.

## Content-free validation

`validateProject` validates one coherent `IRepositoryReader` snapshot and returns no canonical document body.

```typescript
import { createCore } from '@moldea.ai/core';
import type { IRepositoryReader } from '@moldea.ai/repository';

export const validate = async (repository: IRepositoryReader) => {
  return createCore().validateProject({ repository });
};
```

The result contains source identity, validity, format version, summary counts and digests, diagnostics, binding coverage, and `coverageCounts`. Core internally composes canonical discovery, project and context validation, decision graphs, registered-agent assets, mirrors, references, relationships, syntax-only export inventories, and coding-agent integration checks through one budget-aware reader session.

Coverage reports the actual file and export checks performed. It does not establish runtime wiring or SDK compatibility. Validity means zero errors; business readiness remains a separate decision. Explicit manifest acceptances retain warning findings and reasons, count them as `acceptedWarnings`, and exclude them from unaccepted `warnings`. See [diagnostics](/packages/core/diagnostics/).

The `unresolved` summary count includes all project-owned and agent-owned requirements, across every effect. Identical IDs under different owners count separately. Validation and every inspection page report the same complete total. Requirements describe readiness gaps; even blocking requirements do not invalidate a structurally valid project.

Structural repository errors and proven missing runtime exports return error diagnostics. A declared source too large for a bounded syntax check produces `not-checked` coverage with reason `resource-limit` without reading that source. Reader access failures, inconsistent entry and source sizes, snapshot drift, cancellation, resource exhaustion outside this optional check, and invalid operation input reject the complete operation with typed exceptions. No partial coverage is returned.

## Coding-agent integration

After required repository checks, validation and inspection read `/AGENTS.md`. One complete, ordered `<!-- moldea:start -->` and `<!-- moldea:end -->` region must contain the fixed relevance-gate command. `parseIntegrationBlock(text)`, exported from the main entry, returns `{ kind: 'found', skillPath }` or `{ kind: 'missing', reason }`. The relative installation path allows only `^[A-Za-z0-9._/-]+$` and rejects empty, absolute, and traversal segments.

The installation's `SKILL.md` and `scripts/relevance-gate.mjs` must be regular files. Core reads `assets/managed-agents-block.md`, substitutes `{{skill-path}}`, renders the document's LF or CRLF line ending, and compares the complete managed region including its markers. Missing or non-regular files and drift produce `integration` warnings, with subject `/AGENTS.md` and qualifier `null`. The five integration warning codes may be accepted with a manifest reason. See [diagnostics](/packages/core/diagnostics/).

### Instruction source and linked files

`validateProject`, `createProjectInspection`, and `createNodeProjectInspection` accept an optional `instructions` source `{ reader, linkResolver? }` beside `repository`:

```typescript
import { createCore } from '@moldea.ai/core';
import type { IRepositoryLinkResolver, IRepositoryReader } from '@moldea.ai/repository';

export const validateWithInstructions = async (
  repository: IRepositoryReader,
  reader: IRepositoryReader,
  linkResolver: IRepositoryLinkResolver,
) => createCore().validateProject({ instructions: { linkResolver, reader }, repository });
```

The instruction reader holds only `/AGENTS.md`, `/CLAUDE.md`, `/.claude/CLAUDE.md`, and `/CLAUDE.local.md`, and only the integration check reads it. The referenced skill files, the managed asset, and every other check read `repository`, so files the instruction source adds never reach reference checks, pattern matching, discovery, coverage, or the inventory. A resolver whose snapshot differs from the instruction reader's is `INVALID_ARGUMENT`.

A symlinked `/AGENTS.md` whose final target is a readable regular file, inside or outside the repository, gets every integration check on the target text, still reported against `/AGENTS.md`. Any other link, and any link without a resolver, is `MOLDEA_INTEGRATION_UNVERIFIED`. Diagnostics carry the link state only, never document text, link text, or outside paths.

### Claude Code instructions

Core also checks whether Claude Code loads AGENTS.md. When `/CLAUDE.md` or `/.claude/CLAUDE.md` exists, only those shared files count; `/CLAUDE.local.md` counts only when neither exists, and no Claude file means no Claude warning. A file loads AGENTS.md when:

- one line outside fenced code blocks, trimmed of surrounding spaces and tabs, is exactly `@AGENTS.md` or `@./AGENTS.md`, or `@../AGENTS.md` in `/.claude/CLAUDE.md`;
- it is a link whose final target is AGENTS.md's final target, compared by logical path or by the resolver's opaque target identity; or
- AGENTS.md is a link resolving to it.

A linked Claude file with a regular-file target is checked for an import line as if it were at the link's own location. When no counted file loads AGENTS.md, Core reports `MOLDEA_INTEGRATION_UNVERIFIED` for an unverifiable counted file, otherwise `MOLDEA_INTEGRATION_CLAUDE_IMPORT_MISSING` for `/CLAUDE.md` when it exists, else `/.claude/CLAUDE.md`, or `/CLAUDE.local.md` when only it counts. Validation reports at most one Claude warning, and either code may be accepted with a manifest reason.

The complete check performs at most six entry lookups, four link resolutions, and five bounded file reads, each limited by `maxFileBytes`. Source bytes, decoded text, and rendering copies are reserved through the operation ledger; only comparison diagnostics survive preparation. No cache is needed because each snapshot is checked once. Access failures, cancellation, snapshot drift, and resource exhaustion reject the whole operation. Manifest-only operations and the standalone scope entry never read this integration.

## Resource limits

These defaults describe Core 7. They apply independently to each Core operation.

| Limit                 |                     Default | Counted scope                                                                                                           |
| --------------------- | --------------------------: | ----------------------------------------------------------------------------------------------------------------------- |
| `maxFileBytes`        |     8 MiB (`8388608` bytes) | One complete file read, including declared source files                                                                 |
| `maxManifestBytes`    |     2 MiB (`2097152` bytes) | The canonical manifest read                                                                                             |
| `maxEntries`          |                    `100000` | Distinct non-root logical paths encountered or requested during the operation, including absent lookups and directories |
| `maxTotalBytesRead`   | 128 MiB (`134217728` bytes) | Source bytes read through the shared operation session, including source export checks                                  |
| `maxDiagnostics`      |                     `10000` | Diagnostics produced by the operation                                                                                   |
| `maxAcceptedWarnings` |                       `256` | Manifest warning acceptance entries                                                                                     |
| `maxCoverage`         |                     `10000` | Binding coverage records produced by the operation                                                                      |
| `maxRetainedBytes`    | 512 MiB (`536870912` bytes) | Logical retained-byte accounting, including prepared records and indexes                                                |

Repeated path observations do not increment the distinct-path count. A file’s presence alone does not consume its complete-file read allowance. The manifest has its own smaller ceiling. Metadata pages and canonical text chunks bound individual responses; continuation does not reset operation budgets or turn full source parsing into streaming analysis.

Callers can supply validated Core limits. These are accounting controls, not a sum or guarantee of total process RAM. The isolated Node boundary reserves 48 MiB of the retained-byte allowance for transport before granting the remainder to Core. The CLI derives its allowance separately; see [CLI resource budgets](/packages/cli/output-and-operations/#resource-budgets).

## Bounded inspection views

`createProjectInspection` validates the supplied snapshot once and prepares one immutable content-free record set with these views:

- `metadata`: one canonical agent-to-runtime assignment per agent plus canonical asset paths, kinds, sizes, digests, and agent or decision identity
- `diagnostics`: Core diagnostics with severity, group, and warning acceptance metadata
- `coverage`: file and syntax-only export check records
- `all`: every assignment, metadata, diagnostic, and coverage item in deterministic order

Each `agent` item contains exactly the canonical `agentId` and manifest-declared `runtimeId`. It does not contain a path, body, digest, relationship, execution result, or runtime-publication claim. The aggregate `agents` count describes the complete canonical agent collection, while `metadata` continues to count asset-metadata items only. Page totals include every record in the selected view.

The returned inspection exposes synchronous `readPage({ view, maxItems, cursor? })` calls. Those page reads perform no repository access, validation, source analysis, sorting, or digesting. Cursors bind progress to the inspection digest and selected view, so a cursor cannot resume another project state or output shape. Agent assignments participate in that digest, which invalidates continuation when a declared runtime changes.

Every inspection and page carries aggregate `coverageCounts`: `bindings`, `exportsPassed`, `exportsFailed`, and `exportsNotChecked`. The counts participate in prepared-memory accounting and the `core7-prepared-inspection` identity. Current cursors use the `core7` domain; cursors from another inspection generation are rejected.

Canonical bodies exist only while the initial validation is being prepared. The returned inspection retains content-free records and indexes only. Its deterministic resource report distinguishes source bytes read, canonical bytes processed, prepared bytes retained after validation, and peak logical retained bytes. Construction fails before exceeding `maxRetainedBytes`; paging remains bounded by `maxItems` and the Core entry limit.

Resource refusals expose the exceeded limit name, configured maximum, observed or projected usage, and the stable `reduce-input-or-increase-limit` next action. Callers can therefore explain a refusal without receiving canonical content or implementation diagnostics.

## Isolated Node inspection

The fixed Core 7 Node profile is independent of configurable input limits:

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

`createNodeProjectInspection` from `@moldea.ai/core/node` runs fixed Core code in one analysis worker inside one supervised subprocess. The existing environment-neutral operations and synchronous prepared-inspection API remain available.

The caller supplies an immutable `IRepositoryReader`. Repository declarations never select executable modules. Authentication, provider calls, quotas, accounting, and the real reader stay in the parent. The bridge exposes only entry lookup, entry listing, and file pages, with four outstanding requests, 64 KiB file pages, and 1 MiB messages. It inherits no Node flags, preloads, inspector configuration, or credentials.

The returned handle contains the existing content-free metadata, coverage counts, and the startup-reported `maxAnalysisHeapBytes`. `readPage` is asynchronous and may return fewer records than requested to fit the transport bound. Counts, order, digests, and continuation semantics are preserved. A single oversized record fails explicitly. Dispose the handle in `finally` before publishing success or beginning source post-checks. Disposal waits for actual reader work and IPC deliveries, then releases its reader reference. Retaining disposed metadata handles does not retain their input repositories.

```typescript
import { createNodeProjectInspection } from '@moldea.ai/core/node';

const inspection = await createNodeProjectInspection({
  repository,
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

Core treats repository bytes as untrusted, executes no repository code, follows only resolver-provided instruction links, receives no host path or source credential, and performs no network access. Results use logical paths and bounded data only.

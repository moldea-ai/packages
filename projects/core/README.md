![moldea](cover.png)

# `@moldea.ai/core`

Source-neutral, deterministic, content-safe interpretation of the `moldea` repository format.

Version 9 accepts caller-supplied text and `@moldea.ai/repository` version 4 readers. The main, format, and scope entry points remain environment-neutral. Repository access belongs to the caller-supplied reader. Project validation returns content-free summaries, diagnostics, binding coverage, agent assignments, and metadata. Canonical document bodies are available only through an explicit path-scoped byte-range operation.

## Install

```bash
pnpm add @moldea.ai/core@9 @moldea.ai/repository@4
```

## Public entry points

- `@moldea.ai/core` exposes Core construction, operations, results, diagnostics, limits, and exceptions.
- `@moldea.ai/core/format` exposes repository-format contracts.
- `@moldea.ai/core/scope` exposes the standalone manifest-only relationship matcher without source analysis or TypeScript.
- `@moldea.ai/core/node` exposes supervised Node inspection with asynchronous paging and disposal. It runs fixed Core code and never imports project application code. Its frozen `NODE_INSPECTION_PROFILE` reports the fixed heap, lifetime, bridge and transport settings for authenticated consumer state; it does not configure them. Each inspection handle separately reports the runtime's actual V8 heap limit.

## Text and document parsing

```typescript
import { createCore } from '@moldea.ai/core';
import { parseRepositoryPath } from '@moldea.ai/repository';

const core = createCore();
const normalized = core.normalizeText({
  content: new TextEncoder().encode('\ufeffline one\r\nline two\r'),
  path: parseRepositoryPath('/moldea/project.md'),
});
const manifest = await core.parseManifest({
  content: new TextEncoder().encode('version: 1\n'),
  path: parseRepositoryPath('/moldea/moldea.yaml'),
});
```

Normalization validates strict UTF-8 or Unicode-scalar strings, removes one leading byte-order mark, converts CRLF and CR endings to LF, rejects NUL, and performs no Unicode normalization. Digests are SHA-256 over normalized UTF-8 bytes.

Manifest and decision parsing enforce Repository Format version 1 as all-or-nothing document contracts. Structural content errors return deterministic diagnostics. Invalid operation input and resource or source failures reject with typed exceptions.

## Cheap changed-path scope matching

```typescript
const result = await core.matchManifestScope({
  manifest: {
    content: 'version: 1\n',
    path: parseRepositoryPath('/moldea/moldea.yaml'),
  },
  paths: ['/src/orders/service.ts'],
});
```

`matchManifestScope` parses only the supplied manifest and matches sorted, deduplicated changed paths against exact relationships and supported globs. It reads no other repository file, returns no canonical content, and loads no TypeScript. This is the preactivation boundary for callers that already know the changed paths.

## Content-free project validation

```typescript
import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';

const repository = createMemoryRepositoryReader([
  { content: 'version: 1\n', path: '/moldea/moldea.yaml', type: 'file' },
  { content: '# Project\n', path: '/moldea/project.md', type: 'file' },
]);
const result = await core.validateProject({ repository });
```

`validateProject` returns validity, format version, source identity, summary counts and digests, diagnostics, binding coverage, and aggregate `coverageCounts`. It never returns manifest, project, context, decision, runtime-guidance, mirror, description, instruction, or source bodies. Validity means zero error diagnostics.

`createProjectInspection` validates the snapshot once and prepares immutable content-free records for the `metadata`, `diagnostics`, `coverage`, and `all` views. Metadata includes an `agent` record with exactly its canonical `agentId` and manifest-declared `runtimeId`. Every inspection and page carries the same aggregate counts. Semantic cursors bind continuation to the complete inspection digest and view. Page reads perform no repository access, revalidation, sorting, digesting, or source analysis.

The prepared inspection retains only its content-free records, summary, source identity, deterministic resource accounting, and page indexes. Core preflights the complete logical cost before it constructs the prepared collections, indexes, or digest. It does not retain canonical document bodies. `readCanonicalContentPage` is the only Core project operation that returns a body, and it requires an explicit canonical `/moldea/**` file path, byte offset, and byte bound. Returned chunks end at a complete UTF-8 scalar.

## Binding coverage

Core checks each declared binding's file and, when a symbol is named, its syntax-only runtime export inventory. TypeScript and JavaScript ESM are recognized conservatively. A proven missing export is an error and a `failed` coverage record. CommonJS, declaration files, wildcard exports, malformed or oversized source, and insufficient parsing capacity remain `not-checked`, with a reason. Coverage names the checks performed; it does not establish runtime wiring, behavior, provider compatibility, or business correctness.

`RECOGNIZED_RUNTIME_IDS` contains 35 runtime labels plus `custom`. Labels select agent guidance. Core applies the same universal checks to every label and does not interpret SDK calls. Use the installed SDK's type definitions and real application tests to establish runtime behavior. Handoffs remain runtime-native behavior.

Every diagnostic has `severity`, `group`, and stable `source: 'core'`. The groups are `discovery`, `manifest`, `references`, `agents`, `mirrors`, and `integration`. The result reports complete `errorCount`, unaccepted `warningCount`, `acceptedWarningCount`, and `diagnosticCount`; warnings do not invalidate a project. Manifest `acceptedWarnings` match a warning's code, subject, and qualifier and require a non-empty reason. Accepted findings remain visible. Unmatched impact patterns are best-effort warnings; a skipped check never makes an acceptance obsolete. Validation and inspection also check the root `/AGENTS.md` managed block against its referenced skill installation, reporting missing blocks, missing installation files, drift, or a link that doesn't lead to a file in the repository, with its reason as qualifier, as acceptable integration warnings. They also check whether `/CLAUDE.md`, `/.claude/CLAUDE.md`, or, without shared files, `/CLAUDE.local.md` loads AGENTS.md through an import line or a link, reporting `MOLDEA_INTEGRATION_CLAUDE_IMPORT_MISSING` when it does not. An optional `instructions` reader supplies the four instruction files; links are followed inside the repository with Repository's `resolveRepositoryLink`, and link targets, the skill installation, and every other check read `repository`. `parseIntegrationBlock(text)` extracts the safe relative installation path or a reason it could not be found. Manifest-only operations and `scope` do not read the integration.

## Resource and trust boundaries

Core uses independent limits for distinct entries, total bytes read, per-file bytes, manifest bytes, logical retained bytes, diagnostics, and coverage records. The default logical retained-memory ceiling is 512 MiB. Before reading a supported source for export analysis, Core checks `maxFileBytes`, confirms read-buffer headroom, and reserves `65536 + sourceBytes * (8 + 512)` bytes for text and syntax nodes. An oversized source or reservation miss records `resource-limit` without a source read; a subsequent failed read, cancellation, or operation budget failure rejects the whole operation. Each distinct source is parsed at most once per operation. Source buffers and syntax reservations are released after analysis; only export names remain in the inventory cache. Core executes no repository code, follows instruction links only inside the snapshot, receives no host path or source credential, and returns logical paths only.

Logical `RESOURCE_LIMIT_EXCEEDED` exceptions identify the exceeded limit, its configured maximum, the observed or projected usage, and `reduce-input-or-increase-limit`. Verified isolated-worker heap exhaustion uses `review-inspection-capacity` with unknown observed usage. Fixed transport limits have no next action. Core refuses an operation before allocating retained state beyond the applicable ceiling.

## Development

From the monorepo root:

```bash
pnpm --filter @moldea.ai/core typecheck
pnpm --filter @moldea.ai/core build
pnpm --filter @moldea.ai/core test:unit
pnpm --filter @moldea.ai/core test:integration
pnpm --filter @moldea.ai/core test
```

Repository fixtures use `@moldea.ai/repository/memory`. Package and consumer checks verify the published surface separately from source tests.

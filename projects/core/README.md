![moldea](cover.png)

# `@moldea.ai/core`

Source-neutral, deterministic, content-safe interpretation of the `moldea` repository format.

Version 3 accepts caller-supplied text and `@moldea.ai/repository` version 2 readers. It performs no filesystem, Git, or network access independently. Project validation returns content-free summaries, diagnostics, evidence, and metadata. Canonical document bodies are available only through an explicit path-scoped byte-range operation.

## Install

```bash
pnpm add @moldea.ai/core@3 @moldea.ai/repository@2
```

## Public entry points

- `@moldea.ai/core` exposes Core construction, operations, results, diagnostics, limits, and exceptions.
- `@moldea.ai/core/format` exposes repository-format contracts.
- `@moldea.ai/core/adapter` exposes the per-agent runtime-adapter contract and bounded reader utilities.

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

`matchManifestScope` parses only the supplied manifest and matches sorted, deduplicated changed paths against exact relationships and supported globs. It reads no other repository file, returns no canonical content, and invokes no adapter. This is the preactivation boundary for callers that already know the changed paths.

## Content-free project validation

```typescript
import { createMemoryRepositoryReader } from '@moldea.ai/repository/memory';

const repository = createMemoryRepositoryReader([
  { content: 'version: 1\n', path: '/moldea/moldea.yaml', type: 'file' },
  { content: '# Project\n', path: '/moldea/project.md', type: 'file' },
]);
const result = await core.validateProject({ repository });
```

`validateProject` returns validity, format version, source identity, summary counts and digests, diagnostics, and runtime evidence. It never returns manifest, project, context, decision, runtime-guidance, mirror, description, or instruction bodies.

`inspectProjectPage` provides bounded content-free views named `metadata`, `diagnostics`, `evidence`, and `all`. Each page uses a semantic continuation cursor tied to the validation digest and view. `readCanonicalContentPage` is the only Core project operation that returns a body, and it requires an explicit canonical `/moldea/**` file path, byte offset, and byte bound. Returned chunks end at a complete UTF-8 scalar.

## Per-agent runtime adapters

Universal validation must succeed before adapters run. Core invokes a configured package adapter once for each matching agent, in deterministic adapter and agent order. Each invocation receives only that agent, a bounded reader, a shared cancellation signal, and an exact same-runtime `resolveAgent(reference)` function for bindings that genuinely require another agent. It never receives the complete agent collection.

Adapter evidence and diagnostics are validated, normalized, deduplicated, sorted, and limited before exposure. An unexpected adapter failure or invalid output rejects the complete operation with `ADAPTER_EXECUTION_FAILED`.

## Resource and trust boundaries

Core uses independent limits for distinct entries, total bytes, file bytes, manifest bytes, diagnostics, and evidence. The adapter-facing repository adds per-page entry and byte limits. Core executes no repository code, follows no symlink, receives no host path or source credential, and returns logical paths only.

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

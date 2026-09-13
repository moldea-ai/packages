# `@moldea.ai/adapter-eve`

Deterministic runtime evidence and diagnostics for Eve TypeScript filesystem agents declared by `moldea` agents.

## Installation

```bash
pnpm add @moldea.ai/adapter-eve @moldea.ai/core @moldea.ai/repository
```

The package exports one immutable adapter:

```typescript
import { eveAdapter } from '@moldea.ai/adapter-eve';
import { createCore } from '@moldea.ai/core';

const core = createCore({ adapters: [eveAdapter] });
```

## Verified target

Version `3.0.3` supports Repository Format `1`, `@moldea.ai/core ^4.0.0`, and direct TypeScript Eve filesystem agents whose declared Eve range intersects `eve >=0.39.1`. Eve `0.39.1` is the verified minimum. Later stable releases are eligible for deterministic inspection on a best-effort basis and must still match the documented source patterns. Qualification evidence records the exact package versions and date used for each execution. The target recognizes:

- flat and nested root `agent.ts` definitions
- recursive directory-backed local subagents
- exclusive modern Markdown or TypeScript instructions
- recursive `defineTool(...)` modules
- TypeScript `defineSkill(...)` modules
- direct output, input, and output-schema relationships

The adapter reads source through the Repository contract. It does not execute Eve, import inspected modules, resolve installed packages, read lockfiles, or write to the repository.

## Public API

The package exports only `eveAdapter`. It has no default export, configuration factory, Eve SDK facade, parser export, or public diagnostic registry.

## Documentation

- [Complete binding example](docs/binding-example.md): manifest, canonical instructions, runtime source, and supported schema or routing relationships.

These guides are included in the installed package. Open only the page relevant to your task.

- [Package overview](docs/index.md)
- [Verified target](docs/verified-target.md)
- [Evidence and diagnostics](docs/evidence-and-diagnostics.md)
- [Limitations](docs/limitations.md)

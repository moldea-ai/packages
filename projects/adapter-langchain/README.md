# `@moldea.ai/adapter-langchain`

Deterministic runtime evidence and diagnostics for LangChain TypeScript `createAgent` applications declared by `moldea` agents.

## Installation

```bash
pnpm add @moldea.ai/adapter-langchain @moldea.ai/core @moldea.ai/repository
```

The package exports one immutable adapter:

```typescript
import { langChainAdapter } from '@moldea.ai/adapter-langchain';
import { createCore } from '@moldea.ai/core';

const core = createCore({ adapters: [langChainAdapter] });
```

## Verified target

Version `3.0.2` supports Repository Format `1`, `@moldea.ai/core ^4.0.0`, and declared ranges that intersect `langchain >=1.5.9` with companion `@langchain/core >=1.2.8`. Those minimum versions are verified. Later stable releases are eligible for deterministic inspection on a best-effort basis and must still match the documented source patterns. Qualification evidence records the exact package versions and date used for each execution. The target recognizes:

- directly exported package-root `createAgent(...)` definitions
- direct instruction-loader calls and `SystemMessage` construction
- direct, `toolStrategy(...)`, and `providerStrategy(...)` output-schema relationships
- normal two-argument `tool(implementation, fields)` declarations
- closed inline, module-local, and relative-imported tool arrays

The adapter reads source through the Repository contract. It does not execute LangChain, import inspected modules, inspect lockfiles or installed packages, contact LangSmith or model providers, or write to the repository.

## Public API

The package exports only `langChainAdapter`. It has no default export, configuration factory, LangChain or LangGraph facade, parser export, or public diagnostic registry.

## Documentation

These guides are included in the installed package. Open only the page relevant to your task.

- [Package overview](docs/index.md)
- [Verified target](docs/verified-target.md)
- [Evidence and diagnostics](docs/evidence-and-diagnostics.md)
- [Limitations](docs/limitations.md)

# `@moldea.ai/adapter-langgraph`

Deterministic runtime evidence and diagnostics for LangGraph TypeScript Graph API and Functional API workflows declared by `moldea` agents.

## Installation

```bash
pnpm add @moldea.ai/adapter-langgraph @moldea.ai/core @moldea.ai/repository
```

The package exports one immutable adapter:

```typescript
import { langGraphAdapter } from '@moldea.ai/adapter-langgraph';
import { createCore } from '@moldea.ai/core';

const core = createCore({ adapters: [langGraphAdapter] });
```

## Verified targets

Version `4.0.0` supports Repository Format `1`, `@moldea.ai/core ^5.0.0`, and declared ranges that intersect `@langchain/langgraph >=1.4.12` with companion `@langchain/core >=1.2.9`. Those minimum versions are verified. Later stable releases are eligible for deterministic inspection on a best-effort basis and must still match the documented source patterns. Qualification evidence records the exact package versions and date used for each execution. The targets recognize:

- directly exported compiled `StateGraph` definitions using supported inline fluent or single-owner module-local builders
- closed modern Graph API schema initialization and direct input/output schema wiring
- supported node, direct-edge, waiting-edge, and conditional-edge operations
- directly exported Functional API `entrypoint(...)` definitions
- direct task, interrupt, previous-state, and final-state patterns in an entrypoint's own lexical body
- two-argument `interrupt(value, { responseSchema })` patterns when every observed LangGraph declaration is at or after `1.4.16`; the schema describes the resume value, not agent input or output

The adapter reads source through the Repository contract. It does not execute LangGraph, import inspected modules, inspect lockfiles or installed packages, contact LangSmith or model providers, or write to the repository.

## Public API

The package exports only `langGraphAdapter`. It has no default export, configuration factory, LangGraph facade, parser export, or public diagnostic registry.

## Documentation

- [Complete binding example](docs/binding-example.md): manifest, canonical instructions, runtime source, and supported schema or routing relationships.

These guides are included in the installed package. Open only the page relevant to your task.

- [Package overview](docs/index.md)
- [Verified targets](docs/verified-target.md)
- [Evidence and diagnostics](docs/evidence-and-diagnostics.md)
- [Limitations](docs/limitations.md)

## Diagnostics

`LANGGRAPH_RUNTIME_RELATIONSHIP_UNVERIFIED` has severity `warning` only when the adapter identifies a declared relationship affected by a recognized but unresolved source candidate. Its safe details identify the relationship and reason; known version-behavior boundaries additionally carry normalized dependency context. Missing local evidence or a newer eligible dependency version alone does not produce this warning. Confirmed diagnostic codes remain errors.

`LANGGRAPH_RUNTIME_RELATIONSHIP_UNVERIFIED`: The declared runtime relationship could not be verified.

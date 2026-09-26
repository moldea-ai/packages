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

Version `4.0.0` supports Repository Format `1`, `@moldea.ai/core ^5.0.0`, and direct TypeScript Eve filesystem agents whose declared Eve range intersects `eve >=0.39.1`. Eve `0.39.1` is the verified minimum. Later stable releases remain eligible; the adapter interprets recognized behavior changes from the declared range and leaves a version-dependent relationship unverified when that range spans incompatible behaviors. Qualification evidence records the exact package versions and date used for each execution. The target recognizes:

- flat and nested root `agent.ts` definitions
- recursive directory-backed local subagents
- workspace agents and exact manifest-registered `defineWorkspaceAgent(...)` peers from Eve `0.54.3`
- exclusive modern Markdown or TypeScript instructions
- recursive `defineTool(...)` modules
- direct `defineWorkflowTool(...)` modules from Eve `0.52.0`, including declared background execution and, from `0.61.0`, subagent exposure
- TypeScript `defineSkill(...)` modules
- direct agent output schemas before Eve `0.67.0`, plus tool input and output schemas

The adapter reads source through the Repository contract. It does not execute Eve, import inspected modules, resolve installed packages, read lockfiles, or write to the repository.

Eve `0.52.2` adds `defaultTools` and `task_cancel`; Eve `0.59.1` adds the subagent `tool` option; Eve `0.61.0` adds `availableInSubagents`; Eve `0.65.0` removes the `todo` and `ask_question` defaults; Eve `0.66.2` excludes test/spec tool and subagent files and `__tests__` paths; Eve `0.67.0` removes `defineAgent.outputSchema`. Earlier eligible releases keep their prior behavior. A spanning declared range produces a scoped warning only when a specific relationship changes across the boundary. An authored or bound agent output schema on Eve `0.67.0` is a confirmed feature error. Tool output schemas remain supported. The adapter does not prove that a Workflow runs durably or that a registered tool is exposed on every model turn.

## Public API

The package exports only `eveAdapter`. It has no default export, configuration factory, Eve SDK facade, parser export, or public diagnostic registry.

## Documentation

- [Complete binding example](docs/binding-example.md): manifest, canonical instructions, runtime source, and supported schema or routing relationships.

These guides are included in the installed package. Open only the page relevant to your task.

- [Package overview](docs/index.md)
- [Verified target](docs/verified-target.md)
- [Evidence and diagnostics](docs/evidence-and-diagnostics.md)
- [Limitations](docs/limitations.md)

## Diagnostics

`EVE_RUNTIME_RELATIONSHIP_UNVERIFIED` has severity `warning` only when the adapter identifies a declared relationship affected by a recognized but unresolved source candidate. Its safe details identify the relationship and reason; known version-behavior boundaries additionally carry normalized dependency context. Missing local evidence or a newer eligible dependency version alone does not produce this warning. Confirmed diagnostic codes remain errors.

`EVE_RUNTIME_RELATIONSHIP_UNVERIFIED`: The declared runtime relationship could not be verified.

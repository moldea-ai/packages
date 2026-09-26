---
title: Verified targets
description: Static forms covered by the LangGraph targets from their verified minimums.
order: 10
---

# Verified targets

Technical targets `typescript-state-graph-1-4` and `typescript-functional-api-1-4` admit declared ranges that intersect `@langchain/langgraph >=1.4.12` with companion `@langchain/core >=1.2.9`. Those minimum versions are verified. Later stable releases are eligible for deterministic inspection on a best-effort basis and must still match the source patterns below. Qualification evidence records the exact package versions and date used for each execution.

Graph API agent evidence requires a directly exported immutable `const` initialized by a supported `.compile(...)` call over a package-root `StateGraph`. The builder may be an inline fluent chain or one module-local `const` whose exact top-level operations precede a single compile call. Closed modern object initialization can establish input and output schema relationships. The overloaded direct-schema constructor family can establish graph identity but not schema wiring.

Graph runtime-pattern evidence covers supported positional nodes, direct edges, waiting edges, and conditional edges. Recognized collection and builder operations may preserve graph identity without being expanded into topology evidence. The emitted observations never claim a complete, reachable, or executable topology.

Functional API agent evidence requires a directly exported immutable `const` initialized by the package-root `entrypoint(...)` helper. The workflow may be inline, module-local, or a directly resolved relative ESM import. Task, interrupt, previous-state, and final-state observations must occur directly in that workflow's own lexical body.

The direct one-argument `interrupt(value)` form remains supported from the target minimum. A direct two-argument call with a closed options object containing only an optional `responseSchema` yields functional interrupt evidence only when every observed `@langchain/langgraph` declaration is wholly at or after `1.4.16`. An older or spanning declaration cannot prove that form. A present `responseSchema` describes a resume value and never establishes an agent input or output schema. Indirect, open, or malformed options do not establish the two-argument pattern.

Named import aliases and `.ts`, `.tsx`, and `.mts` sources are supported. The adapter itself supports Node.js `>=22.11.0`.

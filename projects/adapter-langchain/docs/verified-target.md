---
title: Verified target
description: Static forms covered by the LangChain createAgent target from its verified minimums.
order: 10
---

# Verified target

Technical target `typescript-create-agent-1-5` admits declared ranges that intersect `langchain >=1.5.9` with companion `@langchain/core >=1.2.8`. Those minimum versions are verified. Later stable releases are eligible for deterministic inspection on a best-effort basis and must still match the source patterns below. Qualification evidence records the exact package versions and date used for each execution.

Positive agent evidence requires a directly exported TypeScript `const` initialized by the named package-root `createAgent(...)` helper with one closed object-literal configuration and a `model` property. Named import aliases and `.ts`, `.tsx`, and `.mts` source are supported.

Instruction relationships require a direct loader call in `systemPrompt` or a direct `SystemMessage(loaderCall)` construction. Agent output schemas may be direct or wrapped by a supported one-schema `toolStrategy(...)` or `providerStrategy(...)` call. Normal function tools require the two-argument `tool(implementation, fields)` overload and an explicit manifest registration binding. Agent registration requires a closed tool array.

Middleware must be absent or a provably immutable empty array before instruction, agent output-schema, or tool-registration conclusions are produced. The adapter itself supports Node.js `>=22.11.0`.

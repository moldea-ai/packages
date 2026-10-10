---
title: Runtime adapters
description: Per-agent adapter contexts, exact binding resolution, bounded repository access, evidence, and failures.
order: 40
---

# Runtime adapters

Runtime adapters extend deterministic repository validation for one approved runtime. They inspect source already exposed through the bounded reader and never execute an agent or provider runtime.

```typescript
import { createCore } from '@moldea.ai/core';
import type { IRuntimeAdapter } from '@moldea.ai/core/adapter';

export const createRuntimeAwareCore = (adapter: IRuntimeAdapter) => {
  return createCore({ adapters: [adapter] });
};
```

## Built-in `custom`

`custom` is recognized by Core without a package. Core emits `CUSTOM_RUNTIME_RELATIONSHIP_UNVERIFIED` for each applicable declared relationship it cannot inspect. It creates no warning for an undeclared relationship, registers no custom adapter, and infers no SDK. A project-local runtime guidance file is optional in the format, but the Runtime Compatibility Matrix requires appropriate guidance before a custom runtime receives a supported production-readiness claim. There is no `@moldea.ai/adapter-custom` package.

## Per-agent invocation

Core validates adapter definitions during `createCore`. Project validation completes universal checks and runtime availability before any adapter runs. It then invokes each applicable configured adapter once per matching agent in deterministic adapter and agent order.

Each invocation receives:

- exactly one immutable `agent`
- bounded `getEntry`, `listEntriesPage`, and `readFilePage` repository capabilities
- per-page and operation-wide limits
- an immutable `outputBudget` with diagnostic/evidence `maximum` and `remaining` raw counts
- an optional shared cancellation signal
- `resolveAgent(reference)` for one exact same-runtime binding

The context never includes a complete agent list or project body index. `resolveAgent` returns only `absent`, `ambiguous` with a candidate count, or one content-minimal matched agent. Only a successfully resolved agent joins the evidence-validation scope for that invocation.

## Evidence and failures

Use `createRuntimeAdapterResultCollector(context)` from `@moldea.ai/core/adapter` to construct bounded output. `diagnostics.add(factory)` and `evidence.add(factory)` admit one record before executing its factory. `finalize()` returns `{ evidence, diagnostics }`. Raw output from earlier invocations reduces the remaining allowance, including records later deduplicated. Empty output remains valid when an allowance is exhausted. Further admission raises `RESOURCE_LIMIT_EXCEEDED` before record construction; cancellation raises `ABORTED`. Core's authoritative raw-result validation remains in force.

Collector refusal exposes `CoreOperationException` with `RESOURCE_LIMIT_EXCEEDED` (`A Core resource limit was exceeded.`); collector cancellation exposes `ABORTED` (`The Core operation was aborted.`). Reader failures preserve their repository exception contracts through the public inspection boundary, including incomplete-provider failures. Neither path returns a completed or truncated adapter result.

Evidence records source-grounded runtime observations without repository content, secrets, model input, tool arguments, or provider payloads. Core validates evidence and diagnostics against the current agent and any exact resolved agents, applies operation-wide limits before normalization, then deduplicates, sorts, and freezes retained output.

Adapter diagnostics require `severity`. Confirmed violations are errors; an applicable declared relationship that remains unverified uses its adapter's reserved unverified-relationship warning with closed safe context. A warning neither proves runtime wiring nor makes the project invalid. The aggregate `runtimeInspection` becomes `incomplete` when warnings remain, and becomes `not-run` if universal validation or adapter availability prevents inspection. Core rejects malformed severity, warning code, message, subject, source path, or details as `ADAPTER_EXECUTION_FAILED`. Raw diagnostics count against `maxDiagnostics` before deduplication.

Official adapters check declared runtime-value exports independently of wiring. A TypeScript interface, type-only export, or explicit `declare` declaration supplies no runtime value. Named and namespace runtime re-exports can establish existence without proving wiring; wildcard or dynamic exports leave absence uncertain.

Observed writes and client escapes to unknown helpers prevent affected SDK request proofs. They produce scoped uncertainty while independent declarations remain checkable.

A thrown adapter error or malformed result becomes `ADAPTER_EXECUTION_FAILED`. Partial output from that invocation is not exposed. Repository path, source, cancellation, snapshot, and resource failures propagate through their typed boundaries.

The [Runtime Compatibility Matrix](/compatibility/) defines approved adapter IDs, implementation state, evidence kinds, binding support, supported patterns, provider limits, and verification dates.

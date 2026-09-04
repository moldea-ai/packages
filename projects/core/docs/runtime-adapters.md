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

`custom` is recognized by Core without a package. A project-local runtime guidance file is optional in the format, but the Runtime Compatibility Matrix requires appropriate guidance before a custom runtime receives a supported production-readiness claim. There is no `@moldea.ai/adapter-custom` package.

## Per-agent invocation

Core validates adapter definitions during `createCore`. Project validation completes universal checks and runtime availability before any adapter runs. It then invokes each applicable configured adapter once per matching agent in deterministic adapter and agent order.

Each invocation receives:

- exactly one immutable `agent`
- bounded `getEntry`, `listEntriesPage`, and `readFilePage` repository capabilities
- per-page and operation-wide limits
- an optional shared cancellation signal
- `resolveAgent(reference)` for one exact same-runtime binding

The context never includes a complete agent list or project body index. `resolveAgent` returns only `absent`, `ambiguous` with a candidate count, or one content-minimal matched agent. Only a successfully resolved agent joins the evidence-validation scope for that invocation.

## Evidence and failures

Evidence records source-grounded runtime observations without repository content, secrets, model input, tool arguments, or provider payloads. Core validates evidence and diagnostics against the current agent and any exact resolved agents, applies operation-wide limits before normalization, then deduplicates, sorts, and freezes retained output.

A thrown adapter error or malformed result becomes `ADAPTER_EXECUTION_FAILED`. Partial output from that invocation is not exposed. Repository path, source, cancellation, snapshot, and resource failures propagate through their typed boundaries.

The [Runtime Compatibility Matrix](/compatibility/) defines approved adapter IDs, implementation state, evidence kinds, binding support, supported patterns, provider limits, and verification dates.

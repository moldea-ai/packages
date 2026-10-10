# `@moldea.ai/adapter-static-analysis`

Private, provider-neutral static-analysis primitives shared by moldea runtime adapters.

This package owns normalized text and Unicode-scalar handling, nearest package-manifest discovery with optional manifest-package identity, strict dependency-range classification, provider-neutral TypeScript module indexing, lexical binding resolution, direct client-call analysis, relationship classification, immutable module-value and mutation analysis, exact static strings across relative named imports, and operation-local inspection caches.

Export inventories describe runtime values. Erased TypeScript type-only exports, interfaces, and explicit `declare` declarations do not establish a runtime value, including namespace type exports and default interfaces. Runtime namespace exports remain present but unsupported for wiring proofs.

Binding effect indexing follows aliases and separately records writes and call-argument escapes. Direct assignment, `Object.assign`, property descriptor writes, `Reflect.set`, and prototype replacement invalidate affected SDK method proofs. Built-in mutators are recognized only when their global names are not shadowed by lexical declarations. Passing a client or its resource to an unknown helper also prevents a request proof. Known property writes and unrelated member escapes retain unaffected proofs; dynamic keys or prototype changes invalidate the affected object. Module-value analysis retains unknown-call escapes as uncertainty.

Source-cache admission estimates normalized text, scalar positions, syntax nodes, and indexes. The node count is collected during identifier indexing; there is no extra traversal for admission. Estimates control retained ownership, not peak RSS or the first parse allocation. Each adapter and immutable inspection owns a separate bounded cache. Oversized analyses may be borrowed within the active agent invocation but are not retained across invocations.

Each adapter retains at most 16 sources within 16 MiB estimated cost and 128 combined entry/package observations within 128 KiB estimated cost. Observation admission includes lookup keys and variable-sized metadata such as content identities and dependency declarations. Sources, observations, and Eve root listings share four active loads per adapter. Eviction causes normal rereads or reparsing; oversized results are returned to the current caller without cache retention. These estimates do not bound transient serialization, provider allocations, or process RSS.

It does not depend on public moldea projects, define provider diagnostics, or form part of any public adapter contract. Public adapters bundle the implementation and retain their own Core, Repository, evidence, diagnostic, and provider-contract boundaries.

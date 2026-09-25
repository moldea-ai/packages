---
title: Evidence and diagnostics
description: Source-grounded observations and stable Cloudflare adapter failures.
order: 20
---

# Evidence and diagnostics

Package evidence records exact dependency declarations and whether each declaration is supported or ambiguous for the selected target. Unsupported disjoint ranges produce `CLOUDFLARE_AGENTS_RUNTIME_VERSION_UNSUPPORTED` and suppress target-derived evidence.

`agent-definition` identifies a supported exported class. `runtime-pattern` identifies direct AI SDK generation in `AIChatAgent`; Think does not emit it. `instruction-loader`, `schema`, and `tool-registration` require exact manifest binding identity. `handoff-registration` requires an active `agentTool` in a closed tools map, a unique registered target class, and an exact routing-description match against the target agent's handoff description or description fallback.

The package README is the canonical package diagnostic catalog. Dynamic or unsupported forms yield partial or no evidence rather than guessed relationships. Unsupported class initialization preserves package and language observations but suppresses all class method-derived results.

## Diagnostics

`CLOUDFLARE_AGENTS_RUNTIME_RELATIONSHIP_UNVERIFIED`: The declared runtime relationship could not be verified.

`CLOUDFLARE_AGENTS_RUNTIME_RELATIONSHIP_UNVERIFIED` has severity `warning` only when the adapter identifies a declared relationship affected by a recognized but unresolved source candidate. Its safe details identify the relationship and reason; known version-behavior boundaries additionally carry normalized dependency context. Missing local evidence or a newer eligible dependency version alone does not produce this warning. Confirmed diagnostic codes remain errors.

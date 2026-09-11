---
title: Verified target
description: Static forms covered by the Eve filesystem-agent target from verified minimum 0.39.1.
order: 10
---

# Verified target

Technical target `typescript-filesystem-agent-0-39` admits declared Eve ranges that intersect `eve >=0.39.1`. Eve `0.39.1` is the verified minimum. Later stable releases are eligible for deterministic inspection on a best-effort basis and must still match the source patterns below. Qualification evidence records the exact package versions and date used for each execution.

Positive agent evidence requires an uncollided flat or nested `agent.ts` that directly default-exports `defineAgent(...)`, uses only `model`, optional `description`, and optional `outputSchema`, and resolves `model` to a supported static string. Directory-backed local subagents use the same rule recursively.

Instructions require one exclusive exact-lowercase `instructions.md` or one exact-shape `instructions.ts`. Tools are discovered recursively under `tools/`, use Eve's exact path-segment grammar, and flatten path separators to hyphens. Positive skill registration is limited to uncollided direct TypeScript `defineSkill(...)` modules.

The adapter itself supports Node.js `>=22.11.0`. Applications must also satisfy the selected Eve release's Node.js requirement; the verified minimum requires Node.js 24 or newer according to Eve's package metadata.

---
title: Verified target
description: Static forms covered by the Eve filesystem-agent target from verified minimum 0.39.1.
order: 10
---

# Verified target

Technical target `typescript-filesystem-agent-0-39` admits declared Eve ranges that intersect `eve >=0.39.1`. Eve `0.39.1` is the verified minimum. Later stable releases are eligible for deterministic inspection on a best-effort basis and must still match the source patterns below. Qualification evidence records the exact package versions and date used for each execution.

Positive agent evidence requires an uncollided flat or nested `agent.ts` that directly default-exports `defineAgent(...)`, uses `model` plus optional `description`, `outputSchema`, `defaultTools`, and `tool`, and resolves `model` to a supported static string. The last two options require an eligible Eve release that defines them. Directory-backed local subagents use the same rule recursively.

The same definition form is recognized at `agents/<name>/agent/agent.ts` in a workspace. The adapter follows each registered parent's immediate directory-backed children, including children of workspace agents and nested local agents. A direct `defineWorkspaceAgent({ name })` under a workspace parent's `subagents/` directory resolves only to the exact manifest-registered `agents/<name>/agent/agent.ts` peer from Eve `0.54.3`. From Eve `0.59.1`, `tool: false` keeps that peer callable without claiming a model-visible handoff. Same-name tools, subagents, active defaults, and unsupported candidates still receive namespace preflight.

Instructions require one exclusive exact-lowercase `instructions.md` or one exact-shape `instructions.ts`. Tools are discovered recursively under `tools/`, use Eve's exact path-segment grammar, and flatten path separators to hyphens. Positive skill registration is limited to uncollided direct TypeScript `defineSkill(...)` modules.

Direct `defineWorkflowTool(...)` modules are recognized from Eve `0.52.0` when their executor is a top-level async function declaration or the definition's direct async `execute` method, with a leading `use workflow` directive. Eve rejects arrows and function expressions marked with that directive. Evidence records declared `execution: 'background'` and, from Eve `0.61.0`, explicit `availableInSubagents` values when statically supported; it does not verify durable execution or turn-time exposure. Eve `0.52.2` introduces `defaultTools` and the `task_cancel` default; Eve `0.59.1` introduces the subagent `tool` option; `todo` and `ask_question` leave the default namespace in Eve `0.65.0`. Eve `0.66.2` excludes test/spec modules and paths under `__tests__` from tool and subagent discovery. An explicitly bound child beneath `__tests__` is a confirmed registration error on that release. Version ranges spanning a changed behavior leave only the affected relationship unverified.

The adapter itself supports Node.js `>=22.11.0`. Applications must also satisfy the selected Eve release's Node.js requirement; the verified minimum requires Node.js 24 or newer according to Eve's package metadata.

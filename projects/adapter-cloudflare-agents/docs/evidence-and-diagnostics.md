---
title: Evidence and diagnostics
description: Source-grounded observations and stable Cloudflare adapter failures.
order: 20
---

# Evidence and diagnostics

Package evidence records exact dependency declarations and whether each declaration is supported or ambiguous for the selected target. Unsupported disjoint ranges produce `CLOUDFLARE_AGENTS_RUNTIME_VERSION_UNSUPPORTED` and suppress target-derived evidence.

`agent-definition` identifies a supported exported class. `runtime-pattern` identifies direct AI SDK generation in `AIChatAgent`; Think does not emit it. `instruction-loader`, `schema`, and `tool-registration` require exact manifest binding identity. `handoff-registration` requires an active `agentTool` in a closed tools map, a unique registered target class, and an exact routing-description match against the target agent's handoff description or description fallback.

Function-tool registration details include `declaredDeferredLoading` (`absent`, `enabled`, `disabled`, or `unknown`). This is source evidence, not a claim about per-turn tool availability. Think instruction analysis follows known pre-0.18 and 0.18-or-newer context behavior when declarations establish one side. A spanning declaration produces a version-dependent warning only when the conclusions differ.

Dynamic or unsupported forms yield partial or no evidence rather than guessed relationships. Unsupported class initialization preserves package and language observations but suppresses all class method-derived results.

## Diagnostics

| Code                                                      | Stable message                                                                                                           |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `CLOUDFLARE_AGENTS_AGENT_INPUT_SCHEMA_SYMBOL_NOT_FOUND`   | The declared agent input-schema symbol was not found.                                                                    |
| `CLOUDFLARE_AGENTS_SKILL_IMPLEMENTATION_SYMBOL_NOT_FOUND` | The declared skill-implementation symbol was not found.                                                                  |
| `CLOUDFLARE_AGENTS_SKILL_REGISTRATION_SYMBOL_NOT_FOUND`   | The declared skill-registration symbol was not found.                                                                    |
| `CLOUDFLARE_AGENTS_VARIABLE_PROVIDER_SYMBOL_NOT_FOUND`    | The declared variable-provider symbol was not found.                                                                     |
| `CLOUDFLARE_AGENTS_INSTRUCTION_SOURCE_MISMATCH`           | The declared instruction loader does not consume the canonical instruction source.                                       |
| `CLOUDFLARE_AGENTS_AGENT_OUTPUT_SCHEMA_NOT_WIRED`         | The declared agent output schema is not wired to the detected AIChatAgent structured output.                             |
| `CLOUDFLARE_AGENTS_AGENT_OUTPUT_SCHEMA_SYMBOL_NOT_FOUND`  | The declared agent output-schema symbol was not found.                                                                   |
| `CLOUDFLARE_AGENTS_HANDOFF_ROUTING_DESCRIPTION_MISSING`   | The detected Cloudflare agent-tool routing description is missing.                                                       |
| `CLOUDFLARE_AGENTS_HANDOFF_ROUTING_DESCRIPTION_NOT_WIRED` | The detected Cloudflare agent-tool routing description is not wired to the target agent's effective routing description. |
| `CLOUDFLARE_AGENTS_HANDOFF_TARGET_AMBIGUOUS`              | The detected Cloudflare agent-tool target maps to more than one registered agent.                                        |
| `CLOUDFLARE_AGENTS_INSTRUCTION_LOADER_NOT_WIRED`          | The declared instruction loader is not wired to a supported configured Cloudflare agent instruction source.              |
| `CLOUDFLARE_AGENTS_INSTRUCTION_LOADER_SYMBOL_NOT_FOUND`   | The declared instruction-loader symbol was not found.                                                                    |
| `CLOUDFLARE_AGENTS_PACKAGE_MANIFEST_INVALID`              | The owning package manifest is invalid for Cloudflare Agents dependency detection.                                       |
| `CLOUDFLARE_AGENTS_RUNTIME_AGENT_SYMBOL_NOT_FOUND`        | The declared runtime-agent symbol was not found.                                                                         |
| `CLOUDFLARE_AGENTS_RUNTIME_VERSION_UNSUPPORTED`           | The observed Cloudflare Agents dependency range is disjoint from the supported target.                                   |
| `CLOUDFLARE_AGENTS_SOURCE_SYNTAX_INVALID`                 | The referenced Cloudflare Agents source file contains invalid TypeScript syntax.                                         |
| `CLOUDFLARE_AGENTS_SOURCE_TEXT_INVALID`                   | The referenced Cloudflare Agents source file is not valid normalized text.                                               |
| `CLOUDFLARE_AGENTS_TOOL_IMPLEMENTATION_NOT_WIRED`         | The declared tool implementation is not wired to the detected Cloudflare agent function tool.                            |
| `CLOUDFLARE_AGENTS_TOOL_IMPLEMENTATION_SYMBOL_NOT_FOUND`  | The declared tool-implementation symbol was not found.                                                                   |
| `CLOUDFLARE_AGENTS_TOOL_INPUT_SCHEMA_NOT_WIRED`           | The declared tool input schema is not wired to the detected Cloudflare agent function tool.                              |
| `CLOUDFLARE_AGENTS_TOOL_INPUT_SCHEMA_SYMBOL_NOT_FOUND`    | The declared tool input-schema symbol was not found.                                                                     |
| `CLOUDFLARE_AGENTS_TOOL_NAME_MISMATCH`                    | The declared tool name does not match the detected Cloudflare agent tools-map key.                                       |
| `CLOUDFLARE_AGENTS_TOOL_OUTPUT_SCHEMA_NOT_WIRED`          | The declared tool output schema is not wired to the detected Cloudflare agent function tool.                             |
| `CLOUDFLARE_AGENTS_TOOL_OUTPUT_SCHEMA_SYMBOL_NOT_FOUND`   | The declared tool output-schema symbol was not found.                                                                    |
| `CLOUDFLARE_AGENTS_TOOL_REGISTRATION_NOT_WIRED`           | The declared tool registration is not wired to the detected Cloudflare agent tools map.                                  |
| `CLOUDFLARE_AGENTS_TOOL_REGISTRATION_SYMBOL_NOT_FOUND`    | The declared tool-registration symbol was not found.                                                                     |
| `CLOUDFLARE_AGENTS_RUNTIME_RELATIONSHIP_UNVERIFIED`       | The declared runtime relationship could not be verified.                                                                 |

`CLOUDFLARE_AGENTS_RUNTIME_RELATIONSHIP_UNVERIFIED`: The declared runtime relationship could not be verified.

`CLOUDFLARE_AGENTS_RUNTIME_RELATIONSHIP_UNVERIFIED` has severity `warning` when an applicable declared relationship remains unverified, including unsupported source patterns, dynamic or mutated wiring, and ranges spanning a relevant behavior change. Its safe details identify the relationship and reason; version-dependent warnings also include normalized dependency context. Independent export checks and proved contradictions remain errors. Warning-only validation is valid with `runtimeInspection: 'incomplete'`; it does not establish launch readiness. A newer eligible dependency version alone does not produce this warning.

## Declaration outcomes

Each applicable declared binding, tool, skill, schema, and variable provider receives evidence, a confirmed error, or a scoped unverified warning. Declared exports are checked independently of runtime wiring. A closed local export inventory can prove a symbol missing; dynamic or wildcard exports remain uncertain. Reader, snapshot, cancellation, and resource failures propagate through Core instead of being reported as unsupported source. Relationships absent from the declaration receive no invented warning.

Instruction-loader evidence requires both supported wiring and canonical source provenance. A supported loader reading a different file or returning different instruction text produces `INSTRUCTION_SOURCE_MISMATCH` with the adapter prefix. Unsupported loaders remain unverified. Proved mismatches from one consumer remain observable when another consumer is correctly wired. Static inspection does not execute application code or require a particular application architecture.

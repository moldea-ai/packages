---
title: Evidence and diagnostics
description: Emitted evidence, stable diagnostics, package detection, and conservative uncertainty.
order: 20
---

# Evidence and diagnostics

## Evidence

The targets may emit `runtime-package`, `language`, `agent-definition`, `runtime-pattern`, `instruction-loader`, `schema`, and `tool-registration` evidence.

`agent-definition` identifies a supported immutable `ToolLoopAgent`. `runtime-pattern` identifies a supported direct `generateText` or `streamText` wrapper. Schema evidence identifies `agent-input`, `agent-output`, `tool-input`, or `tool-output`. Tool registration requires an exact bound function-tool value under a tools-map key matching the manifest tool name.

Tool registration details include `declaredDeferredLoading` (`absent`, `enabled`, `disabled`, or `unknown`). This records the function-tool declaration and does not prove per-turn model availability or search results. An additional `toolSearch()` declaration does not become the registered function-tool identity.

Evidence contains no repository content, instructions, descriptions, credentials, model values, tool arguments, provider payloads, request data, response data, or model output. Unverified declared relationships receive scoped warnings.

## Diagnostic catalog

| Code                                                  | Stable message                                                                                  |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `VERCEL_AI_SDK_SKILL_IMPLEMENTATION_SYMBOL_NOT_FOUND` | The declared skill-implementation symbol was not found.                                         |
| `VERCEL_AI_SDK_SKILL_REGISTRATION_SYMBOL_NOT_FOUND`   | The declared skill-registration symbol was not found.                                           |
| `VERCEL_AI_SDK_VARIABLE_PROVIDER_SYMBOL_NOT_FOUND`    | The declared variable-provider symbol was not found.                                            |
| `VERCEL_AI_SDK_INSTRUCTION_SOURCE_MISMATCH`           | The declared instruction loader does not consume the canonical instruction source.              |
| `VERCEL_AI_SDK_AGENT_INPUT_SCHEMA_NOT_WIRED`          | The declared agent input schema is not wired to the detected ToolLoopAgent call-options schema. |
| `VERCEL_AI_SDK_AGENT_INPUT_SCHEMA_SYMBOL_NOT_FOUND`   | The declared agent input-schema symbol was not found.                                           |
| `VERCEL_AI_SDK_AGENT_OUTPUT_SCHEMA_NOT_WIRED`         | The declared agent output schema is not wired to the detected Vercel AI SDK structured output.  |
| `VERCEL_AI_SDK_AGENT_OUTPUT_SCHEMA_SYMBOL_NOT_FOUND`  | The declared agent output-schema symbol was not found.                                          |
| `VERCEL_AI_SDK_INSTRUCTION_LOADER_NOT_WIRED`          | The declared instruction loader is not wired to the detected Vercel AI SDK instructions.        |
| `VERCEL_AI_SDK_INSTRUCTION_LOADER_SYMBOL_NOT_FOUND`   | The declared instruction-loader symbol was not found.                                           |
| `VERCEL_AI_SDK_PACKAGE_MANIFEST_INVALID`              | The owning package manifest is invalid for Vercel AI SDK dependency detection.                  |
| `VERCEL_AI_SDK_RUNTIME_AGENT_SYMBOL_NOT_FOUND`        | The declared runtime-agent symbol was not found.                                                |
| `VERCEL_AI_SDK_SOURCE_SYNTAX_INVALID`                 | The referenced Vercel AI SDK source file contains invalid TypeScript syntax.                    |
| `VERCEL_AI_SDK_SOURCE_TEXT_INVALID`                   | The referenced Vercel AI SDK source file is not valid normalized text.                          |
| `VERCEL_AI_SDK_TOOL_IMPLEMENTATION_NOT_WIRED`         | The declared tool implementation is not wired to the detected Vercel AI SDK function tool.      |
| `VERCEL_AI_SDK_TOOL_IMPLEMENTATION_SYMBOL_NOT_FOUND`  | The declared tool-implementation symbol was not found.                                          |
| `VERCEL_AI_SDK_TOOL_INPUT_SCHEMA_NOT_WIRED`           | The declared tool input schema is not wired to the detected Vercel AI SDK function tool.        |
| `VERCEL_AI_SDK_TOOL_INPUT_SCHEMA_SYMBOL_NOT_FOUND`    | The declared tool input-schema symbol was not found.                                            |
| `VERCEL_AI_SDK_TOOL_NAME_MISMATCH`                    | The declared tool name does not match the detected Vercel AI SDK tools-map key.                 |
| `VERCEL_AI_SDK_TOOL_OUTPUT_SCHEMA_NOT_WIRED`          | The declared tool output schema is not wired to the detected Vercel AI SDK function tool.       |
| `VERCEL_AI_SDK_TOOL_OUTPUT_SCHEMA_SYMBOL_NOT_FOUND`   | The declared tool output-schema symbol was not found.                                           |
| `VERCEL_AI_SDK_TOOL_REGISTRATION_NOT_WIRED`           | The declared tool registration is not wired to the detected Vercel AI SDK tools map.            |
| `VERCEL_AI_SDK_TOOL_REGISTRATION_SYMBOL_NOT_FOUND`    | The declared tool-registration symbol was not found.                                            |
| `VERCEL_AI_SDK_VERSION_UNSUPPORTED`                   | The observed Vercel AI SDK dependency range is disjoint from the supported range.               |
| `VERCEL_AI_SDK_RUNTIME_RELATIONSHIP_UNVERIFIED`       | The declared runtime relationship could not be verified.                                        |

`VERCEL_AI_SDK_RUNTIME_RELATIONSHIP_UNVERIFIED`: The declared runtime relationship could not be verified.

The catalog above records the stable codes and messages. They cover invalid package or source state, missing bound symbols, unwired instruction/schema/tool relationships, and tool-name mismatches.

Diagnostics use Core's shared adapter shape, preserve logical source locations, and remain deterministically ordered. Dynamic or indirect patterns yield partial or no evidence rather than guessed failures. Core validates adapter output and applies all-or-nothing inspection semantics.

`VERCEL_AI_SDK_TOOL_NAME_MISMATCH` and `VERCEL_AI_SDK_TOOL_REGISTRATION_NOT_WIRED` are mutually exclusive for one closed analysis: an exact registration found only under another key produces the mismatch, while complete absence produces not wired.

## Package detection

Detection stops at the nearest existing `package.json` owning each runtime-agent source. Supported dependency fields are considered collectively. A collectively disjoint range produces the unsupported-version diagnostic without package evidence; an ambiguous range remains evidence rather than being promoted to verified support. Invalid UTF-8 or NUL in the owning manifest produces only `VERCEL_AI_SDK_PACKAGE_MANIFEST_INVALID`; source text failures remain source diagnostics.

`VERCEL_AI_SDK_RUNTIME_RELATIONSHIP_UNVERIFIED` has severity `warning` when an applicable declared relationship remains unverified, including unsupported source patterns, dynamic or mutated wiring, and ranges spanning a relevant behavior change. Its safe details identify the relationship and reason; version-dependent warnings also include normalized dependency context. Independent export checks and proved contradictions remain errors. Warning-only validation is valid with `runtimeInspection: 'incomplete'`; it does not establish launch readiness. A newer eligible dependency version alone does not produce this warning.

## Declaration outcomes

Each applicable declared binding, tool, skill, schema, and variable provider receives evidence, a confirmed error, or a scoped unverified warning. Declared exports are checked independently of runtime wiring. A closed local export inventory can prove a symbol missing; dynamic or wildcard exports remain uncertain. Reader, snapshot, cancellation, and resource failures propagate through Core instead of being reported as unsupported source. Relationships absent from the declaration receive no invented warning.

Instruction-loader evidence requires both supported wiring and canonical source provenance. A supported loader reading a different file or returning different instruction text produces `INSTRUCTION_SOURCE_MISMATCH` with the adapter prefix. Unsupported loaders remain unverified. Proved mismatches from one consumer remain observable when another consumer is correctly wired. Static inspection does not execute application code or require a particular application architecture.

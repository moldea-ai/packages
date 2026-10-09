---
title: Evidence and diagnostics
description: Emitted evidence, stable diagnostic contracts, ambiguity, and all-or-nothing Core integration.
order: 20
---

# Evidence and diagnostics

## Evidence

The verified target may emit `agent-definition`, `handoff-registration`, `instruction-loader`, `language`, `runtime-package`, `schema`, and `tool-registration` evidence. Records are grounded in existing logical source references and may identify the relevant agent, capability, target agent, configuration property, schema role, or routing-description source.

Agent-definition evidence uses the exact supported static Agent name only when it satisfies Core's non-empty, single-line, NUL-free, Unicode-scalar machine-string contract without surrounding Repository Format whitespace. Otherwise it uses the bound runtime-agent symbol. A target Agent name that cannot satisfy the same contract is omitted from handoff details.

Handoff evidence maps a target only when exactly one registered `moldea` agent has the detected runtime binding. It reports a runtime name only for a supported static, non-empty `toolNameOverride` representable as a Core machine string. The adapter does not invent a manifest handoff graph or SDK-generated default name.

Evidence contains no repository content, instructions, descriptions, credentials, API keys, tool arguments, provider payloads, or model responses. Unverified declared relationships receive scoped warnings.

## Diagnostic catalog

| Code                                                      | Stable message                                                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `OPENAI_AGENTS_SDK_AGENT_INPUT_SCHEMA_SYMBOL_NOT_FOUND`   | The declared agent input-schema symbol was not found.                                                              |
| `OPENAI_AGENTS_SDK_SKILL_IMPLEMENTATION_SYMBOL_NOT_FOUND` | The declared skill-implementation symbol was not found.                                                            |
| `OPENAI_AGENTS_SDK_SKILL_REGISTRATION_SYMBOL_NOT_FOUND`   | The declared skill-registration symbol was not found.                                                              |
| `OPENAI_AGENTS_SDK_VARIABLE_PROVIDER_SYMBOL_NOT_FOUND`    | The declared variable-provider symbol was not found.                                                               |
| `OPENAI_AGENTS_SDK_INSTRUCTION_SOURCE_MISMATCH`           | The declared instruction loader does not consume the canonical instruction source.                                 |
| `OPENAI_AGENTS_SDK_AGENT_OUTPUT_SCHEMA_NOT_WIRED`         | The declared agent output schema is not wired to the detected OpenAI Agents SDK agent output type.                 |
| `OPENAI_AGENTS_SDK_AGENT_OUTPUT_SCHEMA_SYMBOL_NOT_FOUND`  | The declared agent output-schema symbol was not found.                                                             |
| `OPENAI_AGENTS_SDK_HANDOFF_ROUTING_DESCRIPTION_MISSING`   | The detected OpenAI Agents SDK handoff registration is missing its effective routing description.                  |
| `OPENAI_AGENTS_SDK_HANDOFF_ROUTING_DESCRIPTION_NOT_WIRED` | The detected OpenAI Agents SDK handoff registration does not use the target agent's effective routing description. |
| `OPENAI_AGENTS_SDK_HANDOFF_TARGET_AMBIGUOUS`              | The detected OpenAI Agents SDK handoff target matches more than one registered moldea agent.                       |
| `OPENAI_AGENTS_SDK_INSTRUCTION_LOADER_NOT_WIRED`          | The declared instruction loader is not wired to the detected OpenAI Agents SDK agent.                              |
| `OPENAI_AGENTS_SDK_INSTRUCTION_LOADER_SYMBOL_NOT_FOUND`   | The declared instruction-loader symbol was not found.                                                              |
| `OPENAI_AGENTS_SDK_PACKAGE_MANIFEST_INVALID`              | The owning package manifest is invalid for OpenAI Agents SDK dependency detection.                                 |
| `OPENAI_AGENTS_SDK_RUNTIME_AGENT_SYMBOL_NOT_FOUND`        | The declared runtime-agent symbol was not found.                                                                   |
| `OPENAI_AGENTS_SDK_SOURCE_SYNTAX_INVALID`                 | The referenced OpenAI Agents SDK source file contains invalid TypeScript syntax.                                   |
| `OPENAI_AGENTS_SDK_SOURCE_TEXT_INVALID`                   | The referenced OpenAI Agents SDK source file is not valid normalized text.                                         |
| `OPENAI_AGENTS_SDK_TOOL_IMPLEMENTATION_NOT_WIRED`         | The declared tool implementation is not wired to the detected OpenAI Agents SDK function tool.                     |
| `OPENAI_AGENTS_SDK_TOOL_IMPLEMENTATION_SYMBOL_NOT_FOUND`  | The declared tool-implementation symbol was not found.                                                             |
| `OPENAI_AGENTS_SDK_TOOL_INPUT_SCHEMA_NOT_WIRED`           | The declared tool input schema is not wired to the detected OpenAI Agents SDK function tool.                       |
| `OPENAI_AGENTS_SDK_TOOL_INPUT_SCHEMA_SYMBOL_NOT_FOUND`    | The declared tool input-schema symbol was not found.                                                               |
| `OPENAI_AGENTS_SDK_TOOL_NAME_MISMATCH`                    | The declared tool name does not match the detected OpenAI Agents SDK function-tool name.                           |
| `OPENAI_AGENTS_SDK_TOOL_OUTPUT_SCHEMA_NOT_WIRED`          | The declared tool output schema is not wired to the detected OpenAI Agents SDK function tool.                      |
| `OPENAI_AGENTS_SDK_TOOL_OUTPUT_SCHEMA_SYMBOL_NOT_FOUND`   | The declared tool output-schema symbol was not found.                                                              |
| `OPENAI_AGENTS_SDK_TOOL_REGISTRATION_NOT_WIRED`           | The declared tool registration is not wired to the detected OpenAI Agents SDK agent.                               |
| `OPENAI_AGENTS_SDK_TOOL_REGISTRATION_SYMBOL_NOT_FOUND`    | The declared tool-registration symbol was not found.                                                               |
| `OPENAI_AGENTS_SDK_VERSION_UNSUPPORTED`                   | The observed OpenAI Agents SDK dependency range is disjoint from the supported range.                              |
| `OPENAI_AGENTS_SDK_RUNTIME_RELATIONSHIP_UNVERIFIED`       | The declared runtime relationship could not be verified.                                                           |

Diagnostics use Core's shared adapter shape, preserve logical source locations, and remain deterministically ordered. Dynamic or indirect patterns yield partial or no evidence rather than guessed failures. Core validates adapter output and applies all-or-nothing inspection semantics.

## Package detection

Detection stops at the nearest existing `package.json` owning each runtime-agent source. Supported dependency fields are considered collectively. A collectively disjoint range produces the unsupported-version diagnostic without package evidence; an ambiguous range remains evidence rather than being promoted to verified support. Invalid UTF-8 or NUL in the owning manifest produces only `OPENAI_AGENTS_SDK_PACKAGE_MANIFEST_INVALID`; source text failures remain source diagnostics.

`OPENAI_AGENTS_SDK_RUNTIME_RELATIONSHIP_UNVERIFIED` has severity `warning` when an applicable declared relationship remains unverified, including unsupported source patterns, dynamic or mutated wiring, and ranges spanning a relevant behavior change. Its safe details identify the relationship and reason; version-dependent warnings also include normalized dependency context. Independent export checks and proved contradictions remain errors. Warning-only validation is valid with `runtimeInspection: 'incomplete'`; it does not establish launch readiness. A newer eligible dependency version alone does not produce this warning.

## Declaration outcomes

Each applicable declared binding, tool, skill, schema, and variable provider receives evidence, a confirmed error, or a scoped unverified warning. Declared exports are checked independently of runtime wiring. A closed local export inventory can prove a symbol missing; dynamic or wildcard exports remain uncertain. Reader, snapshot, cancellation, and resource failures propagate through Core instead of being reported as unsupported source. Relationships absent from the declaration receive no invented warning.

Instruction-loader evidence requires both supported wiring and canonical source provenance. A supported loader reading a different file or returning different instruction text produces `INSTRUCTION_SOURCE_MISMATCH` with the adapter prefix. Unsupported loaders remain unverified. Proved mismatches from one consumer remain observable when another consumer is correctly wired. Static inspection does not execute application code or require a particular application architecture.

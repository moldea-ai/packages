---
title: Evidence and diagnostics
description: Emitted evidence, stable diagnostics, availability, and all-or-nothing Core integration.
order: 20
---

# Evidence and diagnostics

## Evidence

The target may emit `runtime-package`, `language`, `runtime-pattern`, `agent-definition`, `instruction-loader`, `schema`, `tool-registration`, and `handoff-registration` evidence.

`runtime-pattern` identifies a direct query wrapper. `agent-definition` identifies a supported immutable programmatic definition. `handoff-registration` requires an active query context whose built-in `Agent` tool is available. `tool-registration` requires a canonical server key, an exact fully qualified runtime name, and available query or subagent tool state.

Instruction evidence distinguishes a direct query prompt, a typed custom prompt, a preset append, and a subagent prompt. Snapshot, verbatim delivery, and ambient-file controls leave direct binding evidence intact; they do not prove what the model receives in a session.

Evidence contains no repository content, prompts, descriptions, credentials, API keys, tool arguments, provider payloads, MCP results, session transcripts, or model responses. Unverified declared relationships receive scoped warnings.

## Diagnostic catalog

| Code                                                     | Stable message                                                                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE_AGENT_SDK_AGENT_INPUT_SCHEMA_SYMBOL_NOT_FOUND`   | The declared agent input-schema symbol was not found.                                                                     |
| `CLAUDE_AGENT_SDK_TOOL_OUTPUT_SCHEMA_SYMBOL_NOT_FOUND`   | The declared tool output-schema symbol was not found.                                                                     |
| `CLAUDE_AGENT_SDK_SKILL_IMPLEMENTATION_SYMBOL_NOT_FOUND` | The declared skill-implementation symbol was not found.                                                                   |
| `CLAUDE_AGENT_SDK_SKILL_REGISTRATION_SYMBOL_NOT_FOUND`   | The declared skill-registration symbol was not found.                                                                     |
| `CLAUDE_AGENT_SDK_VARIABLE_PROVIDER_SYMBOL_NOT_FOUND`    | The declared variable-provider symbol was not found.                                                                      |
| `CLAUDE_AGENT_SDK_INSTRUCTION_SOURCE_MISMATCH`           | The declared instruction loader does not consume the canonical instruction source.                                        |
| `CLAUDE_AGENT_SDK_AGENT_OUTPUT_SCHEMA_NOT_WIRED`         | The declared agent output schema is not wired to the detected Claude Agent SDK query output format.                       |
| `CLAUDE_AGENT_SDK_AGENT_OUTPUT_SCHEMA_SYMBOL_NOT_FOUND`  | The declared agent output-schema symbol was not found.                                                                    |
| `CLAUDE_AGENT_SDK_HANDOFF_ROUTING_DESCRIPTION_MISSING`   | The detected Claude Agent SDK subagent registration has no supported routing description.                                 |
| `CLAUDE_AGENT_SDK_HANDOFF_ROUTING_DESCRIPTION_NOT_WIRED` | The detected Claude Agent SDK subagent routing description does not use the target agent's effective routing description. |
| `CLAUDE_AGENT_SDK_HANDOFF_TARGET_AMBIGUOUS`              | The detected Claude Agent SDK subagent target matches more than one registered moldea agent.                              |
| `CLAUDE_AGENT_SDK_INSTRUCTION_LOADER_NOT_WIRED`          | The declared instruction loader is not wired to the detected Claude Agent SDK agent.                                      |
| `CLAUDE_AGENT_SDK_INSTRUCTION_LOADER_SYMBOL_NOT_FOUND`   | The declared instruction-loader symbol was not found.                                                                     |
| `CLAUDE_AGENT_SDK_PACKAGE_MANIFEST_INVALID`              | The owning package manifest is invalid for Claude Agent SDK dependency detection.                                         |
| `CLAUDE_AGENT_SDK_RUNTIME_AGENT_SYMBOL_NOT_FOUND`        | The declared runtime-agent symbol was not found.                                                                          |
| `CLAUDE_AGENT_SDK_SOURCE_SYNTAX_INVALID`                 | The referenced Claude Agent SDK source file contains invalid TypeScript syntax.                                           |
| `CLAUDE_AGENT_SDK_SOURCE_TEXT_INVALID`                   | The referenced Claude Agent SDK source file is not valid normalized text.                                                 |
| `CLAUDE_AGENT_SDK_TOOL_IMPLEMENTATION_NOT_WIRED`         | The declared tool implementation is not wired to the detected Claude Agent SDK custom tool.                               |
| `CLAUDE_AGENT_SDK_TOOL_IMPLEMENTATION_SYMBOL_NOT_FOUND`  | The declared tool-implementation symbol was not found.                                                                    |
| `CLAUDE_AGENT_SDK_TOOL_INPUT_SCHEMA_NOT_WIRED`           | The declared tool input schema is not wired to the detected Claude Agent SDK custom tool.                                 |
| `CLAUDE_AGENT_SDK_TOOL_INPUT_SCHEMA_SYMBOL_NOT_FOUND`    | The declared tool input-schema symbol was not found.                                                                      |
| `CLAUDE_AGENT_SDK_TOOL_NAME_MISMATCH`                    | The declared tool name does not match the detected Claude Agent SDK MCP tool name.                                        |
| `CLAUDE_AGENT_SDK_MCP_SERVER_KEY_UNSUPPORTED`            | The detected Claude Agent SDK MCP server key cannot establish a canonical runtime-name segment.                           |
| `CLAUDE_AGENT_SDK_TOOL_REGISTRATION_NOT_WIRED`           | The declared tool registration is not available to the detected Claude Agent SDK agent.                                   |
| `CLAUDE_AGENT_SDK_TOOL_REGISTRATION_SYMBOL_NOT_FOUND`    | The declared tool-registration symbol was not found.                                                                      |
| `CLAUDE_AGENT_SDK_VERSION_UNSUPPORTED`                   | The observed Claude Agent SDK dependency range is disjoint from the supported range.                                      |
| `CLAUDE_AGENT_SDK_RUNTIME_RELATIONSHIP_UNVERIFIED`       | The declared runtime relationship could not be verified.                                                                  |

`CLAUDE_AGENT_SDK_RUNTIME_RELATIONSHIP_UNVERIFIED`: The declared runtime relationship could not be verified.

The catalog above records the stable codes and messages. They cover invalid package or source state, missing bound symbols, unwired instruction/schema/tool relationships, unsupported MCP server keys, tool-name mismatches, ambiguous subagent targets, and missing or mismatched routing descriptions.

Diagnostics use Core's shared adapter shape, preserve logical source locations, and remain deterministically ordered. Dynamic or indirect patterns yield partial or no evidence rather than guessed failures. Core validates adapter output and applies all-or-nothing inspection semantics.

`CLAUDE_AGENT_SDK_TOOL_NAME_MISMATCH` and `CLAUDE_AGENT_SDK_TOOL_REGISTRATION_NOT_WIRED` are mutually exclusive for one closed registration analysis: an exact tool mounted only under the wrong runtime name produces the mismatch, while complete absence produces not wired.

## Package detection

Detection stops at the nearest existing `package.json` owning each runtime-agent source. Supported dependency fields are considered collectively. A collectively disjoint range produces the unsupported-version diagnostic without package evidence; an ambiguous range remains evidence rather than being promoted to verified support. Invalid UTF-8 or NUL in the owning manifest produces only `CLAUDE_AGENT_SDK_PACKAGE_MANIFEST_INVALID`; source text failures remain source diagnostics.

`CLAUDE_AGENT_SDK_RUNTIME_RELATIONSHIP_UNVERIFIED` has severity `warning` when an applicable declared relationship remains unverified, including unsupported source patterns, dynamic or mutated wiring, and ranges spanning a relevant behavior change. Its safe details identify the relationship and reason; version-dependent warnings also include normalized dependency context. Independent export checks and proved contradictions remain errors. Warning-only validation is valid with `runtimeInspection: 'incomplete'`; it does not establish launch readiness. A newer eligible dependency version alone does not produce this warning.

## Declaration outcomes

Each applicable declared binding, tool, skill, schema, and variable provider receives evidence, a confirmed error, or a scoped unverified warning. Declared exports are checked independently of runtime wiring. A closed local export inventory can prove a symbol missing; dynamic or wildcard exports remain uncertain. Reader, snapshot, cancellation, and resource failures propagate through Core instead of being reported as unsupported source. Relationships absent from the declaration receive no invented warning.

Instruction-loader evidence requires both supported wiring and canonical source provenance. A supported loader reading a different file or returning different instruction text produces `INSTRUCTION_SOURCE_MISMATCH` with the adapter prefix. Unsupported loaders remain unverified. Proved mismatches from one consumer remain observable when another consumer is correctly wired. Static inspection does not execute application code or require a particular application architecture.

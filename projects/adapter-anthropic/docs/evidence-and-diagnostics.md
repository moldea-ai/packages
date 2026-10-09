---
title: Evidence and diagnostics
description: Emitted evidence kinds, stable diagnostic contracts, ambiguity, and Core integration.
order: 20
---

# Evidence and diagnostics

## Evidence

The verified target may emit `runtime-package`, `language`, `runtime-pattern`, `instruction-loader`, `tool-registration`, and `schema` evidence. Records are grounded in existing logical source references and may identify the relevant agent or tool capability.

Evidence contains no repository content, instructions, system prompts, credentials, API keys, tool arguments, provider payloads, or model messages. Unverified declared relationships receive scoped warnings.

## Diagnostic catalog

| Code                                              | Stable message                                                                                  |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `ANTHROPIC_AGENT_INPUT_SCHEMA_SYMBOL_NOT_FOUND`   | The declared agent input-schema symbol was not found.                                           |
| `ANTHROPIC_TOOL_IMPLEMENTATION_SYMBOL_NOT_FOUND`  | The declared tool-implementation symbol was not found.                                          |
| `ANTHROPIC_TOOL_OUTPUT_SCHEMA_SYMBOL_NOT_FOUND`   | The declared tool output-schema symbol was not found.                                           |
| `ANTHROPIC_SKILL_IMPLEMENTATION_SYMBOL_NOT_FOUND` | The declared skill-implementation symbol was not found.                                         |
| `ANTHROPIC_SKILL_REGISTRATION_SYMBOL_NOT_FOUND`   | The declared skill-registration symbol was not found.                                           |
| `ANTHROPIC_VARIABLE_PROVIDER_SYMBOL_NOT_FOUND`    | The declared variable-provider symbol was not found.                                            |
| `ANTHROPIC_INSTRUCTION_SOURCE_MISMATCH`           | The declared instruction loader does not consume the canonical instruction source.              |
| `ANTHROPIC_INSTRUCTION_LOADER_NOT_WIRED`          | The declared instruction loader is not wired to the detected Anthropic Messages API call.       |
| `ANTHROPIC_INSTRUCTION_LOADER_SYMBOL_NOT_FOUND`   | The declared instruction-loader symbol was not found.                                           |
| `ANTHROPIC_OUTPUT_SCHEMA_NOT_WIRED`               | The declared agent output schema is not wired to the detected Messages output format.           |
| `ANTHROPIC_OUTPUT_SCHEMA_SYMBOL_NOT_FOUND`        | The declared agent output-schema symbol was not found.                                          |
| `ANTHROPIC_PACKAGE_MANIFEST_INVALID`              | The owning package manifest is invalid for Anthropic dependency detection.                      |
| `ANTHROPIC_RUNTIME_AGENT_SYMBOL_NOT_FOUND`        | The declared runtime-agent symbol was not found.                                                |
| `ANTHROPIC_SDK_VERSION_UNSUPPORTED`               | The observed Anthropic SDK dependency range is disjoint from the supported range.               |
| `ANTHROPIC_SOURCE_SYNTAX_INVALID`                 | The referenced Anthropic source file contains invalid TypeScript syntax.                        |
| `ANTHROPIC_SOURCE_TEXT_INVALID`                   | The referenced Anthropic source file is not valid normalized text.                              |
| `ANTHROPIC_TOOL_INPUT_SCHEMA_NOT_WIRED`           | The declared tool input schema is not wired to the detected Anthropic client-tool input schema. |
| `ANTHROPIC_TOOL_INPUT_SCHEMA_SYMBOL_NOT_FOUND`    | The declared tool input-schema symbol was not found.                                            |
| `ANTHROPIC_TOOL_NAME_MISMATCH`                    | The declared tool name does not match the detected Anthropic client-tool name.                  |
| `ANTHROPIC_TOOL_NAME_INVALID`                     | The detected Anthropic client-tool name violates the supported provider limit.                  |
| `ANTHROPIC_TOOL_REGISTRATION_NOT_WIRED`           | The declared tool registration is not wired to the detected Anthropic Messages API call.        |
| `ANTHROPIC_TOOL_REGISTRATION_SYMBOL_NOT_FOUND`    | The declared tool-registration symbol was not found.                                            |
| `ANTHROPIC_RUNTIME_RELATIONSHIP_UNVERIFIED`       | The declared runtime relationship could not be verified.                                        |

Diagnostics use Core's adapter shape, preserve logical source locations, identify the scoped agent or tool when applicable, and remain deterministically ordered. Dynamic or indirect patterns yield partial or no evidence instead of guessed failures.

## Package detection

Detection stops at the nearest existing `package.json` owning each runtime-agent source. Dependency declarations across `dependencies`, `optionalDependencies`, `peerDependencies`, and `devDependencies` are considered collectively. A collectively disjoint range produces the unsupported-version diagnostic; an ambiguous range remains observational evidence. Invalid UTF-8 or NUL in the owning manifest produces only `ANTHROPIC_PACKAGE_MANIFEST_INVALID`; `ANTHROPIC_SOURCE_TEXT_INVALID` is reserved for referenced TypeScript source files.

`ANTHROPIC_RUNTIME_RELATIONSHIP_UNVERIFIED` has severity `warning` when an applicable declared relationship remains unverified, including unsupported source patterns, dynamic or mutated wiring, and ranges spanning a relevant behavior change. Its safe details identify the relationship and reason; version-dependent warnings also include normalized dependency context. Independent export checks and proved contradictions remain errors. Warning-only validation is valid with `runtimeInspection: 'incomplete'`; it does not establish launch readiness. A newer eligible dependency version alone does not produce this warning.

## Declaration outcomes

Each applicable declared binding, tool, skill, schema, and variable provider receives evidence, a confirmed error, or a scoped unverified warning. Declared exports are checked independently of runtime wiring. A closed local export inventory can prove a symbol missing; dynamic or wildcard exports remain uncertain. Reader, snapshot, cancellation, and resource failures propagate through Core instead of being reported as unsupported source. Relationships absent from the declaration receive no invented warning.

Instruction-loader evidence requires both supported wiring and canonical source provenance. A supported loader reading a different file or returning different instruction text produces `INSTRUCTION_SOURCE_MISMATCH` with the adapter prefix. Unsupported loaders remain unverified. Proved mismatches from one consumer remain observable when another consumer is correctly wired. Static inspection does not execute application code or require a particular application architecture.

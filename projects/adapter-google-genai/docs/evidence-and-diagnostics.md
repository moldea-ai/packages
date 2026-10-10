---
title: Evidence and diagnostics
description: Evidence kinds, stable diagnostics, conservative ambiguity, and cascade suppression.
order: 20
---

# Evidence and diagnostics

The target may emit `runtime-package`, `language`, `runtime-pattern`, `instruction-loader`, `tool-registration`, and `schema` evidence. Records identify only safe scalar metadata and logical source references.

## Diagnostic catalog

| Code                                                 | Stable message                                                                                             |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `GOOGLE_GENAI_AGENT_INPUT_SCHEMA_SYMBOL_NOT_FOUND`   | The declared agent input-schema symbol was not found.                                                      |
| `GOOGLE_GENAI_AGENT_OUTPUT_SCHEMA_SYMBOL_NOT_FOUND`  | The declared agent output-schema symbol was not found.                                                     |
| `GOOGLE_GENAI_TOOL_IMPLEMENTATION_SYMBOL_NOT_FOUND`  | The declared tool-implementation symbol was not found.                                                     |
| `GOOGLE_GENAI_TOOL_OUTPUT_SCHEMA_SYMBOL_NOT_FOUND`   | The declared tool output-schema symbol was not found.                                                      |
| `GOOGLE_GENAI_SKILL_IMPLEMENTATION_SYMBOL_NOT_FOUND` | The declared skill-implementation symbol was not found.                                                    |
| `GOOGLE_GENAI_SKILL_REGISTRATION_SYMBOL_NOT_FOUND`   | The declared skill-registration symbol was not found.                                                      |
| `GOOGLE_GENAI_VARIABLE_PROVIDER_SYMBOL_NOT_FOUND`    | The declared variable-provider symbol was not found.                                                       |
| `GOOGLE_GENAI_INSTRUCTION_SOURCE_MISMATCH`           | The declared instruction loader does not consume the canonical instruction source.                         |
| `GOOGLE_GENAI_FUNCTION_DECLARATION_LIMIT_EXCEEDED`   | The detected Google Gen AI function-declaration collection exceeds the supported SDK declaration limit.    |
| `GOOGLE_GENAI_INSTRUCTION_LOADER_NOT_WIRED`          | The declared instruction loader is not wired to the detected Google Gen AI generate-content configuration. |
| `GOOGLE_GENAI_INSTRUCTION_LOADER_SYMBOL_NOT_FOUND`   | The declared instruction-loader symbol was not found.                                                      |
| `GOOGLE_GENAI_PACKAGE_MANIFEST_INVALID`              | The owning package manifest is invalid for Google Gen AI dependency detection.                             |
| `GOOGLE_GENAI_RUNTIME_AGENT_SYMBOL_NOT_FOUND`        | The declared runtime-agent symbol was not found.                                                           |
| `GOOGLE_GENAI_SDK_VERSION_UNSUPPORTED`               | The observed Google Gen AI SDK dependency range is disjoint from the supported range.                      |
| `GOOGLE_GENAI_SOURCE_SYNTAX_INVALID`                 | The referenced Google Gen AI source file contains invalid TypeScript syntax.                               |
| `GOOGLE_GENAI_SOURCE_TEXT_INVALID`                   | The referenced Google Gen AI source file is not valid normalized text.                                     |
| `GOOGLE_GENAI_TOOL_INPUT_SCHEMA_NOT_WIRED`           | The declared tool input schema is not wired to the detected function declaration's parameters JSON schema. |
| `GOOGLE_GENAI_TOOL_INPUT_SCHEMA_SYMBOL_NOT_FOUND`    | The declared tool input-schema symbol was not found.                                                       |
| `GOOGLE_GENAI_TOOL_NAME_INVALID`                     | The detected Google Gen AI function name violates the supported SDK declaration limit.                     |
| `GOOGLE_GENAI_TOOL_NAME_MISMATCH`                    | The declared tool name does not match the detected Google Gen AI function name.                            |
| `GOOGLE_GENAI_TOOL_REGISTRATION_NOT_WIRED`           | The declared tool registration is not wired to the detected Google Gen AI function-declaration collection. |
| `GOOGLE_GENAI_TOOL_REGISTRATION_SYMBOL_NOT_FOUND`    | The declared tool-registration symbol was not found.                                                       |
| `GOOGLE_GENAI_RUNTIME_RELATIONSHIP_UNVERIFIED`       | The declared runtime relationship could not be verified.                                                   |

Invalid text or syntax suppresses derived symbol and relationship diagnostics for that source. Missing symbols suppress their derived wiring diagnostics. Unsupported or dynamic requests, configurations, collections, containers, registrations, or schema values suppress negative relationship diagnostics when they could contain the declared relationship. Independently proved package, name, and collection-limit diagnostics remain observable.

`GOOGLE_GENAI_RUNTIME_RELATIONSHIP_UNVERIFIED` has severity `warning` when an applicable declared relationship remains unverified, including unsupported source patterns, dynamic or mutated wiring, and ranges spanning a relevant behavior change. Its safe details identify the relationship and reason; version-dependent warnings also include normalized dependency context. Independent export checks and proved contradictions remain errors. Warning-only validation is valid with `runtimeInspection: 'incomplete'`; it does not establish launch readiness. A newer eligible dependency version alone does not produce this warning.

## Declaration outcomes

Each applicable declared binding, tool, skill, schema, and variable provider receives evidence, a confirmed error, or a scoped unverified warning. Declared exports are checked independently of runtime wiring. A closed local export inventory can prove a symbol missing; dynamic or wildcard exports remain uncertain. Reader, snapshot, cancellation, and resource failures propagate through Core instead of being reported as unsupported source. Relationships absent from the declaration receive no invented warning.

Instruction-loader evidence requires both supported wiring and canonical source provenance. A supported loader reading a different file or returning different instruction text produces `INSTRUCTION_SOURCE_MISMATCH` with the adapter prefix. Unsupported loaders remain unverified. Proved mismatches from one consumer remain observable when another consumer is correctly wired. Static inspection does not execute application code or require a particular application architecture.

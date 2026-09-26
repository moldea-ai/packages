---
title: Evidence and diagnostics
description: Source-grounded Eve observations and stable adapter failures.
order: 20
---

# Evidence and diagnostics

The adapter may emit `runtime-package`, `language`, `agent-definition`, `instruction-loader`, `schema`, `tool-registration`, `skill-registration`, and `handoff-registration` evidence. Dynamic or collided forms suppress optimistic evidence and any negative diagnostic that would require selecting an uncertain source.

## Stable diagnostics

| Code                                        | Message                                                                                |
| ------------------------------------------- | -------------------------------------------------------------------------------------- |
| `EVE_PACKAGE_MANIFEST_INVALID`              | The owning package manifest is invalid for Eve dependency detection.                   |
| `EVE_SDK_VERSION_UNSUPPORTED`               | The observed Eve dependency range is disjoint from the supported range.                |
| `EVE_SDK_FEATURE_UNAVAILABLE`               | The declared Eve feature is unavailable in the eligible SDK versions.                  |
| `EVE_SOURCE_TEXT_INVALID`                   | The referenced Eve source file is not valid normalized text.                           |
| `EVE_SOURCE_SYNTAX_INVALID`                 | The referenced Eve source file contains invalid TypeScript syntax.                     |
| `EVE_RUNTIME_AGENT_SYMBOL_NOT_FOUND`        | The declared Eve runtime-agent symbol was not found.                                   |
| `EVE_INSTRUCTION_LOADER_SYMBOL_NOT_FOUND`   | The declared Eve instruction-loader symbol was not found.                              |
| `EVE_AGENT_OUTPUT_SCHEMA_SYMBOL_NOT_FOUND`  | The declared Eve agent output-schema symbol was not found.                             |
| `EVE_TOOL_IMPLEMENTATION_SYMBOL_NOT_FOUND`  | The declared Eve tool implementation symbol was not found.                             |
| `EVE_TOOL_REGISTRATION_SYMBOL_NOT_FOUND`    | The declared Eve tool registration symbol was not found.                               |
| `EVE_TOOL_INPUT_SCHEMA_SYMBOL_NOT_FOUND`    | The declared Eve tool input-schema symbol was not found.                               |
| `EVE_TOOL_OUTPUT_SCHEMA_SYMBOL_NOT_FOUND`   | The declared Eve tool output-schema symbol was not found.                              |
| `EVE_SKILL_IMPLEMENTATION_SYMBOL_NOT_FOUND` | The declared Eve skill implementation symbol was not found.                            |
| `EVE_SKILL_REGISTRATION_SYMBOL_NOT_FOUND`   | The declared Eve skill registration symbol was not found.                              |
| `EVE_INSTRUCTION_ROOT_CONFLICT`             | The Eve instruction slot contains conflicting authored sources.                        |
| `EVE_INSTRUCTION_LOADER_NOT_WIRED`          | The declared instruction loader is not wired to the supported Eve instruction surface. |
| `EVE_AGENT_OUTPUT_SCHEMA_NOT_WIRED`         | The declared agent output schema is not wired to the Eve agent definition.             |
| `EVE_TOOL_IMPLEMENTATION_NOT_WIRED`         | The declared tool implementation is not wired to the Eve tool definition.              |
| `EVE_TOOL_REGISTRATION_NOT_WIRED`           | The declared tool registration is not wired to the owning Eve agent.                   |
| `EVE_WORKFLOW_EXECUTOR_NOT_WIRED`           | The Eve workflow tool lacks a compiled use workflow executor.                          |
| `EVE_TOOL_NAME_INVALID`                     | The Eve filesystem tool name is invalid.                                               |
| `EVE_TOOL_NAME_RESERVED`                    | The Eve filesystem tool name is reserved by the runtime.                               |
| `EVE_TOOL_RUNTIME_NAME_COLLISION`           | Multiple Eve tool sources resolve to the same runtime tool name.                       |
| `EVE_TOOL_NAME_MISMATCH`                    | The declared tool name does not match the Eve path-derived runtime name.               |
| `EVE_TOOL_INPUT_SCHEMA_NOT_WIRED`           | The declared tool input schema is not wired to the Eve tool definition.                |
| `EVE_TOOL_OUTPUT_SCHEMA_NOT_WIRED`          | The declared tool output schema is not wired to the Eve tool definition.               |
| `EVE_SKILL_IMPLEMENTATION_NOT_WIRED`        | The declared skill implementation is not the discovered Eve skill artifact.            |
| `EVE_SKILL_REGISTRATION_NOT_WIRED`          | The declared skill registration is not wired to the owning Eve agent.                  |
| `EVE_SKILL_NAME_MISMATCH`                   | The declared skill name does not match the Eve path-derived runtime name.              |
| `EVE_SUBAGENT_REGISTRATION_NOT_WIRED`       | The declared Eve subagent is not discovered by the runtime.                            |
| `EVE_TOOL_SUBAGENT_NAME_COLLISION`          | The Eve tool and subagent use the same runtime tool name.                              |
| `EVE_SUBAGENT_PARENT_AMBIGUOUS`             | Multiple registered Eve agents map to the local subagent's immediate parent root.      |
| `EVE_ROUTING_DESCRIPTION_MISSING`           | The supported Eve subagent definition is missing its routing description.              |
| `EVE_ROUTING_DESCRIPTION_NOT_WIRED`         | The Eve subagent description does not use the target effective routing description.    |
| `EVE_RUNTIME_RELATIONSHIP_UNVERIFIED`       | The declared runtime relationship could not be verified.                               |

Diagnostics never include source snippets, descriptions, instructions, schema contents, credentials, URLs, host paths, or raw TypeScript diagnostic messages.

`EVE_RUNTIME_RELATIONSHIP_UNVERIFIED` has severity `warning` only when the adapter identifies a declared relationship affected by a recognized but unresolved source candidate. Its safe details identify the relationship and reason; known version-behavior boundaries additionally carry normalized dependency context. Missing local evidence or a newer eligible dependency version alone does not produce this warning. Confirmed diagnostic codes remain errors.

The Eve `0.67.0` removal of `defineAgent.outputSchema` applies only when an agent schema property or binding is present. A declaration confined to `0.67.0` or later produces `EVE_SDK_FEATURE_UNAVAILABLE` for that relationship. A range spanning the removal emits `EVE_RUNTIME_RELATIONSHIP_UNVERIFIED` and withholds dependent agent and handoff evidence. An unaffected agent and a tool `outputSchema` keep their independent evidence.

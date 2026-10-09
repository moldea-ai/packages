---
title: Evidence and diagnostics
description: Source-grounded LangGraph observations and stable adapter failures.
order: 20
---

# Evidence and diagnostics

The adapter may emit `runtime-package`, `language`, `agent-definition`, `schema`, and `runtime-pattern` evidence. Stable runtime patterns are `state-graph-node`, `state-graph-edge`, `state-graph-conditional-edge`, `functional-task`, `functional-interrupt`, `functional-previous-state`, and `functional-final-state`.

Runtime names and source-derived name details use the closed safety grammar `^[A-Za-z0-9_][A-Za-z0-9_-]{0,127}$`. Values outside that grammar are omitted rather than rewritten. Evidence never contains source bodies, descriptions, schema contents, state values, checkpoint data, credentials, URLs, host paths, or raw non-SemVer package declarations.

## Stable diagnostics

| Code                                              | Stable message                                                                         |
| ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `LANGGRAPH_INSTRUCTION_LOADER_SYMBOL_NOT_FOUND`   | The declared instruction-loader symbol was not found.                                  |
| `LANGGRAPH_TOOL_IMPLEMENTATION_SYMBOL_NOT_FOUND`  | The declared tool-implementation symbol was not found.                                 |
| `LANGGRAPH_TOOL_REGISTRATION_SYMBOL_NOT_FOUND`    | The declared tool-registration symbol was not found.                                   |
| `LANGGRAPH_TOOL_INPUT_SCHEMA_SYMBOL_NOT_FOUND`    | The declared tool input-schema symbol was not found.                                   |
| `LANGGRAPH_TOOL_OUTPUT_SCHEMA_SYMBOL_NOT_FOUND`   | The declared tool output-schema symbol was not found.                                  |
| `LANGGRAPH_SKILL_IMPLEMENTATION_SYMBOL_NOT_FOUND` | The declared skill-implementation symbol was not found.                                |
| `LANGGRAPH_SKILL_REGISTRATION_SYMBOL_NOT_FOUND`   | The declared skill-registration symbol was not found.                                  |
| `LANGGRAPH_VARIABLE_PROVIDER_SYMBOL_NOT_FOUND`    | The declared variable-provider symbol was not found.                                   |
| `LANGGRAPH_INSTRUCTION_SOURCE_MISMATCH`           | The declared instruction loader does not consume the canonical instruction source.     |
| `LANGGRAPH_AGENT_INPUT_SCHEMA_NOT_WIRED`          | The declared agent input schema is not wired to the detected LangGraph input schema.   |
| `LANGGRAPH_AGENT_INPUT_SCHEMA_SYMBOL_NOT_FOUND`   | The declared agent input-schema symbol was not found.                                  |
| `LANGGRAPH_AGENT_OUTPUT_SCHEMA_NOT_WIRED`         | The declared agent output schema is not wired to the detected LangGraph output schema. |
| `LANGGRAPH_AGENT_OUTPUT_SCHEMA_SYMBOL_NOT_FOUND`  | The declared agent output-schema symbol was not found.                                 |
| `LANGGRAPH_PACKAGE_MANIFEST_INVALID`              | The owning package manifest is invalid for LangGraph dependency detection.             |
| `LANGGRAPH_RUNTIME_AGENT_SYMBOL_NOT_FOUND`        | The declared runtime-agent symbol was not found.                                       |
| `LANGGRAPH_SOURCE_SYNTAX_INVALID`                 | The referenced LangGraph source file contains invalid TypeScript syntax.               |
| `LANGGRAPH_SOURCE_TEXT_INVALID`                   | The referenced LangGraph source file is not valid normalized text.                     |
| `LANGGRAPH_VERSION_UNSUPPORTED`                   | The observed LangGraph target package ranges are disjoint from the supported target.   |
| `LANGGRAPH_RUNTIME_RELATIONSHIP_UNVERIFIED`       | The declared runtime relationship could not be verified.                               |

Dynamic, indirect, ambiguous, or unsupported forms suppress optimistic evidence and contradiction diagnostics that would require guessing runtime behavior.

`LANGGRAPH_RUNTIME_RELATIONSHIP_UNVERIFIED` has severity `warning` when an applicable declared relationship remains unverified, including unsupported source patterns, dynamic or mutated wiring, and ranges spanning a relevant behavior change. Its safe details identify the relationship and reason; version-dependent warnings also include normalized dependency context. Independent export checks and proved contradictions remain errors. Warning-only validation is valid with `runtimeInspection: 'incomplete'`; it does not establish launch readiness. A newer eligible dependency version alone does not produce this warning.

## Declaration outcomes

Each applicable declared binding, tool, skill, schema, and variable provider receives evidence, a confirmed error, or a scoped unverified warning. Declared exports are checked independently of runtime wiring. A closed local export inventory can prove a symbol missing; dynamic or wildcard exports remain uncertain. Reader, snapshot, cancellation, and resource failures propagate through Core instead of being reported as unsupported source. Relationships absent from the declaration receive no invented warning.

Instruction-loader evidence requires both supported wiring and canonical source provenance. A supported loader reading a different file or returning different instruction text produces `INSTRUCTION_SOURCE_MISMATCH` with the adapter prefix. Unsupported loaders remain unverified. Proved mismatches from one consumer remain observable when another consumer is correctly wired. Static inspection does not execute application code or require a particular application architecture.

---
title: Evidence and diagnostics
description: Source-grounded LangGraph observations and stable adapter failures.
order: 20
---

# Evidence and diagnostics

The adapter may emit `runtime-package`, `language`, `agent-definition`, `schema`, and `runtime-pattern` evidence. Stable runtime patterns are `state-graph-node`, `state-graph-edge`, `state-graph-conditional-edge`, `functional-task`, `functional-interrupt`, `functional-previous-state`, and `functional-final-state`.

Runtime names and source-derived name details use the closed safety grammar `^[A-Za-z0-9_][A-Za-z0-9_-]{0,127}$`. Values outside that grammar are omitted rather than rewritten. Evidence never contains source bodies, descriptions, schema contents, state values, checkpoint data, credentials, URLs, host paths, or raw non-SemVer package declarations.

## Stable diagnostics

| Code                                             | Message                                                                                |
| ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `LANGGRAPH_PACKAGE_MANIFEST_INVALID`             | The owning package manifest is invalid for LangGraph dependency detection.             |
| `LANGGRAPH_VERSION_UNSUPPORTED`                  | The observed LangGraph target package ranges are disjoint from the supported target.   |
| `LANGGRAPH_SOURCE_TEXT_INVALID`                  | The referenced LangGraph source file is not valid normalized text.                     |
| `LANGGRAPH_SOURCE_SYNTAX_INVALID`                | The referenced LangGraph source file contains invalid TypeScript syntax.               |
| `LANGGRAPH_RUNTIME_AGENT_SYMBOL_NOT_FOUND`       | The declared runtime-agent symbol was not found.                                       |
| `LANGGRAPH_AGENT_INPUT_SCHEMA_SYMBOL_NOT_FOUND`  | The declared agent input-schema symbol was not found.                                  |
| `LANGGRAPH_AGENT_OUTPUT_SCHEMA_SYMBOL_NOT_FOUND` | The declared agent output-schema symbol was not found.                                 |
| `LANGGRAPH_AGENT_INPUT_SCHEMA_NOT_WIRED`         | The declared agent input schema is not wired to the detected LangGraph input schema.   |
| `LANGGRAPH_AGENT_OUTPUT_SCHEMA_NOT_WIRED`        | The declared agent output schema is not wired to the detected LangGraph output schema. |
| `LANGGRAPH_RUNTIME_RELATIONSHIP_UNVERIFIED`      | The declared runtime relationship could not be verified.                               |

Dynamic, indirect, ambiguous, or unsupported forms suppress optimistic evidence and contradiction diagnostics that would require guessing runtime behavior.

`LANGGRAPH_RUNTIME_RELATIONSHIP_UNVERIFIED` has severity `warning` only when the adapter identifies a declared relationship affected by a recognized but unresolved source candidate. Its safe details identify the relationship and reason; known version-behavior boundaries additionally carry normalized dependency context. Missing local evidence or a newer eligible dependency version alone does not produce this warning. Confirmed diagnostic codes remain errors.

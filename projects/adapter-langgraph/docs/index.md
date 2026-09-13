---
title: LangGraph adapter
description: Deterministic evidence for LangGraph TypeScript workflows.
order: 1
---

# LangGraph adapter

`@moldea.ai/adapter-langgraph` connects Repository Format `1` declarations to static Graph API and Functional API forms. `@langchain/langgraph` `1.4.12` and companion `@langchain/core` `1.2.9` are the verified minimums. Later stable releases are eligible for deterministic inspection on a best-effort basis and must still match the documented source patterns.

The adapter begins at each declared runtime-agent path, finds its nearest owning package, checks the primary and companion declarations together, and returns immutable evidence and stable diagnostics through Core. It does not execute the application or treat package presence as proof of a LangGraph workflow.

The package exports only `langGraphAdapter`. The generated API reference derives that surface from the package export.

Start with the [complete binding example](https://packages.moldea.ai/adapters/langgraph/binding-example/) when connecting runtime source to canonical instructions, schemas, tools, or routing metadata. The same example ships locally as `docs/binding-example.md` in the installed package.

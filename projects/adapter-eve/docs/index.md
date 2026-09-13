---
title: Eve adapter
description: Deterministic evidence for Eve TypeScript filesystem agents.
order: 1
---

# Eve adapter

`@moldea.ai/adapter-eve` connects Repository Format `1` declarations to static Eve filesystem conventions. Eve `0.39.1` is the verified minimum. Later stable releases are eligible for deterministic inspection on a best-effort basis and must still match the documented source patterns.

The adapter begins at each declared runtime-agent path, finds its nearest owning package, validates the exact Eve layout, and returns immutable evidence and stable diagnostics through Core. It neither executes the application nor treats package presence as proof of an agent definition.

The package exports only `eveAdapter`. The generated API reference derives that surface from the package export.

Start with the [complete binding example](https://packages.moldea.ai/adapters/eve/binding-example/) when connecting runtime source to canonical instructions, schemas, tools, or routing metadata. The same example ships locally as `docs/binding-example.md` in the installed package.

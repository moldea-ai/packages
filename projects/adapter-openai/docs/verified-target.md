---
title: Verified target
description: Exact supported source language, module form, Responses pattern, package detection, and binding behavior.
order: 10
---

# Verified target

The canonical Runtime Compatibility Matrix defines the technical target as `typescript-responses-api-7`.

## Supported boundary

- TypeScript ESM files
- supported direct default or named `OpenAI` imports, selected direct helper imports, and relative named imports
- a nearest owning package manifest declaring npm `openai >=7.4.0`
- a module-local OpenAI client
- a bound exported runtime-agent function with direct `client.responses.create({ ... })`, `parse({ ... })`, or `stream({ ... })` object-literal calls
- one request argument or a second options argument; a static `body` replaces the first request body, while transport-only options leave it unchanged
- direct instruction-loader wiring through `instructions`, optionally awaited
- closed inline or immutable module-local function-tool arrays through `tools`
- direct tool input-schema wiring through function-tool `parameters`
- direct agent output-schema wiring through `text.format.schema` or the first argument of directly imported `zodTextFormat`

Bindings must remain lexically visible at each matched use. Parameters or local declarations that shadow the OpenAI client, loader, tool registration, or input schema do not establish evidence.

## Responses request analysis

Each supported call is analyzed independently. `instructions`, `tools`, and `text` have separate closure: a dynamic unrelated property does not erase a statically provable relationship. Exact shorthand relationship properties are treated as direct identifier values. Computed relationship properties, spreads, duplicate effective properties, methods, getters, or setters leave only the affected relationship unresolved. An unresolved options `body` leaves dependent relationships unverified.

Tool registrations retain varying-availability behavior across calls: one supported available context can establish a tool, and a missing-wiring error requires closed absence across the relevant contexts. Instruction consumers are checked independently. A correct consumer does not suppress another consumer’s proved mismatch, and unresolved consumers receive scoped warnings. Instruction evidence also requires supported provenance from the canonical instruction or a validated mirror.

## Static function tools

Supported function-tool objects require exact `type`, `name`, `parameters`, and `strict` properties. A static or `null` description is supported. `allowed_callers`, `defer_loading`, and `output_schema` are tolerated but not interpreted. Unknown properties or unsupported members leave registration unestablished.

Inline schema values support static strings, no-substitution templates, signed numbers, booleans, `null`, arrays without holes or spreads, and objects with exact identifier or string-literal properties. The adapter proves wiring, not OpenAI schema validity.

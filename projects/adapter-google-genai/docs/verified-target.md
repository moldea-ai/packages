---
title: Verified target
description: Exact package, language, generate-content, instruction, function-declaration, schema, and provider-limit behavior.
order: 10
---

# Verified target

The canonical Runtime Compatibility Matrix defines technical target `typescript-models-generate-content-2`.

## Runtime boundary

- TypeScript ESM `.ts`, `.tsx`, and `.mts` files
- named runtime value imports of `GoogleGenAI` from `@google/genai`
- the nearest owning manifest declaring `@google/genai >=2.17.1`
- a module-local `const` client constructed directly with `new GoogleGenAI(...)`
- a directly exported runtime-agent function containing exact non-computed `client.models.generateContent({ ... })` or `generateContentStream({ ... })` calls
- one exact object-literal request argument

`config` is resolved only as a direct object literal. `systemInstruction` and `tools` are classified independently inside it. Tool registrations retain varying-availability behavior across calls: one supported available context can establish a tool, and a missing-wiring error requires closed absence across the relevant contexts. Instruction consumers are checked independently. A correct consumer does not suppress another consumer’s proved mismatch, and unresolved consumers receive scoped warnings. Instruction evidence also requires supported provenance from the canonical instruction or a validated mirror.

## Function declarations

The tool path is `config.tools[].functionDeclarations[]`. Inline literals and immutable module-local `const` arrays and objects are supported. Arrays with holes or spreads, mutation, aliases, escapes, dynamic candidates, computed properties, and unknown container fields keep the affected relationship unresolved.

A supported declaration has a static `name`, optional static `description`, optional `parametersJsonSchema`, and optional uninterpreted `behavior`, `response`, and `responseJsonSchema`. The alternative `parameters` field is unsupported. Only a directly exported bound `const` object can establish manifest tool-registration and schema evidence; inline and unexported declarations still participate in closure and count checks.

Names must match `^[A-Za-z_][A-Za-z0-9_.:-]*$` and contain 1–128 Unicode scalar values. Every closed `functionDeclarations` collection permits at most 512 occurrences.

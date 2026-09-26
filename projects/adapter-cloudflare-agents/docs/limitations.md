---
title: Boundaries and limitations
description: Unsupported Cloudflare surfaces, source forms, and the adapter security boundary.
order: 30
---

# Boundaries and limitations

The current verified targets do not claim support for:

- JavaScript, Python, CommonJS, default imports, namespace imports, or source outside TypeScript ESM
- the bare `Agent` class, custom harnesses, factories, indirect subclasses, re-export graphs, or decorators
- executable class fields, static blocks, computed member names, generator methods, or non-pass-through constructors
- dynamic session builders, `onCompaction` behavior, mutable definitions, open tools maps, or channel-provided tool replacement
- nested generation calls, request variables, `prepareStep` instruction interpretation, or generation APIs other than `generateText` and `streamText`
- output variants other than `Output.object({ schema })` or any agent input schema
- dynamic, provider, MCP-generated, or inline tools as manifest registration identities
- arbitrary compiler resolution, `tsconfig` path aliases, directory indexes, package exports, or general re-export graphs
- runtime-generated strings, schema-content validation, provider compatibility, model behavior, or actual tool execution

Package detection uses nearest manifests, not lockfiles or installed `node_modules`. Known Think context behavior is interpreted from all observed declarations only when they establish one side of the 0.18.0 boundary. Broad, conflicting, missing, and non-SemVer declarations cannot establish that behavior. A warning is scoped to the instruction relationship affected by uncertainty; other closed relationships remain independently inspectable. AI SDK `deferLoading` and `toolSearch()` source does not prove runtime feature support or turn-time availability.

Each invocation sees one declared agent, exact same-runtime binding resolution, and only the bounded operations Core supplies through `IRuntimeAdapterRepository`. It receives no complete agent collection, project body index, host path, credential, environment variable, network client, or runtime process.

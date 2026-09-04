---
title: Command-line interface
navigationTitle: Overview
description: The canonical read-only local composition for bounded validation, metadata inspection, relationship scope, and explicit content retrieval.
order: 0
---

# The local package composition

`@moldea.ai/cli` version 7 provides the `moldea` executable. It emits concise human results or deterministic schema 4 JSON pages. Full validation and metadata inspection use Core with active official adapters; changed-path scope and explicit canonical content use adapter-free, path-selected repository reads.

```bash
pnpm add -D @moldea.ai/cli@7
pnpm exec moldea validate
```

Install and invoke the CLI from each adopted repository. Global, user-home, and cross-repository installations are outside the supported trust boundary because they can expose unrelated repositories to ambient executable or skill behavior.

The package exposes no supported JavaScript or TypeScript import API. Its public contract is the executable, command grammar, schema 4 envelope, bounded pagination and content chunks, status and exit semantics, safe operational errors, and runtime requirements.

## Composition

The CLI composes `@moldea.ai/repository`, `@moldea.ai/repository-fs`, `@moldea.ai/core`, and the currently active package-backed adapters. The `custom` runtime remains built into Core. The CLI reports only this installed executable composition and does not carry technical matrix targets or target maturity.

The Agent Skill consumes this local executable as its deterministic package layer. Complete skill installation, workflows, tutorials, target maturity, and qualification presentation belong to the separate public experiences; this documentation covers only the CLI contract.

## Boundaries

The executable performs no network requests, telemetry, repository writes, configured Git content transforms, runtime SDK calls, or model calls. It uses read-only Git operations and no-follow filesystem observations. `inspect` deliberately projects the richer Core result through a content-free metadata allowlist; complete canonical text is available only through an explicit bounded `content` request.

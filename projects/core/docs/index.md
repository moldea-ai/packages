---
title: Core
navigationTitle: Overview
description: Source-neutral, content-safe validation and universal binding coverage for moldea repositories.
order: 0
---

# Deterministic repository interpretation

`@moldea.ai/core` version 9 is the source-neutral interpretation layer for the `moldea` repository format. It accepts caller-supplied text or an `IRepositoryReader`, validates universal repository structure, matches changed paths against declared relationships, prepares reusable bounded content-free inspection, and checks declared files and runtime export names without executing application code.

Core never discovers or reads a filesystem, Git provider, or network on its own. Repository acquisition belongs to reader packages and local composition belongs to the CLI.

## Repository Format

Core implements Repository Format version `1`. The [Repository Format specification](/repository-format/) defines canonical files, manifest properties, validation boundaries, and conformance rules. Package documentation covers the deterministic implementation of that format.

## Available operations

- strict text normalization and normalized SHA-256 digests
- all-or-nothing manifest and decision parsing
- cheap content-free changed-path relationship matching
- content-free project validation summaries, diagnostics, and coverage
- bounded content-free agent-assignment, asset-metadata, diagnostic, coverage, or combined pages
- explicit canonical content pages by path and byte range
- identical universal checks for 35 runtime labels plus `custom`
- bounded coding-agent integration checks, including instruction links followed inside the repository and an optional instruction reader, and explicit warning acceptance
- bounded repository reads, syntax analysis, and coverage

## Entry points

- `@moldea.ai/core` exposes Core construction, public operations, and `parseIntegrationBlock(text)`.
- `@moldea.ai/core/format` exposes Repository Format contracts.
- `@moldea.ai/core/scope` exposes manifest-only matching without loading TypeScript.
- `@moldea.ai/core/node` exposes supervised Node inspection, asynchronous paging, and disposal.

Core does not own source discovery, repository writes, Git behavior, runtime execution, provider API calls, model calls, or semantic Assurance judgments. Use the generated [API reference](./api/) for the exact public surface.

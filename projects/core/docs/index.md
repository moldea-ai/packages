---
title: Core
navigationTitle: Overview
description: Source-neutral, content-safe validation and per-agent runtime-adapter composition for moldea repositories.
order: 0
---

# Deterministic repository interpretation

`@moldea.ai/core` version 3 is the source-neutral interpretation layer for the `moldea` repository format. It accepts caller-supplied text or an `IRepositoryReader`, validates universal repository structure, matches changed paths against declared relationships, exposes bounded content-free inspection, and invokes configured runtime adapters through per-agent contexts.

Core never discovers or reads a filesystem, Git provider, or network on its own. Repository acquisition belongs to reader packages and local composition belongs to the CLI.

## Repository Format

Core implements Repository Format version `1`. The [Repository Format specification](/repository-format/) defines canonical files, manifest properties, validation boundaries, and conformance rules. Package documentation covers the deterministic implementation of that format.

## Available operations

- strict text normalization and normalized SHA-256 digests
- all-or-nothing manifest and decision parsing
- cheap content-free changed-path relationship matching
- content-free project validation summaries, diagnostics, and evidence
- bounded content-free metadata, diagnostic, evidence, or combined pages
- explicit canonical content pages by path and byte range
- built-in `custom` runtime validation
- per-agent package-backed runtime-adapter invocation
- bounded repository reads and adapter output

## Entry points

- `@moldea.ai/core` exposes Core construction and public operations.
- `@moldea.ai/core/format` exposes Repository Format contracts.
- `@moldea.ai/core/adapter` exposes the runtime-adapter extension contract.

Core does not own source discovery, repository writes, Git behavior, runtime execution, provider API calls, model calls, or semantic Assurance judgments. Use the generated [API reference](./api/) for the exact public surface.

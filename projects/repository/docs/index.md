---
title: Repository access
navigationTitle: Overview
description: Source-neutral, resource-bounded repository contracts and an immutable in-memory reader.
order: 0
---

# Bounded repository access without source assumptions

`@moldea.ai/repository` version 2 defines the public boundary through which `moldea` code observes one coherent repository snapshot. Metadata lookup is content-free. Descendant enumeration, file content, and repository comparison are explicitly bounded and resumable.

The package keeps Core independent from source mechanics. `@moldea.ai/repository-fs` implements this contract for an explicitly selected local directory, other source packages can implement the same contract, and Core interprets only the portable entries and bytes returned through it.

## What it owns

- root-absolute logical repository paths
- immutable source snapshot identity
- exact metadata lookup
- deterministic bounded descendant pages
- bounded regular-file byte ranges
- bounded deterministic comparison pages
- integrity-protected, source-bound continuation cursors
- source and path exception contracts
- an immutable in-memory reference reader
- shared conformance tests for official readers

## What it does not own

The package does not access a filesystem or network, discover repositories, follow symlinks, decode file content, interpret the `moldea` format, apply Git ignore rules, or expose writes. Source implementations decide how to preserve snapshot coherence. Consumers decide what returned bytes mean.

## Entry points

- `@moldea.ai/repository` exports contracts, logical-path functions, exceptions, identity, and comparison.
- `@moldea.ai/repository/memory` exports the immutable reference reader.
- `@moldea.ai/repository/testing` exports the shared reader conformance suite.

Use the generated [API reference](./api/) for the exact exported surface.

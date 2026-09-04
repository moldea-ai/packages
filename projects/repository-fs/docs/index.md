---
title: Filesystem repository reader
navigationTitle: Overview
description: Lazy bounded Node.js access to an explicitly selected local repository root.
order: 0
---

# Bounded filesystem access behind the common reader contract

`@moldea.ai/repository-fs` version 2 exposes an explicitly selected local directory through `IRepositoryReader`. It maps host entries to portable logical paths, observes only the paths needed by current operations, and returns bounded metadata pages and byte ranges without materializing a repository-wide inventory.

The package is Git-agnostic. The CLI owns repository discovery, Git-aware path selection, nested-repository policy, and content-transformation guards. Trust-sensitive callers supply an exact path selection; raw directory mode deliberately exposes all eligible entries reached through it.

## Responsibilities

- canonicalize and pin an explicit absolute root
- enforce exact-path or directory selection
- classify entries without traversing symlinks or junctions
- paginate directory traversal with authenticated source-bound cursors
- verify observed filesystem identity and file ranges
- enforce independent concurrency, queue, entry, directory, page, read, and cache limits
- cache only complete verified ranges in bounded LRU storage
- map filesystem failures to source-neutral repository exceptions

## Boundaries

The reader does not discover Git roots, parse ignore rules, execute filters, interpret repository content, traverse symlinks, or expose host paths. It makes no unbounded eager repository scan during construction.

Use the generated [API reference](./api/) for exact exports.

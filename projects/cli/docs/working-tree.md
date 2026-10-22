---
title: Git working-tree source model
navigationTitle: Working-tree source
description: Git-aware inventory, repository discovery, guarded content, symlink handling, and snapshot stabilization.
order: 20
---

# Git working-tree source model

Git determines the absolute top-level working-tree root for the selected starting directory. Ordinary repositories, unborn repositories, nested invocation directories, and linked worktrees use this same discovery path. Bare repositories, Git-directory-only paths, sparse checkouts, malformed Git output, and unsupported versions fail before inventory begins.

## Inventory

`validate` and `inspect` read NUL-delimited tracked index records plus non-ignored untracked records using fixed, non-interactive Git commands. `scope` applies an exact top-level literal pathspec for `/moldea/moldea.yaml`; `content` applies one for the already validated canonical path. Selected commands therefore avoid whole-repository inventory cost. Every mode validates modes, stages, object identifiers, UTF-8 paths, ownership, and exact logical-path grammar before constructing the reader.

`validate` and `inspect` also run a separate instruction probe over literal pathspecs for `/AGENTS.md`, `/CLAUDE.md`, `/.claude/CLAUDE.md`, and `/CLAUDE.local.md`. It adds Git-ignored files at exactly those paths and builds the instruction reader that Core reads only for its coding-agent integration check. Ignored files never enter the general inventory, so inspection, impact patterns, and every other check see the same tree with or without them.

Submodule roots and their descendants are excluded. Untracked content owned by a nested repository is excluded. Missing candidates are omitted, while contradictory index stages, tracked/untracked collisions, unsupported types, unsafe paths, or ambiguous ownership fail atomically.

## Symlinks and content transforms

Native symlinks remain symlinks. A symlink or junction in the working tree also shadows every Git entry beneath it, whatever Git lists there, so the inventory keeps one link entry at its path and an unrelated link produces no diagnostic. When `core.symlinks=false`, tracked Git symlinks materialized as regular host files are overlaid as logical symlinks and never read as content. Their `readLinkText` returns the host file's bytes, which are exactly the link text Git stored.

Core follows a linked instruction file with Repository's `resolveRepositoryLink` over the instruction and repository readers, so native and materialized links resolve the same way and nothing outside the repository is read. A link that doesn't lead to a file in the repository is reported as `MOLDEA_INTEGRATION_LINK_UNRESOLVED` with its reason as qualifier.

The CLI classifies effective `filter`, `working-tree-encoding`, and `ident` attributes without executing filters, Git LFS, clean or smudge commands, or encoding helpers. A guarded regular file remains visible in the inventory but fails if Core requests its bytes, using the safe `git:GIT_CONTENT_TRANSFORM_UNSUPPORTED` contract.

## Stabilization

The selected working tree, worktree Git directory, and common Git directory are pinned by host identity. Each attempt compares the applicable complete or path-selected normalized inventories, plus the instruction inventory for `validate` and `inspect`, around exact-path reader construction and runs its operation only when they agree. Snapshot-related failures retry the whole provisional operation up to three total attempts; no provisional bytes or results are reused.

An unstable tree produces retryable `cli:WORKING_TREE_UNSTABLE`. Commands use observational Git operations only and preserve the worktree, real index, refs, `HEAD`, configuration, submodule state, and object-database state. The CLI never exposes selected host paths, raw process errors, Git stderr, or rejected values in its public errors.

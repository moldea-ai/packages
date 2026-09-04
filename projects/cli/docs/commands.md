---
title: Commands and options
description: Validate, inspect, scope, content, and installed composition command behavior.
order: 10
---

# Commands and options

```text
moldea validate
moldea inspect
moldea scope --path /src/example.ts
moldea scope --paths-stdin
moldea content --path /moldea/project.md
moldea composition
```

Top-level and command help, `moldea --version`, strict option parsing, and deterministic usage errors do not require repository access.

## `validate`

Validates the complete selected repository through Core and active runtime adapters. Human and JSON output contain ordered diagnostics but deliberately omit the project index, canonical content, and adapter evidence. Zero diagnostics produce `valid`; any diagnostics produce `invalid`.

## `inspect`

Runs the same full snapshot and inspection path. Human output reports format and complete counts. JSON output contains a deterministic page of allowlisted metadata records and never includes canonical bodies or arbitrary adapter evidence details.

## `scope`

Matches changed repository paths to manifest relationships without loading adapters or inspecting project documents. Supply one logical path through `--path`, or pass NUL-delimited UTF-8 paths to `--paths-stdin`. The result includes relevance, complete counts and digests, and paged match or diagnostic records. An empty relationship manifest returns `relevant: false` without scanning the repository.

## `content`

Reads one explicitly selected canonical moldea text asset. Accepted paths are the project manifest, project foundation, context, decisions, runtimes, and agent description, instruction, or handoff description assets. Directories, globs, traversal, Windows drive or backslash paths, and non-canonical repository files are rejected. Large text is returned in Unicode-scalar-safe chunks.

## `composition`

Reports the installed CLI version, JSON schema version, supported Node.js range, minimum Git version, exact package versions, Core repository-format versions, and active executable adapters. It performs release-integrity validation but does not invoke Git, discover a repository, read client files, or use the network. It does not report the Runtime Compatibility Matrix or target maturity; current published compatibility is available from [`https://packages.moldea.ai/compatibility/runtimes.json`](https://packages.moldea.ai/compatibility/runtimes.json).

## Repository and output options

Repository-backed commands accept `--repository <path>`, `--json`, `--no-color`, and positive safe-integer overrides for `--max-entries`, `--max-file-bytes`, and `--max-total-bytes`. `validate`, `inspect`, and `scope` also accept `--max-manifest-bytes` and `--max-diagnostics`; only adapter-backed `validate` and `inspect` accept `--max-evidence`.

JSON collection and content commands accept `--max-output-bytes <integer>` from 4,096 through 1,048,576, defaulting to 65,536, and `--cursor <opaque-cursor>` for continuation. Output budgets bound each final UTF-8 page, not repository size. Cursors are valid only for the same command, normalized filters, and repository snapshot.

The default repository is the invocation directory. Relative repository selections resolve from that directory.

## Runtime requirements

The CLI supports Node.js `>=22.11.0`. Repository-backed commands require Git `2.30.0` or later and a usable non-sparse working tree. `composition`, help, version, and argument validation do not require Git.

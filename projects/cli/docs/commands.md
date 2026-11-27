---
title: Commands and options
description: Validate, inspect, scope, content, and installed composition command behavior.
order: 10
---

# Commands and options

```bash
moldea validate
moldea inspect
moldea scope --path /src/example.ts
moldea scope --paths-stdin
moldea content --path /moldea/project.md
moldea composition
```

Top-level and command help, `moldea --version`, strict option parsing, and deterministic usage errors do not require repository access.

## `validate`

Validates the selected repository through Core. Human and JSON output report diagnostics and binding coverage without canonical content. Zero errors produce `valid`, including warning-only results. Every page includes complete binding coverage, diagnostic, error, unaccepted-warning and accepted-warning counts. JSON pages carry all diagnostics and only the coverage records for failed or unchecked checks. Missing or wrong-type binding files appear in diagnostics.

## `inspect`

Runs the same full snapshot and inspection path. Human output reports format and complete counts. JSON returns validity, complete counts, and paged inventory and diagnostics. Each inventory record has its file kind, canonical path, byte length, and applicable agent or decision ID.

## `scope`

Matches changed repository paths to manifest relationships without loading the export checker or inspecting project documents. Supply one leading-slash repository-logical path through `--path`, or pass NUL-delimited UTF-8 paths with the same grammar to `--paths-stdin`. Invalid paths return `PATH_INPUT_INVALID` before repository discovery; relative paths are not normalized. The result reports validity, relevance, complete counts and paged diagnostics and owner matches. Each match gives the owner’s canonical path and kind, the tool or skill ID when applicable, and its matched relationships. Each relationship contains `field` and the declared `path`, exactly as written in the manifest. Counts describe the complete match set, including declarations that match multiple input paths. An empty relationship manifest returns `relevant: false` without scanning the repository.

## `content`

Reads one explicitly selected canonical moldea text asset. Accepted paths are the project manifest, project foundation, focused context, decisions, and canonical agent descriptions and instructions. Directories, globs, traversal, Windows drive or backslash paths, and non-canonical repository files are rejected. Large text is returned in Unicode-scalar-safe chunks.

## `composition`

Reports the installed CLI version, JSON schema version, supported Node.js range, minimum Git version, exact foundational package versions and Core repository-format versions. It validates installation integrity without invoking Git, discovering a repository, reading client files or accessing the network.

## Repository and output options

Repository-backed commands accept `--repository <path>`, `--json`, `--no-color`, and positive safe-integer overrides for `--max-entries`, `--max-file-bytes`, and `--max-total-bytes`. `validate`, `inspect`, and `scope` also accept `--max-manifest-bytes` and `--max-diagnostics`; only `validate` and `inspect` accept `--max-coverage`.

JSON collection and content commands accept `--max-output-bytes <integer>` from 4,096 through 1,048,576, defaulting to 65,536, and `--cursor <opaque-cursor>` for continuation. Output budgets bound each final UTF-8 page, not repository size. Cursors are valid only for the same command, normalized filters, and repository snapshot.

The default repository is the invocation directory. Relative repository selections resolve from that directory.

## Runtime requirements

The CLI supports Node.js `>=22.17.0`. Repository-backed commands require Git `2.32.0` or later and a usable non-sparse working tree. `composition`, help, version, and argument validation do not require Git.

---
title: Output and operations
description: JSON envelopes, statuses, exit codes, safe errors, cancellation, read-only behavior, and installation integrity.
order: 30
---

# Output and operations

## JSON envelope

`--json` writes one deterministic schema 9 envelope to standard output. Envelopes contain exactly `schemaVersion`, `cliVersion`, `command`, `status`, `error`, and `result`, and every object's keys follow RFC 8785 order. No command mixes a partial success result with an operational error.

`validate`, `inspect`, `scope`, and `composition` are recursively content-free. `content` is the only command allowed to return a `content` property, and it does so only for one explicitly selected canonical asset.

Every diagnostic has `severity` and `group`. Core diagnostic `details` are never projected, so integration warnings about linked or Git-ignored instruction files expose neither link text nor target paths; `MOLDEA_INTEGRATION_LINK_UNRESOLVED` reports its reason through `qualifier`. Warnings also have `subject`, nullable `qualifier`, `acceptable`, boolean `accepted`, and nullable `reason` (non-null only for an accepted warning). `warningCount` excludes accepted warnings; `diagnosticCount` equals `errorCount + warningCount + acceptedWarningCount`. Inspect JSON exposes the same totals as `counts.errors`, `counts.warnings`, `counts.acceptedWarnings` and `counts.diagnostics`. Its `counts.coverage` gives the total number of binding coverage records, and its pages contain canonical asset metadata and diagnostics. Validate JSON returns full `coverageCounts` and pages the individual coverage records for failed or unchecked checks. Scope JSON pages diagnostics and owner matches, each carrying its distinct matched manifest declarations. Zero errors produce `valid`, including warning-only results. Human Validate and Inspect output print unaccepted warning identities, a coverage summary and an accepted-warning count.

Collection and content JSON use a default 65,536-byte page budget and accept explicit budgets from 4,096 through 1,048,576 bytes. Byte accounting measures the final newline-terminated UTF-8 serialization after escaping. Paged Validate, Inspect and Scope records have opaque eleven-digit base-36 ordinal keys in deterministic order across pages. Opaque cursors bind their format version, command, filters, source snapshot, last key, and checksum. Pages can traverse a large repository without gaps or duplicate records; a changed snapshot fails instead of mixing states. A change that alters a linked instruction file’s validation result invalidates a Validate cursor. An Inspect cursor also detects changes in a canonical file’s body when its listed metadata stays the same.

Each reported binding coverage record includes `fileCheck`, `exportCheck`, and the reason when an export could not be checked. Missing and wrong-type binding files appear in diagnostics. TypeScript and JavaScript ESM use conservative syntax-only export inventories; CommonJS, unsupported extensions and inconclusive syntax remain not checked. A passed export check does not establish runtime wiring or SDK compatibility. Interrupted operations return an error without a partial coverage result.

## Resource budgets

These defaults describe CLI 15 with Core 10. Options take byte counts or positive safe-integer counts as appropriate.

| Option                 |               Default | Scope                                                                              |
| ---------------------- | --------------------: | ---------------------------------------------------------------------------------- |
| `--max-file-bytes`     |     8 MiB (`8388608`) | One complete file read when required                                               |
| `--max-manifest-bytes` |     2 MiB (`2097152`) | Canonical manifest                                                                 |
| `--max-entries`        |              `100000` | Git-selected inventory and Core path accounting, each enforced at its own boundary |
| `--max-total-bytes`    | 128 MiB (`134217728`) | Core source reads; separately, inventory metadata and filesystem cache budgets     |
| `--max-diagnostics`    |               `10000` | Produced diagnostics                                                               |
| `--max-coverage`       |               `10000` | Produced binding coverage records                                                  |
| `--max-output-bytes`   |      64 KiB (`65536`) | One newline-terminated JSON page; allowed range 4 KiB through 1 MiB                |

Input limits require `maxManifestBytes <= maxFileBytes <= maxTotalBytes`. The CLI derives logical retained bytes as four times `maxTotalBytes`, capped at JavaScript’s maximum safe integer. The Node boundary reserves 48 MiB of that allowance for transport. Neither this ledger nor the input options guarantee total RAM use or raise the [fixed analysis profile](/packages/core/repository-inspection/#isolated-node-inspection).

The CLI supplies exact Git-selected paths to Repository FS and overrides its raw reader defaults: cache bytes use `maxTotalBytes`; observed entries and directory entries use `maxEntries`; metadata pages use the smaller of `4096` and `maxEntries`; range reads use `maxFileBytes`. The [standalone reader limits](/packages/repository-fs/security-and-limits/#resource-limits) therefore are not additional CLI-wide input limits.

Pagination bounds output, not complete analysis. It does not reset read/entry budgets, bypass source parsing, or divide an oversized complete record. `scope` and `content` use focused paths without loading the export checker; `validate` and `inspect` perform the required project inspection. On a refusal, inspect its named dimension and required scope before changing an input budget. Fixed worker failures require reviewing inspection capacity, not raising an input option or repeatedly retrying unchanged source.

## Status and exit codes

| Outcome                                   | Status                       |               Exit code |
| ----------------------------------------- | ---------------------------- | ----------------------: |
| Completed inspection without errors       | `valid`                      |                     `0` |
| Completed structurally invalid inspection | `invalid`                    |                     `1` |
| Invocation or operational error           | `error`                      | `2` or `3`, by contract |
| `SIGINT` before output completes          | no completed result required |                   `130` |
| `SIGTERM` before output completes         | no completed result required |                   `143` |

`composition` succeeds with `valid` and never uses `invalid`. A contradictory installed release fails with `cli:COMPOSITION_STATE_INVALID` and exit code `3`.

## Safe operational errors

Known repository and Core exceptions retain their source, code, retryability, safe logical path when applicable, and non-confidential metadata. Git and CLI errors use a closed stable registry. When the working-tree inventory's `ls-files` listing, `config` read of `core.symlinks`, or `check-attr` attribute check fails, the error's `details.subcommand` names that subcommand; no other Git output is exposed, and every other error keeps empty `details`. Unexpected failures become `cli:INTERNAL_ERROR` without raw causes, stack traces, host paths, or process diagnostics.

Schema 9 includes these stable CLI-owned contracts:

| Code                      | Stable message                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `CONTENT_INVALID`         | The requested canonical asset is not valid moldea text.                                                       |
| `CONTENT_PATH_INVALID`    | The content path must identify one canonical moldea text asset.                                               |
| `CURSOR_INVALID`          | The continuation cursor is invalid for this request.                                                          |
| `CURSOR_SNAPSHOT_CHANGED` | The continuation cursor belongs to a different repository snapshot.                                           |
| `OUTPUT_BUDGET_TOO_SMALL` | The output byte budget cannot contain the next complete result.                                               |
| `PATH_INPUT_INVALID`      | The scope path input is invalid. Use leading-slash repository-logical paths and NUL-delimited UTF-8 on stdin. |

Isolated inspection adds `core:INSPECTION_BUSY` (retryable, `Project inspection capacity is busy. Try again shortly.`), `core:INSPECTION_TIMEOUT` (retryable, `The isolated project inspection timed out.`), and `core:INSPECTION_PROCESS_FAILED` (nonretryable, `The isolated project inspection failed.`). None implies invalid repository content. Verified worker heap exhaustion retains `core:RESOURCE_LIMIT_EXCEEDED`, reports the startup-observed `maxAnalysisHeapBytes`, `observedUsage: null`, and `nextAction: review-inspection-capacity`, without an inferred source path. Fixed transport refusals expose their dimension and usage without suggesting a limit increase.

## Cancellation and read-only guarantees

One operation-scoped abort signal reaches Git processes, inventory, filesystem reader creation, repository reads, Core. A signal discards an unwritten provisional result and stops further snapshot retries. The supervised inspection has a fixed 120-second lifetime covering reads, preparation, paging, and disposal. Cleanup awaits actual repository reads and child closure before source post-checks or successful output.

The executable does not modify the working tree, real index, refs or `HEAD`, Git configuration, attributes, submodules, object database, filters, or runtime environment. It never uses a temporary index or object-writing plumbing. `scope` and `content` do not load the export checker. For npm installations, before `validate`, `inspect`, and `composition`, integrity checks compare installed package identities, exact resolved versions, compatible-major dependency declarations, Core formats, and executable constants so a contradictory installation cannot report a misleading result. Compatible patch and minor resolutions are accepted; prerelease or breaking-major substitutions fail closed.

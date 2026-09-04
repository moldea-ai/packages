---
title: Output and operations
description: JSON envelopes, statuses, exit codes, safe errors, cancellation, read-only behavior, and installation integrity.
order: 30
---

# Output and operations

## JSON envelope

`--json` writes one deterministic schema 3 envelope to standard output. Envelopes contain exactly `schemaVersion`, `cliVersion`, `command`, `status`, `error`, and `result`. No command mixes a partial success result with an operational error.

`validate`, `inspect`, `scope`, and `composition` are recursively content-free. `inspect` projects only allowlisted metadata and splits unbounded child collections into separately keyed records. `content` is the only command allowed to return a `content` property, and it does so only for one explicitly selected canonical asset.

Collection and content JSON use a default 65,536-byte page budget and accept explicit budgets from 4,096 through 1,048,576 bytes. Byte accounting measures the final newline-terminated UTF-8 serialization after escaping. Opaque keyset cursors bind their format version, command, filters, source snapshot, last key, and checksum. Pages can traverse a large repository without gaps or duplicate records; a changed snapshot fails instead of mixing states.

## Status and exit codes

| Outcome                                   | Status                       |               Exit code |
| ----------------------------------------- | ---------------------------- | ----------------------: |
| Completed valid inspection                | `valid`                      |                     `0` |
| Completed structurally invalid inspection | `invalid`                    |                     `1` |
| Invocation or operational error           | `error`                      | `2` or `3`, by contract |
| `SIGINT` before output completes          | no completed result required |                   `130` |
| `SIGTERM` before output completes         | no completed result required |                   `143` |

`composition` succeeds with `valid` and never uses `invalid`. A contradictory installed release fails with `cli:COMPOSITION_STATE_INVALID` and exit code `3`.

## Safe operational errors

Known repository and Core exceptions retain their source, code, retryability, safe logical path when applicable, and non-confidential metadata. Git and CLI errors use a closed stable registry. Unexpected failures become `cli:INTERNAL_ERROR` without raw causes, stack traces, host paths, or process diagnostics.

Schema 3 adds these stable CLI-owned contracts:

| Code                      | Stable message                                                      |
| ------------------------- | ------------------------------------------------------------------- |
| `CONTENT_INVALID`         | The requested canonical asset is not valid moldea text.             |
| `CONTENT_PATH_INVALID`    | The content path must identify one canonical moldea text asset.     |
| `CURSOR_INVALID`          | The continuation cursor is invalid for this request.                |
| `CURSOR_SNAPSHOT_CHANGED` | The continuation cursor belongs to a different repository snapshot. |
| `OUTPUT_BUDGET_TOO_SMALL` | The output byte budget cannot contain the next complete result.     |
| `PATH_INPUT_INVALID`      | The NUL-delimited changed-path input is invalid.                    |

## Cancellation and read-only guarantees

One operation-scoped abort signal reaches Git processes, inventory, filesystem reader creation, repository reads, Core, and adapters. A signal discards an unwritten provisional result and stops further snapshot retries.

The executable does not modify the working tree, real index, refs or `HEAD`, Git configuration, attributes, submodules, object database, filters, or runtime environment. It never uses a temporary index or object-writing plumbing. `scope` and `content` do not load adapter modules. Before `validate`, `inspect`, and `composition`, installation-integrity checks compare installed package identities, exact versions, dependency declarations, actual active adapters, Core formats, and executable constants so a contradictory installation cannot report a misleading result.

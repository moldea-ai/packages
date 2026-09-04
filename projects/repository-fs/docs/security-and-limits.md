---
title: Security and operational limits
description: Independent resource ceilings, safe errors, raw directory risk, and runtime support.
order: 30
---

# Security and operational limits

Filesystem names and content are untrusted. The reader validates closed option and cursor contracts, copies caller-owned configuration, follows no descendant symlink, executes no file, and exposes no host path through `IRepositoryReader` or its exceptions.

## Resource limits

| Limit                     |          Default | Meaning                                                       |
| ------------------------- | ---------------: | ------------------------------------------------------------- |
| `maxEntries`              |         `131072` | Distinct non-root entries observed during the reader lifetime |
| `maxCachedBytes`          | `67108864` bytes | Complete verified file-page bytes retained in LRU storage     |
| `maxConcurrentOperations` |             `16` | Active filesystem operations                                  |
| `maxDirectoryEntries`     |         `131072` | Raw names accepted from one directory scan                    |
| `maxPageEntries`          |           `4096` | Metadata entries returned in one page                         |
| `maxQueuedOperations`     |            `256` | Operations waiting for the gate                               |
| `maxReadBytes`            |  `1048576` bytes | File bytes returned by one range request                      |

Configured values must be positive safe integers. Limits are independent so large repositories remain usable through continuation while individual scans, pages, reads, queues, and retained memory stay bounded. A breach fails with `RESOURCE_LIMIT_EXCEEDED` and reports the named dimension, limit, and observed request or count.

## Error mapping

Malformed logical paths use `RepositoryPathException`. Configuration, filesystem, resource, cursor, snapshot, and cancellation failures use `RepositorySourceException`. Stable access denial maps to `ACCESS_DENIED`; stable I/O failure maps to `SOURCE_UNAVAILABLE`; an already-observed path that changes maps to `SNAPSHOT_CHANGED`.

Raw directory selection is sensitive because it can expose ignored files, credentials, dependencies, caches, and generated output. The CLI uses Git-derived exact paths for repository-bound inspection rather than delegating trust policy to this package.

## Runtime

The package supports Node.js `>=22.11.0` and uses Node filesystem primitives. It is not browser-compatible. Creation and every reader operation support cancellation; a creation signal does not remain attached to later operations.

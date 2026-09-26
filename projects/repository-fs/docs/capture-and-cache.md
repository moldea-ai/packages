---
title: File ranges, cache, and concurrency
description: Verified bounded byte ranges, LRU cache accounting, cancellation, and operation gating.
order: 20
---

# File ranges, cache, and concurrency

`readFilePage` reads only the requested bounded range. The request must use a non-negative safe-integer offset and a positive `maxBytes` no greater than `maxReadBytes`.

## Verified range reads

The reader observes the selected root and path ancestors, opens the file without following the final symlink where supported, verifies file identity before reading, fills only the bounded range, and verifies identity again before returning. Detected missing, redirected, truncated, replaced, oversized, or otherwise changed files fail without returning partial bytes. Hostile concurrent replacement between path-based checks and opens remains outside the containment guarantee.

Every successful result includes the page offset, total file length, completion state, next offset, and reader snapshot. Returned buffers are detached from cache storage and other caller results.

## Bounded LRU cache

Only complete, nonempty verified ranges enter the cache. The cache key contains path, offset, and range size. Reading a cached page refreshes its recency. Before retaining a new page, the reader evicts the oldest pages until total retained bytes fit `maxCachedBytes` and no more than 4,096 pages remain. A single page larger than the cache budget is returned but not retained.

## Operation gate

At most `maxConcurrentOperations` filesystem operations run simultaneously. Up to `maxQueuedOperations` may wait. Further operations fail with `RESOURCE_LIMIT_EXCEEDED`. Each waiting or active operation is independently cancellable; cancellation does not consume a result or disable the reader.

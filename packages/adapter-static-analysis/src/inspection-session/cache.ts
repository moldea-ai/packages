// private cache bounds apply independently to each adapter and immutable operation
export const SOURCE_CACHE_LIMITS = { entries: 16, retainedBytes: 16 * 1024 * 1024 } as const;
export const OBSERVATION_CACHE_LIMITS = { entries: 128, retainedBytes: 128 * 1024 } as const;
const MAXIMUM_ACTIVE_LOADS = 4;

/**
 * Shares the adapter's active-load allowance across its source, observation, and listing caches.
 * @returns An admission function that releases ownership when the actual load settles.
 * @throws Propagates cancellation and loader failures.
 */
export const createInspectionLoadLimiter = () => {
  const active = new Set<Promise<unknown>>();

  return async <T>(load: () => Promise<T>, signal?: AbortSignal): Promise<T> => {
    signal?.throwIfAborted();
    while (active.size >= MAXIMUM_ACTIVE_LOADS) {
      await Promise.race(
        [...active].map(async (work) => {
          try {
            await work;
          } catch {
            /* the owning caller receives the failure */
          }
        }),
      );
      signal?.throwIfAborted();
    }
    const work = (async () => {
      await Promise.resolve();
      signal?.throwIfAborted();
      return load();
    })();
    active.add(work);
    try {
      return await work;
    } finally {
      active.delete(work);
    }
  };
};

// an estimate controls retention, rather than claiming to bound process RSS
export interface IInspectionCacheEntry<T> {
  result: T;
  retainedBytes: number;
}

/**
 * Creates an LRU cache with bounded resident ownership and active work.
 * Rejected and oversized results are discarded. Waiting callers do not start more loads.
 * @param limits Maximum resident entries and estimated retained bytes.
 * @param runLoad Shared adapter admission, or a cache-local allowance when omitted.
 * @returns A path-keyed load function shared only by its owning inspection.
 * @throws Propagates cancellation and loader failures.
 */
export const createBoundedInspectionCache = <T>(
  limits: { entries: number; retainedBytes: number },
  runLoad = createInspectionLoadLimiter(),
) => {
  const resident = new Map<string, IInspectionCacheEntry<T>>();
  const pending = new Map<string, Promise<T>>();
  let retainedBytes = 0;
  let activeLoads = 0;

  const get = async (
    path: string,
    load: () => Promise<IInspectionCacheEntry<T>>,
    signal?: AbortSignal,
  ): Promise<T> => {
    signal?.throwIfAborted();
    const existing = resident.get(path);
    if (existing !== undefined) {
      resident.delete(path);
      resident.set(path, existing);
      return existing.result;
    }
    const inFlight = pending.get(path);
    if (inFlight !== undefined) {
      const result = await inFlight;
      signal?.throwIfAborted();
      return result;
    }
    const work = (async (): Promise<T> => {
      // defer execution until the promise has been registered for duplicate callers
      await Promise.resolve();
      return runLoad(async () => {
        activeLoads += 1;
        try {
          const entry = await load();
          signal?.throwIfAborted();
          if (entry.retainedBytes <= limits.retainedBytes) {
            while (
              resident.size >= limits.entries ||
              retainedBytes + entry.retainedBytes > limits.retainedBytes
            ) {
              const oldest = resident.keys().next().value;
              if (oldest === undefined) break;
              retainedBytes -= resident.get(oldest)!.retainedBytes;
              resident.delete(oldest);
            }
            resident.set(path, entry);
            retainedBytes += entry.retainedBytes;
          }
          return entry.result;
        } finally {
          activeLoads -= 1;
        }
      }, signal);
    })();
    pending.set(path, work);
    try {
      return await work;
    } finally {
      pending.delete(path);
    }
  };
  const getUsage = () =>
    Object.freeze({
      entries: resident.size,
      retainedBytes,
      activeLoads,
    });
  return Object.freeze({ get, getUsage });
};

import type {
  IStaticAnalysisInspectionSession,
  IStaticAnalysisInspectionSessionOptions,
} from '../types.js';
import {
  createBoundedInspectionCache,
  createInspectionLoadLimiter,
  OBSERVATION_CACHE_LIMITS,
  SOURCE_CACHE_LIMITS,
} from './cache.js';
import { getObservationRetainedBytes } from './retention.js';

/**
 * Creates a typed adapter-owned session factory with weak operation ownership.
 * @param getOptions Supplies the immutable repository identity and provider callbacks.
 * @returns A factory reusing bounded resident observations across agents in one operation.
 * @throws Propagates cancellation and provider callback failures.
 */
export const createInspectionSessionFactory = <
  TContext,
  TPath extends string,
  TSourceResult,
  TPackageResult,
  TEntry,
>(
  getOptions: (
    context: TContext,
  ) => IStaticAnalysisInspectionSessionOptions<TPath, TSourceResult, TPackageResult, TEntry>,
) => {
  const createCaches = () => {
    const runLoad = createInspectionLoadLimiter();
    return {
      sources: createBoundedInspectionCache<TSourceResult>(SOURCE_CACHE_LIMITS, runLoad),
      observations: createBoundedInspectionCache<TPackageResult | TEntry>(
        OBSERVATION_CACHE_LIMITS,
        runLoad,
      ),
      runLoad,
    };
  };
  const owners = new WeakMap<object, ReturnType<typeof createCaches>>();

  return (
    context: TContext,
  ): IStaticAnalysisInspectionSession<TPath, TSourceResult, TPackageResult, TEntry> => {
    const options = getOptions(context);
    let caches = owners.get(options.owner);
    if (caches === undefined) {
      caches = createCaches();
      owners.set(options.owner, caches);
    }
    const { sources, observations, runLoad } = caches;
    const loadSource = (path: TPath): Promise<TSourceResult> =>
      sources.get(
        path,
        async () => {
          options.signal?.throwIfAborted();
          const bytes = await options.readFile(path, options.signal);
          options.signal?.throwIfAborted();
          const result = await options.analyzeSource(path, bytes, options.signal);
          return { result, retainedBytes: options.getSourceRetainedBytes(result) };
        },
        options.signal,
      );
    // This single borrowed graph dies with the agent's session. It is not an extra resident cache.
    let activeSource: Promise<TSourceResult> | undefined;
    const analyzeSource = async (path: TPath): Promise<TSourceResult> => {
      options.signal?.throwIfAborted();
      if (path !== options.activeSourcePath) return loadSource(path);
      activeSource ??= loadSource(path);
      try {
        const result = await activeSource;
        options.signal?.throwIfAborted();
        return result;
      } catch (error) {
        activeSource = undefined;
        throw error;
      }
    };
    return Object.freeze({
      analyzeSource,
      runLoad,
      // namespaced keys keep the two observation result types distinct in their shared allowance
      discoverPackage: async (path: TPath) =>
        (await observations.get(
          'package:' + path,
          async () => {
            const result = await options.discoverPackage(path, options.signal);
            return {
              result,
              retainedBytes: getObservationRetainedBytes('package:' + path, result),
            };
          },
          options.signal,
        )) as TPackageResult,
      getEntry: async (path: TPath) =>
        (await observations.get(
          'entry:' + path,
          async () => {
            const result = await options.getEntry(path, options.signal);
            return { result, retainedBytes: getObservationRetainedBytes('entry:' + path, result) };
          },
          options.signal,
        )) as TEntry,
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
  };
};

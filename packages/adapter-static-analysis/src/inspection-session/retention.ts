import type { IStaticAnalysisSourceResult } from '../types.js';

/**
 * Returns the source graph's calibrated cache cost, or a bounded invalid-result allowance.
 * @param result The adapter-owned source result.
 * @returns Estimated retained bytes for cache admission, without claiming an RSS bound.
 */
export const getSourceRetainedBytes = (result: IStaticAnalysisSourceResult): number =>
  result.kind === 'valid' ? result.analysis.estimatedRetainedBytes : 65536;

/**
 * Estimates JSON-safe provider observations including their key and variable-sized strings.
 * @param path The retained lookup key.
 * @param result The detached entry or package observation.
 * @returns Conservative cache admission cost, without claiming an RSS bound.
 */
export const getObservationRetainedBytes = (path: string, result: unknown): number =>
  256 + (path.length + (JSON.stringify(result)?.length ?? 0)) * 8;

import { DEFAULT_CORE_RESOURCE_LIMITS } from '../constants/index.js';
import type { ICoreOptions, ICoreResourceLimits } from '../contracts/index.js';
import { createCoreOperationResourceLimits } from '../diagnostic-utilities/index.js';
import { CoreConfigurationException } from '../exceptions/index.js';
import { freezeRecursively } from '../immutable/index.js';

// complete immutable Core configuration
export interface ICoreOptionsSnapshot {
  readonly limits: ICoreResourceLimits;
}

/** Creates an operation-local options view with one shared raw-diagnostic budget. */
export const createCoreOperationOptionsSnapshot = (
  options: ICoreOptionsSnapshot,
): ICoreOptionsSnapshot => {
  return Object.freeze({
    limits: createCoreOperationResourceLimits(options.limits),
  });
};

const RESOURCE_LIMIT_KEYS = [
  'maxEntries',
  'maxTotalBytesRead',
  'maxFileBytes',
  'maxManifestBytes',
  'maxRetainedBytes',
  'maxDiagnostics',
  'maxCoverage',
  'maxAcceptedWarnings',
] as const satisfies readonly (keyof ICoreResourceLimits)[];

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

/**
 * Validates, copies, fills, and freezes all configured resource limits.
 * @param candidate The untrusted optional limit overrides.
 * @returns The complete frozen resource limits.
 * @throws
 * - INVALID_RESOURCE_LIMIT: A Core resource limit is invalid.
 */
const normalizeLimits = (candidate: unknown): ICoreResourceLimits => {
  if (candidate === undefined) {
    return DEFAULT_CORE_RESOURCE_LIMITS;
  }

  if (!isRecord(candidate)) {
    throw new CoreConfigurationException({
      code: 'INVALID_RESOURCE_LIMIT',
      operation: 'create-core',
    });
  }

  const knownKeys = new Set<string>(RESOURCE_LIMIT_KEYS);

  if (Object.keys(candidate).some((key) => !knownKeys.has(key))) {
    throw new CoreConfigurationException({
      code: 'INVALID_RESOURCE_LIMIT',
      operation: 'create-core',
    });
  }

  const normalized: ICoreResourceLimits = {
    ...DEFAULT_CORE_RESOURCE_LIMITS,
  };

  for (const key of RESOURCE_LIMIT_KEYS) {
    const value = candidate[key];

    if (value === undefined) {
      continue;
    }

    if (!Number.isSafeInteger(value) || (value as number) <= 0) {
      throw new CoreConfigurationException({
        code: 'INVALID_RESOURCE_LIMIT',
        operation: 'create-core',
      });
    }

    (normalized as Record<keyof ICoreResourceLimits, number>)[key] = value as number;
  }

  return freezeRecursively(normalized);
};

/**
 * Validates and snapshots caller-owned Core resource limits.
 * @returns A deeply frozen configuration snapshot.
 * @throws
 * - INVALID_RESOURCE_LIMIT: A Core resource limit is invalid.
 */
export const normalizeCoreOptions = (options: ICoreOptions | undefined): ICoreOptionsSnapshot => {
  if (
    options !== undefined &&
    (!isRecord(options) || Reflect.ownKeys(options).some((key) => key !== 'limits'))
  ) {
    throw new CoreConfigurationException({
      code: 'INVALID_RESOURCE_LIMIT',
      operation: 'create-core',
    });
  }
  return freezeRecursively({ limits: normalizeLimits(options?.['limits']) });
};

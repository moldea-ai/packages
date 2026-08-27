import type {
  IRuntimeCompatibilityMatrix,
  IRuntimeTarget,
} from '../../../../../scripts/runtime-compatibility/types.ts';

import type {
  IRuntimeTargetMaturity,
  IRuntimeTargetMaturityRegistry,
} from '../runtime-target-maturity/index.ts';

import type {
  IRuntimeCompatibilityPublicationAdapter,
  IRuntimeCompatibilityPublicationTarget,
  IRuntimeCompatibilityPublicationV1,
} from './types.ts';

const RUNTIME_TARGET_MATURITIES = new Set<IRuntimeTargetMaturity>([
  'deprecated',
  'experimental',
  'supported',
]);

const compareExactStrings = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const createTargetKey = (adapterId: string, targetId: string): string => `${adapterId}/${targetId}`;

const requireTargetMaturity = (
  targetMaturities: IRuntimeTargetMaturityRegistry,
  adapterId: string,
  targetId: string,
): IRuntimeTargetMaturity => {
  const maturity = targetMaturities[adapterId]?.[targetId];

  if (maturity === undefined) {
    throw new Error(`Runtime target maturity is missing for ${adapterId}/${targetId}.`);
  }

  if (!RUNTIME_TARGET_MATURITIES.has(maturity)) {
    throw new Error(`Runtime target maturity is invalid for ${adapterId}/${targetId}.`);
  }

  return maturity;
};

const rejectUnknownTargetMaturities = (
  expectedTargetKeys: ReadonlySet<string>,
  targetMaturities: IRuntimeTargetMaturityRegistry,
): void => {
  const configuredTargetKeys = Object.entries(targetMaturities).flatMap(([adapterId, targets]) =>
    Object.keys(targets).map((targetId) => createTargetKey(adapterId, targetId)),
  );
  const unknownTargetKey = configuredTargetKeys
    .sort(compareExactStrings)
    .find((targetKey) => !expectedTargetKeys.has(targetKey));

  if (unknownTargetKey !== undefined) {
    throw new Error(
      `Runtime target maturity contains unknown or stale target ${unknownTargetKey}.`,
    );
  }
};

const createPublicationTarget = (
  target: IRuntimeTarget,
  maturity: IRuntimeTargetMaturity,
): IRuntimeCompatibilityPublicationTarget => ({ ...target, maturity });

/**
 * Combines a validated technical matrix with the exact website maturity registry.
 * @param matrix The normalized technical Runtime Compatibility Matrix.
 * @param targetMaturities The website-owned maturity registry.
 * @returns The closed publication schema version 1 model.
 * @throws
 * - If maturity is missing, invalid, or attached to an unknown technical target
 */
export const createRuntimeCompatibilityPublication = (
  matrix: IRuntimeCompatibilityMatrix,
  targetMaturities: IRuntimeTargetMaturityRegistry,
): IRuntimeCompatibilityPublicationV1 => {
  const expectedTargetKeys = new Set(
    Object.entries(matrix.adapters).flatMap(([adapterId, adapter]) =>
      (adapter.targets ?? []).map((target) => createTargetKey(adapterId, target.id)),
    ),
  );

  rejectUnknownTargetMaturities(expectedTargetKeys, targetMaturities);

  const adapters = Object.fromEntries(
    Object.entries(matrix.adapters)
      .sort(([leftId], [rightId]) => compareExactStrings(leftId, rightId))
      .map(([adapterId, adapter]): [string, IRuntimeCompatibilityPublicationAdapter] => {
        const { targets, ...technicalAdapter } = adapter;

        if (targets === undefined) {
          return [adapterId, technicalAdapter];
        }

        return [
          adapterId,
          {
            ...technicalAdapter,
            targets: [...targets]
              .sort((left, right) => compareExactStrings(left.id, right.id))
              .map((target) =>
                createPublicationTarget(
                  target,
                  requireTargetMaturity(targetMaturities, adapterId, target.id),
                ),
              ),
          },
        ];
      }),
  );

  return {
    adapters,
    matrixVersion: matrix.version,
    schemaVersion: 1,
  };
};

/** Compares strings by Unicode scalar value for the publication's canonical object-key order. */
const compareUnicodeCodePoints = (left: string, right: string): number => {
  const leftCodePoints = [...left];
  const rightCodePoints = [...right];
  const sharedLength = Math.min(leftCodePoints.length, rightCodePoints.length);

  for (let index = 0; index < sharedLength; index += 1) {
    const leftCodePoint = leftCodePoints[index]?.codePointAt(0);
    const rightCodePoint = rightCodePoints[index]?.codePointAt(0);

    if (leftCodePoint === undefined || rightCodePoint === undefined) {
      throw new TypeError('A runtime compatibility publication key could not be compared.');
    }

    if (leftCodePoint !== rightCodePoint) {
      return leftCodePoint - rightCodePoint;
    }
  }

  return leftCodePoints.length - rightCodePoints.length;
};

/** Serializes one publication value with recursively sorted object keys. */
const serializePublicationValue = (value: unknown, ancestors: Set<object>): string => {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('A runtime compatibility publication number must be finite.');
    }

    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }

  if (typeof value !== 'object') {
    throw new TypeError('The runtime compatibility publication contains an unsupported value.');
  }

  if (ancestors.has(value)) {
    throw new TypeError('The runtime compatibility publication must not contain a cycle.');
  }

  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      const entries: string[] = [];

      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) {
          throw new TypeError(
            'The runtime compatibility publication must not contain sparse arrays.',
          );
        }

        entries.push(serializePublicationValue(value[index], ancestors));
      }

      return `[${entries.join(',')}]`;
    }

    const prototype = Object.getPrototypeOf(value) as object | null;

    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('The runtime compatibility publication must contain plain records.');
    }

    if (Object.getOwnPropertySymbols(value).length > 0) {
      throw new TypeError('The runtime compatibility publication must not contain symbol keys.');
    }

    const record = value as Readonly<Record<string, unknown>>;
    const properties = Object.keys(record)
      .sort(compareUnicodeCodePoints)
      .map((key) => `${JSON.stringify(key)}:${serializePublicationValue(record[key], ancestors)}`);

    return `{${properties.join(',')}}`;
  } finally {
    ancestors.delete(value);
  }
};

/**
 * Serializes the closed publication as compact canonical JSON with one trailing LF.
 * @param publication The validated publication model.
 * @returns The deterministic public artifact bytes as text.
 * @throws
 * - If the publication contains unsupported, non-finite, class-backed, or cyclic data
 */
export const serializeRuntimeCompatibilityPublication = (
  publication: IRuntimeCompatibilityPublicationV1,
): string => `${serializePublicationValue(publication, new Set())}\n`;

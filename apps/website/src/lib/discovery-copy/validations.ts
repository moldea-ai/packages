import type { IPublicPackage } from '../model/types.ts';

import type { IDiscoveryCopy } from './types.ts';

/**
 * Requires exact coverage so new or removed canonical identities cannot silently use stale copy.
 * @throws
 * - If canonical IDs are missing or stale IDs retain display copy.
 */
const validateKeys = (labels: Record<string, unknown>, expected: string[], scope: string): void => {
  const actual = Object.keys(labels);
  const missing = expected.filter((id) => !Object.hasOwn(labels, id));
  const stale = actual.filter((id) => !expected.includes(id));

  if (missing.length > 0 || stale.length > 0) {
    throw new Error(
      `Discovery copy mismatch for ${scope}: missing [${missing.sort().join(', ')}]; stale [${stale.sort().join(', ')}].`,
    );
  }
};

/**
 * Validates display metadata without mutating canonical package records.
 * @throws
 * - If canonical IDs are missing or stale IDs retain display copy.
 * - Discovery copy must not contain empty names or descriptions.
 */
export const validateDiscoveryCopy = (
  copy: IDiscoveryCopy,
  packages: Pick<IPublicPackage, 'name'>[],
): void => {
  validateKeys(
    copy.packages,
    packages.map(({ name }) => name),
    'packages',
  );
  const text = Object.values(copy.packages).flatMap(({ name, description }) => [name, description]);
  if (text.some((label) => label.trim().length === 0)) {
    throw new Error('Discovery copy must not contain empty names or descriptions.');
  }
};

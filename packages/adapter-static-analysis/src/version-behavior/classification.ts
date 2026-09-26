import { minVersion, Range, subset, valid } from 'semver';

import type { IVersionBehavior, IVersionBehaviorDeclaration } from './types.js';

/**
 * Classifies all observed declarations against one known stable behavior boundary.
 * @param declarations Every declaration for the same package in the owning manifest.
 * @param boundary The first stable release with the newer behavior.
 * @returns The established side of the boundary, or `null` when it cannot be established.
 */
export const classifyVersionBehavior = (
  declarations: readonly IVersionBehaviorDeclaration[],
  boundary: string,
): IVersionBehavior | null => {
  if (declarations.length === 0 || valid(boundary) === null) {
    return null;
  }

  let behavior: IVersionBehavior | null = null;

  for (const { declaredRange } of declarations) {
    let range: Range;

    try {
      range = new Range(declaredRange, { includePrerelease: false, loose: false });
    } catch {
      return null;
    }

    if (
      minVersion(range) === null ||
      range.set.some((comparators) =>
        comparators.some(
          (comparator) =>
            typeof comparator.semver !== 'symbol' &&
            comparator.semver.prerelease.length > 0 &&
            !(
              comparator.operator === '<' &&
              comparator.semver.prerelease.length === 1 &&
              comparator.semver.prerelease[0] === 0
            ),
        ),
      )
    ) {
      return null;
    }

    const current = subset(range, `<${boundary}`, { includePrerelease: false, loose: false })
      ? 'before'
      : subset(range, `>=${boundary}`, { includePrerelease: false, loose: false })
        ? 'after'
        : null;

    if (current === null || (behavior !== null && behavior !== current)) {
      return null;
    }

    behavior = current;
  }

  return behavior;
};

import type { IRepositoryPath } from '@moldea.ai/repository';

/** Tests a single-segment wildcard without regular-expression interpretation. */
const matchesSegment = (pattern: string, value: string): boolean => {
  let patternIndex = 0;
  let valueIndex = 0;
  let starIndex = -1;
  let starValueIndex = -1;

  while (valueIndex < value.length) {
    if (pattern[patternIndex] === value[valueIndex]) {
      patternIndex += 1;
      valueIndex += 1;
      continue;
    }

    if (pattern[patternIndex] === '*') {
      starIndex = patternIndex;
      starValueIndex = valueIndex;
      patternIndex += 1;
      continue;
    }

    if (starIndex === -1) {
      return false;
    }

    patternIndex = starIndex + 1;
    starValueIndex += 1;
    valueIndex = starValueIndex;
  }

  while (pattern[patternIndex] === '*') {
    patternIndex += 1;
  }

  return patternIndex === pattern.length;
};

/** Matches validated simple-glob segments with zero-or-more-segment globstars. */
export const matchesRepositoryGlob = (
  patternSegments: readonly string[],
  path: IRepositoryPath,
): boolean => {
  const pathSegments = path.slice(1).split('/');
  let reachable = new Uint8Array(pathSegments.length + 1);
  reachable[0] = 1;

  for (const patternSegment of patternSegments) {
    const next = new Uint8Array(pathSegments.length + 1);

    if (patternSegment === '**') {
      let canReach = false;

      for (let index = 0; index < reachable.length; index += 1) {
        canReach ||= reachable[index] === 1;
        next[index] = canReach ? 1 : 0;
      }
    } else {
      for (let index = 0; index < pathSegments.length; index += 1) {
        if (reachable[index] === 1 && matchesSegment(patternSegment, pathSegments[index] ?? '')) {
          next[index + 1] = 1;
        }
      }
    }

    reachable = next;
  }

  return reachable[pathSegments.length] === 1;
};

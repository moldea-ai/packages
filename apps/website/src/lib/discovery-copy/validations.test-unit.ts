// @vitest-environment node
import { expect, test } from 'vitest';

import type { IDiscoveryCopy } from './types.ts';
import { validateDiscoveryCopy } from './validations.ts';

const packages = [{ name: '@moldea.ai/core' }];
const createCopy = (): IDiscoveryCopy => ({
  packages: { '@moldea.ai/core': { name: 'Core', description: 'Structural checks.' } },
});

test('accepts complete copy without mutating canonical inputs', () => {
  const before = structuredClone(packages);
  validateDiscoveryCopy(createCopy(), packages);
  expect(packages).toStrictEqual(before);
});
test('rejects missing and stale package copy', () => {
  const copy = createCopy();
  delete copy.packages['@moldea.ai/core'];
  expect(() => validateDiscoveryCopy(copy, packages)).toThrow('missing [@moldea.ai/core]');
  const stale = createCopy();
  stale.packages.obsolete = { name: 'Obsolete', description: 'Old.' };
  expect(() => validateDiscoveryCopy(stale, packages)).toThrow('stale [obsolete]');
});
test.each(['name', 'description'] as const)('rejects empty %s', (field) => {
  const copy = createCopy();
  copy.packages['@moldea.ai/core'][field] = ' ';
  expect(() => validateDiscoveryCopy(copy, packages)).toThrow(
    'must not contain empty names or descriptions',
  );
});

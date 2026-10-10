// @vitest-environment node
import { expect, test } from 'vitest';

import { isCompatiblePackageDependency } from './index.mjs';

test.each([
  ['2.0.3', '^2.0.3', true],
  ['2.0.4', '^2.0.3', true],
  ['2.1.0', '^2.0.3', true],
  ['2.0.2', '^2.0.3', false],
  ['3.0.0', '^2.0.3', false],
  ['0.2.4', '^0.2.3', true],
  ['0.3.0', '^0.2.3', false],
  ['0.0.3', '^0.0.3', true],
  ['0.0.4', '^0.0.3', false],
  ['2.0.3', '2.0.3', false],
  ['2.0.3-rc.1', '^2.0.3', false],
  ['02.0.3', '^2.0.3', false],
  ['2.0.3', '^02.0.3', false],
  ['2.9007199254740992.0', '^2.0.0', false],
  [undefined, '^2.0.3', false],
])('isCompatiblePackageDependency(%s, %s) -> %s', (installed, range, expected) => {
  expect(isCompatiblePackageDependency(installed, range)).toBe(expected);
});

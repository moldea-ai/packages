// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { classifyVersionBehavior } from './index.js';

describe('known version behavior classification', () => {
  test.each([
    ['0.17.9', 'before'],
    ['^0.17.0', 'before'],
    ['>=0.16.0 <0.18.0', 'before'],
    ['0.18.0', 'after'],
    ['^0.18.0', 'after'],
    ['>=0.18.0', 'after'],
    ['>=0.17.0', null],
    ['*', null],
    ['latest', null],
    ['workspace:*', null],
    ['0.18.0-rc.1', null],
    ['>=0.17.0 <0.17.0', null],
  ] as const)('classifyVersionBehavior(%s) -> %s', (declaredRange, expected) => {
    expect(classifyVersionBehavior([{ declaredRange }], '0.18.0')).toBe(expected);
  });

  test('requires every observed declaration to establish the same side', () => {
    expect(
      classifyVersionBehavior(
        [{ declaredRange: '^0.17.0' }, { declaredRange: '>=0.17.2 <0.18.0' }],
        '0.18.0',
      ),
    ).toBe('before');
    expect(
      classifyVersionBehavior(
        [{ declaredRange: '^0.17.0' }, { declaredRange: '^0.18.0' }],
        '0.18.0',
      ),
    ).toBeNull();
    expect(classifyVersionBehavior([], '0.18.0')).toBeNull();
  });

  test('treats equivalent normalized stable ranges the same', () => {
    const ranges = ['^0.18.0', '>=0.18.0 <0.19.0-0', '0.18.x'];
    expect(
      ranges.map((declaredRange) => classifyVersionBehavior([{ declaredRange }], '0.18.0')),
    ).toStrictEqual(['after', 'after', 'after']);
  });
});

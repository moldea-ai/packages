// @vitest-environment node
import { expect, test } from 'vitest';

import type { IDiscoveryCopy } from './types.ts';
import { validateDiscoveryCopy } from './validations.ts';

const packages = [{ name: '@moldea.ai/core' }];
const adapters = [{ id: 'custom', entry: { targets: [{ id: 'custom' }, { id: 'second' }] } }];
const createCopy = (): IDiscoveryCopy => ({
  packages: { '@moldea.ai/core': { name: 'Core', description: 'Structural checks.' } },
  adapters: {
    custom: {
      name: 'Custom runtime',
      description: 'Built into Core.',
      targets: { custom: 'Custom', second: 'Second target' },
    },
  },
});

test('accepts complete multi-target copy without mutating canonical inputs', () => {
  const before = structuredClone({ packages, adapters });
  validateDiscoveryCopy(createCopy(), packages, adapters);
  expect({ packages, adapters }).toStrictEqual(before);
});

test.each(['packages', 'adapters', 'targets'] as const)(
  'rejects missing and stale %s copy',
  (scope) => {
    const copy = createCopy();
    const entries = scope === 'targets' ? copy.adapters.custom.targets : copy[scope];
    const firstKey = Object.keys(entries)[0];
    delete entries[firstKey];
    expect(() => validateDiscoveryCopy(copy, packages, adapters)).toThrow(`missing [${firstKey}]`);

    const staleCopy = createCopy();
    if (scope === 'targets') staleCopy.adapters.custom.targets.obsolete = 'Obsolete';
    else if (scope === 'packages')
      staleCopy.packages.obsolete = { name: 'Obsolete', description: 'Old.' };
    else staleCopy.adapters.obsolete = { name: 'Obsolete', description: 'Old.', targets: {} };
    expect(() => validateDiscoveryCopy(staleCopy, packages, adapters)).toThrow('stale [obsolete]');
  },
);

test('requires no target copy when a canonical adapter has no published targets', () => {
  const copy = createCopy();
  copy.adapters.custom.targets = {};
  expect(() => validateDiscoveryCopy(copy, packages, [{ id: 'custom', entry: {} }])).not.toThrow();
});

test.each(['package name', 'adapter description', 'target name'])(
  'rejects an empty %s',
  (field) => {
    const copy = createCopy();
    if (field === 'package name') copy.packages['@moldea.ai/core'].name = ' ';
    else if (field === 'adapter description') copy.adapters.custom.description = '';
    else copy.adapters.custom.targets.custom = ' ';
    expect(() => validateDiscoveryCopy(copy, packages, adapters)).toThrow(
      'must not contain empty names or descriptions',
    );
  },
);

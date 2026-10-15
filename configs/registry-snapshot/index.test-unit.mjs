// @vitest-environment node
import { expect, test } from 'vitest';

import { REGISTRY_SNAPSHOT, getRegistrySnapshotEnvironment } from './index.mjs';

const SNAPSHOT_TIME = Date.parse(REGISTRY_SNAPSHOT);

test('the snapshot is one valid, canonical UTC instant', () => {
  expect(new Date(SNAPSHOT_TIME).toISOString()).toBe(REGISTRY_SNAPSHOT);
});

test.each([
  [SNAPSHOT_TIME + 60_000, '1'],
  [SNAPSHOT_TIME + 90_000, '2'],
  [SNAPSHOT_TIME + 3 * 24 * 60 * 60_000, '4320'],
])('getRegistrySnapshotEnvironment(%d) reaches back to the snapshot -> %s minutes', (now, age) => {
  expect(getRegistrySnapshotEnvironment(now)).toStrictEqual({
    npm_config_before: REGISTRY_SNAPSHOT,
    pnpm_config_minimum_release_age: age,
  });
});

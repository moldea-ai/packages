// @vitest-environment node
import { expect, test, vi } from 'vitest';

import { createBoundedInspectionCache } from './cache.js';

test('evicts by cost and recency, and declines oversized results', async () => {
  const cache = createBoundedInspectionCache<string>({ entries: 4, retainedBytes: 8 });
  const load = vi.fn((result: string, retainedBytes: number) =>
    Promise.resolve({ result, retainedBytes }),
  );
  const get = (path: string, cost = 4) => cache.get(path, () => load(path, cost));
  await get('a');
  await get('b');
  await get('a');
  await get('c');
  expect(cache.getUsage()).toStrictEqual({ entries: 2, retainedBytes: 8, activeLoads: 0 });
  await get('a');
  expect(load).toHaveBeenCalledTimes(3);
  await get('b');
  expect(load).toHaveBeenCalledTimes(4);
  await get('oversized', 9);
  await get('oversized', 9);
  expect(load).toHaveBeenCalledTimes(6);
  expect(cache.getUsage()).toStrictEqual({ entries: 2, retainedBytes: 8, activeLoads: 0 });
});

test('bounds active loads while sharing in-flight work', async () => {
  const cache = createBoundedInspectionCache<number>({ entries: 16, retainedBytes: 16 });
  let active = 0;
  let maximumActive = 0;
  let loadCount = 0;
  const get = (index: number) =>
    cache.get(String(index), async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      loadCount += 1;
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      active -= 1;
      return { result: index, retainedBytes: 1 };
    });
  const results = await Promise.all(Array.from({ length: 32 }, (_, index) => get(index % 8)));
  expect(results).toStrictEqual(Array.from({ length: 32 }, (_, index) => index % 8));
  expect(maximumActive).toBe(4);
  expect(loadCount).toBe(8);
});

test('bounds entry ownership independently of retained cost and releases rejected work', async () => {
  const cache = createBoundedInspectionCache<string>({ entries: 2, retainedBytes: 16 });
  for (const key of ['a', 'b', 'c'])
    await cache.get(key, () => Promise.resolve({ result: key, retainedBytes: 1 }));
  expect(cache.getUsage()).toStrictEqual({ entries: 2, retainedBytes: 2, activeLoads: 0 });
  const failure = new Error('source read failed');
  const load = vi.fn(() => Promise.reject(failure));
  await expect(cache.get('failed', load)).rejects.toBe(failure);
  await expect(cache.get('failed', load)).rejects.toBe(failure);
  expect(load).toHaveBeenCalledTimes(2);
  expect(cache.getUsage()).toStrictEqual({ entries: 2, retainedBytes: 2, activeLoads: 0 });
});

test('cancellation prevents resident hits and retention of in-flight results', async () => {
  const cache = createBoundedInspectionCache<string>({ entries: 2, retainedBytes: 16 });
  await cache.get('resident', () => Promise.resolve({ result: 'resident', retainedBytes: 1 }));
  const controller = new AbortController();
  controller.abort(new Error('inspection cancelled'));
  const load = vi.fn(() => Promise.resolve({ result: 'unexpected', retainedBytes: 1 }));
  await expect(cache.get('resident', load, controller.signal)).rejects.toBe(
    controller.signal.reason,
  );
  expect(load).not.toHaveBeenCalled();

  const running = new AbortController();
  const runningFailure = new Error('cancelled while loading');
  await expect(
    cache.get(
      'active',
      () => {
        running.abort(runningFailure);
        return Promise.resolve({ result: 'active', retainedBytes: 1 });
      },
      running.signal,
    ),
  ).rejects.toBe(runningFailure);
  expect(cache.getUsage()).toStrictEqual({ entries: 1, retainedBytes: 1, activeLoads: 0 });
});

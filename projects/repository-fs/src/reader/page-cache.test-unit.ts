// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { cacheFilePage, type ICachedFilePage } from './page-cache.js';

describe('verified file-page cache', () => {
  test('bounds tiny pages by entry count even below the byte budget', () => {
    const cache = new Map<string, ICachedFilePage>();
    let cachedBytes = 0;

    for (let index = 0; index <= 4_096; index += 1) {
      cachedBytes = cacheFilePage(
        cache,
        cachedBytes,
        `page-${index}`,
        new Uint8Array([index % 256]),
        'identity',
        8_192,
      );
    }

    expect(cache.size).toBe(4_096);
    expect(cachedBytes).toBe(4_096);
    expect(cache.has('page-0')).toBe(false);
    expect(cache.get('page-4096')?.bytes).toStrictEqual(new Uint8Array([0]));
  });

  test('bypasses empty pages and evicts old pages when their bytes exceed the budget', () => {
    const cache = new Map<string, ICachedFilePage>();
    let cachedBytes = cacheFilePage(cache, 0, 'empty', new Uint8Array(), 'identity', 2);

    expect(cache.size).toBe(0);
    expect(cachedBytes).toBe(0);

    cachedBytes = cacheFilePage(cache, cachedBytes, 'first', new Uint8Array([1, 2]), 'identity', 2);
    cachedBytes = cacheFilePage(cache, cachedBytes, 'second', new Uint8Array([3]), 'identity', 2);

    expect(cache.has('first')).toBe(false);
    expect(cache.get('second')?.bytes).toStrictEqual(new Uint8Array([3]));
    expect(cachedBytes).toBe(1);
  });
});

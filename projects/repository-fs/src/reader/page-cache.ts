// verified file pages retained by one filesystem reader
export interface ICachedFilePage {
  readonly bytes: Uint8Array;
  readonly entryIdentity: string;
}

const MAX_CACHED_PAGES = 4_096;

/** Retains a verified page within both the byte and entry-count limits. */
export const cacheFilePage = (
  cache: Map<string, ICachedFilePage>,
  cachedBytes: number,
  cacheKey: string,
  bytes: Uint8Array,
  entryIdentity: string,
  maxCachedBytes: number,
): number => {
  if (bytes.byteLength === 0 || bytes.byteLength > maxCachedBytes) {
    return cachedBytes;
  }

  const replaced = cache.get(cacheKey);

  if (replaced !== undefined) {
    cache.delete(cacheKey);
    cachedBytes -= replaced.bytes.byteLength;
  }

  while (cachedBytes + bytes.byteLength > maxCachedBytes || cache.size >= MAX_CACHED_PAGES) {
    const oldestKey = cache.keys().next().value;

    if (oldestKey === undefined) {
      break;
    }

    const oldest = cache.get(oldestKey);
    cache.delete(oldestKey);
    cachedBytes -= oldest?.bytes.byteLength ?? 0;
  }

  cache.set(cacheKey, { bytes: bytes.slice(), entryIdentity });

  return cachedBytes + bytes.byteLength;
};

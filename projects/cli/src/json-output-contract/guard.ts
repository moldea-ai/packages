/** Rejects canonical bodies and content fields from a non-content JSON result. */
export const assertMoldeaCliJsonResultIsContentFree = (
  value: unknown,
  canonicalBodies: readonly string[] = [],
): void => {
  const pending: unknown[] = [value];
  const visited = new Set<object>();
  const bodies = new Set(canonicalBodies.filter((body) => body.length > 0));

  while (pending.length > 0) {
    const current = pending.pop();

    if (typeof current === 'string') {
      if (bodies.has(current)) {
        throw new TypeError('A non-content CLI result contains canonical document text.');
      }

      continue;
    }

    if (typeof current !== 'object' || current === null || visited.has(current)) {
      continue;
    }

    visited.add(current);

    if (Array.isArray(current)) {
      for (const item of current as readonly unknown[]) {
        pending.push(item);
      }

      continue;
    }

    const record = current as Readonly<Record<string, unknown>>;

    if (Object.hasOwn(record, 'content')) {
      throw new TypeError('A non-content CLI result contains a content property.');
    }

    pending.push(...Object.values(record));
  }
};

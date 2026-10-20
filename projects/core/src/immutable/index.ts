/**
 * Creates a record that cannot collide with prototype-chain properties.
 * @param entries The own string-keyed entries to assign.
 * @returns A mutable null-prototype record for later normalization and freezing.
 */
export const createNullPrototypeRecord = <Value>(
  entries: Iterable<readonly [string, Value]>,
): Record<string, Value> => {
  const record = Object.create(null) as Record<string, Value>;

  for (const [key, value] of entries) {
    record[key] = value;
  }

  return record;
};

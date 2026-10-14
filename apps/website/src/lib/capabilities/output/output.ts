import { isDeepStrictEqual } from 'node:util';

import { z } from 'zod';

import type { ICapabilityFact } from '../index.ts';

import type { IOutputRedaction, IRecordedOutput } from './types.ts';

/** Distinguishes JSON object properties from canonical array indexes. */
const hasJsonField = (
  parent: ICapabilityFact[] | Record<string, ICapabilityFact>,
  field: string,
): boolean =>
  Array.isArray(parent)
    ? /^(?:0|[1-9][0-9]*)$/u.test(field) && Number(field) < parent.length
    : Object.hasOwn(parent, field);

/** Applies only declared field replacements to a detached, complete JSON response. */
const captureResponses = (
  responses: unknown[],
  redactions: IOutputRedaction[],
): ICapabilityFact[] => {
  if (responses.length === 0) throw new Error('Recorded output must contain an executed response.');
  const captured = responses.map((response) => {
    const parsed = z.json().safeParse(response);
    if (!parsed.success)
      throw new Error('Recorded output must contain only JSON values.', { cause: parsed.error });
    return parsed.data;
  });
  const pointers = new Set<string>();
  for (const { responseIndex, pointer, reason } of redactions) {
    const key = `${responseIndex}:${pointer}`;
    if (
      !Number.isInteger(responseIndex) ||
      responseIndex < 0 ||
      responseIndex >= captured.length ||
      !pointer.startsWith('/') ||
      /~(?![01])/u.test(pointer) ||
      reason.trim() === '' ||
      pointers.has(key)
    )
      throw new Error('An output redaction is invalid.');
    pointers.add(key);
    const segments = pointer
      .slice(1)
      .split('/')
      .map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'));
    let parent: ICapabilityFact | undefined = captured[responseIndex];
    for (const segment of segments.slice(0, -1)) {
      if (parent === null || typeof parent !== 'object' || !hasJsonField(parent, segment))
        throw new Error('An output redaction target does not exist.');
      parent = Array.isArray(parent) ? parent[Number(segment)] : parent[segment];
    }
    const field = segments.at(-1)!;
    if (parent === null || typeof parent !== 'object' || !hasJsonField(parent, field))
      throw new Error('An output redaction target does not exist.');
    if (Array.isArray(parent)) parent[Number(field)] = `[redacted: ${reason}]`;
    else parent[field] = `[redacted: ${reason}]`;
  }
  return captured;
};

/**
 * Captures every JSON field before projections, with only explicitly identified redactions.
 * @throws
 * - Recorded output must contain an executed response.
 * - Recorded output must contain only JSON values.
 * - An output redaction is invalid.
 * - An output redaction target does not exist.
 */
export const createRecordedOutput = (
  responses: unknown[],
  kind: IRecordedOutput['kind'] = 'response',
  redactions: IOutputRedaction[] = [],
): IRecordedOutput => ({
  kind,
  responses: captureResponses(responses, redactions),
  redactions: redactions.map((redaction) => ({ ...redaction })),
});

/**
 * Rejects omitted, reordered or changed output beyond exactly declared redactions.
 * @throws
 * - Recorded output must contain an executed response.
 * - Recorded output must contain only JSON values.
 * - An output redaction is invalid.
 * - An output redaction target does not exist.
 * - Recorded output does not match the complete executed response.
 */
export const assertRecordedOutput = (responses: unknown[], output: IRecordedOutput): void => {
  if (!isDeepStrictEqual(captureResponses(responses, output.redactions), output.responses))
    throw new Error('Recorded output does not match the complete executed response.');
};

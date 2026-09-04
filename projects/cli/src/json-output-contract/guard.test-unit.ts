// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { assertMoldeaCliJsonResultIsContentFree } from './guard.js';

describe('content-free JSON guard', () => {
  test('accepts recursively allowlisted metadata', () => {
    expect(() =>
      assertMoldeaCliJsonResultIsContentFree({
        asset: { digest: `sha256:${'0'.repeat(64)}`, path: '/moldea/project.md' },
        nested: [{ kind: 'context', scalarLength: 12, utf8ByteLength: 12 }],
      }),
    ).not.toThrow();
  });

  test.each([
    [{ content: 'body' }, []],
    [{ nested: [{ content: '' }] }, []],
    [{ message: 'canonical project body' }, ['canonical project body']],
  ])('rejects content-bearing result %#', (result, canonicalBodies) => {
    expect(() => assertMoldeaCliJsonResultIsContentFree(result, canonicalBodies)).toThrow(
      TypeError,
    );
  });

  test('does not reject a short canonical substring embedded in diagnostic text', () => {
    expect(() =>
      assertMoldeaCliJsonResultIsContentFree({ message: 'not found' }, ['not']),
    ).not.toThrow();
  });

  test('does not perform substring scans across canonical bodies', () => {
    expect(() =>
      assertMoldeaCliJsonResultIsContentFree({ message: 'prefix canonical project body suffix' }, [
        'canonical project body',
      ]),
    ).not.toThrow();
  });
});

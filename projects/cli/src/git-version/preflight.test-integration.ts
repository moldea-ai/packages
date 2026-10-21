// @vitest-environment node
import process from 'node:process';
import { describe, expect, test } from 'vitest';

import { createGitVersionPreflight } from './preflight.js';

describe('Git version preflight integration', () => {
  test('accepts the installed Git executable through the production Git boundary', async () => {
    const result = await createGitVersionPreflight()(process.cwd());

    expect(result.kind).toBe('supported');
    expect(Object.isFrozen(result)).toBe(true);
  });
});

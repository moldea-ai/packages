// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { loadWebsiteModel } from '../generation/generation.ts';
import { serializeRuntimeCompatibilityPublication } from '../runtime-compatibility-publication/index.ts';

import { createRuntimeCompatibilityResponse } from './runtime-compatibility-response.ts';

describe('runtime compatibility response', () => {
  test('returns the exact deterministic publication contract', async () => {
    const publication = loadWebsiteModel().runtimeCompatibilityPublication;
    const response = createRuntimeCompatibilityResponse(publication);
    const source = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    expect(source).toBe(serializeRuntimeCompatibilityPublication(publication));
    expect(JSON.parse(source)).toStrictEqual(publication);
  });
});

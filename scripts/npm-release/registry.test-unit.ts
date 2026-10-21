// @vitest-environment node
import { request } from 'jg-fetch';
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  loadNpmRegistryDependencyVersions,
  loadNpmRegistryVersions,
  parseNpmRegistryVersions,
  type INpmRegistryRequest,
} from './registry.ts';

const QUICK_PROPAGATION = Object.freeze({ intervalSeconds: 0.01, timeoutSeconds: 5 });

/** Creates the real jg-fetch request, without retries, against registry responses in order. */
const createRegistryRequest = (
  ...responses: readonly Response[]
): ReturnType<typeof vi.fn<INpmRegistryRequest>> => {
  const fetchMock = vi.spyOn(globalThis, 'fetch');

  for (const [index, response] of responses.entries()) {
    if (index === responses.length - 1) {
      fetchMock.mockImplementation(() => Promise.resolve(response.clone()));
    } else {
      fetchMock.mockResolvedValueOnce(response);
    }
  }

  return vi.fn<INpmRegistryRequest>((url, options) =>
    request(url, { ...options, retryDelaysSeconds: [] }),
  );
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('npm release registry access', () => {
  test('parses exact published versions', () => {
    expect(
      parseNpmRegistryVersions(
        {
          name: '@moldea.ai/core',
          versions: { '1.0.0': {}, '1.1.0': {} },
        },
        '@moldea.ai/core',
      ),
    ).toStrictEqual(['1.0.0', '1.1.0']);
  });

  test.each([
    ['wrong identity', { name: '@moldea.ai/other', versions: { '1.0.0': {} } }],
    ['invalid collection', { name: '@moldea.ai/core', versions: ['1.0.0'] }],
    ['invalid version', { name: '@moldea.ai/core', versions: { latest: {} } }],
    ['non-object document', null],
  ])('rejects an %s', (_description, metadata) => {
    expect(() => parseNpmRegistryVersions(metadata, '@moldea.ai/core')).toThrow('registry');
  });

  test('returns an empty inventory for an unpublished package', async () => {
    const requestRegistry = createRegistryRequest(new Response(null, { status: 404 }));

    await expect(
      loadNpmRegistryVersions('@moldea.ai/core', requestRegistry),
    ).resolves.toStrictEqual([]);
    expect(requestRegistry).toHaveBeenCalledWith(
      new URL('https://registry.npmjs.org/%40moldea.ai%2Fcore'),
      { headers: { accept: 'application/json' }, timeoutSeconds: 30 },
    );
  });

  test('loads published metadata without authentication', async () => {
    const requestRegistry = createRegistryRequest(
      Response.json({ name: '@moldea.ai/core', versions: { '1.0.0': {} } }),
    );

    await expect(
      loadNpmRegistryVersions('@moldea.ai/core', requestRegistry),
    ).resolves.toStrictEqual(['1.0.0']);
    const [input, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    const headers = new Headers(input instanceof Request ? input.headers : init?.headers);

    expect(headers.get('accept')).toBe('application/json');
    expect(headers.has('authorization')).toBe(false);
  });

  test('rejects an unsuccessful registry response', async () => {
    const requestRegistry = createRegistryRequest(new Response(null, { status: 503 }));

    await expect(loadNpmRegistryVersions('@moldea.ai/core', requestRegistry)).rejects.toThrow(
      'failed with 503',
    );
  });

  test('reads an ordinary dependency range once, without waiting', async () => {
    const requestRegistry = createRegistryRequest(
      Response.json({ name: '@moldea.ai/core', versions: { '2.1.0': {} } }),
    );

    await expect(
      loadNpmRegistryDependencyVersions('@moldea.ai/core', '^3.0.0', requestRegistry),
    ).resolves.toStrictEqual(['2.1.0']);
    expect(requestRegistry).toHaveBeenCalledOnce();
  });

  test('waits for a newly published dependency to become visible', async () => {
    const requestRegistry = createRegistryRequest(
      Response.json({ name: '@moldea.ai/core', versions: { '2.1.0': {} } }),
      Response.json({ name: '@moldea.ai/core', versions: { '2.1.0': {} } }),
      Response.json({ name: '@moldea.ai/core', versions: { '2.1.0': {}, '3.0.0': {} } }),
    );

    await expect(
      loadNpmRegistryDependencyVersions(
        '@moldea.ai/core',
        'workspace:3.0.0',
        requestRegistry,
        QUICK_PROPAGATION,
      ),
    ).resolves.toStrictEqual(['2.1.0', '3.0.0']);
    expect(requestRegistry).toHaveBeenCalledTimes(3);
  });

  test('returns the last observed versions when a dependency stays unavailable', async () => {
    const requestRegistry = createRegistryRequest(
      Response.json({ name: '@moldea.ai/core', versions: { '2.1.0': {} } }),
    );

    await expect(
      loadNpmRegistryDependencyVersions('@moldea.ai/core', 'workspace:3.0.0', requestRegistry, {
        intervalSeconds: 0.01,
        timeoutSeconds: 0.1,
      }),
    ).resolves.toStrictEqual(['2.1.0']);
    expect(requestRegistry.mock.calls.length).toBeGreaterThan(1);
  });

  test('stops waiting at a registry failure instead of treating it as unavailable', async () => {
    const requestRegistry = createRegistryRequest(
      Response.json({ name: '@moldea.ai/core', versions: { '2.1.0': {} } }),
      new Response(null, { status: 503 }),
    );

    await expect(
      loadNpmRegistryDependencyVersions(
        '@moldea.ai/core',
        'workspace:3.0.0',
        requestRegistry,
        QUICK_PROPAGATION,
      ),
    ).rejects.toThrow('failed with 503');
  });
});

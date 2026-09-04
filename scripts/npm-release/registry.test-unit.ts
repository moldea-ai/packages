// @vitest-environment node
import { describe, expect, test, vi } from 'vitest';

import { NPM_RELEASE_REGISTRY_PROPAGATION_DELAYS_MS } from './constants.ts';
import {
  loadNpmRegistryDependencyVersions,
  loadNpmRegistryVersions,
  parseNpmRegistryVersions,
} from './registry.ts';

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
  ])('rejects an %s', (_description, metadata) => {
    expect(() => parseNpmRegistryVersions(metadata, '@moldea.ai/core')).toThrow('registry');
  });

  test('returns an empty inventory for an unpublished package', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 404 }));

    await expect(loadNpmRegistryVersions('@moldea.ai/core', request)).resolves.toStrictEqual([]);
    expect(request).toHaveBeenCalledWith(
      new URL('https://registry.npmjs.org/%40moldea.ai%2Fcore'),
      { headers: { accept: 'application/json' } },
    );
  });

  test('loads published metadata without authentication', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        name: '@moldea.ai/core',
        versions: { '1.0.0': {} },
      }),
    );

    await expect(loadNpmRegistryVersions('@moldea.ai/core', request)).resolves.toStrictEqual([
      '1.0.0',
    ]);
  });

  test('rejects an unsuccessful registry response', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 }));

    await expect(loadNpmRegistryVersions('@moldea.ai/core', request)).rejects.toThrow(
      'failed with 503',
    );
  });

  test('waits for a newly published dependency to become visible', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ name: '@moldea.ai/core', versions: { '2.1.0': {} } }))
      .mockResolvedValueOnce(Response.json({ name: '@moldea.ai/core', versions: { '2.1.0': {} } }))
      .mockResolvedValueOnce(
        Response.json({ name: '@moldea.ai/core', versions: { '2.1.0': {}, '3.0.0': {} } }),
      );
    const wait = vi.fn<(delayMs: number) => Promise<unknown>>(() => Promise.resolve(undefined));

    await expect(
      loadNpmRegistryDependencyVersions('@moldea.ai/core', 'workspace:3.0.0', request, wait),
    ).resolves.toStrictEqual(['2.1.0', '3.0.0']);
    expect(wait).toHaveBeenNthCalledWith(1, 2_000);
    expect(wait).toHaveBeenNthCalledWith(2, 4_000);
    expect(wait).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenCalledTimes(3);
  });

  test('bounds registry propagation checks when a dependency remains unavailable', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockImplementation(() =>
        Promise.resolve(Response.json({ name: '@moldea.ai/core', versions: { '2.1.0': {} } })),
      );
    const wait = vi.fn<(delayMs: number) => Promise<unknown>>(() => Promise.resolve(undefined));

    await expect(
      loadNpmRegistryDependencyVersions('@moldea.ai/core', 'workspace:3.0.0', request, wait),
    ).resolves.toStrictEqual(['2.1.0']);
    expect(wait.mock.calls.map(([delayMs]) => delayMs)).toStrictEqual(
      NPM_RELEASE_REGISTRY_PROPAGATION_DELAYS_MS.map((delayMs) => delayMs),
    );
    expect(request).toHaveBeenCalledTimes(NPM_RELEASE_REGISTRY_PROPAGATION_DELAYS_MS.length + 1);
  });
});

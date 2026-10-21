// @vitest-environment node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { request } from 'jg-fetch';
import { afterEach, expect, test, vi } from 'vitest';

import { verifyNpmReleaseAvailability } from './availability.ts';
import { NPM_RELEASE_PROJECTS } from './constants.ts';
import type { INpmRegistryRequest } from './registry.ts';

const repositoryRoot = new URL('../../', import.meta.url);
const publishedVersions = new Map<string, string>(
  Object.values(NPM_RELEASE_PROJECTS).map(({ packageName, projectDirectory }) => {
    const manifest = JSON.parse(
      readFileSync(new URL(`${projectDirectory}/package.json`, repositoryRoot), 'utf8'),
    ) as { version: string };
    return [packageName, manifest.version];
  }),
);

/** Creates the real jg-fetch request, without retries, against a stubbed registry. */
const createRegistryRequest = (
  respond: (name: string) => Response,
): ReturnType<typeof vi.fn<INpmRegistryRequest>> => {
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) =>
    Promise.resolve(
      respond(
        decodeURIComponent(new URL(input instanceof Request ? input.url : input).pathname.slice(1)),
      ),
    ),
  );

  return vi.fn<INpmRegistryRequest>((url, options) =>
    request(url, { ...options, retryDelaysSeconds: [] }),
  );
};

afterEach(() => {
  vi.restoreAllMocks();
});

test('checks every advertised exact version using the real release manifest owner', async () => {
  const requestRegistry = createRegistryRequest((name) => {
    const version = publishedVersions.get(name);
    assert.ok(version);
    return Response.json({ name, versions: { [version]: {} } });
  });
  await verifyNpmReleaseAvailability({ repositoryRoot, request: requestRegistry });
  expect(requestRegistry).toHaveBeenCalledTimes(publishedVersions.size);
});

test('blocks deployment when an exact version remains missing after bounded propagation checks', async () => {
  const requestRegistry = createRegistryRequest((name) => {
    const version = name === '@moldea.ai/cli' ? '1.0.0' : publishedVersions.get(name);
    assert.ok(version);
    return Response.json({ name, versions: { [version]: {} } });
  });
  await expect(
    verifyNpmReleaseAvailability({
      propagation: { intervalSeconds: 0.01, timeoutSeconds: 0.1 },
      repositoryRoot,
      request: requestRegistry,
    }),
  ).rejects.toThrow(
    `@moldea.ai/cli@${publishedVersions.get('@moldea.ai/cli')} is not available on npm`,
  );
  // the missing version is checked again until the propagation deadline
  expect(requestRegistry.mock.calls.length).toBeGreaterThan(publishedVersions.size);
});

test('does not treat a registry failure as published availability', async () => {
  const requestRegistry = createRegistryRequest(() => new Response(null, { status: 503 }));
  await expect(
    verifyNpmReleaseAvailability({ repositoryRoot, request: requestRegistry }),
  ).rejects.toThrow('failed with 503');
});

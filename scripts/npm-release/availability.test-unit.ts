// @vitest-environment node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { expect, test, vi } from 'vitest';

import { verifyNpmReleaseAvailability } from './availability.ts';
import { NPM_RELEASE_PROJECTS, NPM_RELEASE_REGISTRY_PROPAGATION_DELAYS_MS } from './constants.ts';

const repositoryRoot = new URL('../../', import.meta.url);
const publishedVersions = new Map<string, string>(
  Object.values(NPM_RELEASE_PROJECTS).map(({ packageName, projectDirectory }) => {
    const manifest = JSON.parse(
      readFileSync(new URL(`${projectDirectory}/package.json`, repositoryRoot), 'utf8'),
    ) as { version: string };
    return [packageName, manifest.version];
  }),
);

test('checks every advertised exact version using the real release manifest owner', async () => {
  const request = vi.fn<typeof fetch>((input) => {
    const name = decodeURIComponent(
      new URL(input instanceof Request ? input.url : input).pathname.slice(1),
    );
    const version = publishedVersions.get(name);
    assert.ok(version);
    return Promise.resolve(Response.json({ name, versions: { [version]: {} } }));
  });
  await verifyNpmReleaseAvailability({ repositoryRoot, request });
  expect(request).toHaveBeenCalledTimes(publishedVersions.size);
});

test('blocks deployment when an exact version remains missing after bounded propagation checks', async () => {
  const request = vi.fn<typeof fetch>((input) => {
    const name = decodeURIComponent(
      new URL(input instanceof Request ? input.url : input).pathname.slice(1),
    );
    const version = name === '@moldea.ai/cli' ? '1.0.0' : publishedVersions.get(name);
    assert.ok(version);
    return Promise.resolve(Response.json({ name, versions: { [version]: {} } }));
  });
  const wait = vi.fn<(delayMs: number) => Promise<unknown>>(() => Promise.resolve(undefined));
  await expect(verifyNpmReleaseAvailability({ repositoryRoot, request, wait })).rejects.toThrow(
    `@moldea.ai/cli@${publishedVersions.get('@moldea.ai/cli')} is not available on npm`,
  );
  expect(wait.mock.calls.map(([delayMs]) => delayMs)).toStrictEqual([
    ...NPM_RELEASE_REGISTRY_PROPAGATION_DELAYS_MS,
  ]);
});

test('does not treat a registry failure as published availability', async () => {
  const request = vi.fn<typeof fetch>(() => Promise.resolve(new Response(null, { status: 503 })));
  await expect(verifyNpmReleaseAvailability({ repositoryRoot, request })).rejects.toThrow(
    'failed with 503',
  );
});

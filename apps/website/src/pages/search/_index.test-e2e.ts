import { expect, test } from '@playwright/test';
import { DEFAULT_BASE_PATH, withBase } from '@moldea.ai/website-ui/site';

const basePath = process.env.BASE_PATH ?? DEFAULT_BASE_PATH;
const searchPath = withBase('/search/', basePath);
const indexPath = withBase('/search-index.json', basePath);
const documents = [
  {
    title: 'Snapshots',
    description: 'Read snapshots.',
    searchText: 'snapshot',
    url: '/snapshots/',
  },
  { title: 'Adapters', description: 'Inspect adapters.', searchText: 'adapter', url: '/adapters/' },
];

// Astro's underscore prefix keeps page-owned browser tests out of production routes.
for (const [query, status, resultCount] of [
  ['adapter', '1 result for “adapter”.', 1],
  ['no-match', 'No matching documentation, capability, or adapter was found.', 0],
  ['', 'Enter a package, capability, API symbol, or adapter ID.', 0],
  ['   ', 'Enter a package, capability, API symbol, or adapter ID.', 0],
] as const) {
  test(`only renders the latest submitted query ${JSON.stringify(query)} after a delayed index`, async ({
    page,
  }) => {
    const indexRequested = Promise.withResolvers<void>();
    const releaseIndex = Promise.withResolvers<void>();
    let requests = 0;
    await page.route(`**${indexPath}`, async (route) => {
      requests += 1;
      indexRequested.resolve();
      await releaseIndex.promise;
      await route.fulfill({ json: documents });
    });
    try {
      await page.goto(searchPath);
      const input = page.getByRole('searchbox', { name: 'Search documentation' });
      expect(requests).toBe(0);
      await input.fill('snapshot');
      await input.press('Enter');
      await indexRequested.promise;
      await expect(page.locator('[data-search-status]')).toHaveText(
        'Searching the local documentation index…',
      );
      await input.fill(query);
      await input.press('Enter');
      const responsePromise = page.waitForResponse((response) =>
        response.url().endsWith(indexPath),
      );
      releaseIndex.resolve();
      await (await responsePromise).finished();
      // Observe the next paint after fetch/body completion, including stale-query callbacks.
      await page.evaluate(
        () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
      );
      await expect(page.locator('[data-search-status]')).toHaveText(status);
      await expect(page.locator('[data-search-results] li')).toHaveCount(resultCount);
      expect(requests).toBe(1);
      await expect(
        page.getByRole('link', { name: 'Snapshots Read snapshots.', exact: true }),
      ).toHaveCount(0);
      if (resultCount > 0) {
        await expect(page.locator('[data-search-results]').getByRole('heading')).toHaveText(
          'Adapters',
        );
        await input.fill('snapshot');
        await input.press('Enter');
        await expect(page.locator('[data-search-status]')).toHaveText('1 result for “snapshot”.');
        expect(requests).toBe(1);
      }
    } finally {
      releaseIndex.resolve();
      await page.unrouteAll({ behavior: 'wait' });
    }
  });
}

for (const failure of ['http', 'network', 'invalid-json', 'invalid-index'] as const) {
  test(`reports ${failure} failures without an unhandled rejection and allows retry`, async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));
    let requests = 0;
    await page.route(`**${indexPath}`, async (route) => {
      requests += 1;
      if (requests > 1) return route.fulfill({ json: documents });
      if (failure === 'network') return route.abort('failed');
      if (failure === 'http') return route.fulfill({ status: 503 });
      if (failure === 'invalid-json')
        return route.fulfill({ body: '{', contentType: 'application/json' });
      return route.fulfill({ json: [{ title: 'Incomplete' }] });
    });
    await page.goto(searchPath);
    const input = page.getByRole('searchbox', { name: 'Search documentation' });
    await input.fill('snapshot');
    await input.press('Enter');
    await expect(page.locator('[data-search-status]')).toHaveText(
      'The local search index could not be loaded. Use package navigation instead.',
    );
    await expect(page.locator('[data-search-results] li')).toHaveCount(0);
    await input.press('Enter');
    await expect(page.locator('[data-search-status]')).toHaveText('1 result for “snapshot”.');
    await expect(page.locator('[data-search-results] li')).toHaveCount(1);
    expect(requests).toBe(2);
    expect(pageErrors).toStrictEqual([]);
  });
}

test('a cleared query stays empty when the pending index fails', async ({ page }) => {
  const indexRequested = Promise.withResolvers<void>();
  const releaseIndex = Promise.withResolvers<void>();
  await page.route(`**${indexPath}`, async (route) => {
    indexRequested.resolve();
    await releaseIndex.promise;
    await route.fulfill({ status: 503 });
  });
  try {
    await page.goto(searchPath);
    const input = page.getByRole('searchbox', { name: 'Search documentation' });
    await input.fill('snapshot');
    await input.press('Enter');
    await indexRequested.promise;
    await input.fill('');
    await input.press('Enter');
    const responsePromise = page.waitForResponse((response) => response.url().endsWith(indexPath));
    releaseIndex.resolve();
    // HTTP failures settle at the headers; the rejected body is intentionally not consumed.
    await responsePromise;
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );
    await expect(page.locator('[data-search-status]')).toHaveText(
      'Enter a package, capability, API symbol, or adapter ID.',
    );
    await expect(page.locator('[data-search-results] li')).toHaveCount(0);
  } finally {
    releaseIndex.resolve();
    await page.unrouteAll({ behavior: 'wait' });
  }
});

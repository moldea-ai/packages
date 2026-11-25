import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { RUNTIME_CATALOG } from '@moldea.ai/website-ui/runtime-catalog';
import { DEFAULT_BASE_PATH, normalizeBasePath, withBase } from '@moldea.ai/website-ui/site';

const basePath = normalizeBasePath(process.env.BASE_PATH ?? DEFAULT_BASE_PATH);

for (const width of [320, 768, 1440]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`runtime icons and three-row disclosure at ${width}px in ${colorScheme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      const batchSize = width < 768 ? 3 : width < 1280 ? 6 : 9;
      for (const route of ['/', '/runtimes/']) {
        await page.goto(withBase(route, basePath));
        const grid = page.locator('[data-runtime-grid]');
        const loadMore = page.getByRole('button', { name: 'Load more SDKs', exact: true });
        await expect(grid.locator('a:visible')).toHaveCount(batchSize);
        if (width === 1440) {
          await expect(
            grid.getByRole('link', { name: 'eve (opens in a new tab)', exact: true }),
          ).toBeVisible();
          await expect(
            grid.getByRole('link', {
              name: 'Mastra @mastra/core (opens in a new tab)',
              exact: true,
            }),
          ).toBeHidden();
        }
        await loadMore.focus();
        await page.keyboard.press('Enter');
        await expect(grid.locator('a:visible')).toHaveCount(35);
        await expect(
          grid.getByRole('link', { name: 'Mastra @mastra/core (opens in a new tab)', exact: true }),
        ).toBeVisible();
        await expect(grid.locator('a').nth(batchSize)).toBeFocused();
        await expect(loadMore).toBeHidden();
        await expect(grid.locator('a:visible')).toHaveCount(35);
        for (const runtime of RUNTIME_CATALOG) {
          const link = grid.getByRole('link', {
            name: `${[runtime.displayName, runtime.packageName].filter(Boolean).join(' ')} (opens in a new tab)`,
            exact: true,
          });
          await expect(link).toHaveAttribute('href', runtime.websiteUrl);
          await expect(link).toHaveAttribute('target', '_blank');
          await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
          await expect(link.locator('[data-external-link-icon]')).toHaveCount(1);
          await link.scrollIntoViewIfNeeded();
          const image = link.locator('img:visible');
          await expect(image).toHaveAttribute('alt', '');
          await expect(image).toHaveAttribute('width', '56');
          await expect(image).toHaveAttribute('height', '56');
          await image.evaluate(async (element: HTMLImageElement) => {
            await element.decode();
            if (element.naturalWidth === 0) throw new Error('Runtime icon did not decode.');
          });
        }
        // package names without separators stay on one line with their full value as a title
        const unbreakableId = grid.locator('code').filter({ hasText: /^openai$/u });
        await expect(unbreakableId).toHaveAttribute('data-code-text', 'unbreakable');
        await expect(unbreakableId).toHaveAttribute('title', 'openai');
        await expect(unbreakableId).toHaveCSS('white-space', 'nowrap');
        await expect(unbreakableId).toHaveCSS('text-overflow', 'ellipsis');
        const breakableId = grid.locator('code').filter({ hasText: /^@anthropic-ai\/sdk$/u });
        await expect(breakableId).not.toHaveAttribute('data-code-text');
        await expect(breakableId).not.toHaveAttribute('title');
        const first = grid.getByRole('link').first();
        await first.focus();
        await page.keyboard.press('Tab');
        const focusedLink = grid.getByRole('link').nth(1);
        await expect(focusedLink).toBeFocused();
        expect(
          await focusedLink.evaluate((element) => {
            const style = getComputedStyle(element);
            return style.outlineStyle !== 'none' || style.boxShadow !== 'none';
          }),
        ).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toStrictEqual(
          [],
        );
      }
      await expect(page.getByRole('heading', { name: 'SDKs moldea works with' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Read the binding contract' })).toHaveAttribute(
        'href',
        withBase('/repository-format/#repository-references-and-bindings', basePath),
      );
    });
  }
}

test('keeps three rows when the grid changes column count', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(withBase('/runtimes/', basePath));
  const links = page.locator('[data-runtime-grid] a:visible');
  await expect(links).toHaveCount(9);
  await links.nth(8).focus();
  await page.setViewportSize({ width: 320, height: 900 });
  await expect(links).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Load more SDKs' })).toBeFocused();
  await page.setViewportSize({ width: 768, height: 900 });
  await expect(links).toHaveCount(6);
});

test('all official links remain available without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    await context.route('https://openai.com/', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<title>Official runtime destination</title>',
      }),
    );
    const page = await context.newPage();
    await page.goto(withBase('/runtimes/', basePath));
    await expect(page.locator('[data-runtime-grid] a:visible')).toHaveCount(35);
    await expect(page.getByRole('button', { name: 'Load more SDKs' })).toBeHidden();
    const popupPromise = page.waitForEvent('popup');
    await page
      .getByRole('link', { name: 'OpenAI openai (opens in a new tab)', exact: true })
      .click();
    const popup = await popupPromise;
    await expect(popup).toHaveURL('https://openai.com/');
  } finally {
    await context.close();
  }
});

test('runtime search fragments reveal a collapsed destination', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(withBase('/runtimes/#openai', basePath));
  const runtime = page.locator('[data-runtime-grid] #openai');
  await expect(runtime).toBeVisible();
  await expect(runtime).toBeInViewport();
  await page.evaluate(() => {
    location.hash = 'voltagent';
  });
  await expect(page.locator('[data-runtime-grid] #voltagent')).toBeInViewport();
  await expect(page.locator('[data-runtime-grid] a:visible')).toHaveCount(35);
});

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { RUNTIME_CATALOG } from '@moldea.ai/website-ui/runtime-catalog';
import { DEFAULT_BASE_PATH, normalizeBasePath, withBase } from '@moldea.ai/website-ui/site';

const basePath = normalizeBasePath(process.env.BASE_PATH ?? DEFAULT_BASE_PATH);

for (const width of [320, 768, 1440]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`runtime labels, coverage guidance, and logos at ${width}px in ${colorScheme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      for (const route of ['/', '/runtimes/']) {
        await page.goto(withBase(route, basePath));
        const grid = page.locator('[data-runtime-grid]');
        await expect(grid.getByRole('link')).toHaveCount(35);
        for (const runtime of RUNTIME_CATALOG) {
          const link = grid.getByRole('link', { name: runtime.displayName, exact: true });
          await expect(link).toHaveAttribute(
            'href',
            `${route === '/' ? withBase('/runtimes/', basePath) : ''}#${runtime.id}`,
          );
          await link.scrollIntoViewIfNeeded();
          const image = link.locator('img:visible');
          await expect(image).toHaveAttribute('loading', 'lazy');
          await expect(image).toHaveAttribute('alt', '');
          await expect(image).toHaveAttribute('width', '104');
          await expect(image).toHaveAttribute('height', '32');
          await image.evaluate(async (element: HTMLImageElement) => {
            await element.decode();
            if (element.naturalWidth === 0) throw new Error('Runtime logo did not decode.');
          });
        }
        const first = grid.getByRole('link').first();
        await first.focus();
        expect(
          await first.evaluate((element) => {
            const style = getComputedStyle(element);
            return style.outlineStyle !== 'none' || style.boxShadow !== 'none';
          }),
        ).toBe(true);
        await page.keyboard.press('Tab');
        await expect(grid.getByRole('link').nth(1)).toBeFocused();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toStrictEqual(
          [],
        );
      }
      await expect(
        page.getByRole('heading', { name: 'Declared files and exports.' }),
      ).toBeVisible();
      await expect(page.locator('main')).toContainText('Core does not check runtime wiring');
    });
  }
}

test('a runtime link reaches its manifest ID without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(withBase('/runtimes/', basePath));
    await page
      .locator('[data-runtime-grid]')
      .getByRole('link', { name: 'OpenAI', exact: true })
      .click();
    await expect(page).toHaveURL(`${withBase('/runtimes/', basePath)}#openai`);
    await expect(page.locator('#openai')).toContainText('openai');
  } finally {
    await context.close();
  }
});

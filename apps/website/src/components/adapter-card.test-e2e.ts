import { expect, test } from '@playwright/test';
import { DEFAULT_BASE_PATH, withBase } from '@moldea.ai/website-ui/site';

import { loadWebsiteModel } from '../lib/generation/generation.ts';

const basePath = process.env.BASE_PATH ?? DEFAULT_BASE_PATH;

test('shows package identities and consistent card states without runtime descriptions', async ({
  page,
}) => {
  // the complete adapter catalog runs across both responsive widths and themes
  test.setTimeout(60_000);
  const model = loadWebsiteModel();
  for (const width of [320, 1440]) {
    for (const theme of ['light', 'dark'] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto(withBase('/', basePath));
      const runtimes = page.getByRole('list', { name: 'Available runtimes', exact: true });
      for (const adapter of model.adapters.filter(
        ({ entry }) => entry.implementationStatus === 'available',
      )) {
        const copy = model.discoveryCopy.adapters[adapter.id];
        const card = runtimes
          .getByRole('link')
          .filter({ has: page.getByRole('heading', { name: copy.name, exact: true }) });
        await expect(card).toContainText(adapter.entry.implementation.package);
        await expect(card).not.toContainText(copy.description);
        await page.mouse.move(0, 0);
        const restingBackground = await card.evaluate(
          (element) => getComputedStyle(element).backgroundColor,
        );
        const restingBorder = await card.evaluate(
          (element) => getComputedStyle(element).borderBottomColor,
        );
        await card.hover();
        await expect(card).toHaveCSS('opacity', '1');
        await expect(card).not.toHaveCSS('border-bottom-color', restingBorder);
        await expect(card).toHaveCSS('translate', 'none');
        await expect(card).toHaveCSS('background-color', restingBackground);
        await page.mouse.down();
        await expect(card).toHaveCSS('opacity', '1');
        await expect(card).toHaveCSS('translate', 'none');
        await expect(card).toHaveCSS('background-color', restingBackground);
        await page.mouse.move(0, 0);
        await page.mouse.up();
      }
    }
  }
});

test('uses the platform package-card lift without fading content', async ({ page }) => {
  for (const theme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'no-preference' });
    await page.goto(withBase('/', basePath));
    for (const name of ['Check a local repository', 'OpenAI']) {
      const card = page.getByRole('link').filter({
        has: page.getByRole('heading', { name, exact: true }),
      });
      await card.evaluate((element) =>
        element.scrollIntoView({ block: 'center', behavior: 'instant' }),
      );
      await card.hover();
      await expect(card).toHaveCSS('translate', '0px -2px');
      await expect(card).toHaveCSS('opacity', '1');
      await page.mouse.down();
      await expect(card).toHaveCSS('translate', '0px 1px');
      await page.mouse.move(0, 0);
      await page.mouse.up();
      await card.focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      await expect(card).toBeFocused();
      await expect(card).not.toHaveCSS('box-shadow', 'none');
    }
  }
});

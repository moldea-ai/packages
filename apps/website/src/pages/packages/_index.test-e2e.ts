import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { DEFAULT_BASE_PATH, withBase } from '@moldea.ai/website-ui/site';

const basePath = process.env.BASE_PATH ?? DEFAULT_BASE_PATH;

// Astro's underscore prefix excludes this colocated browser test from page discovery.
for (const width of [320, 768, 1440]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`package examples and navigation at ${width}px in ${colorScheme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto(withBase('/packages/', basePath));
      const sections = page.locator('[data-package-showcase]');
      await expect(sections).toHaveCount(4);
      for (const slug of ['cli', 'core', 'repository', 'repository-fs']) {
        await page
          .getByRole('navigation', { name: 'Choose a package' })
          .getByRole('link', { name: slug, exact: true })
          .click();
        const section = page.locator(`#${slug}`);
        await expect(section).toBeInViewport();
        const code = section.getByRole('region', {
          name: `@moldea.ai/${slug} example`,
          exact: true,
        });
        await expect(code.locator('[style*="--shiki"]')).not.toHaveCount(0);
        const trigger = section.getByRole('button', { name: /^View result:/u });
        await trigger.focus();
        await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        const bounds = await dialog.boundingBox();
        expect(bounds!.width).toBe(width < 640 ? width : Math.min(width - 32, 672));
        await page.keyboard.press('Escape');
        await expect(trigger).toBeFocused();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toStrictEqual(
        [],
      );
    });
  }
}

test('package examples and guide links work without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 900 },
  });
  try {
    const page = await context.newPage();
    await page.goto(withBase('/packages/', basePath));
    await expect(page.locator('[data-package-showcase]')).toHaveCount(4);
    await page.getByRole('link', { name: 'Not sure where to start? Read the guide.' }).click();
    await expect(page).toHaveURL(new RegExp(`${withBase('/getting-started/', basePath)}$`));
  } finally {
    await context.close();
  }
});

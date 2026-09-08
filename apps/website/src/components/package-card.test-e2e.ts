import { expect, test } from '@playwright/test';
import { DEFAULT_BASE_PATH, withBase } from '@moldea.ai/website-ui/site';

import { loadWebsiteModel } from '../lib/generation/generation.ts';

const basePath = process.env.BASE_PATH ?? DEFAULT_BASE_PATH;

test('separates each package identifier from its bottom-right version in both themes and responsive layouts', async ({
  page,
}) => {
  const model = loadWebsiteModel();
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(withBase('/packages/', basePath));
      for (const packageModel of model.packages) {
        const card = page
          .locator('main')
          .getByRole('link')
          .filter({
            has: page.getByText(packageModel.name, { exact: true }),
          });
        await expect(card).toHaveAttribute('href', withBase(packageModel.route, basePath));
        const identifier = card.locator('code').filter({ hasText: packageModel.name });
        await expect(identifier.locator('..')).toHaveText(packageModel.name);
        const version = card.getByText(`Version v${packageModel.version}`, { exact: true });
        await expect(version).toHaveText(`Version v${packageModel.version}`);
        const position = await version.evaluate((element) => {
          const versionRect = element.getBoundingClientRect();
          const footer = element.parentElement!;
          const footerRect = footer.getBoundingClientRect();
          const actionRect = footer.firstElementChild!.getBoundingClientRect();
          return {
            rightGap: footerRect.right - versionRect.right,
            bottomGap: footerRect.bottom - versionRect.bottom,
            separation: versionRect.left - actionRect.right,
            height: versionRect.height,
            lineHeight: Number.parseFloat(getComputedStyle(element).lineHeight),
          };
        });
        expect(position.rightGap).toBeLessThanOrEqual(1);
        expect(position.bottomGap).toBeLessThanOrEqual(1);
        expect(position.separation).toBeGreaterThan(0);
        expect(position.height).toBeLessThanOrEqual(position.lineHeight + 1);
      }
      const widths = await page.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(widths.scroll).toBeLessThanOrEqual(widths.client);
    }
  }
});

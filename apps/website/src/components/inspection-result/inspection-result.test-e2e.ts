import { expect, test } from '@playwright/test';
import { DEFAULT_BASE_PATH, withBase } from '@moldea.ai/website-ui/site';

const homepage = withBase('/', process.env.BASE_PATH ?? DEFAULT_BASE_PATH);

for (const theme of ['light', 'dark'] as const) {
  test(`keeps a long result scrollable beneath its outcome heading in ${theme}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 540 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto(homepage);
    await page.getByRole('button', { name: 'View result: Hero example', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '1 broken reference', exact: true });
    await expect(dialog.getByRole('heading')).toHaveCount(1);
    const badge = dialog.locator('header').getByText('Invalid', { exact: true });
    await expect(badge).toBeInViewport({ ratio: 1 });
    const body = dialog.locator(':scope > div');
    expect(await body.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
      true,
    );
    const pageScroll = await page.evaluate(() => window.scrollY);
    await body.hover();
    await page.mouse.wheel(0, 400);
    await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(pageScroll);
    await expect(dialog.getByRole('heading')).toBeInViewport({ ratio: 1 });
    await expect(dialog.getByRole('button', { name: 'Close Core result' })).toBeInViewport({
      ratio: 1,
    });
    expect(await body.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  });
}

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { DEFAULT_BASE_PATH, withBase } from '@moldea.ai/website-ui/site';

const basePath = process.env.BASE_PATH ?? DEFAULT_BASE_PATH;
const homepage = withBase('/', basePath);

test('follows the real check through keyboard tabs and reinitializes after navigation', async ({
  page,
}) => {
  await page.goto(homepage);
  const example = page.getByRole('region', { name: 'A file moves. The connection breaks.' });
  const connected = example.getByRole('tab', { name: '1. Connected' });
  const broken = example.getByRole('tab', { name: '2. File moved' });
  const repaired = example.getByRole('tab', { name: '3. Connection updated' });
  const activePanel = example.getByRole('tabpanel');
  await expect(activePanel).toHaveCount(1);
  await expect(activePanel).toContainText('Check passed');
  await connected.focus();
  await page.keyboard.press('ArrowRight');
  await expect(broken).toBeFocused();
  await expect(broken).toHaveAttribute('aria-selected', 'true');
  await expect(activePanel).toContainText('MOLDEA_REFERENCE_MISSING');
  await expect(activePanel).toContainText('/context/~1moldea~1project.md/bindings/0');
  await expect(activePanel).toContainText('/src/payments/refund-policy.ts');
  await page.keyboard.press('End');
  await expect(repaired).toBeFocused();
  await expect(activePanel).toContainText('Check passed');
  await expect(activePanel).not.toContainText('MOLDEA_REFERENCE_MISSING');
  await page.keyboard.press('ArrowLeft');
  await expect(broken).toBeFocused();
  await page.keyboard.press('Home');
  await expect(connected).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(repaired).toBeFocused();
  await expect(example).toContainText('It does not check that the code enforces manager approval');

  await page.getByRole('link', { name: 'Start using the tools' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Get started with moldea' }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${homepage}$`));
  await example.getByRole('tab', { name: '2. File moved' }).click();
  await expect(example.getByRole('tabpanel')).toContainText('Check failed');
});

for (const width of [320, 360, 768, 1024, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`renders all example states at ${width}px in ${theme} mode`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto(homepage);
      const example = page.getByRole('region', { name: 'A file moves. The connection breaks.' });
      for (const name of ['1. Connected', '2. File moved', '3. Connection updated']) {
        const tab = example.getByRole('tab', { name });
        await tab.click();
        await expect(tab).toHaveAttribute('aria-selected', 'true');
        await expect(example.getByRole('tabpanel')).toBeVisible();
        const widths = await page.evaluate(() => ({
          client: document.documentElement.clientWidth,
          scroll: document.documentElement.scrollWidth,
        }));
        expect(widths.scroll).toBeLessThanOrEqual(widths.client);
        if (width === 320 || width === 1440) {
          const results = await new AxeBuilder({ page }).include('#how-it-works').analyze();
          expect(
            results.violations.filter(
              ({ impact }) => impact === 'serious' || impact === 'critical',
            ),
          ).toStrictEqual([]);
        }
      }
    });
  }
}

test('keeps all snapshots and results readable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 740 },
  });
  const page = await context.newPage();
  try {
    await page.goto(homepage);
    const example = page.getByRole('region', { name: 'A file moves. The connection breaks.' });
    await expect(example.getByText('Core result excerpt', { exact: true })).toHaveCount(3);
    await expect(example.getByText('Check passed', { exact: true })).toHaveCount(2);
    await expect(example.getByText('Check failed', { exact: true })).toBeVisible();
    for (const name of ['1. Connected', '2. File moved', '3. Connection updated']) {
      await expect(example.getByRole('region', { name, exact: true })).toBeVisible();
    }
  } finally {
    await context.close();
  }
});

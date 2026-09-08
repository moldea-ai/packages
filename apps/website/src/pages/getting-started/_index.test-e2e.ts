import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { DEFAULT_BASE_PATH, withBase } from '@moldea.ai/website-ui/site';

const basePath = process.env.BASE_PATH ?? DEFAULT_BASE_PATH;
const guidePath = withBase('/getting-started/', basePath);

for (const width of [320, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`keeps the title's brand token proportionate at ${width}px in ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(guidePath);
      const heading = page.getByRole('heading', { level: 1, name: 'Get started with moldea' });
      const brand = heading.locator('code');
      await expect(brand).toHaveText('moldea');
      await expect(brand).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(brand).toHaveCSS('letter-spacing', 'normal');
      const typography = await heading.evaluate((element) => ({
        heading: parseFloat(getComputedStyle(element).fontSize),
        brand: parseFloat(getComputedStyle(element.querySelector('code')!).fontSize),
      }));
      expect(typography.brand / typography.heading).toBeCloseTo(0.86, 2);
      const bounds = await brand.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      const accessibility = await new AxeBuilder({ page }).include('main').analyze();
      expect(
        accessibility.violations.filter(
          ({ impact }) => impact === 'serious' || impact === 'critical',
        ),
      ).toStrictEqual([]);
    });
  }
}

// Astro's native underscore prefix keeps this colocated page test out of route discovery.
test('connects homepage, desktop navigation, and footer to the guide', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(withBase('/', basePath));
  await page.getByRole('link', { name: 'Start using the tools', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${guidePath}$`));
  await expect(
    page.getByRole('heading', { level: 1, name: 'Get started with moldea' }),
  ).toBeVisible();
  await expect(
    page.locator('header nav').getByRole('link', { name: 'Get started', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(
    page
      .getByRole('navigation', { name: 'Documentation', exact: true })
      .getByRole('link', { name: 'Get started' }),
  ).toHaveAttribute('href', guidePath);

  const content = page.locator('main');
  await expect(
    content.getByRole('link', { name: 'moldea Agent Skill', exact: true }),
  ).toHaveAttribute('href', 'https://skill.moldea.ai/');
  await expect(
    content.getByRole('link', { name: 'CLI overview and installation guide' }),
  ).toHaveAttribute('href', withBase('/packages/cli/', basePath));
  for (const [name, route] of [
    ['Core', '/packages/core/'],
    ['Repository', '/packages/repository/'],
    ['Repository FS', '/packages/repository-fs/'],
    ['runtime adapters and compatibility', '/adapters/'],
  ] as const) {
    await expect(content.getByRole('link', { name, exact: true })).toHaveAttribute(
      'href',
      withBase(route, basePath),
    );
  }
  await expect(content).toContainText('not every coding-agent or Agent Skill workflow');
  await expect(content).toContainText('Installing a package alone does not adopt the repository');
});

test('keeps the guide usable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 740 },
  });
  const page = await context.newPage();
  try {
    await page.goto(guidePath);
    await expect(
      page.getByRole('heading', { name: 'Check an adopted repository locally' }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'CLI overview and installation guide' }).click();
    await expect(page).toHaveURL(new RegExp(`${withBase('/packages/cli/', basePath)}$`));
  } finally {
    await context.close();
  }
});

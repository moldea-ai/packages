import { expect, test } from '@playwright/test';
import { DEFAULT_BASE_PATH, withBase } from '@moldea.ai/website-ui/site';

const basePath = process.env.BASE_PATH ?? DEFAULT_BASE_PATH;
const guidePath = withBase('/getting-started/', basePath);

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
    ['compatibility matrix', '/compatibility/'],
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

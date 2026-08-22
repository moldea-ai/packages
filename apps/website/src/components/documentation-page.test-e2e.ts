import { expect, test } from '@playwright/test';
import { DEFAULT_BASE_PATH, withBase } from '@moldea.ai/website-ui/site';

const basePath = process.env.BASE_PATH ?? DEFAULT_BASE_PATH;
const toPublicPath = (route: string): string => withBase(route, basePath);

test('renders documentation tables with one consistent scroll-frame perimeter', async ({
  page,
}) => {
  await page.setViewportSize({ height: 740, width: 320 });
  await page.goto(toPublicPath('/adapters/anthropic/evidence-and-diagnostics/'));

  const table = page.getByRole('table');
  const scrollFrame = table.locator('..');

  await expect(table).toBeVisible();
  await expect(table).toHaveCSS('margin-top', '0px');
  await expect(table).toHaveCSS('margin-bottom', '0px');
  await expect(table).toHaveCSS('border-style', 'hidden');
  await expect(scrollFrame).toHaveAttribute('role', 'region');
  await expect(scrollFrame).toHaveAttribute('aria-label', 'Scrollable table');
  await expect(scrollFrame).toHaveCSS('border-style', 'solid');
});

test('identifies API reference pages in breadcrumbs and documentation navigation', async ({
  page,
}) => {
  for (const { packageName, packageRoute, path } of [
    {
      packageName: '@moldea.ai/core',
      packageRoute: '/packages/core/',
      path: '/packages/core/api/',
    },
    {
      packageName: '@moldea.ai/adapter-anthropic',
      packageRoute: '/adapters/anthropic/',
      path: '/adapters/anthropic/api/',
    },
    {
      packageName: '@moldea.ai/adapter-openai',
      packageRoute: '/adapters/openai/',
      path: '/adapters/openai/api/',
    },
  ]) {
    await page.goto(toPublicPath(path));

    const breadcrumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(breadcrumbs.getByRole('link', { name: packageName, exact: true })).toHaveAttribute(
      'href',
      toPublicPath(packageRoute),
    );
    await expect(breadcrumbs.locator('[aria-current="page"]')).toHaveText('API reference');

    const documentationNavigation = page.getByRole('navigation', {
      includeHidden: true,
      name: `${packageName} documentation`,
    });
    const activeApiLinks = documentationNavigation.getByRole('link', {
      includeHidden: true,
      name: 'API reference',
      exact: true,
    });

    await expect(documentationNavigation).toHaveCount(2);
    await expect(activeApiLinks).toHaveCount(2);
    await expect(activeApiLinks.nth(0)).toHaveAttribute('aria-current', 'page');
    await expect(activeApiLinks.nth(1)).toHaveAttribute('aria-current', 'page');
  }
});

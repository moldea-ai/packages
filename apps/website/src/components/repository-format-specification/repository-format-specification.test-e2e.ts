import { expect, test } from '@playwright/test';
import { DEFAULT_BASE_PATH, withBase } from '@moldea.ai/website-ui/site';

const basePath = process.env.BASE_PATH ?? DEFAULT_BASE_PATH;
const toPublicPath = (route: string): string => withBase(route, basePath);

test('presents the official contract and its complete property reference', async ({ page }) => {
  await page.setViewportSize({ height: 720, width: 1280 });
  await page.goto(toPublicPath('/repository-format/'));

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Repository Format specification',
  );
  await expect(page.getByText('Official specification', { exact: true })).toBeVisible();
  await expect(page.getByText('Repository Format version 1', { exact: true })).toBeVisible();
  await expect(page.getByRole('table').first()).toContainText(
    'agents.{agent-id}.tools.{tool-id}.implementation.path',
  );
  await expect(page.getByRole('link', { name: 'Canonical source' })).toHaveAttribute(
    'href',
    'https://github.com/moldea-ai/packages/blob/main/specifications/repository-format.md',
  );
  await expect(page.getByRole('link', { name: 'Core reference implementation' })).toHaveAttribute(
    'href',
    toPublicPath('/packages/core/'),
  );

  const desktopOutline = page.getByRole('navigation', { name: 'On this page' });
  const desktopOutlineScroller = desktopOutline.locator('..');

  await expect(desktopOutline).toBeVisible();
  expect(
    await desktopOutlineScroller.evaluate((element) => {
      const styles = getComputedStyle(element);

      return styles.overflowY === 'auto' && element.scrollHeight > element.clientHeight;
    }),
  ).toBe(true);
});

test('contains long reference content at the 320px viewport', async ({ page }) => {
  await page.setViewportSize({ height: 740, width: 320 });
  await page.goto(toPublicPath('/repository-format/'));

  const propertyTableRegion = page.getByRole('region', { name: 'Scrollable table' }).first();
  const minimumTree = page.getByLabel('Minimum Repository Format tree');
  const mobileOutline = page.locator('details').filter({ hasText: 'On this page' });

  await expect(propertyTableRegion).toBeVisible();
  await expect(minimumTree).toBeVisible();
  await expect(mobileOutline).toBeVisible();

  const mobileOutlineSummary = mobileOutline.locator('summary');

  await mobileOutlineSummary.focus();
  await page.keyboard.press('Enter');
  await expect(mobileOutline).toHaveAttribute('open', '');

  const mobileOutlineNavigation = mobileOutline.getByRole('navigation', {
    name: 'On this page',
  });

  await expect(mobileOutlineNavigation).toBeVisible();
  await expect(
    mobileOutlineNavigation.getByRole('link', { name: 'Manifest property reference' }),
  ).toHaveAttribute('href', '#manifest-property-reference');
  expect(
    await mobileOutlineNavigation.evaluate((element) => {
      const styles = getComputedStyle(element);

      return styles.overflowY === 'auto' && element.scrollHeight > element.clientHeight;
    }),
  ).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

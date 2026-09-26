// @vitest-environment node
import { expect, test } from '@playwright/test';
import { DEFAULT_BASE_PATH, withBase } from '@moldea.ai/website-ui/site';

const basePath = process.env.BASE_PATH ?? DEFAULT_BASE_PATH;
const toPublicPath = (route: string): string => withBase(route, basePath);

test('distinguishes required repository files from optional project knowledge', async ({
  page,
}) => {
  await page.goto(toPublicPath('/'));
  const overview = page.getByRole('region', { name: 'The structure behind every evaluation.' });
  const files = overview.getByRole('list', { name: 'moldea directory' });
  await expect(files.getByRole('listitem').filter({ hasText: 'moldea.yaml' })).toContainText(
    'Required',
  );
  await expect(files.getByRole('listitem').filter({ hasText: 'project.md' })).toContainText(
    'Required',
  );
  await expect(files.getByRole('listitem').filter({ hasText: 'context/' })).toContainText(
    'Optional',
  );
  await expect(files).toContainText('decisions/');
  await expect(files).toContainText('agents/');
  await expect(overview.getByRole('list', { name: 'Repository files', exact: true })).toContainText(
    'src/',
  );
  for (const name of ['Files you own', 'Check the connections', 'Structured result']) {
    await expect(overview.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  await expect(overview).toContainText('a separate, semantic evaluation');
  await expect(
    overview.getByRole('link', { name: 'Read the format specification' }),
  ).toHaveAttribute('href', toPublicPath('/repository-format/'));
  const output = overview.getByLabel('Core validation result excerpt');
  await expect(output).toBeVisible();
  expect(JSON.parse(await output.innerText())).toStrictEqual({
    valid: false,
    errorCount: 1,
    warningCount: 0,
    diagnostics: [
      { code: 'MOLDEA_REFERENCE_MISSING', path: '/moldea/moldea.yaml', severity: 'error' },
    ],
  });
  await expect(overview).toContainText('The full result also includes formatVersion');
});

test('visually separates the repository architecture from the example in both themes', async ({
  page,
}) => {
  await page.goto(toPublicPath('/'));
  const overview = page.getByRole('region', { name: 'The structure behind every evaluation.' });
  for (const theme of ['light', 'dark'] as const) {
    await page.locator('html').evaluate((root, activeTheme) => {
      root.classList.remove('light', 'dark');
      root.classList.add(activeTheme);
    }, theme);
    const surfaces = await overview.evaluate((section) => ({
      architecture: getComputedStyle(section).backgroundColor,
      page: getComputedStyle(document.body).backgroundColor,
    }));
    expect(surfaces.architecture).not.toBe(surfaces.page);
  }
});

test('orders the homepage from purpose and a real check to tools and boundaries', async ({
  page,
}) => {
  await page.goto(toPublicPath('/'));
  const titles = await page.getByRole('main').getByRole('heading', { level: 2 }).allTextContents();
  expect(titles.map((title) => title.replaceAll(/\s+/gu, ' ').trim())).toStrictEqual([
    'A file moves.The connection breaks.',
    'The structure behind every evaluation.',
    'Start with the task.',
    'Find your runtime.',
    'Know what a check tells you.',
  ]);
  await expect(page.getByRole('region', { name: 'Available runtimes' })).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'Available runtimes' })).toHaveCount(1);
});

for (const width of [320, 768, 1024, 1440]) {
  test(`aligns architecture and runtime introductions at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(toPublicPath('/'));
    for (const title of ['The structure behind every evaluation.', 'Find your runtime.']) {
      const section = page.getByRole('region', { name: title, exact: true });
      const header = section.locator('header').first();
      const heading = await header.getByRole('heading', { level: 2 }).boundingBox();
      const description = await header.locator(':scope > p').boundingBox();
      if (width >= 1024) {
        expect(description!.x).toBeGreaterThan(heading!.x + heading!.width);
        expect(
          Math.abs(description!.y + description!.height - heading!.y - heading!.height),
        ).toBeLessThan(1);
      } else {
        expect(description!.y).toBeGreaterThan(heading!.y + heading!.height);
      }
    }
  });
}

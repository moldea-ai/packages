// @vitest-environment node
import { expect, test } from '@playwright/test';
import { DEFAULT_BASE_PATH, withBase } from '@moldea.ai/website-ui/site';

const basePath = process.env.BASE_PATH ?? DEFAULT_BASE_PATH;
const toPublicPath = (route: string): string => withBase(route, basePath);

test('explains how Repository Format supports deterministic and semantic evaluation', async ({
  page,
}) => {
  await page.goto(toPublicPath('/'));

  const overview = page.getByRole('region', {
    name: 'The structure behind every evaluation.',
  });

  await expect(
    overview.getByRole('heading', { level: 3, name: 'Repository snapshot' }),
  ).toBeVisible();
  await expect(overview.getByText('moldea/project.md', { exact: true })).toBeVisible();
  await expect(overview.getByText('@moldea.ai/core', { exact: true })).toBeVisible();
  await expect(
    overview.getByRole('heading', { level: 3, name: 'Structured result' }),
  ).toBeVisible();
  await expect(overview.getByLabel('Project inspection result structure')).toContainText(
    'evidence: [...]',
  );
  await expect(
    overview.getByRole('heading', {
      level: 3,
      name: 'Code, context, and instructions stay connected.',
    }),
  ).toBeVisible();
  await expect(
    overview.getByRole('heading', { level: 3, name: 'Deterministic evaluation' }),
  ).toBeVisible();
  await expect(
    overview.getByRole('heading', { level: 3, name: 'Semantic evaluation' }),
  ).toBeVisible();
  await expect(
    overview.getByRole('link', { name: 'Read the format specification' }),
  ).toHaveAttribute('href', toPublicPath('/repository-format/'));
});

test('keeps selection visible across dark and nested light surfaces', async ({ page }) => {
  await page.goto(toPublicPath('/'));

  const overview = page.getByRole('region', {
    name: 'The structure behind every evaluation.',
  });
  const overviewTitle = overview.getByRole('heading', {
    level: 2,
    name: 'The structure behind every evaluation.',
  });
  const coreLabel = overview.getByText('@moldea.ai/core', { exact: true });
  const specificationLink = overview.getByRole('link', {
    name: 'Read the format specification',
  });
  const brandCode = overview.locator('code').filter({ hasText: 'moldea' });

  for (const theme of ['light', 'dark'] as const) {
    await page.locator('html').evaluate((root, activeTheme) => {
      root.classList.remove('light', 'dark');
      root.classList.add(activeTheme);
    }, theme);

    const surfaceBackground = await overview.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    const titleSelection = await overviewTitle.evaluate((element) => {
      const styles = getComputedStyle(element, '::selection');

      return { background: styles.backgroundColor, color: styles.color };
    });
    const coreSelection = await coreLabel.evaluate((element) => {
      const styles = getComputedStyle(element, '::selection');

      return { background: styles.backgroundColor, color: styles.color };
    });
    const linkSelection = await specificationLink.evaluate((element) => {
      const styles = getComputedStyle(element, '::selection');

      return { background: styles.backgroundColor, color: styles.color };
    });
    const codeSelection = await brandCode.evaluate((element) => {
      const styles = getComputedStyle(element, '::selection');

      return { background: styles.backgroundColor, color: styles.color };
    });

    expect(titleSelection.background).not.toBe(surfaceBackground);
    expect(coreSelection).toStrictEqual(linkSelection);
    expect(coreSelection.background).not.toBe(titleSelection.background);
    expect(codeSelection.background).not.toBe(titleSelection.background);
    expect(codeSelection.color).not.toBe(titleSelection.color);
  }
});

test('orders the landing-page narrative from repository model to implementation confidence', async ({
  page,
}) => {
  await page.goto(toPublicPath('/'));

  const sectionHeadings = await page.locator('main > section h2').allTextContents();

  expect(sectionHeadings.map((heading) => heading.replaceAll(/\s+/gu, ' ').trim())).toStrictEqual([
    'The structure behind every evaluation.',
    'Deterministic by design.',
    'Runtime-specific evidence, built in.',
    'From source bytes to trusted structure.',
    'Technical compatibility and maturity stay independent.',
  ]);
});

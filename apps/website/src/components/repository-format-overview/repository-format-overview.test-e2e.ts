// @vitest-environment node
import { expect, test } from '@playwright/test';
import { DEFAULT_BASE_PATH, withBase } from '@moldea.ai/website-ui/site';

const basePath = process.env.BASE_PATH ?? DEFAULT_BASE_PATH;
const toPublicPath = (route: string): string => withBase(route, basePath);

test('distinguishes required repository files from optional project knowledge', async ({
  page,
}) => {
  await page.goto(toPublicPath('/'));
  const overview = page.getByRole('region', { name: 'A small structure. A shared record.' });
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
  await expect(
    overview.getByRole('link', { name: 'Read the format specification' }),
  ).toHaveAttribute('href', toPublicPath('/repository-format/'));
  await expect(page.getByLabel('Project inspection result structure')).toHaveCount(0);
});

test('orders the homepage from purpose and a real check to tools and boundaries', async ({
  page,
}) => {
  await page.goto(toPublicPath('/'));
  const titles = await page.locator('main > section h2').allTextContents();
  expect(titles.map((title) => title.replaceAll(/\s+/gu, ' ').trim())).toStrictEqual([
    'A file moves.The connection breaks.',
    'A small structure.A shared record.',
    'Start with the task.',
    'Find your runtime.Check its exact scope.',
    'Know what a check tells you.',
  ]);
  await expect(page.getByRole('region', { name: 'Available runtimes' })).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'Available runtimes' })).toHaveCount(1);
});

// @vitest-environment node
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { DEFAULT_BASE_PATH, withBase } from '@moldea.ai/website-ui/site';

const basePath = process.env.BASE_PATH ?? DEFAULT_BASE_PATH;
const toPublicPath = (route: string): string => withBase(route, basePath);

test('shows maturity definitions without hover and preserves every exact target', async ({
  page,
}) => {
  await page.goto(toPublicPath('/compatibility/'));
  const legend = page.getByRole('region', { name: 'Target maturity' });
  for (const definition of [
    'Production-ready within its exact published scope.',
    'Verified and fixture-backed, but not production-ready.',
    'Documented for existing users; new adoption is discouraged.',
  ])
    await expect(legend.getByText(definition, { exact: true })).toBeVisible();
  const table = page.getByRole('table', {
    name: 'Official moldea runtime adapter compatibility summary',
  });
  await expect(table.getByRole('link', { name: /, supported$/u })).toHaveCount(14);
  await expect(table.getByRole('link', { name: /, experimental$/u })).toHaveCount(0);
  await expect(table.getByRole('link', { name: /, deprecated$/u })).toHaveCount(0);
  for (const [name, id] of [
    ['Custom runtime declarations', 'custom'],
    ['Create agent', 'typescript-create-agent-1-5'],
    ['Functional API', 'typescript-functional-api-1-4'],
    ['StateGraph', 'typescript-state-graph-1-4'],
    ['Think agents', 'typescript-think-0-16-ai-sdk-7'],
    ['AIChatAgent', 'typescript-ai-chat-agent-0-10-ai-sdk-7'],
  ]) {
    const link = table.getByRole('link', { name: `${name}, ${id}, supported`, exact: true });
    await expect(link.locator('code')).toHaveText(id);
    await expect(link.getByText('supported', { exact: true })).toBeVisible();
  }
  const borders = await Promise.all(
    ['supported', 'experimental', 'deprecated'].map((kind) =>
      legend
        .getByText(kind, { exact: true })
        .evaluate((element) => getComputedStyle(element).borderStyle),
    ),
  );
  expect(borders).toStrictEqual(['solid', 'dashed', 'dotted']);
  for (const theme of ['light', 'dark'] as const) {
    await page.locator('html').evaluate((root, activeTheme) => {
      root.classList.remove('light', 'dark');
      root.classList.add(activeTheme);
    }, theme);
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter(({ impact }) => impact === 'critical' || impact === 'serious'),
    ).toStrictEqual([]);
  }
});

test('keeps full target identifiers and keyboard navigation usable at 320px', async ({ page }) => {
  await page.setViewportSize({ height: 740, width: 320 });
  await page.goto(toPublicPath('/compatibility/'));
  const scrollRegion = page.getByRole('region', { name: 'Runtime compatibility table' });
  await scrollRegion.focus();
  await expect(scrollRegion).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect
    .poll(() => scrollRegion.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0);
  const targetLink = page.getByRole('link', {
    name: 'Create agent, typescript-create-agent-1-5, supported',
    exact: true,
  });
  const targetPath =
    toPublicPath('/adapters/langchain/') + '#langchain-typescript-create-agent-1-5';
  await expect(targetLink).toHaveAttribute('href', targetPath);
  await expect(targetLink.locator('code')).toHaveText('typescript-create-agent-1-5');
  expect(
    await targetLink.locator('code').evaluate((element) => getComputedStyle(element).textOverflow),
  ).not.toBe('ellipsis');
  const widths = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client);
  await targetLink.focus();
  await expect(targetLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(targetPath + '$'));
  await expect(
    page.getByRole('heading', { level: 2, name: 'Create agent', exact: true }),
  ).toBeVisible();
});

test('shows both target maturities on multi-target adapter cards', async ({ page }) => {
  await page.goto(toPublicPath('/adapters/'));
  const langGraphTargets = page.getByRole('list', { name: 'LangGraph target maturity' });
  await expect(langGraphTargets.getByRole('listitem')).toHaveCount(2);
  await expect(langGraphTargets.getByText('supported', { exact: true })).toHaveCount(2);
  await expect(langGraphTargets).toContainText('typescript-functional-api-1-4');
  await expect(langGraphTargets).toContainText('typescript-state-graph-1-4');
});

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { DEFAULT_BASE_PATH, normalizeBasePath, withBase } from '@moldea.ai/website-ui/site';

import { loadWebsiteModel } from '../../lib/generation/generation.ts';

const basePath = normalizeBasePath(process.env.BASE_PATH ?? DEFAULT_BASE_PATH);
const route = withBase('/capabilities/', basePath);
const model = loadWebsiteModel();

for (const width of [320, 375, 768, 1024, 1100, 1279, 1280, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`shows the complete capabilities without overflow at ${width}px in ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(
        'What can your repository prove?',
      );
      await expect(page.locator('main [data-capability-outcome]')).toHaveCount(
        model.capabilities.cases.length,
      );
      await expect(page.locator('main [data-capability-target]')).toHaveCount(14);
      for (const group of model.capabilities.groups)
        await expect(page.getByRole('region', { name: group.title, exact: true })).toBeVisible();
      if (width < 1024) await page.getByLabel('Open navigation', { exact: true }).click();
      const nav = page.getByRole('navigation', {
        name: width < 1024 ? 'Mobile navigation' : 'Primary navigation',
        exact: true,
      });
      await expect(nav.getByRole('link', { name: 'Capabilities', exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      const overflow = await page
        .locator('main article')
        .evaluateAll((articles) =>
          articles
            .filter(
              (article) =>
                article.getBoundingClientRect().right > document.documentElement.clientWidth + 1,
            )
            .map((article) => article.id),
        );
      expect(overflow).toStrictEqual([]);
      const code = page.locator('#variable-undeclared pre').last();
      await expect(code).toHaveAttribute('tabindex', '0');
      await expect(code).toHaveCSS('white-space', 'pre');
      await expect(code).toHaveCSS('overflow-x', 'auto');
    });
  }
}

for (const width of [320, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`keeps each result family accessible at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto(route);
      for (const [id, title] of [
        ['manifest-unknown-property', 'Unknown field: agent'],
        ['variable-undeclared', '1 undeclared variable'],
        ['decision-cycle', '2 decisions form a cycle'],
        ['snapshot-comparison', 'Recorded facts returned'],
        ['cli-content-refusal', 'Exit 3: operation refused'],
      ]) {
        const trigger = page.locator(`#${id}`).getByRole('button', { name: /^View result:/u });
        await trigger.click();
        const dialog = page.getByRole('dialog', { name: title, exact: true });
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole('heading', { level: 2, name: title })).toBeVisible();
        await expect(dialog).not.toHaveAttribute('aria-describedby');
        const close = dialog.getByRole('button', { name: 'Close capability result' });
        await expect(close).toBeFocused();
        const icon = dialog
          .getByRole('group', { name: 'Result', exact: true })
          .locator(':scope > span');
        if (width < 640) await expect(icon).toBeHidden();
        else await expect(icon).toHaveCSS('width', '40px');
        const badge = dialog.locator('[data-status-badge]').first();
        expect((await badge.boundingBox())!.height).toBeLessThanOrEqual(22);
        expect(
          await dialog.evaluate((element) =>
            element
              .getAnimations()
              .every((animation) => Number(animation.effect?.getTiming().duration) <= 1),
          ),
        ).toBe(true);
        await page.keyboard.press('Shift+Tab');
        // Native dialogs may transfer focus to browser chrome, never the inert page.
        expect(
          await dialog.evaluate(
            (element) =>
              element.contains(document.activeElement) ||
              (!document.hasFocus() && document.activeElement === document.body),
          ),
        ).toBe(true);
        await page.keyboard.press('Escape');
        await expect(dialog).not.toBeVisible();
        await expect(trigger).toBeFocused();
        await trigger.click();
        await close.click();
        await expect(dialog).not.toBeVisible();
        if (width >= 640) {
          await trigger.click();
          await page.mouse.click(8, 8);
          await expect(dialog).not.toBeVisible();
          await expect(trigger).toBeFocused();
        }
      }
      const runtime = page.locator('#target-openai-typescript-responses-api-7');
      await runtime.getByRole('button', { name: /^View result:/u }).click();
      const runtimeDialog = page.getByRole('dialog');
      await expect(runtimeDialog.getByRole('heading', { name: /evidence records/u })).toBeVisible();
      await expect(runtimeDialog).toContainText('evidenceExcerpt');
      const analysis = await new AxeBuilder({ page }).include('dialog[open]').analyze();
      expect(
        analysis.violations.filter(({ impact }) => impact === 'critical' || impact === 'serious'),
      ).toStrictEqual([]);
      await page.keyboard.press('Escape');
      await expect(runtimeDialog).not.toBeVisible();
    });
  }
}

test('keeps dynamic analysis distinct from invalid checks and operational refusals', async ({
  page,
}) => {
  await page.goto(route);
  await expect(page.locator('#vercel-dynamic-preparation')).toContainText('Not established');
  await expect(page.locator('#openai-loader-disconnected')).toContainText('Invalid');
  await expect(page.locator('#reader-cancellation')).toContainText('Refused');
  await expect(page.locator('#cli-content-refusal')).toContainText('Exit 3');
  await expect(page.locator('#snapshot-comparison')).toContainText('type-changed');
  await expect(page.locator('#canonical-content-pages')).toContainText('é r');
});

test('renders each command verbatim without template indentation', async ({ page }) => {
  await page.goto(route);
  for (const example of model.capabilities.cases) {
    if (example.result.kind !== 'cli') continue;
    const command = page.locator(`#${example.id} pre`).last();
    expect(await command.textContent()).toBe(example.result.command);
    await expect(command).toHaveAttribute('tabindex', '0');
    await expect(command).toHaveAttribute('aria-label', 'Code block');
    await expect(command).toHaveCSS('white-space', 'pre');
  }
});

for (const theme of ['light', 'dark'] as const) {
  test(`keeps every essential example readable without JavaScript in ${theme}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      colorScheme: theme,
      viewport: { width: 320, height: 900 },
    });
    try {
      const page = await context.newPage();
      await page.goto(route);
      await expect(page.locator('main [data-capability-outcome]')).toHaveCount(133);
      await expect(page.locator('main [data-capability-target]')).toHaveCount(14);
      await expect(page.getByRole('button', { name: /^View result:/u })).toHaveCount(0);
      await page
        .getByRole('navigation', { name: 'Capability sections' })
        .getByRole('link', { name: 'Decisions', exact: true })
        .click();
      await expect(page.getByRole('group', { name: 'Cyclic decision replacement' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        320,
      );
    } finally {
      await context.close();
    }
  });

  test(`has no serious automated page accessibility violations in ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto(route);
    const analysis = await new AxeBuilder({ page }).analyze();
    expect(
      analysis.violations.filter(({ impact }) => impact === 'critical' || impact === 'serious'),
    ).toStrictEqual([]);
  });
}

test('discovers cases through search and releases dialogs when navigating away', async ({
  page,
}) => {
  await page.goto(withBase('/search/?query=undeclared', basePath));
  const result = page.getByRole('link', {
    name: /The instruction requests an undeclared variable/u,
  });
  await expect(result).toHaveAttribute('href', `${route}#variable-undeclared`);
  await result.click();
  await expect(page).toHaveURL(new RegExp(`${route}#variable-undeclared$`, 'u'));
  await page
    .locator('#variable-undeclared')
    .getByRole('button', { name: /^View result:/u })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goForward();
  await page
    .locator('#variable-undeclared')
    .getByRole('button', { name: /^View result:/u })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

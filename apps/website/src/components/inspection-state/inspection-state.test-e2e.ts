import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { DEFAULT_BASE_PATH, withBase } from '@moldea.ai/website-ui/site';

import { loadWebsiteModel } from '../../lib/generation/generation.ts';

const basePath = process.env.BASE_PATH ?? DEFAULT_BASE_PATH;
const homepage = withBase('/', basePath);

/** Native modals may hand focus to browser chrome, but never to the inert background page. */
const hasSafeModalFocus = (element: HTMLElement): boolean =>
  element.contains(document.activeElement) ||
  (!document.hasFocus() && document.activeElement === document.body);

for (const width of [320, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`shows each real Core result in an accessible dialog at ${width}px in ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 740 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto(homepage);
      for (const state of loadWebsiteModel().inspectionExample) {
        const trigger = page.getByRole('button', {
          name: `View result: ${state.label}`,
          exact: true,
        });
        await trigger.focus();
        await page.keyboard.press('Enter');
        const resultTitle = {
          connected: 'Path found',
          broken: '1 broken reference',
          repaired: 'Check passes',
        }[state.id];
        const dialog = page.getByRole('dialog', { name: resultTitle, exact: true });
        await expect(dialog).toBeVisible();
        await expect(dialog).toHaveAccessibleDescription('');
        await expect(dialog.locator('header')).not.toContainText(state.label);
        expect(await dialog.evaluate((element) => element.matches(':modal'))).toBe(true);
        await expect(page.locator('html')).toHaveCSS('overflow', 'hidden');
        await expect(dialog).toHaveCSS('animation-name', 'none');
        await expect(dialog).toContainText(state.declaredPath);
        await expect(dialog.getByRole('heading', { name: resultTitle, exact: true })).toBeVisible();
        await expect(dialog.getByRole('heading')).toHaveCount(1);
        const resultSummary = dialog.getByRole('group', { name: 'Result', exact: true });
        await expect(resultSummary.locator('[data-status-badge]')).toHaveCount(0);
        const excerptLabel = dialog.getByText('Core validation result excerpt', { exact: true });
        const excerptRow = excerptLabel.locator('..');
        const badge = excerptRow.getByText(state.result.valid ? 'Valid' : 'Invalid', {
          exact: true,
        });
        await expect(badge).toBeVisible();
        const badgeBounds = await badge.boundingBox();
        expect(badgeBounds!.height).toBe(20);
        await expect(badge).toHaveCSS('font-size', '10px');
        await expect(badge).toHaveCSS('font-weight', '600');
        const excerptAlignment = await excerptRow.evaluate((element) => {
          const label = element.querySelector('p');
          const status = element.querySelector('[data-status-badge]');

          if (label === null || status === null) return null;
          const rowBounds = element.getBoundingClientRect();
          const labelBounds = label.getBoundingClientRect();
          const statusBounds = status.getBoundingClientRect();

          return {
            rightInset: rowBounds.right - statusBounds.right,
            spacing: statusBounds.left - labelBounds.right,
          };
        });
        expect(excerptAlignment).not.toBeNull();
        expect(Math.abs(excerptAlignment!.rightInset)).toBeLessThanOrEqual(1);
        expect(excerptAlignment!.spacing).toBeGreaterThanOrEqual(12);
        if (!state.result.valid)
          await expect(dialog.locator('pre')).toContainText(state.result.diagnostics[0].message);
        expect(JSON.parse(await dialog.locator('pre').innerText())).toStrictEqual(state.result);
        const code = dialog.getByRole('region', { name: 'Code block', exact: true });
        await expect(code).toHaveCSS('white-space', 'pre');

        const close = dialog.getByRole('button', { name: 'Close Core result', exact: true });
        await expect(close).toBeFocused();
        await expect(close).toBeInViewport({ ratio: 1 });
        const closeBounds = await close.boundingBox();
        expect(closeBounds!.width).toBe(width < 640 ? 36 : 28);
        expect(closeBounds!.height).toBe(width < 640 ? 36 : 28);
        for (let index = 0; index < 4; index += 1) {
          await page.keyboard.press('Tab');
          expect(await dialog.evaluate(hasSafeModalFocus)).toBe(true);
        }
        await page.keyboard.press('Shift+Tab');
        expect(await dialog.evaluate(hasSafeModalFocus)).toBe(true);

        const bounds = await dialog.boundingBox();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.y).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(740);
        const body = dialog.locator(':scope > div');
        expect(await body.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
          true,
        );
        if (width === 320 && !state.result.valid) {
          expect(await code.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
            true,
          );
          await code.focus();
          await expect(code).not.toHaveCSS('box-shadow', 'none');
          await page.keyboard.press('ArrowRight');
          await expect
            .poll(() => code.evaluate((element) => element.scrollLeft))
            .toBeGreaterThan(0);
          await expect(close).toBeInViewport({ ratio: 1 });
        }

        const accessibility = await new AxeBuilder({ page }).include('dialog[open]').analyze();
        expect(
          accessibility.violations.filter(
            ({ impact }) => impact === 'serious' || impact === 'critical',
          ),
        ).toStrictEqual([]);
        await close.focus();
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        await expect(trigger).toBeFocused();
        await expect(trigger).not.toHaveCSS('box-shadow', 'none');
        await expect(page.locator('html')).not.toHaveCSS('overflow', 'hidden');
        await trigger.click();
        await close.click();
        await expect(dialog).toHaveCount(0);
        await expect(trigger).toBeFocused();
      }
    });
  }
}

test('keeps result dialogs usable after client navigation and browser history', async ({
  page,
}) => {
  await page.goto(withBase('/adapters/', basePath));
  await page
    .locator('header')
    .getByRole('link', { name: 'moldea packages home', exact: true })
    .click();
  const trigger = page.getByRole('button', { name: 'View result: 2. File moved', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '1 broken reference', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.evaluate((element) => {
    element.querySelector<HTMLButtonElement>('button')!.click();
    for (const animation of element.getAnimations()) animation.pause();
  });
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Runtime knowledge');
  await expect(page.locator('html')).not.toHaveCSS('overflow', 'hidden');
  await page.goForward();
  await expect(dialog).toHaveCount(0);
  await trigger.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});

for (const theme of ['light', 'dark'] as const) {
  test(`dismisses on an overlay click, not content clicks or drags in ${theme}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'no-preference' });
    await page.goto(homepage);
    for (const name of ['View result: Hero example', 'View result: 2. File moved']) {
      const trigger = page.getByRole('button', { name, exact: true });
      await trigger.click();
      const dialog = page.getByRole('dialog', {
        name: '1 broken reference',
        exact: true,
      });
      await expect(dialog).toHaveCSS('animation-duration', '0.3s');
      await expect(dialog).toHaveCSS('opacity', '1');
      await dialog.getByRole('heading', { level: 2 }).click();
      await expect(dialog).toBeVisible();
      const bounds = await dialog.boundingBox();
      const panelPoint = { x: bounds!.x + 8, y: bounds!.y + 8 };
      await page.mouse.click(panelPoint.x, panelPoint.y);
      await expect(dialog).toBeVisible();

      await page.mouse.move(panelPoint.x, panelPoint.y);
      await page.mouse.down();
      await page.mouse.move(8, 8);
      await page.mouse.up();
      await expect(dialog).toBeVisible();
      await page.mouse.move(8, 8);
      await page.mouse.down();
      await page.mouse.move(panelPoint.x, panelPoint.y);
      await page.mouse.up();
      await expect(dialog).toBeVisible();

      await page.mouse.click(8, 8);
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await expect(page.locator('html')).not.toHaveCSS('overflow', 'hidden');
    }
  });
}

for (const width of [320, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`preserves modality through platform motion at ${width}px in ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'no-preference' });
      await page.goto(homepage);
      const trigger = page.getByRole('button', { name: 'View result: Hero example', exact: true });
      await trigger.click();
      const dialog = page.getByRole('dialog', { name: '1 broken reference', exact: true });
      await dialog.evaluate((element) => {
        for (const animation of element.getAnimations()) {
          animation.pause();
          animation.currentTime = 150;
        }
      });
      await expect(dialog).toHaveCSS('animation-duration', '0.3s');
      const enteringOpacity = Number(
        await dialog.evaluate((element) => getComputedStyle(element).opacity),
      );
      expect(enteringOpacity).toBeGreaterThan(0);
      expect(enteringOpacity).toBeLessThan(1);
      await expect(dialog).not.toHaveCSS('transform', 'none');
      await dialog.evaluate((element) => {
        for (const animation of element.getAnimations()) animation.finish();
      });

      await dialog.evaluate((element) => {
        element.querySelector<HTMLButtonElement>('button')!.click();
        for (const animation of element.getAnimations()) {
          animation.pause();
          animation.currentTime = 100;
        }
      });
      await expect(dialog).toHaveCSS('animation-duration', width < 640 ? '0.3s' : '0.2s');
      const exitingOpacity = Number(
        await dialog.evaluate((element) => getComputedStyle(element).opacity),
      );
      expect(exitingOpacity).toBeGreaterThan(0);
      expect(exitingOpacity).toBeLessThan(1);
      expect(await dialog.evaluate((element) => element.matches(':modal'))).toBe(true);
      await expect(page.locator('html')).toHaveCSS('overflow', 'hidden');
      await expect(dialog.getByRole('button', { name: 'Close Core result' })).toBeFocused();
      await page.keyboard.press('Escape');
      expect(await dialog.evaluate((element) => element.matches(':modal'))).toBe(true);
      await dialog.evaluate((element) => {
        for (const animation of element.getAnimations()) animation.finish();
      });
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await expect(page.locator('html')).not.toHaveCSS('overflow', 'hidden');
    });
  }
}

test('finishes an interrupted exit when reduced motion changes and can reopen', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(homepage);
  const trigger = page.getByRole('button', { name: 'View result: Hero example', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '1 broken reference', exact: true });
  await dialog.evaluate((element) => {
    element.querySelector<HTMLButtonElement>('button')!.click();
    for (const animation of element.getAnimations()) animation.pause();
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS('animation-name', 'none');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('an obsolete exit cannot close a reopened dialog', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(homepage);
  const trigger = page.getByRole('button', { name: 'View result: Hero example', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '1 broken reference', exact: true });
  await dialog.evaluate(async (element) => {
    if (!(element instanceof HTMLDialogElement)) throw new Error('Expected a native dialog.');
    element.querySelector<HTMLButtonElement>('button')!.click();
    const exitAnimations = element.getAnimations();
    element.close();
    element.parentElement!.querySelector<HTMLButtonElement>('[data-dialog-trigger]')!.click();
    await Promise.allSettled(exitAnimations.map((animation) => animation.finished));
  });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Close Core result' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

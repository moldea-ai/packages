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
    test(`shows real Core findings and visible coverage at ${width}px in ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 740 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto(homepage);
      for (const state of loadWebsiteModel().inspectionExample) {
        const frame = page.getByRole('article', { name: state.label, exact: true });
        if (state.result.valid) {
          await expect(frame.getByRole('link', { name: /^View finding:/u })).toHaveCount(0);
          await expect(frame).toContainText('Passed');
          const disclosure = frame.getByText('View binding checks', { exact: true });
          await expect(
            frame.getByRole('group', { name: 'Binding checks', exact: true }),
          ).toBeVisible();
          await disclosure.click();
          await expect(
            frame.getByRole('group', { name: 'Binding checks', exact: true }),
          ).toBeHidden();
          await disclosure.click();
          continue;
        }
        const trigger = frame.getByRole('link', { name: /^View finding:/u });
        await trigger.focus();
        await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog', { name: 'Structural finding', exact: true });
        await expect(dialog).toBeVisible();
        await expect(dialog).toHaveAccessibleDescription('');
        expect(await dialog.evaluate((element) => element.matches(':modal'))).toBe(true);
        await expect(page.locator('html')).toHaveCSS('overflow', 'hidden');
        await expect(dialog).toHaveCSS('animation-name', 'none');
        await expect(dialog).toContainText(state.declaredPath.replace(/^\//u, ''));
        await expect(dialog.getByRole('heading', { level: 2 })).toHaveCount(1);
        const close = dialog.getByRole('button', { name: 'Close dialog', exact: true });
        await expect(close).toBeFocused();
        await expect(dialog.getByRole('tab')).toHaveCount(0);
        const closeBounds = (await close.boundingBox())!;
        expect(closeBounds.width).toBe(width < 640 ? 36 : 28);
        expect(closeBounds.height).toBe(width < 640 ? 36 : 28);
        for (let index = 0; index < 4; index += 1) {
          await page.keyboard.press('Tab');
          expect(await dialog.evaluate(hasSafeModalFocus)).toBe(true);
        }
        await page.keyboard.press('Shift+Tab');
        expect(await dialog.evaluate(hasSafeModalFocus)).toBe(true);
        const bounds = (await dialog.boundingBox())!;
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.y).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(740);
        expect(
          await dialog
            .locator(':scope > div')
            .evaluate((element) => element.scrollWidth <= element.clientWidth),
        ).toBe(true);
        expect(
          (await new AxeBuilder({ page }).include('dialog[open]').analyze()).violations,
        ).toStrictEqual([]);
        const evaluationOpener = dialog.getByRole('button', {
          name: 'Evaluation details',
          exact: true,
        });
        await evaluationOpener.click();
        const evaluation = page.getByRole('dialog', { name: 'Evaluation details', exact: true });
        const code = evaluation.getByRole('group', { name: 'Finding output', exact: true });
        expect(JSON.parse(await code.locator('code').innerText())).toStrictEqual(
          state.result.diagnostics[0],
        );
        await expect(code).toHaveCSS('white-space', 'pre');
        if (width === 320) {
          expect(await code.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
            true,
          );
          await code.focus();
          await expect(code).not.toHaveCSS('box-shadow', 'none');
          await page.keyboard.press('ArrowRight');
          await expect
            .poll(() => code.evaluate((element) => element.scrollLeft))
            .toBeGreaterThan(0);
        }
        await page.keyboard.press('Escape');
        await expect(evaluationOpener).toBeFocused();
        await close.focus();
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
        await expect(trigger).toBeFocused();
        await expect(trigger).not.toHaveCSS('box-shadow', 'none');
        await expect(page.locator('html')).not.toHaveCSS('overflow', 'hidden');
        await trigger.click();
        await close.click();
        await expect(dialog).toBeHidden();
        await expect(trigger).toBeFocused();
      }
    });
  }
}

test('keeps finding dialogs usable after client navigation and browser history', async ({
  page,
}) => {
  await page.goto(withBase('/runtimes/', basePath));
  await page
    .locator('header')
    .getByRole('link', { name: 'moldea packages home', exact: true })
    .click();
  const trigger = page.locator('[data-dialog-open="inspection-broken-finding-1"]');
  await trigger.click();
  const dialog = page.locator('#inspection-broken-finding-1');
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole('button', { name: 'Close dialog', exact: true })
    .evaluate((button: HTMLButtonElement) => {
      const element = button.closest('dialog')!;
      button.click();
      for (const animation of element.getAnimations()) animation.pause();
    });
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Guidance for the runtime you use.',
  );
  await expect(page.locator('html')).not.toHaveCSS('overflow', 'hidden');
  await page.goForward();
  await expect(dialog).toBeHidden();
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
    for (const id of ['hero-check-finding-1', 'inspection-broken-finding-1']) {
      const trigger = page.locator(`[data-dialog-open="${id}"]`);
      await trigger.click();
      const dialog = page.locator(`#${id}`);
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
      await expect(dialog).toBeHidden();
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
      const trigger = page.locator('[data-dialog-open="hero-check-finding-1"]');
      await trigger.click();
      const dialog = page.getByRole('dialog', {
        name: 'Structural finding',
        exact: true,
      });
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
      if (width < 640) {
        expect(enteringOpacity).toBe(1);
      } else {
        expect(enteringOpacity).toBeGreaterThan(0);
        expect(enteringOpacity).toBeLessThan(1);
      }
      await expect(dialog).not.toHaveCSS('transform', 'none');
      await dialog.evaluate((element) => {
        for (const animation of element.getAnimations()) animation.finish();
      });

      if (width < 640) {
        const returnStarted = page.waitForFunction(() =>
          document.documentElement.hasAttribute('data-website-ui-dialog-return'),
        );
        await Promise.all([
          returnStarted,
          dialog.getByRole('button', { name: 'Close dialog' }).click(),
        ]);
        expect(
          await page.evaluate(
            () => getComputedStyle(document.documentElement, '::view-transition-new(root)').opacity,
          ),
        ).toBe('1');
        expect(
          await page.evaluate(
            () => getComputedStyle(document.documentElement, '::view-transition-old(root)').opacity,
          ),
        ).toBe('0');
        await expect(dialog).toBeHidden();
        await expect(page.locator('html')).not.toHaveAttribute('data-website-ui-dialog-return');
        await expect(trigger).toBeFocused();
        await expect(page.locator('html')).not.toHaveCSS('overflow', 'hidden');
        return;
      }

      await dialog
        .getByRole('button', { name: 'Close dialog', exact: true })
        .evaluate((button: HTMLButtonElement) => {
          const element = button.closest('dialog')!;
          button.click();
          for (const animation of element.getAnimations()) {
            animation.pause();
            animation.currentTime = 100;
          }
        });
      await expect(dialog).toHaveCSS('animation-duration', '0.2s');
      const exitingOpacity = Number(
        await dialog.evaluate((element) => getComputedStyle(element).opacity),
      );
      expect(exitingOpacity).toBeGreaterThan(0);
      expect(exitingOpacity).toBeLessThan(1);
      expect(await dialog.evaluate((element) => element.matches(':modal'))).toBe(true);
      await expect(page.locator('html')).toHaveCSS('overflow', 'hidden');
      await expect(dialog.getByRole('button', { name: 'Close dialog' })).toBeFocused();
      await page.keyboard.press('Escape');
      expect(await dialog.evaluate((element) => element.matches(':modal'))).toBe(true);
      await dialog.evaluate((element) => {
        for (const animation of element.getAnimations()) animation.finish();
      });
      await expect(dialog).toBeHidden();
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
  const trigger = page.locator('[data-dialog-open="hero-check-finding-1"]');
  await trigger.click();
  const dialog = page.getByRole('dialog', {
    name: 'Structural finding',
    exact: true,
  });
  await dialog
    .getByRole('button', { name: 'Close dialog', exact: true })
    .evaluate((button: HTMLButtonElement) => {
      const element = button.closest('dialog')!;
      button.click();
      for (const animation of element.getAnimations()) animation.pause();
    });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS('animation-name', 'none');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('an obsolete exit cannot close a reopened dialog', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(homepage);
  const trigger = page.locator('[data-dialog-open="hero-check-finding-1"]');
  await trigger.click();
  const dialog = page.getByRole('dialog', {
    name: 'Structural finding',
    exact: true,
  });
  await dialog
    .getByRole('button', { name: 'Close dialog', exact: true })
    .evaluate(async (button: HTMLButtonElement) => {
      const element = button.closest('dialog');
      if (!(element instanceof HTMLDialogElement)) throw new Error('Expected a native dialog.');
      button.click();
      const exitAnimations = element.getAnimations();
      element.close();
      document
        .querySelector<HTMLAnchorElement>('[data-dialog-open="hero-check-finding-1"]')!
        .click();
      await Promise.allSettled(exitAnimations.map((animation) => animation.finished));
    });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

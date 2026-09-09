import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import tailwindcss from '@tailwindcss/vite';
import { build } from 'astro';
import { DEFAULT_BASE_PATH, withBase } from '@moldea.ai/website-ui/site';

const homepage = withBase('/', process.env.BASE_PATH ?? DEFAULT_BASE_PATH);

test('supports public dialog customization without overriding modal behavior', async ({ page }) => {
  // Exercise consumer props through Astro compilation without publishing a fixture route.
  const appDirectory = fileURLToPath(new URL('../../../', import.meta.url));
  const directory = mkdtempSync(join(appDirectory, '.inspection-dialog-'));
  const fixturePath = withBase('/dialog-fixture/', process.env.BASE_PATH ?? DEFAULT_BASE_PATH);
  try {
    mkdirSync(join(directory, 'src', 'pages'), { recursive: true });
    writeFileSync(
      join(directory, 'src', 'styles.css'),
      "@import '@moldea.ai/website-ui/styles.css';\n",
    );
    writeFileSync(
      join(directory, 'src', 'pages', 'index.astro'),
      [
        '---',
        "import Dialog from '@moldea.ai/website-ui/dialog';",
        "import '../styles.css';",
        '---',
        '<html lang="en"><head><title>Dialog consumer</title></head><body><main><h1>Result details</h1>',
        '<Dialog id="default-result" title="Default result" triggerLabel="View result"><p>Compact result details.</p></Dialog>',
        '<Dialog id="wide-result" title="Detailed evidence" description="Recorded check evidence." triggerLabel="Inspect evidence" triggerVariant="primary" triggerSize="lg" size="large" isOverlayCloseEnabled><p>Evidence from the consumer.</p></Dialog>',
        '</main></body></html>',
      ].join('\n'),
    );
    await build({
      root: directory,
      configFile: false,
      base: fixturePath,
      logLevel: 'silent',
      build: { inlineStylesheets: 'always' },
      vite: { plugins: [tailwindcss()] },
    });
    const output = join(directory, 'dist');
    const files = new Map([[fixturePath, join(output, 'index.html')]]);
    for (const entry of readdirSync(join(output, '_astro'), { withFileTypes: true })) {
      if (entry.isFile())
        files.set(`${fixturePath}_astro/${entry.name}`, join(output, '_astro', entry.name));
    }
    await page.route(`**${fixturePath}**`, async (route) => {
      const source = files.get(new URL(route.request().url()).pathname);
      await route.fulfill(source ? { path: source } : { status: 404 });
    });
    for (const width of [320, 768, 1440]) {
      for (const theme of ['light', 'dark'] as const) {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
        await page.goto(fixturePath);
        await page
          .locator('html')
          .evaluate(
            (element, isDark) => element.classList.toggle('dark', isDark),
            theme === 'dark',
          );
        const defaultTrigger = page.getByRole('button', { name: 'View result', exact: true });
        const wideTrigger = page.getByRole('button', { name: 'Inspect evidence', exact: true });
        await expect(defaultTrigger).toBeVisible();
        await expect(wideTrigger).toBeVisible();
        expect((await wideTrigger.boundingBox())!.height).toBeGreaterThan(
          (await defaultTrigger.boundingBox())!.height,
        );
        for (const [title, trigger, maxWidth] of [
          ['Default result', defaultTrigger, 672],
          ['Detailed evidence', wideTrigger, 1024],
        ] as const) {
          await trigger.focus();
          await expect(trigger).toBeFocused();
          await expect(trigger).not.toHaveCSS('box-shadow', 'none');
          await trigger.press('Enter');
          const dialog = page.getByRole('dialog', { name: title, exact: true });
          await expect(dialog).toBeVisible();
          expect((await dialog.boundingBox())!.width).toBe(
            width < 640 ? width : Math.min(width - 32, maxWidth),
          );
          await expect(dialog).toHaveCSS('animation-name', 'none');
          await expect(dialog.getByRole('button', { name: 'Close dialog' })).toBeFocused();
          await expect(dialog).toHaveAccessibleDescription(
            title === 'Detailed evidence' ? 'Recorded check evidence.' : '',
          );
          if (width >= 640) {
            await page.mouse.click(0, 0);
            if (title === 'Detailed evidence') {
              await expect(dialog).not.toBeVisible();
              await expect(trigger).toBeFocused();
              await trigger.press('Enter');
            } else {
              await expect(dialog).toBeVisible();
            }
          }
          const accessibility = await new AxeBuilder({ page }).include('dialog[open]').analyze();
          expect(
            accessibility.violations.filter(
              ({ impact }) => impact === 'serious' || impact === 'critical',
            ),
          ).toStrictEqual([]);
          await page.keyboard.press('Escape');
          await expect(dialog).not.toBeVisible();
          await expect(trigger).toBeFocused();
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width,
        );
      }
    }
  } finally {
    await page.unrouteAll({ behavior: 'wait' });
    rmSync(directory, { recursive: true, force: true });
  }
});

for (const theme of ['light', 'dark'] as const) {
  test(`keeps a long result scrollable beneath its outcome heading in ${theme}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 540 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto(homepage);
    await page.getByRole('button', { name: 'View result: Hero example', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '1 broken reference', exact: true });
    await expect(dialog.getByRole('heading')).toHaveCount(1);
    const badge = dialog.locator('header').getByText('Invalid', { exact: true });
    await expect(badge).toBeInViewport({ ratio: 1 });
    const body = dialog.locator(':scope > div');
    expect(await body.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
      true,
    );
    const pageScroll = await page.evaluate(() => window.scrollY);
    await body.hover();
    await page.mouse.wheel(0, 400);
    await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(pageScroll);
    await expect(dialog.getByRole('heading')).toBeInViewport({ ratio: 1 });
    await expect(dialog.getByRole('button', { name: 'Close Core result' })).toBeInViewport({
      ratio: 1,
    });
    expect(await body.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  });
}

import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import tailwindcss from '@tailwindcss/vite';
import { build } from 'astro';
import { DEFAULT_BASE_PATH, withBase } from '@moldea.ai/website-ui/site';

const homepage = withBase('/', process.env.BASE_PATH ?? DEFAULT_BASE_PATH);

for (const width of [320, 375, 1440]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`keeps finding fallbacks hidden while scripts load at ${width}px in ${colorScheme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      for (const path of ['/', '/packages/', '/getting-started/', '/runtimes/', '/capabilities/']) {
        let releaseScripts!: () => void;
        const scriptsReady = new Promise<void>((resolve) => {
          releaseScripts = resolve;
        });
        await page.route('**/*', async (route) => {
          if (route.request().resourceType() === 'script') await scriptsReady;
          await route.continue();
        });
        try {
          await page.goto(withBase(path, process.env.BASE_PATH ?? DEFAULT_BASE_PATH), {
            waitUntil: 'commit',
          });
          await expect(page.locator('dialog[data-dialog-fallback-open]').first()).toHaveCSS(
            'position',
            'static',
          );
          expect(await page.evaluate(() => matchMedia('(scripting: enabled)').matches)).toBe(true);
          await expect(page.locator('[data-dialog-root][data-enhanced="true"]')).toHaveCount(0);
          await expect(page.locator('[data-dialog-fallback-open]:visible')).toHaveCount(0);
          for (const grid of await page.locator('[data-runtime-grid]').all()) {
            await expect(grid.locator(':scope > li:visible')).toHaveCount(width >= 1280 ? 9 : 3);
          }
        } finally {
          releaseScripts();
          await page.waitForLoadState('load');
          await page.unrouteAll({ behavior: 'wait' });
        }
        await expect(page.locator('[data-dialog-fallback-open]')).toHaveCount(0);
        await expect(page.locator('[data-website-ui-dialog]:visible')).toHaveCount(0);
      }
    });
  }
}

test.describe('inspection touch controls', () => {
  test.use({ hasTouch: true });
  for (const width of [320, 375, 1440]) {
    for (const colorScheme of ['light', 'dark'] as const) {
      test(`sizes inspection touch controls at ${width}px in ${colorScheme}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
        await page.goto(homepage);
        await page
          .locator('html')
          .evaluate(
            (node, isDark) => node.classList.toggle('dark', isDark),
            colorScheme === 'dark',
          );
        expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
        const opener = page.getByRole('link', { name: /View finding:/u }).first();
        await opener.click();
        const dialog = page.getByRole('dialog');
        const close = dialog.getByRole('button', { name: 'Close dialog', exact: true });
        await expect(close).toBeFocused();
        const bounds = (await close.boundingBox())!;
        expect(bounds.width).toBeGreaterThanOrEqual(44);
        expect(bounds.height).toBeGreaterThanOrEqual(44);
        expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
        const evaluationOpener = dialog.getByRole('button', {
          name: 'Evaluation details',
          exact: true,
        });
        const guidance = dialog.getByRole('link', {
          name: 'See the Core diagnostics guidance for this finding.',
          exact: true,
        });
        for (const action of [opener, evaluationOpener, guidance]) {
          const actionBounds = (await action.boundingBox())!;
          expect(actionBounds.width).toBeGreaterThanOrEqual(44);
          expect(actionBounds.height).toBeGreaterThanOrEqual(44);
        }
        await evaluationOpener.click();
        const evaluation = page.getByRole('dialog', { name: 'Evaluation details', exact: true });
        const copy = evaluation.getByRole('button', { name: 'Copy code', exact: true });
        const copyBounds = (await copy.boundingBox())!;
        expect(copyBounds.width).toBeGreaterThanOrEqual(44);
        expect(copyBounds.height).toBeGreaterThanOrEqual(44);
        await page.keyboard.press('Escape');
        await expect(evaluationOpener).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(opener).toBeFocused();
        const bindings = page.getByText('View binding checks', { exact: true }).first();
        const bindingBounds = (await bindings.boundingBox())!;
        expect(bindingBounds.width).toBeGreaterThanOrEqual(44);
        expect(bindingBounds.height).toBeGreaterThanOrEqual(44);
      });
    }
  }
});

test('locks background scrolling without changing the document width', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 740 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(homepage);
  await page.addStyleTag({
    content: 'html { overflow-y: scroll; } html::-webkit-scrollbar { width: 16px; }',
  });
  const measure = () =>
    page.evaluate(() => ({
      bodyWidth: document.body.getBoundingClientRect().width,
      gutter: getComputedStyle(document.documentElement).scrollbarGutter,
      scrollY: window.scrollY,
    }));
  const before = await measure();
  expect(before.gutter).toBe('stable');
  await page.locator('[data-dialog-open="hero-check-finding-1"]').click();
  await expect(
    page.getByRole('dialog', {
      name: 'Structural finding',
      exact: true,
    }),
  ).toBeVisible();
  const during = await measure();
  expect(during.bodyWidth).toBe(before.bodyWidth);
  await page.mouse.move(8, 400);
  await page.mouse.wheel(0, 400);
  expect((await measure()).scrollY).toBe(during.scrollY);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect((await measure()).bodyWidth).toBe(before.bodyWidth);
});

test('supports public dialog customization without overriding modal behavior', async ({ page }) => {
  // Exercise consumer props through Astro compilation without publishing a fixture route.
  test.setTimeout(60_000);
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
          const close = dialog.getByRole('button', { name: 'Close dialog' });
          await expect(close).toBeFocused();
          const closeBounds = (await close.boundingBox())!;
          expect(closeBounds.width).toBe(width < 640 ? 36 : 28);
          expect(closeBounds.height).toBe(width < 640 ? 36 : 28);
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
  test(`keeps a finding scrollable beneath its heading and resets scroll in ${theme}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 540 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto(homepage);
    const opener = page.locator('[data-dialog-open="hero-check-finding-1"]');
    const dialog = page.getByRole('dialog', { name: 'Structural finding', exact: true });
    const body = dialog.locator(':scope > div');
    const openResult = async () => {
      await opener.click();
      await expect(dialog).toBeVisible();
      await dialog.evaluate(async (element) => {
        await Promise.allSettled(element.getAnimations().map((animation) => animation.finished));
      });
      await expect(dialog.getByRole('tab')).toHaveCount(0);
      expect(await body.evaluate((element) => element.scrollTop)).toBe(0);
    };
    await openResult();
    await expect(dialog.getByRole('heading', { level: 2 })).toHaveCount(1);
    expect(await body.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
      true,
    );
    const scrollDistance = await body.evaluate((element) =>
      Math.min(400, element.scrollHeight - element.clientHeight),
    );
    const pageScroll = await page.evaluate(() => window.scrollY);
    // target the dialog body's padding rather than a nested source scroll region
    await body.hover({ position: { x: 8, y: 8 } });
    await page.mouse.wheel(0, 400);
    await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBe(scrollDistance);
    expect(await page.evaluate(() => window.scrollY)).toBe(pageScroll);
    await expect(dialog.getByRole('heading', { level: 2 })).toBeInViewport({ ratio: 1 });
    await expect(dialog.getByRole('button', { name: 'Close dialog' })).toBeInViewport({ ratio: 1 });
    expect(await body.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

    await dialog.getByRole('button', { name: 'Close dialog' }).click();
    await expect(dialog).not.toBeVisible();
    await openResult();
    await body.evaluate((element, distance) => {
      element.scrollTop = distance;
    }, scrollDistance);
    expect(await body.evaluate((element) => element.scrollTop)).toBe(scrollDistance);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await openResult();

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await body.evaluate((element, distance) => {
      element.scrollTop = distance;
    }, scrollDistance);
    expect(await body.evaluate((element) => element.scrollTop)).toBe(scrollDistance);
    await dialog.getByRole('button', { name: 'Close dialog' }).click();
    await expect(dialog).not.toBeVisible();
    await openResult();
  });
}

test('finding evaluation lifecycle restores focus through case, finding and evaluation transitions', async ({
  page,
  context,
}) => {
  // This journey loads the complete static catalogue, navigates to its guide, then loads it again.
  test.setTimeout(60_000);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'no-preference' });
  await page.goto(
    withBase('/capabilities/#cli-invalid-project', process.env.BASE_PATH ?? DEFAULT_BASE_PATH),
  );
  const example = page.getByRole('dialog', {
    name: 'A renamed export breaks a declared connection',
    exact: true,
  });
  await expect(example).toBeVisible();
  const opener = example.getByRole('link', { name: /^View finding:/u });
  await opener.click();
  const finding = page.getByRole('dialog', { name: 'Structural finding', exact: true });
  await expect(finding).toBeVisible();
  const evaluationOpener = finding.getByRole('button', { name: 'Evaluation details', exact: true });
  await evaluationOpener.click();
  const evaluation = page.getByRole('dialog', { name: 'Evaluation details', exact: true });
  await expect(evaluation).toBeVisible();
  await expect(page.locator('dialog:modal')).toHaveCount(3);
  await expect(page.locator('html')).toHaveCSS('overflow', 'hidden');
  await expect(evaluation.getByRole('button', { name: 'Close dialog', exact: true })).toBeFocused();
  const code = evaluation.getByRole('group', { name: 'Finding output', exact: true });
  await expect(code).toHaveCSS('white-space', 'pre');
  const source = (await code.locator('code').textContent())!;
  const record: unknown = JSON.parse(source);
  expect(record).toMatchObject({ kind: 'diagnostic', code: 'MOLDEA_REFERENCE_EXPORT_MISSING' });
  await evaluation.getByRole('button', { name: 'Copy code', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(source);
  await page.keyboard.press('Escape');
  await expect(evaluation).toBeHidden();
  await expect(evaluationOpener).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(finding).toBeHidden();
  await expect(opener).toBeFocused();
  await expect(page.locator('html')).toHaveCSS('overflow', 'hidden');
  const bindingDisclosure = example.getByText('View binding checks', { exact: true });
  await expect(example.getByRole('group', { name: 'Binding checks', exact: true })).toBeHidden();
  await bindingDisclosure.click();
  await expect(example.getByRole('group', { name: 'Binding checks', exact: true })).toBeVisible();
  await expect(example.getByRole('article', { name: 'Binding check', exact: true })).toContainText(
    'Export missing',
  );
  await page.keyboard.press('Escape');
  await expect(example).toBeHidden();
  await expect(
    page.getByRole('button', {
      name: 'Open example: A renamed export breaks a declared connection',
      exact: true,
    }),
  ).toBeFocused();
  await expect(page.locator('html')).not.toHaveCSS('overflow', 'hidden');
  await page
    .getByRole('button', {
      name: 'Open example: A renamed export breaks a declared connection',
      exact: true,
    })
    .click();
  await opener.click();
  const guidance = finding.getByRole('link', {
    name: 'See the Core diagnostics guidance for this finding.',
    exact: true,
  });
  const guidancePath = withBase(
    '/packages/core/diagnostics/#references-context-and-decisions',
    process.env.BASE_PATH ?? DEFAULT_BASE_PATH,
  );
  await expect(guidance).toHaveAttribute('href', guidancePath);
  await guidance.click();
  await expect(page).toHaveURL(new RegExp(`${guidancePath}$`));
  await expect(
    page.getByRole('heading', { name: 'References, context, and decisions', exact: true }),
  ).toBeVisible();
  await expect(page.locator('html')).not.toHaveCSS('overflow', 'hidden');
  await page.goBack();
  await expect(example).toBeVisible();
  await expect(finding).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(example).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_BASE_PATH, normalizeBasePath, withBase } from '@moldea.ai/website-ui/site';

import { loadWebsiteModel } from '../../lib/generation/generation.ts';
import { getCapabilityShowcase, getCapabilityVisualFamily } from '../../lib/capabilities/index.ts';
import { getCapabilityInspectionView } from '../../components/inspection-result/presentation/index.ts';

const basePath = normalizeBasePath(process.env.BASE_PATH ?? DEFAULT_BASE_PATH);
const route = withBase('/capabilities/', basePath);
const catalog = loadWebsiteModel().capabilities;
const showcase = getCapabilityShowcase(catalog);
const mixedExample = catalog.cases.find(({ id }) => id === 'inspection-mixed-diagnostics')!;
const mixedFindings = getCapabilityInspectionView(mixedExample).findings;
const sectionFor = (page: Page, id: string) => page.locator(`#${id}[data-capability-section]`);
const triggerFor = (page: Page, id: string) =>
  page.locator(`#${id}`).getByRole('button', { name: /^Open example:/u });

/** Reveals one finite section through its real public control. */
const revealAll = async (page: Page, id: string): Promise<void> => {
  const button = sectionFor(page, id).locator('[data-capability-load]');
  while (await button.isVisible()) await button.click();
};

for (const width of [320, 768, 1440]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`browses mixed findings without extra dialogs at ${width}px in ${colorScheme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      const id = 'inspection-mixed-diagnostics';
      await page.goto(`${route}#${id}`);
      const opener = triggerFor(page, id);
      const dialog = page.locator(`#${id}-result`);
      await expect(dialog).toBeVisible();
      await expect(page.locator(`#example-${id}`)).toHaveCount(0);
      await expect(page.locator('dialog:modal')).toHaveCount(1);
      await expect(dialog.getByRole('tab', { name: 'Findings', selected: true })).toBeVisible();
      const list = dialog.getByRole('list', { name: 'Inspection findings' });
      const rows = list.getByRole('link');
      await expect(rows).toHaveCount(3);
      await expect(rows.nth(0)).toContainText('MOLDEA_REFERENCE_EXPORT_MISSING');
      await expect(rows.nth(1)).toContainText('MOLDEA_IMPACT_PATTERN_UNMATCHED');
      await expect(rows.nth(2)).toContainText('MOLDEA_INTEGRATION_BLOCK_MISSING');
      for (const row of await rows.all()) {
        await page.keyboard.press('Tab');
        await row.focus();
        await expect(row).not.toHaveCSS('box-shadow', 'none');
        await row.press('Enter');
        await expect(page.locator('dialog:modal')).toHaveCount(1);
        await expect(list).toBeHidden();
        const detail = dialog.locator('[data-inspection-detail]:visible');
        await expect(detail).toHaveCount(1);
        await expect(detail).toBeFocused();
        await expect(detail.getByRole('heading')).toHaveCount(1);
        await dialog.getByRole('tab', { name: 'Output', exact: true }).click();
        expect(
          JSON.parse(await dialog.locator('[data-inspection-output] pre').innerText()),
        ).toStrictEqual(mixedExample.output.responses);
        await dialog.getByRole('tab', { name: 'Findings', exact: true }).click();
        await expect(detail).toBeVisible();
        expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
        await dialog.getByRole('link', { name: 'Back to findings', exact: true }).click();
        await expect(row).toBeFocused();
      }
      await rows.nth(0).click();
      await page.keyboard.press('Escape');
      await expect(opener).toBeFocused();
      await opener.press('Enter');
      await expect(list).toBeVisible();
      await expect(dialog.locator('[data-inspection-detail]:visible')).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect(page.locator('dialog:modal')).toHaveCount(0);
    });

    test(`findings overview accessibility at ${width}px in ${colorScheme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto(`${route}#${mixedExample.id}`);
      await expect(
        page.locator(`#${mixedExample.id}-result [data-inspection-overview]`),
      ).toBeVisible();
      expect(
        (await new AxeBuilder({ page }).include(`#${mixedExample.id}-result`).analyze()).violations,
      ).toStrictEqual([]);
    });

    for (const [index, finding] of mixedFindings.entries()) {
      test(`finding ${index + 1} accessibility at ${width}px in ${colorScheme}`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
        await page.goto(`${route}#${mixedExample.id}`);
        const dialog = page.locator(`#${mixedExample.id}-result`);
        await dialog
          .getByRole('link', {
            name: `View finding: ${finding.title} ${finding.code}`,
            exact: true,
          })
          .click();
        await expect(
          dialog.getByRole('heading', { name: finding.title, exact: true }),
        ).toBeVisible();
        expect(
          (await new AxeBuilder({ page }).include(`#${mixedExample.id}-result`).analyze())
            .violations,
        ).toStrictEqual([]);
      });
    }
  }
}

for (const width of [320, 768, 1440]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`shows the initial example catalog at ${width}px in ${colorScheme}`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        "Catch what's broken.See what's connected.",
      );
      await expect(page.locator('[data-capability-example]')).toHaveCount(catalog.cases.length);
      await expect(page.locator('main dialog')).toHaveCount(catalog.cases.length * 2 - 1);
      await expect(page.locator('main dialog:modal')).toHaveCount(0);
      await expect(page.locator('[data-capability-visual]:visible')).toHaveCount(0);
      await expect(page.locator('main')).not.toContainText('Also covers:');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const button = sectionFor(page, 'structure').locator('[data-capability-load]');
      await page.keyboard.press('Tab');
      await button.focus();
      expect(
        await button.evaluate((element) => {
          const style = getComputedStyle(element);
          return style.outlineStyle !== 'none' || style.boxShadow !== 'none';
        }),
      ).toBe(true);
      expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toStrictEqual(
        [],
      );
    });
    for (const { group, examples } of showcase) {
      test(`opens the ${group.id} examples at ${width}px in ${colorScheme}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
        await page.goto(route);
        const section = sectionFor(page, group.id);
        await expect(section.locator('[data-capability-example]:visible')).toHaveCount(4);
        await expect(section.locator('[data-capability-count]')).toHaveText(
          `4 of ${examples.length} examples`,
        );
        const count = section.locator('[data-capability-count]');
        await expect(count).toHaveAttribute('aria-live', 'polite');
        await expect(count).toHaveAttribute('aria-atomic', 'true');
        expect(
          await count.evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            return bounds.width <= 1 && bounds.height <= 1;
          }),
        ).toBe(true);
        await expect(section.locator('[data-capability-load]')).toHaveAccessibleName(
          `Load more ${group.label.toLowerCase()} examples`,
        );
        await expect(section.locator('[data-capability-load]')).toHaveAttribute(
          'aria-controls',
          `${group.id}-examples`,
        );
        const exampleButtons = section.getByRole('button', { name: /^Open example:/u });
        await expect(exampleButtons).toHaveCount(4);
        for (const [index, example] of examples.slice(0, 4).entries())
          await expect(exampleButtons.nth(index)).toHaveAccessibleName(
            `Open example: ${example.title}`,
          );
        await expect(section.getByRole('link', { name: group.reference.label })).toHaveAttribute(
          'href',
          withBase(group.reference.route, basePath),
        );
        const first = examples[0];
        const trigger = triggerFor(page, first.id);
        await trigger.click();
        const dialog = page.locator(`#example-${first.id}`);
        await expect(dialog).toHaveAccessibleName(first.title);
        await expect(dialog.locator('[data-capability-visual]')).toBeVisible();
        expect(
          (await new AxeBuilder({ page }).include(`#example-${first.id}`).analyze()).violations,
        ).toStrictEqual([]);
        expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
          true,
        );
        await page.keyboard.press('Escape');
        await expect(dialog).toBeHidden();
        await expect(trigger).toBeFocused();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
      });
    }
  }
}

test('reveals four buttons at a time, keeps categories independent, and restores keyboard focus', async ({
  page,
}) => {
  await page.goto(route);
  const section = sectionFor(page, 'structure');
  const examples = showcase.find(({ group }) => group.id === 'structure')!.examples;
  const button = section.locator('[data-capability-load]');
  for (let count = 4; count < examples.length; count += 4) {
    await button.focus();
    await button.press('Enter');
    await expect(triggerFor(page, examples[count].id)).toBeFocused();
    await expect(section.locator('[data-capability-example]:visible')).toHaveCount(
      Math.min(count + 4, examples.length),
    );
  }
  await expect(button).toBeHidden();
  await expect(section.locator('[data-capability-count]')).toHaveText(
    `${examples.length} of ${examples.length} examples`,
  );
  expect(
    await section.locator('[data-capability-controls]').evaluate((element) => ({
      marginTop: getComputedStyle(element).marginTop,
      height: element.getBoundingClientRect().height,
      isHidden: element.hasAttribute('hidden'),
    })),
  ).toStrictEqual({ marginTop: '0px', height: 0, isHidden: false });
  await expect(sectionFor(page, 'agents').locator('[data-capability-example]:visible')).toHaveCount(
    4,
  );
});

test('keeps pointer reading position and repeated initialization correct on Astro return', async ({
  page,
}) => {
  await page.goto(route);
  const section = sectionFor(page, 'agents');
  const button = section.locator('[data-capability-load]');
  const fifth = showcase.find(({ group }) => group.id === 'agents')!.examples[4];
  await button.scrollIntoViewIfNeeded();
  const before = (await button.boundingBox())!.y;
  await button.click();
  await expect(section.locator('[data-capability-example]:visible')).toHaveCount(8);
  await expect
    .poll(async () => Math.abs((await page.locator(`#${fifth.id}`).boundingBox())!.y - before))
    .toBeLessThan(8);
  await page
    .getByRole('banner')
    .getByRole('link', { name: 'moldea packages home', exact: true })
    .click();
  await expect(page).toHaveURL(withBase('/', basePath));
  await expect(page.locator('[data-capability-section]')).toHaveCount(0);
  await page.goBack();
  await expect(section.locator('[data-capability-example]:visible')).toHaveCount(4);
  await button.click();
  await expect(section.locator('[data-capability-example]:visible')).toHaveCount(8);
});

test('reveals and opens direct, search, and history targets beyond two batches', async ({
  page,
}) => {
  const examples = showcase.find(({ group }) => group.id === 'agents')!.examples;
  const target = examples[12];
  await page.goto(`${route}#${target.id}`);
  await expect(page.locator(`#example-${target.id}`)).toBeVisible();
  await expect(sectionFor(page, 'agents').locator('[data-capability-example]:visible')).toHaveCount(
    16,
  );
  await expect(
    sectionFor(page, 'structure').locator('[data-capability-example]:visible'),
  ).toHaveCount(4);
  await page.goto(withBase('/search/', basePath));
  const input = page.getByRole('searchbox', { name: 'Search documentation' });
  await input.fill(target.title);
  await input.press('Enter');
  await page.locator(`[data-search-results] a[href="${route}#${target.id}"]`).click();
  await expect(page.locator(`#example-${target.id}`)).toBeVisible();
  await page.goto(`${route}#${examples[20].id}`);
  await expect(page.locator(`#example-${examples[20].id}`)).toBeVisible();
  await page.goBack();
  await expect(page.locator(`#example-${target.id}`)).toBeVisible();
  await page.goForward();
  await expect(page.locator(`#example-${examples[20].id}`)).toBeVisible();
  await expect(page.locator('dialog:modal')).toHaveCount(1);
});

for (const fragment of ['', '%ZZ', 'unknown-example']) {
  test(`ignores an unknown or malformed fragment #${fragment}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${route}#${fragment}`);
    await expect(page.locator('[data-capability-example]:visible')).toHaveCount(24);
    await expect(page.locator('dialog:modal')).toHaveCount(0);
    expect(errors).toStrictEqual([]);
  });
}

for (const { group, examples } of showcase) {
  for (const example of examples) {
    test(`opens ${example.id} with its recorded result`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(route);
      await revealAll(page, group.id);
      await triggerFor(page, example.id).click();
      if (example.id === 'inspection-mixed-diagnostics') {
        const result = page.locator(`#${example.id}-result`);
        await expect(result.getByRole('list', { name: 'Inspection findings' })).toBeVisible();
        await result.getByRole('tab', { name: 'Output', exact: true }).click();
        expect(
          JSON.parse(await result.locator('[data-inspection-output] pre').innerText()),
        ).toStrictEqual(example.output.responses);
        await page.keyboard.press('Escape');
        await expect(triggerFor(page, example.id)).toBeFocused();
        return;
      }
      const dialog = page.locator(`#example-${example.id}`);
      await expect(
        dialog.getByRole('heading', { level: 2, name: example.title, exact: true }),
      ).toHaveText(example.title);
      await expect(dialog.locator('[data-capability-visual]')).toHaveAttribute(
        'data-capability-visual',
        getCapabilityVisualFamily(example),
      );
      await expect(dialog.locator('[data-capability-summary]')).not.toBeEmpty();
      const view = getCapabilityInspectionView(example);
      const resultOpener = dialog.locator('[data-dialog-open]').first();
      await resultOpener.click();
      const result = page.locator(`#${example.id}-result`);
      await expect(result).toBeVisible();
      if (view.findings.length > 0)
        await result.getByRole('tab', { name: 'Output', exact: true }).click();
      expect(
        JSON.parse(await result.locator('[data-inspection-output] pre').innerText()),
      ).toStrictEqual(JSON.parse(view.output));
      await page.keyboard.press('Escape');
      await expect(resultOpener).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    });
  }
}

test('keeps source representations and catalog accessibility', async ({ page }) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(route);
  for (const { group } of showcase) await revealAll(page, group.id);
  await expect(page.locator('[data-capability-example]:visible')).toHaveCount(catalog.cases.length);
  await expect(page.locator('#manifest-duplicate-key [data-capability-visual] pre')).toContainText(
    'version: 1',
  );
  for (const [id, text] of [
    ['utf8-invalid', 'Byte representation'],
    ['unicode-invalid', 'JSON-string representation'],
    ['canonical-content-pages', 'Bytes 3 to 7'],
    ['reader-cancellation', 'Read cancelled'],
    ['policy-reference-connected', 'Declared target in moldea.yaml'],
    ['cli-composition', 'Completed'],
  ])
    await expect(page.locator(`#${id}`)).toContainText(text);
  await expect(page.locator('#binding-export-passed')).toContainText('A declared export exists');
  await expect(page.locator('#binding-commonjs')).toContainText('Not checked');
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toStrictEqual([]);
});

for (const exampleId of ['cli-pattern-warning', 'cli-accepted-warning']) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`opens illustration and result dialogs with separate focus restoration for ${exampleId} in ${colorScheme}`, async ({
      page,
    }) => {
      // both dialog states receive an Axe audit within this complete nested-dialog journey
      test.setTimeout(60_000);
      await page.setViewportSize({ width: 320, height: 900 });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto(route);
      await revealAll(page, 'command-line');
      const example = catalog.cases.find(({ id }) => id === exampleId)!;
      const trigger = triggerFor(page, example.id);
      await trigger.click();
      const illustration = page.locator(`#example-${example.id}`);
      const resultTrigger = illustration.locator('[data-dialog-open]').first();
      await resultTrigger.click();
      const result = page.locator(`#${example.id}-result`);
      await expect(page.locator('dialog:modal')).toHaveCount(2);
      await expect(result.getByRole('tab', { name: 'Finding', selected: true })).toBeVisible();
      const header = result.locator('[data-inspection-finding-header]');
      const card = result.locator('[data-inspection-finding-card]');
      expect(await header.evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe(
        await card.evaluate((node) => getComputedStyle(node).backgroundColor),
      );
      expect(
        (await new AxeBuilder({ page }).include(`#${example.id}-result`).analyze()).violations,
      ).toStrictEqual([]);
      await result.getByRole('tab', { name: 'Output', exact: true }).click();
      await expect(result.locator('[data-inspection-output]')).toContainText('warningCount');
      const codeRegion = result.getByRole('region', {
        name: getCapabilityInspectionView(example).outputLabel,
      });
      await expect(codeRegion).toHaveAttribute('tabindex', '0');
      await expect(codeRegion.locator('code')).toHaveClass('language-json');
      expect(await codeRegion.locator('code span').count()).toBeGreaterThan(0);
      await codeRegion.focus();
      await page.keyboard.press('ArrowRight');
      await expect
        .poll(() => codeRegion.evaluate((element) => element.scrollLeft))
        .toBeGreaterThan(0);
      expect(await result.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true,
      );
      expect(
        (await new AxeBuilder({ page }).include(`#${example.id}-result`).analyze()).violations,
      ).toStrictEqual([]);
      await page.keyboard.press('Escape');
      await expect(result).toBeHidden();
      await expect(illustration).toBeVisible();
      await expect(resultTrigger).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(illustration).toBeHidden();
      await expect(trigger).toBeFocused();
    });
  }
}

test('keeps one complete illustration catalog readable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 900 },
  });
  try {
    const page = await context.newPage();
    await page.goto(route);
    await expect(page.locator('[data-capability-example]:visible')).toHaveCount(
      catalog.cases.length,
    );
    await expect(page.locator('[data-capability-load]:visible')).toHaveCount(0);
    await expect(page.locator('[data-capability-visual]:visible')).toHaveCount(
      catalog.cases.length - 1,
    );
    await expect(page.locator('dialog[data-dialog-fallback-open][open]')).toHaveCount(
      catalog.cases.length * 2 - 1,
    );
    await expect(page.getByRole('button', { name: /^Open example:/u })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  } finally {
    await context.close();
  }
});

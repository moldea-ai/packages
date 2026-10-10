import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_BASE_PATH, normalizeBasePath, withBase } from '@moldea.ai/website-ui/site';

import { loadWebsiteModel } from '../../lib/generation/generation.ts';
import { getCapabilityShowcase, getCapabilityVisualFamily } from '../../lib/capabilities/index.ts';

const basePath = normalizeBasePath(process.env.BASE_PATH ?? DEFAULT_BASE_PATH);
const route = withBase('/capabilities/', basePath);
const catalog = loadWebsiteModel().capabilities;
const showcase = getCapabilityShowcase(catalog);
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
    test(`shows four compact example buttons per category at ${width}px in ${colorScheme}`, async ({
      page,
    }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        "Catch what's broken.See what's connected.",
      );
      await expect(page.locator('[data-capability-example]')).toHaveCount(catalog.cases.length);
      await expect(page.locator('main dialog')).toHaveCount(catalog.cases.length * 2);
      await expect(page.locator('main dialog:modal')).toHaveCount(0);
      await expect(page.locator('[data-capability-visual]:visible')).toHaveCount(0);
      for (const { group, examples } of showcase) {
        const section = sectionFor(page, group.id);
        await expect(section.locator('[data-capability-example]:visible')).toHaveCount(4);
        await expect(section.locator('[data-capability-count]')).toHaveText(
          `4 of ${examples.length} examples`,
        );
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
      }
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
  expect(Math.abs((await page.locator(`#${fifth.id}`).boundingBox())!.y - before)).toBeLessThan(8);
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
  const examples = showcase.find(({ group }) => group.id === 'runtime-wiring')!.examples;
  const target = examples[12];
  await page.goto(`${route}#${target.id}`);
  await expect(page.locator(`#example-${target.id}`)).toBeVisible();
  await expect(
    sectionFor(page, 'runtime-wiring').locator('[data-capability-example]:visible'),
  ).toHaveCount(16);
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

test('opens every executed illustration once with its truthful visual and result', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(route);
  for (const { group } of showcase) await revealAll(page, group.id);
  await expect(page.locator('[data-capability-example]:visible')).toHaveCount(catalog.cases.length);
  for (const example of catalog.cases) {
    await triggerFor(page, example.id).click();
    const dialog = page.locator(`#example-${example.id}`);
    await expect(
      dialog.getByRole('heading', { level: 2, name: example.title, exact: true }),
    ).toHaveText(example.title);
    await expect(dialog.locator('[data-capability-visual]')).toHaveAttribute(
      'data-capability-visual',
      getCapabilityVisualFamily(example),
    );
    await expect(dialog.locator('[data-capability-summary]')).not.toBeEmpty();
    await expect(
      dialog.getByRole('button', { name: `View result: ${example.title}`, exact: true }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  }
  await expect(page.locator('#manifest-duplicate-key [data-capability-visual] pre')).toContainText(
    'version: 1',
  );
  for (const [id, text] of [
    ['utf8-invalid', 'Byte representation'],
    ['unicode-invalid', 'JSON-string representation'],
    ['canonical-content-pages', 'Bytes 3 to 7'],
    ['reader-cancellation', 'Read cancelled'],
    ['policy-reference-connected', 'Declared target in moldea.yaml'],
    ['openai-loader-disconnected', 'Not connected to this loader'],
    ['cli-composition', 'Command completed'],
  ])
    await expect(page.locator(`#${id}`)).toContainText(text);
  for (const [id, text] of [
    ['anthropic-messages', 'client.messages.create'],
    ['claude-query', 'query({'],
    ['google-generate-content', 'models.generateContent'],
    ['eve-markdown-instruction', 'You are the `support` agent.'],
  ])
    await expect(page.locator(`#${id} [data-capability-visual] pre`)).toContainText(text);
  expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toStrictEqual([]);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`opens illustration and result dialogs with separate focus restoration in ${colorScheme}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.goto(route);
    await revealAll(page, 'command-line');
    const example = catalog.cases.find(({ id }) => id === 'cli-version-warning')!;
    const trigger = triggerFor(page, example.id);
    await trigger.click();
    const illustration = page.locator(`#example-${example.id}`);
    const resultTrigger = illustration.getByRole('button', {
      name: `View result: ${example.title}`,
      exact: true,
    });
    await resultTrigger.click();
    const result = page.locator(`#result-${example.id}`);
    await expect(page.locator('dialog:modal')).toHaveCount(2);
    await expect(result).toContainText('warningCount');
    await expect(result).toContainText(example.packageName);
    expect(
      (await new AxeBuilder({ page }).include(`#result-${example.id}`).analyze()).violations,
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
      catalog.cases.length,
    );
    await expect(page.locator('dialog[data-dialog-fallback-open][open]')).toHaveCount(
      catalog.cases.length,
    );
    await expect(page.getByRole('button', { name: /^Open example:/u })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  } finally {
    await context.close();
  }
});

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_BASE_PATH, normalizeBasePath, withBase } from '@moldea.ai/website-ui/site';

import { loadWebsiteModel } from '../../lib/generation/generation.ts';
import { getCapabilityShowcase } from '../../lib/capabilities/index.ts';

const basePath = normalizeBasePath(process.env.BASE_PATH ?? DEFAULT_BASE_PATH);
const route = withBase('/capabilities/', basePath);
const model = loadWebsiteModel();
const showcase = getCapabilityShowcase(model.capabilities);
const selectedExampleCount = showcase.reduce((count, { examples }) => count + examples.length, 0);
const exampleTrigger = (page: Page, id: string) =>
  page.locator(`#${id} > [data-dialog-root] > [data-dialog-trigger]`);
const exampleDialog = (page: Page, id: string) => page.locator(`#example-${id}`);
const openExample = async (page: Page, id: string) => {
  await exampleTrigger(page, id).click();
  const dialog = exampleDialog(page, id);
  await expect(dialog).toBeVisible();
  return dialog;
};
const closeExample = async (page: Page, id: string) => {
  const dialog = exampleDialog(page, id);
  await dialog.getByRole('button', { name: 'Close example' }).click();
  await expect(dialog).not.toBeVisible();
};

for (const width of [320, 375, 768, 1024, 1100, 1279, 1280, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`shows concise capability coverage without overflow at ${width}px in ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(
        "Catch what's broken. See what's connected.",
      );
      await expect(page.locator('main [data-capability-outcome]')).toHaveCount(
        selectedExampleCount,
      );
      await expect(page.locator('main article')).toHaveCount(selectedExampleCount);
      await expect(page.locator('main dialog')).toHaveCount(selectedExampleCount * 2);
      if (width >= 1280)
        expect(
          (await page.locator('#variable-undeclared').boundingBox())!.width,
        ).toBeLessThanOrEqual(640);
      await expect(
        page.locator('main [data-capability-example] > [data-dialog-root] > [data-dialog-trigger]'),
      ).toHaveCount(selectedExampleCount);
      for (const { group } of showcase)
        await expect(
          page.getByRole('link', { name: group.reference.label, exact: true }),
        ).toHaveAttribute('href', withBase(group.reference.route, basePath));
      for (const { group, examples } of showcase) {
        const section = page.getByRole('region', { name: group.title, exact: true });
        await expect(section).toBeVisible();
        await expect(section.locator('[data-capability-coverage]')).toHaveText(
          `Also covers: ${group.coverage.join('; ')}.`,
        );
        await expect(section.locator('dialog:modal')).toHaveCount(0);
        for (const [index, example] of examples.entries()) {
          const trigger = exampleTrigger(page, example.id);
          await expect(trigger).toBeVisible();
          await expect(trigger).toContainText(example.title);
          await expect(trigger).toContainText(`Example ${index + 1} of ${examples.length}`);
          await expect(trigger.locator('[data-status-badge]')).toHaveCount(1);
        }
      }
      const variable = await page.locator('#variable-undeclared').boundingBox();
      const mirror = await page.locator('#mirror-stale').boundingBox();
      expect(variable!.y + variable!.height).toBeLessThanOrEqual(mirror!.y);
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
      const code = page.locator('#cli-invalid-project pre').first();
      await expect(code).toHaveAttribute('tabindex', '0');
      await expect(code).toHaveCSS('white-space', 'pre');
      await expect(code).toHaveCSS('overflow-x', 'auto');
    });
  }
}

for (const width of [320, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`keeps each result family accessible at ${width}px in ${theme}`, async ({ page }) => {
      // Representative examples exercise each result family and dialog dismissal path.
      test.setTimeout(60_000);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto(route);
      for (const [id, title] of [
        ['policy-reference-missing', '1 missing file'],
        ['decision-replacement-chain', 'Decision chain checks pass'],
        ['openai-responses', 'Instruction and tool connections found'],
        ['openai-loader-unverified', '1 runtime relationship unverified'],
        ['inspection-mixed-diagnostics', '1 warning and 1 error across two pages'],
        ['snapshot-comparison', 'Changes identified'],
        ['cli-invalid-project', 'Broken reference caught by validation'],
        ['cli-version-warning', '1 runtime relationship unverified'],
        ['openai-loader-disconnected', 'Instruction loader not connected'],
        ['cli-content-refusal', 'Source file outside this command’s scope'],
      ]) {
        const example = await openExample(page, id);
        const capabilityCase = model.capabilities.cases.find((candidate) => candidate.id === id)!;
        const trigger = example.getByRole('button', { name: /^View result:/u });
        await expect(trigger).toHaveAccessibleName(`View result: ${capabilityCase.title}`);
        await expect(trigger).toHaveText('View result');
        await expect(trigger.locator('[data-status-badge]')).toHaveCount(0);
        await expect(example.locator('[data-capability-fallback-status]')).toBeHidden();
        await trigger.click();
        const dialog = page.getByRole('dialog', { name: title, exact: true });
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole('heading', { level: 2, name: title })).toBeVisible();
        await expect(dialog).not.toHaveAttribute('aria-describedby');
        const operation = dialog
          .locator('dl > div')
          .filter({ has: page.getByText('Operation', { exact: true }) })
          .locator('dd code');
        await expect(operation).toHaveText(
          model.capabilities.cases.find((example) => example.id === id)!.operation,
        );
        expect(
          await operation.evaluate((element) => getComputedStyle(element).backgroundColor),
        ).not.toBe('rgba(0, 0, 0, 0)');
        expect(
          await operation.evaluate((element) => parseFloat(getComputedStyle(element).paddingLeft)),
        ).toBeGreaterThan(0);
        const close = dialog.getByRole('button', { name: 'Close capability result' });
        await expect(close).toBeFocused();
        const resultSummary = dialog.getByRole('group', { name: 'Result', exact: true });
        const icon = resultSummary.locator(':scope > span');
        if (width < 640) await expect(icon).toBeHidden();
        else await expect(icon).toHaveCSS('width', '40px');
        await expect(resultSummary.locator('[data-status-badge]')).toHaveCount(0);
        const resultKind = model.capabilities.cases.find((example) => example.id === id)?.result
          .kind;
        const excerptLabel = dialog.getByText(
          resultKind === 'reader' || resultKind === 'inspection'
            ? 'Selected execution facts'
            : 'Executed result excerpt',
          { exact: true },
        );
        const excerptRow = excerptLabel.locator('xpath=..');
        const badge = excerptRow.locator('[data-status-badge]');
        await expect(badge).toHaveCount(1);
        expect((await badge.boundingBox())!.height).toBeLessThanOrEqual(22);
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
        await example.getByRole('button', { name: 'Close example' }).click();
        await expect(example).not.toBeVisible();
        await expect(exampleTrigger(page, id)).toBeFocused();
      }
      const runtime = await openExample(page, 'openai-responses');
      await runtime.getByRole('button', { name: /^View result:/u }).click();
      const runtimeDialog = page.locator('#result-openai-responses');
      await expect(
        runtimeDialog.getByRole('heading', { name: 'Instruction and tool connections found' }),
      ).toBeVisible();
      const runtimeExcerpt = JSON.parse(
        (await runtimeDialog.locator('pre').textContent()) ?? '',
      ) as unknown;
      expect(runtimeExcerpt).toMatchObject({
        valid: true,
        errorCount: 0,
        warningCount: 0,
        evidence: expect.any(Array),
      });
      const analysis = await new AxeBuilder({ page }).include('dialog[open]').analyze();
      expect(
        analysis.violations.filter(({ impact }) => impact === 'critical' || impact === 'serious'),
      ).toStrictEqual([]);
      await page.keyboard.press('Escape');
      await expect(runtimeDialog).not.toBeVisible();
    });
  }
}

for (const theme of ['light', 'dark'] as const) {
  test(`returns from an opaque mobile result dialog without a text fade in ${theme}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'no-preference' });
    await page.goto(route);
    const example = await openExample(page, 'policy-reference-missing');
    const trigger = example.getByRole('button', { name: /^View result:/u });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: '1 missing file' });
    await expect(dialog).toBeVisible();
    await expect
      .poll(() => dialog.evaluate((element) => getComputedStyle(element).animationName))
      .toContain('dialog-page-enter');
    await expect(dialog).toHaveCSS('opacity', '1');
    expect(
      await dialog.evaluate((element) => getComputedStyle(element, '::backdrop').backgroundColor),
    ).toBe('rgba(0, 0, 0, 0)');

    const returnStarted = page.waitForFunction(() =>
      document.documentElement.hasAttribute('data-website-ui-dialog-return'),
    );
    await Promise.all([
      returnStarted,
      dialog.getByRole('button', { name: 'Close capability result' }).click(),
    ]);
    await expect(page.locator('main')).toHaveCSS('view-transition-name', 'none');
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
    await expect(dialog).not.toBeVisible();
    await expect(example).toBeVisible();
    await expect(page.locator('html')).not.toHaveAttribute('data-website-ui-dialog-return');
    await expect(trigger).toBeFocused();

    const exampleReturnStarted = page.waitForFunction(() =>
      document.documentElement.hasAttribute('data-website-ui-dialog-return'),
    );
    await Promise.all([
      exampleReturnStarted,
      example.getByRole('button', { name: 'Close example' }).click(),
    ]);
    expect(
      await page.evaluate(
        () =>
          getComputedStyle(document.documentElement, '::view-transition-new(root)').transformOrigin,
      ),
    ).toMatch(/(?:^| )0(?:px|%)$/u);
    expect(
      await page.evaluate(
        () => getComputedStyle(document.documentElement, '::view-transition-old(root)').opacity,
      ),
    ).toBe('0');
    await expect(example).not.toBeVisible();
  });
}

test('dismisses a mobile result immediately when return snapshots are unavailable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.addInitScript(() => {
    Object.defineProperty(document, 'startViewTransition', {
      configurable: true,
      value: undefined,
    });
  });
  await page.goto(route);
  const example = await openExample(page, 'policy-reference-missing');
  const trigger = example.getByRole('button', { name: /^View result:/u });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '1 missing file' });
  await dialog.getByRole('button', { name: 'Close capability result' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('html')).not.toHaveAttribute('data-website-ui-dialog-return');
  await expect(trigger).toBeFocused();
});

for (const width of [320, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`opens one example dialog per section with keyboard and reduced motion at ${width}px in ${theme}`, async ({
      page,
    }) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto(route);
      for (const { group } of showcase) {
        const firstId = group.exampleIds[0];
        const firstTrigger = exampleTrigger(page, firstId);
        await firstTrigger.focus();
        await page.keyboard.press('Enter');
        const firstDialog = exampleDialog(page, firstId);
        await expect(firstDialog).toBeVisible();
        await expect(firstDialog.locator('article')).toBeVisible();
        await expect(firstDialog).toHaveCSS('animation-name', 'none');
        await page.keyboard.press('Escape');
        await expect(firstDialog).not.toBeVisible();
        await expect(firstTrigger).toBeFocused();
        for (const id of group.exampleIds.slice(1, 2)) {
          const trigger = exampleTrigger(page, id);
          await trigger.focus();
          await expect(trigger).toBeFocused();
          expect(await trigger.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe(
            'none',
          );
          await page.mouse.move(0, 0);
          const background = await trigger.evaluate(
            (element) => getComputedStyle(element).backgroundColor,
          );
          await trigger.hover();
          await expect
            .poll(() => trigger.evaluate((element) => getComputedStyle(element).backgroundColor))
            .not.toBe(background);
          await trigger.press('Space');
          const dialog = exampleDialog(page, id);
          await expect(dialog).toBeVisible();
          await expect(firstDialog).not.toBeVisible();
          await expect(dialog.getByRole('button', { name: 'Close example' })).toBeFocused();
          await expect(dialog).toHaveCSS('animation-name', 'none');
          const resultTrigger = dialog.getByRole('button', { name: /^View result:/u });
          if (width < 640)
            expect((await resultTrigger.boundingBox())!.width).toBeGreaterThanOrEqual(width - 32);
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
          ).toBeLessThanOrEqual(width);
          const analysis = await new AxeBuilder({ page }).include(`#example-${id}`).analyze();
          expect(
            analysis.violations.filter(
              ({ impact }) => impact === 'critical' || impact === 'serious',
            ),
          ).toStrictEqual([]);
          await page.keyboard.press('Escape');
          await expect(dialog).not.toBeVisible();
          await expect(trigger).toBeFocused();
        }
      }
    });
  }
}

test('shows source-backed adapter changes and preserves warning and error labels', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto(route);
  for (const [id, expected] of [
    ['openai-loader-unverified', ['Unverified', 'process.env.SUPPORT_INSTRUCTION']],
    ['openai-loader-disconnected', ['Not connected to this loader']],
    ['anthropic-parse-output', ['messages.parse', 'output_config']],
    ['openai-parse-output', ['responses.parse', 'zodTextFormat']],
    ['google-mixed-generation', ['models.generateContent', 'models.generateContentStream']],
    ['cloudflare-think-session-context', ['session.withContext']],
    ['cloudflare-think-configured-context', ['configureContext', 'deferLoading: true']],
    ['cloudflare-think-ambiguous-context', ['Unverified', 'configureContext']],
    ['eve-workspace-peer', ['defineWorkspaceAgent']],
    ['eve-excluded-test-tool', ['Invalid', 'search.test.ts']],
    ['vercel-deferred-tool', ['deferLoading: true']],
    ['langgraph-resume-schema', ['responseSchema: ResumeSchema']],
    ['inspection-mixed-diagnostics', ['1 warning and 1 error', 'Page 1', 'Page 2']],
  ] satisfies [string, string[]][]) {
    const dialog = await openExample(page, id);
    for (const text of expected) await expect(dialog).toContainText(text);
    if (id === 'anthropic-parse-output')
      await expect(
        dialog.getByRole('group', { name: /source and result$/u }).locator('[data-status-badge]'),
      ).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      320,
    );
    await closeExample(page, id);
  }
});

test('keeps displayed runtime source focused and faithful to the inspected files', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(route);
  const runtimeIds = model.capabilities.groups.find(
    ({ id }) => id === 'runtime-wiring',
  )!.exampleIds;

  for (const id of runtimeIds.filter(
    (id) => id !== 'openai-responses' && id !== 'openai-loader-disconnected',
  )) {
    const item = await openExample(page, id);
    const example = model.capabilities.cases.find((candidate) => candidate.id === id)!;
    const codeBlocks = item.locator('article > [role="group"] [data-code-block] pre');
    expect(await codeBlocks.count()).toBeGreaterThan(0);

    for (const codeBlock of await codeBlocks.all()) {
      const excerpt = (await codeBlock.textContent())?.trimEnd() ?? '';
      expect(excerpt.length).toBeGreaterThan(0);
      expect(example.files.some(({ content }) => content.includes(excerpt))).toBe(true);
      expect(excerpt.split('\n').length).toBeLessThanOrEqual(16);
      expect(Math.max(...excerpt.split('\n').map((line) => line.length))).toBeLessThanOrEqual(80);
    }
    await closeExample(page, id);
  }
});

test('gives long structured results more reading width on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(route);

  for (const id of [
    'variable-undeclared',
    'openai-loader-disconnected',
    'eve-excluded-test-tool',
    'normalized-digests',
    'cli-canonical-content',
    'cli-content-refusal',
  ]) {
    const item = await openExample(page, id);
    await item.getByRole('button', { name: /^View result:/u }).click();
    const dialog = page.locator(`#result-${id}`);
    await expect(dialog).toBeVisible();
    expect((await dialog.boundingBox())!.width).toBeGreaterThan(900);
    await dialog.getByRole('button', { name: 'Close capability result' }).click();
    await closeExample(page, id);
  }

  const compact = await openExample(page, 'openai-responses');
  await compact.getByRole('button', { name: /^View result:/u }).click();
  expect((await page.locator('#result-openai-responses').boundingBox())!.width).toBeLessThan(700);
});

test('shows a successful schema 5 warning result with bounded version details', async ({
  page,
}) => {
  await page.goto(route);
  const item = await openExample(page, 'cli-version-warning');
  await expect(item).toContainText('Validation completed with a warning');
  await expect(item).toContainText('Exit 0');
  await item.getByRole('button', { name: /^View result:/u }).click();
  const dialog = page.getByRole('dialog', { name: '1 runtime relationship unverified' });
  const excerpt = JSON.parse((await dialog.locator('pre').textContent()) ?? '') as unknown;
  expect(excerpt).toMatchObject({
    cliVersion: '9.0.1',
    command: 'validate',
    error: null,
    schemaVersion: 5,
    status: 'valid',
    result: {
      valid: true,
      diagnosticCount: 1,
      errorCount: 0,
      warningCount: 1,
      page: {
        records: [
          {
            kind: 'diagnostic',
            code: 'CLOUDFLARE_AGENTS_RUNTIME_RELATIONSHIP_UNVERIFIED',
            severity: 'warning',
            details: {
              relationship: 'instruction-loader',
              reason: 'version-dependent-behavior',
              packageName: '@cloudflare/think',
              declaredRange: '>=0.17.0',
              boundaryVersion: '0.18.0',
            },
          },
        ],
      },
    },
  });
  expect(excerpt).not.toHaveProperty('exitStatus');
});

test('aligns outcome separators with dialog headers without adding empty preview dividers', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(route);
  for (const id of [
    'foundation-missing',
    'tool-implementation-missing',
    'manifest-change-relevance',
  ]) {
    const item = await openExample(page, id);
    await expect(item.locator('[data-file-preview-header]').last()).toHaveCSS(
      'border-bottom-width',
      '0px',
    );
    await expect(item.locator('article > div').last()).toHaveCSS('border-top-width', '1px');
    await closeExample(page, id);
  }
  for (const id of ['foundation-missing', 'manifest-change-relevance']) {
    await expect(page.locator(`#${id} [data-file-preview-header]`).first()).toHaveCSS(
      'border-bottom-width',
      '0px',
    );
  }
  const withBody = await openExample(page, 'policy-reference-missing');
  await expect(withBody.locator('[data-file-preview-header]').first()).toHaveCSS(
    'border-bottom-width',
    '1px',
  );
  await closeExample(page, 'policy-reference-missing');
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const item = await openExample(page, 'foundation-missing');
    const header = await item.locator(':scope > header').boundingBox();
    const illustration = await item.locator('article > :first-child').boundingBox();
    const actionRow = await item.locator('article > div').last().boundingBox();
    expect(actionRow!.x).toBeCloseTo(header!.x);
    expect(actionRow!.width).toBeCloseTo(header!.width);
    expect(actionRow!.y - illustration!.y - illustration!.height).toBeCloseTo(
      illustration!.y - header!.y - header!.height,
    );
    await closeExample(page, 'foundation-missing');
  }
});

for (const fragment of ['', '#', '#%ZZ', '#missing-example']) {
  test(`ignores non-target fragments (${fragment || 'none'}) without empty DOM lookups`, async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));
    await page.addInitScript(() => {
      // Chromium does not warn about empty IDs, so expose that invalid lookup explicitly.
      const getElementById = document.getElementById.bind(document);
      document.getElementById = (elementId) => {
        if (elementId === '') throw new Error('Empty example anchor lookup.');
        return getElementById(elementId);
      };
    });
    await page.goto(`${route}${fragment}`);
    await expect(page.locator('main dialog:modal')).toHaveCount(0);
    expect(pageErrors).toStrictEqual([]);

    await page.evaluate(() => {
      window.location.hash = 'mirror-stale';
    });
    await expect(exampleDialog(page, 'mirror-stale')).toBeVisible();
    await expect(exampleDialog(page, 'variable-undeclared')).not.toBeVisible();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          window.addEventListener('hashchange', () => resolve(), { once: true });
          window.location.hash = '';
        }),
    );
    await expect(exampleDialog(page, 'mirror-stale')).toBeVisible();
    expect(pageErrors).toStrictEqual([]);

    await closeExample(page, 'mirror-stale');
    await page
      .getByRole('navigation', { name: 'Primary navigation', exact: true })
      .getByRole('link', { name: 'Get started', exact: true })
      .click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Get started with moldea' }),
    ).toBeVisible();
    expect(pageErrors).toStrictEqual([]);
  });
}

test('opens direct and history-linked examples without changing the URL on ordinary buttons', async ({
  page,
}) => {
  await page.goto(`${route}#mirror-stale`);
  await expect(exampleDialog(page, 'mirror-stale')).toBeVisible();
  await expect(exampleDialog(page, 'variable-undeclared')).not.toBeVisible();
  await closeExample(page, 'mirror-stale');
  await expect(page).toHaveURL(`${new URL(page.url()).origin}${route}#mirror-stale`);
  await page.goto(`${route}#variable-undeclared`);
  await expect(exampleDialog(page, 'variable-undeclared')).toBeVisible();
  await page.goBack();
  await expect(exampleDialog(page, 'mirror-stale')).toBeVisible();
  await closeExample(page, 'mirror-stale');
  await exampleTrigger(page, 'mirror-stale').click();
  await expect(page).toHaveURL(`${new URL(page.url()).origin}${route}#mirror-stale`);
});

test('explains file failures, successful checks, and source evidence without a technical inventory', async ({
  page,
}) => {
  await page.goto(route);
  await expect(page.locator('#policy-reference-missing')).toContainText('Referenced file: missing');
  await expect(page.locator('#mirror-stale')).toContainText('60 days');
  await expect(page.locator('#mirror-stale')).toContainText('30 days');
  const variable = page.locator('#variable-undeclared');
  await expect(variable.locator('mark')).toHaveText('{{ORDER_ID}}');
  await expect(variable.locator('article')).toContainText('Declared variables');
  await expect(variable.locator('article')).toContainText('REGION');
  await expect(variable.locator('article')).toContainText('Not declared');
  await expect(variable.locator('article')).toContainText('Check delivery status for order');
  await expect(variable.locator('article pre')).toHaveCount(1); // Optional JSON only, not the illustration.
  await expect(page.locator('#decision-replacement-chain')).toContainText('Valid');
  const runtime = await openExample(page, 'openai-responses');
  const connections = runtime.getByRole('group', {
    name: 'Connections found in the OpenAI source',
  });
  await expect(connections).toContainText('responses.create');
  await expect(connections).toContainText('loadInstruction');
  await expect(connections).toContainText('find_order');
  await expect(page.locator('#openai-responses')).toContainText('Inspected');
  await expect(page.locator('#cli-invalid-project')).toContainText('Exit 1');
  await expect(page.locator('#snapshot-comparison')).toContainText('Now a folder');
  await expect(page.getByRole('region', { name: 'Check boundaries and next step' })).toContainText(
    'They do not run your agents',
  );
});

test('renders each command verbatim without template indentation', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(route);
  for (const example of showcase.flatMap(({ examples }) => examples)) {
    if (example.result.kind !== 'cli') continue;
    const item = await openExample(page, example.id);
    const exitBadge = item.locator('[data-status-badge]').filter({ hasText: /^Exit \d+$/u });
    await expect(exitBadge).toHaveCount(1);
    await expect(exitBadge).toHaveCSS('white-space', 'nowrap');
    expect((await exitBadge.boundingBox())!.height).toBeLessThanOrEqual(22);
    const command = item.locator('pre').first();
    expect(await command.textContent()).toBe(example.result.command);
    await expect(command).toHaveAttribute('tabindex', '0');
    await expect(command).toHaveAttribute('aria-label', 'Code block');
    await expect(command).toHaveCSS('white-space', 'pre');
    await expect(command).toHaveCSS('padding', '16px');
    await closeExample(page, example.id);
  }
});

for (const width of [320, 768, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`shows realistic comparisons without result dialogs at ${width}px in ${theme}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto(route);
      const policy = await openExample(page, 'policy-reference-missing');
      await expect(policy).toContainText(
        'Customers can return an order within 30 days of delivery.',
      );
      await closeExample(page, 'policy-reference-missing');

      for (const [id, expected] of [
        ['policy-reference-directory', ['src/returns', 'Folder']],
        ['mirror-stale', ['Updated original', 'Stale copy', 'Copy not updated']],
        [
          'decision-cycle',
          ['30 days', '60 days', 'Replaces: 60-day proposal', 'Replaces: 30-day proposal'],
        ],
        [
          'openai-loader-disconnected',
          [
            'Request uses hard-coded text',
            "instructions: 'Help customers track their orders.',",
            'Not connected to this loader',
            'loadInstruction',
          ],
        ],
        [
          'cli-canonical-content',
          [
            'Customers can return an order within 30 days of delivery.',
            'Document returned as JSON',
          ],
        ],
        ['cli-invalid-project', ['check-eligibility.ts', 'Missing', 'Exit 1', 'Validation failed']],
      ] satisfies [string, string[]][]) {
        const panel = await openExample(page, id);
        for (const text of expected) await expect(panel).toContainText(text);
        if (id === 'decision-cycle') {
          await expect(panel.getByRole('heading', { level: 2 })).toContainText(
            'Two decisions claim to replace each other',
          );
          const diagram = panel.getByRole('group', { name: 'Circular decision replacement' });
          const proposals = diagram.locator(':scope > div');
          await expect(proposals).toHaveCount(2);
          await expect(proposals.nth(0)).toContainText('30 days');
          await expect(proposals.nth(0)).toContainText('Replaces: 60-day proposal');
          await expect(proposals.nth(1)).toContainText('60 days');
          await expect(proposals.nth(1)).toContainText('Replaces: 30-day proposal');
          await expect(diagram).not.toContainText('Replaced by');
        }
        if (id === 'mirror-stale') {
          const windows = panel.locator('article strong');
          await expect(windows).toHaveText(['60 days', '30 days']);
          for (const window of await windows.all()) {
            await expect(window).toBeVisible();
            expect(
              await window.evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
            ).toBeGreaterThanOrEqual(24);
          }
        }
        if (id === 'openai-loader-disconnected') {
          const diagram = panel.getByRole('group', {
            name: 'Connections found in the OpenAI source',
          });
          await expect(diagram).not.toContainText('find_order');
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width,
        );
        await expect(page.locator(`#result-${id}`)).not.toBeVisible();
        const overflowingText = await panel.locator('p, code, strong').evaluateAll((elements) =>
          elements
            .filter((element) => !element.closest('pre, [id^="result-"]'))
            .filter(
              (element) =>
                element.getBoundingClientRect().right > document.documentElement.clientWidth + 1,
            )
            .map((element) => element.textContent),
        );
        expect(overflowingText).toStrictEqual([]);
        if (
          (width === 320 || width === 1440) &&
          ['mirror-stale', 'decision-cycle', 'openai-loader-disconnected'].includes(id)
        ) {
          const screenshotPath = testInfo.outputPath(`${id}-${width}-${theme}.png`);
          await panel.screenshot({ path: screenshotPath });
          await testInfo.attach(`${id}-${width}-${theme}`, {
            path: screenshotPath,
            contentType: 'image/png',
          });
        }
        await closeExample(page, id);
      }
    });
  }
}

for (const theme of ['light', 'dark'] as const) {
  test(`makes mismatches and inline code visible without opening results in ${theme}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.emulateMedia({ colorScheme: theme });
    await page.goto(route);
    for (const [id, expected] of [
      ['policy-reference-directory', ['Expected a file, found a folder', 'Folder']],
      ['agent-identity', ['support', 'You are the sales agent.', 'Names do not match']],
      ['tool-implementation-missing', ['check_return_eligibility', '/returns.ts', 'Missing']],
      [
        'decision-reference-missing',
        ['Earlier decision not found', 'Referenced by the newer decision.', '60 days'],
      ],
      ['normalized-digests', ['30 days', '60 days', 'Same fingerprint', 'Different fingerprint']],
      ['cli-content-refusal', ['Exit 3', 'Source code is not a knowledge document']],
      [
        'mirror-stale',
        ['Updated original', '60 days', 'Stale copy', '30 days', 'Copy not updated'],
      ],
    ] satisfies [string, string[]][]) {
      const panel = await openExample(page, id);
      for (const text of expected) await expect(panel).toContainText(text);
      const unstyledCode = await panel.locator('code').evaluateAll((elements) =>
        elements
          .filter((element) => !element.closest('pre, [id^="result-"]'))
          .filter((element) => {
            const style = getComputedStyle(element.closest('mark') ?? element);
            return (
              style.backgroundColor === 'rgba(0, 0, 0, 0)' || parseFloat(style.paddingLeft) === 0
            );
          })
          .map((element) => element.textContent),
      );
      expect(unstyledCode).toStrictEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        320,
      );
      await closeExample(page, id);
    }
    const manifest = page
      .locator('#policy-reference-missing article code')
      .filter({ hasText: /^moldea.yaml$/u });
    await expect(manifest).toHaveCount(1);
    expect(
      await manifest.evaluate((element) => getComputedStyle(element).backgroundColor),
    ).not.toBe('rgba(0, 0, 0, 0)');
  });
}

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
      await expect(page.locator('main [data-capability-outcome]')).toHaveCount(
        selectedExampleCount,
      );
      await expect(page.locator('main [data-dialog-fallback-open][open]')).toHaveCount(
        selectedExampleCount,
      );
      await expect(page.locator('#variable-undeclared')).toContainText('1 undeclared variable');
      await expect(page.locator('#openai-loader-unverified')).toContainText(
        '1 runtime relationship unverified',
      );
      await expect(page.locator('#inspection-mixed-diagnostics')).toContainText(
        '1 warning and 1 error across two pages',
      );
      for (const group of model.capabilities.groups)
        await expect(page.locator(`[data-capability-coverage="${group.id}"]`)).toHaveText(
          `Also covers: ${group.coverage.join('; ')}.`,
        );
      await expect(exampleDialog(page, 'mirror-stale').locator('article')).toBeVisible();
      await expect(exampleDialog(page, 'variable-undeclared').locator('article')).toBeVisible();
      await expect(
        page.locator('main [data-capability-fallback-status] [data-status-badge]'),
      ).toHaveCount(selectedExampleCount);
      await expect(page.getByRole('button', { name: /^View result:/u })).toHaveCount(0);
      await expect(
        page.getByRole('group', { name: 'Consistent decision replacement' }),
      ).toBeVisible();
      await expect(
        page.getByRole('link', { name: 'Find your runtime and its scope' }),
      ).toBeVisible();
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

for (const [query, id, title] of [
  ['stale', 'mirror-stale', 'The copied instruction is out of date'],
  ['undeclared', 'variable-undeclared', 'An instruction uses an undeclared variable'],
  [
    'The instruction choice cannot be verified',
    'openai-loader-unverified',
    'The instruction choice cannot be verified',
  ],
  [
    'Warnings and errors across two pages',
    'inspection-mixed-diagnostics',
    'Warnings and errors across two pages',
  ],
]) {
  test(`discovers ${id} through search and releases dialogs when navigating away`, async ({
    page,
  }) => {
    await page.goto(withBase(`/search/?query=${encodeURIComponent(query)}`, basePath));
    const result = page.getByRole('link', {
      name: new RegExp(title.replaceAll('.', '\\.'), 'u'),
    });
    await expect(result).toHaveAttribute('href', `${route}#${id}`);
    await result.click();
    await expect(page).toHaveURL(new RegExp(`${route}#${id}$`, 'u'));
    await expect(exampleDialog(page, id)).toBeVisible();
    await page
      .locator(`#${id}`)
      .getByRole('button', { name: /^View result:/u })
      .click();
    await expect(page.locator(`#result-${id}`)).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.goForward();
    await expect(exampleDialog(page, id)).toBeVisible();
    await page
      .locator(`#${id}`)
      .getByRole('button', { name: /^View result:/u })
      .click();
    await expect(page.locator(`#result-${id}`)).toBeVisible();
  });
}

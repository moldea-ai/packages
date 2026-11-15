import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { DEFAULT_BASE_PATH, withBase } from '@moldea.ai/website-ui/site';

import { loadWebsiteModel } from '../../lib/generation/generation.ts';

const homepage = withBase('/', process.env.BASE_PATH ?? DEFAULT_BASE_PATH);

for (const width of [375, 1024, 1440]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`keeps inspection cards compact at ${width}px in ${colorScheme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto(homepage);
      await page.evaluate(() => document.fonts.ready);
      const preview = page.getByRole('figure', { name: 'Repository check preview', exact: true });
      const spacing = await preview.evaluate((frame) => {
        const finding = frame.querySelector('[data-inspection-finding]')!;
        const style = getComputedStyle(frame);
        return {
          expected: parseFloat(style.paddingBottom),
          actual:
            frame.getBoundingClientRect().bottom -
            parseFloat(style.borderBottomWidth) -
            finding.getBoundingClientRect().bottom,
        };
      });
      expect(spacing.actual).toBeCloseTo(spacing.expected, 0);
      await expect(preview.getByText('Agents errors', { exact: true })).toHaveCount(0);
      await expect(preview.getByText('1 blocking', { exact: true })).toHaveCount(0);
      const steps = page
        .getByRole('region', { name: 'A file moves. The connection breaks.', exact: true })
        .locator('article[id^="inspection-"]');
      if (width >= 1024) {
        const rows = await steps.evaluateAll((frames) =>
          frames.map((frame) => ({
            top: frame.getBoundingClientRect().top,
            bottom: frame.getBoundingClientRect().bottom,
            result: frame.querySelector('.example-card-footer')!.getBoundingClientRect().top,
            resultHeight: frame.querySelector('[data-inspection-list]')!.getBoundingClientRect()
              .height,
            cardBottom: (
              frame.querySelector('[data-inspection-binding]') ??
              frame.querySelector('[data-inspection-finding]')!
            ).getBoundingClientRect().bottom,
          })),
        );
        for (const row of rows) {
          expect(row.top).toBeCloseTo(rows[0].top, 0);
          expect(row.bottom).toBeCloseTo(rows[0].bottom, 0);
          expect(row.result).toBeCloseTo(rows[0].result, 0);
          expect(row.resultHeight).toBeCloseTo(rows[1].resultHeight, 0);
          expect(row.cardBottom).toBeCloseTo(rows[1].cardBottom, 0);
        }
      }
    });
  }
}

for (const width of [320, 768, 1024, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`introduces the real repository check at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(homepage);
      await page.evaluate(() => document.fonts.ready);
      const hero = page.getByRole('region', { name: 'Introduction', exact: true });
      const preview = hero.getByRole('figure', { name: 'Repository check preview' });
      await expect(preview).toContainText('Agent instruction');
      await expect(
        preview.locator('figcaption').getByText('Check failed', { exact: true }),
      ).toBeVisible();
      const instructionPath = 'moldea/agents/support/instruction.md';
      const instructionFile = preview.getByTitle(instructionPath, { exact: true });
      await expect(instructionFile).toHaveText(instructionPath);
      const directory = instructionFile.locator(':scope > span').first();
      const filename = instructionFile.getByText('/instruction.md', { exact: true });
      await expect(filename).toBeVisible();
      await expect(instructionFile).toHaveCSS('font-size', '12px');
      await expect(directory).toHaveCSS('text-overflow', 'ellipsis');
      const pathBounds = await instructionFile.boundingBox();
      const filenameBounds = await filename.boundingBox();
      expect(filenameBounds!.height).toBe(
        await filename.evaluate((element) => parseFloat(getComputedStyle(element).lineHeight)),
      );
      await expect(instructionFile).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(instructionFile).toHaveCSS('font-weight', '600');
      expect(filenameBounds!.x + filenameBounds!.width).toBeLessThanOrEqual(
        pathBounds!.x + pathBounds!.width,
      );
      expect(await filename.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true,
      );
      if (width === 320 || width === 1440) {
        expect(
          await directory.evaluate((element) => element.scrollWidth > element.clientWidth),
        ).toBe(width === 320);
      }
      const instructionSource = preview
        .getByRole('group', { name: 'Instruction content' })
        .locator('code');
      await expect(instructionSource).toHaveText(loadWebsiteModel().instructionExample.instruction);
      await expect(instructionSource).toHaveCSS('white-space', 'pre-wrap');
      await expect(preview).toContainText('Tool implementation linked in moldea.yaml');
      const manifestName = preview.locator('code').filter({ hasText: /^moldea\.yaml$/ });
      await expect(manifestName).toHaveCount(1);
      await expect(manifestName).toHaveCSS('font-weight', '600');
      await expect(manifestName).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      const implementation = preview.getByRole('group', { name: 'Missing tool implementation' });
      await expect(implementation).toContainText('src/orders/tracking.ts');
      await expect(implementation.getByText('Missing', { exact: true })).toBeVisible();
      await expect(preview).not.toContainText('CUSTOMER_NAME');
      await expect(preview).not.toContainText('password');
      await expect(preview).not.toContainText('src/refund-policy.ts');
      await expect(preview.getByText('Example', { exact: true })).toHaveCount(0);
      await expect(preview.locator('details')).toHaveCount(0);
      await expect(preview.locator('pre:visible')).toHaveCount(1);
      const findingCard = preview.getByRole('article', { name: 'Structural finding', exact: true });
      const findingTrigger = findingCard.getByRole('link', { name: /^View finding:/u });
      const trigger = findingTrigger;
      await expect(findingCard).toContainText('Blocking');
      await expect(findingCard.locator('svg.lucide-bot')).toHaveCount(1);
      const triggerBounds = (await findingTrigger.boundingBox())!;
      expect(triggerBounds.height).toBeGreaterThanOrEqual(44);
      const cardBox = (await findingCard.boundingBox())!;
      expect(triggerBounds.x).toBeCloseTo(cardBox.x + 1, 0);
      expect(triggerBounds.width).toBeCloseTo(cardBox.width - 2, 0);
      const badges = hero.getByRole('list', { name: 'Package foundations' });
      await expect(badges.getByRole('listitem')).toHaveCount(3);
      const heading = hero.getByRole('heading', { level: 1 });
      const badgeBounds = await badges.boundingBox();
      const eyebrow = hero.getByText('Open-source repository tools', { exact: true });
      const eyebrowBounds = await eyebrow.boundingBox();
      const headingBounds = await heading.boundingBox();
      const copyBounds = await heading.locator('..').boundingBox();
      const previewBounds = await preview.boundingBox();
      const heroBounds = await hero.boundingBox();
      if (width === 1440) expect(heroBounds!.y + heroBounds!.height).toBeLessThanOrEqual(900);
      const heroInset = width >= 1024 ? 80 : width >= 640 ? 72 : 56;
      expect(Math.min(copyBounds!.y, previewBounds!.y) - heroBounds!.y).toBeCloseTo(heroInset, 0);
      expect(badgeBounds!.y + badgeBounds!.height).toBeLessThan(headingBounds!.y);
      // badges belong to the text column, with the same 28px gap used by the Skill hero
      expect(eyebrowBounds!.y - badgeBounds!.y - badgeBounds!.height).toBeCloseTo(28, 0);
      expect(badgeBounds!.x).toBe(headingBounds!.x);
      expect(badgeBounds!.width).toBeLessThanOrEqual(headingBounds!.width);
      if (width >= 1024) {
        const centers = await hero.evaluate((section) => {
          const copy = section.querySelector('h1')!.parentElement!.getBoundingClientRect();
          const preview = section
            .querySelector('figure[aria-label="Repository check preview"]')!
            .getBoundingClientRect();
          return { copy: copy.y + copy.height / 2, preview: preview.y + preview.height / 2 };
        });
        expect(centers.copy).toBeCloseTo(centers.preview, 0);
        expect(previewBounds!.x).toBeGreaterThan(headingBounds!.x + headingBounds!.width);
        await preview.scrollIntoViewIfNeeded();
        await expect(preview).toBeInViewport({ ratio: 1 });
        await trigger.scrollIntoViewIfNeeded();
        await expect(trigger).toBeInViewport({ ratio: 1 });
        for (const titleId of ['inspection-title', 'repository-contents-title', 'runtimes-title']) {
          const headerBottoms = await page.locator(`#${titleId}`).evaluate((element) => {
            const header = element.closest('header');
            const [titleColumn, descriptionColumn] = header?.children ?? [];
            if (!titleColumn || !descriptionColumn) return null;
            return {
              title: titleColumn.getBoundingClientRect().bottom,
              description: descriptionColumn.getBoundingClientRect().bottom,
            };
          });
          expect(headerBottoms).not.toBeNull();
          if (!headerBottoms) return;
          expect(headerBottoms.title).toBeCloseTo(headerBottoms.description, 0);
        }
      } else {
        expect(previewBounds!.y).toBeGreaterThan(headingBounds!.y + headingBounds!.height);
      }
      await expect(hero).not.toContainText('packages / Open source');
      const widths = await page.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(widths.scroll).toBeLessThanOrEqual(widths.client);
      expect(await preview.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true,
      );
      if (width === 320 || width === 1440) {
        const accessibility = await new AxeBuilder({ page })
          .include('section[aria-label="Introduction"]')
          .analyze();
        expect(
          accessibility.violations.filter(
            ({ impact }) => impact === 'serious' || impact === 'critical',
          ),
        ).toStrictEqual([]);
      }

      await trigger.focus();
      await expect(trigger).not.toHaveCSS('box-shadow', 'none');
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', {
        name: 'Structural finding',
        exact: true,
      });
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAccessibleDescription('');
      await expect(dialog.getByRole('button', { name: 'Close dialog' })).toBeFocused();
      await expect(dialog).toContainText('src/orders/tracking.ts');
      await expect(dialog).not.toContainText('/src/refund-policy.ts');
      const evaluationOpener = dialog.getByRole('button', {
        name: 'Evaluation details',
        exact: true,
      });
      await evaluationOpener.click();
      const evaluation = page.getByRole('dialog', { name: 'Evaluation details', exact: true });
      expect(
        JSON.parse(await evaluation.locator('[data-inspection-record] pre').innerText()),
      ).toStrictEqual(loadWebsiteModel().instructionExample.result.diagnostics[0]);
      await page.keyboard.press('Escape');
      await expect(evaluationOpener).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();

      const cardTrigger = page.locator('[data-dialog-open="inspection-broken-finding-1"]');
      await cardTrigger.click();
      const cardDialog = page.locator('#inspection-broken-finding-1');
      await expect(cardDialog).toBeVisible();
      expect(await cardDialog.getAttribute('id')).not.toBe(
        await trigger.getAttribute('aria-controls'),
      );
      await page.keyboard.press('Escape');
      await expect(cardTrigger).toBeFocused();
    });
  }
}

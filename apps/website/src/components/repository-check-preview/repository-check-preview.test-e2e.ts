import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { DEFAULT_BASE_PATH, withBase } from '@moldea.ai/website-ui/site';

import { loadWebsiteModel } from '../../lib/generation/generation.ts';

const homepage = withBase('/', process.env.BASE_PATH ?? DEFAULT_BASE_PATH);

for (const width of [320, 768, 1024, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`introduces the real repository check at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(homepage);
      const hero = page.getByRole('region', { name: 'Introduction', exact: true });
      const preview = hero.getByRole('figure', { name: 'Repository check preview' });
      await expect(preview).toContainText('Agent instruction');
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
      expect(filenameBounds!.height).toBe(pathBounds!.height);
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
      await expect(preview.getByRole('group', { name: 'Instruction content' })).toContainText(
        'Use get_delivery_status to answer delivery questions.',
      );
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
      await expect(preview.locator('details, pre:visible')).toHaveCount(0);
      const trigger = preview
        .locator('figcaption')
        .getByRole('button', { name: 'View result: Hero example', exact: true });
      await expect(trigger).toBeVisible();
      const triggerBounds = await trigger.boundingBox();
      expect(triggerBounds!.height).toBe(32);
      await expect(
        preview
          .getByRole('group', { name: 'Check outcome', exact: true })
          .getByText('1 broken reference', { exact: true }),
      ).toBeVisible();
      const badges = hero.getByRole('list', { name: 'Package foundations' });
      await expect(badges.getByRole('listitem')).toHaveCount(3);
      const heading = hero.getByRole('heading', { level: 1 });
      const badgeBounds = await badges.boundingBox();
      const headingBounds = await heading.boundingBox();
      const previewBounds = await preview.boundingBox();
      expect(badgeBounds!.y + badgeBounds!.height).toBeLessThan(headingBounds!.y);
      if (width >= 1024) {
        expect(previewBounds!.x).toBeGreaterThan(headingBounds!.x + headingBounds!.width);
        await expect(preview).toBeInViewport({ ratio: 1 });
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
      const dialog = page.getByRole('dialog', { name: '1 broken reference', exact: true });
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAccessibleDescription('');
      expect(JSON.parse(await dialog.locator('pre').innerText())).toStrictEqual(
        loadWebsiteModel().instructionExample.result,
      );
      await expect(dialog).toContainText('Missing implementation');
      await expect(dialog).toContainText('/src/orders/tracking.ts');
      await expect(dialog).not.toContainText('/src/refund-policy.ts');
      await expect(dialog.getByRole('button', { name: 'Close Core result' })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();

      const cardTrigger = page.getByRole('button', {
        name: 'View result: 2. File moved',
        exact: true,
      });
      await cardTrigger.click();
      const cardDialog = page.getByRole('dialog', { name: '1 broken reference', exact: true });
      await expect(cardDialog).toBeVisible();
      expect(await cardDialog.getAttribute('id')).not.toBe(
        await trigger.getAttribute('aria-controls'),
      );
      await page.keyboard.press('Escape');
      await expect(cardTrigger).toBeFocused();
    });
  }
}

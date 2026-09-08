import { expect, test, type Locator } from '@playwright/test';
import { DEFAULT_BASE_PATH, withBase } from '@moldea.ai/website-ui/site';

const homepage = withBase('/', process.env.BASE_PATH ?? DEFAULT_BASE_PATH);

/** Verifies the shared proportions while allowing descriptions to wrap on narrow screens. */
const expectBalancedSummary = async (summary: Locator, hasIcon = true): Promise<void> => {
  const layout = await summary.evaluate((element) => {
    const badge = element.querySelector(':scope > span')!;
    const text = element.querySelector(':scope > div')!;
    const title = text.querySelector('h2, p')!;
    const description = text.lastElementChild!;
    const badgeBounds = badge.getBoundingClientRect();
    const textBounds = text.getBoundingClientRect();
    return {
      badgeWidth: badgeBounds.width,
      badgeHeight: badgeBounds.height,
      iconWidth: badge.querySelector('svg')!.getBoundingClientRect().width,
      centerOffset: Math.abs(
        badgeBounds.top + badgeBounds.height / 2 - (textBounds.top + textBounds.height / 2),
      ),
      gap: textBounds.left - badgeBounds.right,
      titleSize: getComputedStyle(title).fontSize,
      descriptionSize: getComputedStyle(description).fontSize,
      titleLineHeight: getComputedStyle(title).lineHeight,
      descriptionLineHeight: getComputedStyle(description).lineHeight,
      hasOverflow: element.scrollWidth > element.clientWidth,
    };
  });
  expect(layout.badgeWidth).toBe(hasIcon ? 40 : 0);
  expect(layout.badgeHeight).toBe(hasIcon ? 40 : 0);
  expect(layout.iconWidth).toBe(hasIcon ? 20 : 0);
  if (hasIcon) {
    expect(layout.centerOffset).toBeLessThan(1);
    expect(layout.gap).toBe(12);
  }
  expect(layout.titleSize).toBe('14px');
  expect(layout.descriptionSize).toBe('12px');
  expect(layout.titleLineHeight).toBe('20px');
  expect(layout.descriptionLineHeight).toBe('20px');
  expect(layout.hasOverflow).toBe(false);
};

for (const width of [320, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`balances example outcomes at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto(homepage);
      const outcomes = page.getByRole('group', { name: 'Check outcome', exact: true });
      await expect(outcomes).toHaveCount(4);
      for (const outcome of await outcomes.all()) await expectBalancedSummary(outcome);

      for (const name of [
        'Hero example',
        '1. Connected',
        '2. File moved',
        '3. Reference updated',
      ]) {
        const trigger = page.getByRole('button', { name: `View result: ${name}`, exact: true });
        const card =
          name === 'Hero example'
            ? page.getByRole('figure', { name: 'Repository check preview' })
            : page.getByRole('article', { name, exact: true });
        const visibleSummary = card.getByRole('group', { name: 'Check outcome', exact: true });
        const title = await visibleSummary.locator('p').first().innerText();
        const description = await visibleSummary.locator('p').last().innerText();
        const icon = await visibleSummary.locator('svg').innerHTML();
        await trigger.click();
        const dialog = page.getByRole('dialog', { name: title, exact: true });
        const headingSummary = dialog
          .locator('header')
          .getByRole('group', { name: 'Check outcome', exact: true });
        await expectBalancedSummary(headingSummary, width >= 640);
        await expect(headingSummary.getByRole('heading', { level: 2 })).toHaveText(title);
        await expect(headingSummary.locator('p')).toHaveText(description);
        expect(await headingSummary.locator('svg').innerHTML()).toBe(icon);
        await expect(dialog.getByRole('heading')).toHaveCount(1);
        await page.keyboard.press('Escape');
        await expect(trigger).toBeFocused();
      }
    });
  }
}

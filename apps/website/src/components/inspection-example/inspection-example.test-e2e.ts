import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { DEFAULT_BASE_PATH, withBase } from '@moldea.ai/website-ui/site';

const basePath = process.env.BASE_PATH ?? DEFAULT_BASE_PATH;
const homepage = withBase('/', basePath);

test('shows the complete real check without tabs or disclosures', async ({ page }) => {
  await page.goto(homepage);
  const example = page.getByRole('region', { name: 'A file moves. The connection breaks.' });
  await expect(example.getByRole('article')).toHaveCount(3);
  await expect(example.getByRole('tab')).toHaveCount(0);
  await expect(example.locator('details, pre:visible')).toHaveCount(0);
  await expect(example.getByRole('button', { name: /^View result:/ })).toHaveCount(3);
  await expect(example.getByRole('article', { name: '1. Connected' })).toContainText('Path found');
  const broken = example.getByRole('article', { name: '2. File moved' });
  await expect(broken).toContainText('1 broken reference');
  await expect(broken.getByRole('group', { name: 'Referenced location' })).toContainText(
    'src/refund-policy.ts',
  );
  await expect(broken.getByRole('group', { name: 'Referenced location' })).toContainText('Missing');
  await expect(broken.getByRole('group', { name: 'New file location' })).toContainText(
    'src/payments/refund-policy.ts',
  );
  await expect(example.getByRole('article', { name: '3. Reference updated' })).toContainText(
    'Check passes',
  );
  await expect(example).not.toContainText('Core diagnostic:');
  await expect(example).toContainText('not program behavior');
  await expect(example).toContainText('A developer makes the repair.');
  const preview = page.getByRole('figure', { name: 'Repository check preview' });
  await expect(preview).toContainText('1 broken reference');
  await expect(preview).not.toContainText('src/refund-policy.ts');
});

for (const width of [320, 360, 768, 1024, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`shows the static file sequence at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto(homepage);
      const example = page.getByRole('region', { name: 'A file moves. The connection breaks.' });
      const header = example.locator(':scope > header');
      const titleBounds = await header.getByRole('heading', { level: 2 }).boundingBox();
      const descriptionBounds = await header.locator(':scope > p').boundingBox();
      if (width >= 1024) {
        expect(descriptionBounds!.x).toBeGreaterThan(titleBounds!.x + titleBounds!.width);
        expect(
          Math.abs(
            descriptionBounds!.y + descriptionBounds!.height - titleBounds!.y - titleBounds!.height,
          ),
        ).toBeLessThan(1);
      } else {
        expect(descriptionBounds!.y).toBeGreaterThan(titleBounds!.y + titleBounds!.height);
      }
      const frames = example.getByRole('article');
      for (const frame of await frames.all()) await expect(frame).toBeVisible();
      for (const frame of await frames.all()) {
        const header = frame.locator(':scope > header');
        const trigger = header.getByRole('button', { name: /^View result:/ });
        const titleBounds = await header.getByRole('heading', { level: 3 }).boundingBox();
        const triggerBounds = await trigger.boundingBox();
        expect(triggerBounds!.height).toBe(32);
        expect(triggerBounds!.x).toBeGreaterThan(titleBounds!.x + titleBounds!.width);
        expect(
          Math.abs(
            triggerBounds!.y +
              triggerBounds!.height / 2 -
              (titleBounds!.y + titleBounds!.height / 2),
          ),
        ).toBeLessThan(1);
      }
      const bounds = await frames.evaluateAll((elements) =>
        elements.map((element) => {
          const { top, left, height } = element.getBoundingClientRect();
          return { top: Math.round(top), left: Math.round(left), height };
        }),
      );
      if (width >= 1024) {
        expect(new Set(bounds.map(({ top }) => top)).size).toBe(1);
        await page.getByRole('link', { name: 'See how it works', exact: true }).click();
        for (const frame of await frames.all()) await expect(frame).toBeInViewport({ ratio: 1 });
      } else {
        expect(new Set(bounds.map(({ left }) => left)).size).toBe(1);
        expect(bounds[0].top).toBeLessThan(bounds[1].top);
        expect(bounds[1].top).toBeLessThan(bounds[2].top);
      }
      const widths = await page.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(widths.scroll).toBeLessThanOrEqual(widths.client);
      if (width === 320 || width === 1440) {
        const results = await new AxeBuilder({ page }).include('#how-it-works').analyze();
        expect(
          results.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical'),
        ).toStrictEqual([]);
      }
    });
  }
}

test('keeps every frame readable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 740 },
  });
  const page = await context.newPage();
  try {
    await page.goto(homepage);
    const example = page.getByRole('region', { name: 'A file moves. The connection breaks.' });
    for (const name of ['1. Connected', '2. File moved', '3. Reference updated']) {
      await expect(example.getByRole('article', { name, exact: true })).toBeVisible();
    }
    await expect(
      example
        .getByRole('group', { name: 'Check outcome', exact: true })
        .getByText('1 broken reference', { exact: true }),
    ).toBeVisible();
    await expect(example.locator('details, [role="tab"]')).toHaveCount(0);
    await expect(example.getByRole('button', { name: /^View result:/ })).toHaveCount(0);
    const preview = page.getByRole('figure', { name: 'Repository check preview' });
    await expect(preview).toBeVisible();
    await expect(preview.getByRole('group', { name: 'Instruction content' })).toContainText(
      'Use get_delivery_status to answer delivery questions.',
    );
    await expect(preview.getByRole('group', { name: 'Missing tool implementation' })).toContainText(
      'src/orders/tracking.ts',
    );
    await expect(preview.getByRole('group', { name: 'Check outcome', exact: true })).toContainText(
      '1 broken reference',
    );
    await expect(preview.getByRole('button', { name: /^View result:/ })).toHaveCount(0);
  } finally {
    await context.close();
  }
});

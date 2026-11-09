import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { DEFAULT_BASE_PATH, withBase } from '@moldea.ai/website-ui/site';

const basePath = process.env.BASE_PATH ?? DEFAULT_BASE_PATH;
const previews = [
  {
    route: '/#workflow-video',
    id: 'home-context-alignment-video',
    title: 'moldea | Keeping project context and code aligned',
    triggerLabel: 'Watch the workflow',
    cover: 'context-alignment',
    videoId: 'PyZiQXWS1ZE',
  },
  {
    route: '/getting-started/',
    id: 'skill-installation-video',
    title: 'moldea | Install and use the skill',
    triggerLabel: 'Watch installation walkthrough',
    cover: 'skill-installation',
    videoId: 'dwl_RFm95Tg',
  },
  {
    route: '/getting-started/#context-video',
    id: 'context-alignment-video',
    title: 'moldea | Keeping project context and code aligned',
    triggerLabel: 'Watch context-alignment workflow',
    cover: 'context-alignment',
    videoId: 'PyZiQXWS1ZE',
  },
] as const;

for (const preview of previews) {
  test.describe(preview.route, () => {
    for (const width of [320, 1440]) {
      for (const colorScheme of ['light', 'dark'] as const) {
        test(`opens the visible cover at ${width}px in ${colorScheme} and restores its trigger`, async ({
          page,
        }) => {
          const requests: string[] = [];
          const pageErrors: string[] = [];
          const consoleErrors: string[] = [];
          page.on('pageerror', (error) => pageErrors.push(error.message));
          page.on('console', (message) => {
            if (message.type() === 'error') consoleErrors.push(message.text());
          });
          await page.route('https://www.youtube-nocookie.com/embed/**', async (route) => {
            requests.push(route.request().url());
            await route.fulfill({
              contentType: 'text/html',
              body: '<!doctype html><html lang="en"><head><title>Video player</title></head><body><main>Video player</main></body></html>',
            });
          });
          await page.setViewportSize({ width, height: 900 });
          await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
          await page.goto(withBase(preview.route, basePath));
          const card = page.locator(`[data-video-preview="${preview.id}"]`);
          const cover = card.locator('img').filter({ visible: true });
          const trigger = card.getByRole('button', { name: preview.triggerLabel, exact: true });
          const dialog = page.getByRole('dialog', { name: preview.title, exact: true });
          const player = dialog.getByTitle(preview.title, { exact: true });
          await expect(cover).toHaveCount(1);
          await expect(cover).toHaveAttribute('src', new RegExp(preview.cover, 'u'));
          await expect(cover).toHaveAttribute(
            'loading',
            preview.route === '/getting-started/' ? 'eager' : 'lazy',
          );
          if (preview.route.includes('#')) {
            await expect
              .poll(() =>
                cover.evaluate((image) => {
                  const bounds = image.getBoundingClientRect();
                  const header = image.ownerDocument.querySelector('header');
                  const headerBottom = header?.getBoundingClientRect().bottom ?? 0;
                  return bounds.top >= headerBottom && bounds.bottom <= window.innerHeight;
                }),
              )
              .toBe(true);
          }
          await cover.scrollIntoViewIfNeeded();
          await expect
            .poll(() =>
              cover.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
            )
            .toBe(true);
          await expect(card.getByRole('link', { name: /Watch on YouTube/u })).toHaveCount(0);
          await expect(player).toHaveCount(0);
          expect(requests).toStrictEqual([]);
          const unfocusedShadow = await card.evaluate((node) => getComputedStyle(node).boxShadow);
          await page.keyboard.press('Tab');
          await trigger.focus();
          await expect(trigger).toBeFocused();
          await expect(card).not.toHaveCSS('box-shadow', unfocusedShadow);
          const bounds = (await cover.boundingBox())!;
          // the shared trigger's hit area covers the image, not only its visible label
          await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
          await expect(dialog).toBeVisible();
          await expect(
            dialog.getByRole('button', { name: 'Close dialog', exact: true }),
          ).toBeFocused();
          const play = dialog.getByRole('button', { name: `Play ${preview.title}`, exact: true });
          await expect(play).toBeVisible();
          await expect(player).toHaveCount(0);
          expect(requests).toStrictEqual([]);
          await play.focus();
          await play.press('Enter');
          await expect(player).toHaveAttribute(
            'src',
            `https://www.youtube-nocookie.com/embed/${preview.videoId}?autoplay=1`,
          );
          await expect.poll(() => requests.length).toBe(1);
          await expect(dialog).toBeFocused();
          await page.keyboard.press('Escape');
          await expect(dialog).toBeHidden();
          await expect(player).toHaveCount(0);
          await expect(trigger).toBeFocused();
          await trigger.press('Enter');
          await expect(play).toBeVisible();
          await expect(player).toHaveCount(0);
          await page.keyboard.press('Escape');
          await expect(dialog).toBeHidden();
          await expect(trigger).toBeFocused();
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
            ),
          ).toBe(true);
          const accessibility = await new AxeBuilder({ page })
            .include(`[data-video-preview="${preview.id}"]`)
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
            .analyze();
          expect(accessibility.violations).toStrictEqual([]);
          expect(pageErrors).toStrictEqual([]);
          expect(consoleErrors).toStrictEqual([]);
        });
      }
    }

    test.describe('without JavaScript', () => {
      test.use({ javaScriptEnabled: false });

      test('shows the cover and a usable YouTube fallback', async ({ page }) => {
        await page.goto(withBase(preview.route, basePath));
        const card = page.locator(`[data-video-preview="${preview.id}"]`);
        await expect(card.locator('img').filter({ visible: true })).toHaveCount(1);
        await expect(card.getByRole('button')).toHaveCount(0);
        await expect(card.getByRole('link', { name: /Watch on YouTube/u })).toHaveAttribute(
          'href',
          `https://www.youtube.com/watch?v=${preview.videoId}`,
        );
      });
    });
  });
}

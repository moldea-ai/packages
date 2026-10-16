import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { DEFAULT_BASE_PATH, withBase } from '@moldea.ai/website-ui/site';

const basePath = process.env.BASE_PATH ?? DEFAULT_BASE_PATH;

// Astro's underscore prefix excludes this colocated browser test from page discovery.
for (const width of [320, 768, 1440]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`package examples and navigation at ${width}px in ${colorScheme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto(withBase('/packages/', basePath));
      const sections = page.locator('[data-package-showcase]');
      await expect(sections).toHaveCount(4);
      for (const slug of ['cli', 'core', 'repository', 'repository-fs']) {
        await page
          .getByRole('navigation', { name: 'Choose a package' })
          .getByRole('link', { name: slug, exact: true })
          .click();
        const section = page.locator(`#${slug}`);
        await expect(section).toBeInViewport();
        const code = section.getByRole('region', {
          name: `@moldea.ai/${slug} ${slug === 'repository-fs' ? 'usage excerpt' : 'example'}`,
          exact: true,
        });
        await expect(code.locator('[style*="--shiki"]')).not.toHaveCount(0);
        if (slug === 'repository') {
          await expect(
            section.getByRole('list', { name: 'Changed repository paths' }),
          ).toContainText('return-policy.md');
          await expect(code).toContainText('listChangesPage');
        } else if (slug === 'repository-fs') {
          const selection = section.getByRole('group', {
            name: 'Select the files your inspection can read execution facts',
          });
          // repository paths display without their leading slash
          await expect(selection).toContainText('node_modules/left-pad/index.js');
          await expect(selection).not.toContainText('/node_modules/left-pad/index.js');
          await expect(code).toContainText('/moldea/moldea.yaml');
          await expect(section).toContainText(
            'Output also lists parent directories and byte lengths.',
          );
        } else if (slug === 'cli') {
          await expect(section.locator('[data-inspection-outcome]').first()).toContainText(
            'Blocking',
          );
          await expect(section.locator('svg.lucide-link-2').first()).toBeVisible();
          // a local CLI run is not a pull request, so its title has no leading icon
          await expect(section.locator('.example-card-header svg')).toHaveCount(0);
        }
        if (slug === 'cli' && width >= 1024) {
          const columns = await section
            .locator(':scope > div > div')
            .evaluateAll((elements) =>
              elements.map((element) => element.getBoundingClientRect().top),
            );
          expect(columns[0]).toBeCloseTo(columns[1], 0);
        }
        const trigger = section.locator('[data-dialog-open]').first();
        await trigger.focus();
        await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        if (slug === 'repository-fs') {
          const output: unknown = JSON.parse(
            await dialog.locator('[data-inspection-output] pre').innerText(),
          );
          expect(output).toMatchObject({
            explicit: expect.arrayContaining([
              {
                path: '/moldea',
                type: 'directory',
                byteLength: null,
              },
            ]),
            directory: expect.arrayContaining([
              {
                path: '/dist/bundle.js',
                type: 'file',
                byteLength: 13,
              },
            ]),
          });
          await expect(dialog).toContainText(
            'Execution facts omit opaque snapshot and content identities and cursor values.',
          );
        }
        const bounds = await dialog.boundingBox();
        expect(bounds!.width).toBe(width < 640 ? width : Math.min(width - 32, 672));
        await page.keyboard.press('Escape');
        await expect(trigger).toBeFocused();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toStrictEqual(
        [],
      );
    });
  }
}

test('package examples and guide links work without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 900 },
  });
  try {
    const page = await context.newPage();
    await page.goto(withBase('/packages/', basePath));
    await expect(page.locator('[data-package-showcase]')).toHaveCount(4);
    await page.getByRole('link', { name: 'Not sure where to start? Read the guide.' }).click();
    await expect(page).toHaveURL(new RegExp(`${withBase('/getting-started/', basePath)}$`));
  } finally {
    await context.close();
  }
});

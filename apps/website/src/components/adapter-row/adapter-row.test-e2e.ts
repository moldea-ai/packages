import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import tailwindcss from '@tailwindcss/vite';
import { build } from 'astro';
import { DEFAULT_BASE_PATH, withBase } from '@moldea.ai/website-ui/site';

import { loadWebsiteModel } from '../../lib/generation/generation.ts';

const basePath = process.env.BASE_PATH ?? DEFAULT_BASE_PATH;
const directoryPath = withBase('/adapters/', basePath);

test('renders every maturity with real components, distinct tones, and readable state labels', async ({
  page,
}) => {
  // compile synthetic statuses separately so the published compatibility claims stay untouched
  const appDirectory = fileURLToPath(new URL('../../../', import.meta.url));
  const fixtureDirectory = mkdtempSync(join(appDirectory, '.adapter-row-'));
  const sourceDirectory = join(fixtureDirectory, 'src');
  const pagesDirectory = join(sourceDirectory, 'pages');
  const sourceImport = (directory: string, source: string): string =>
    relative(directory, join(appDirectory, source)).split(sep).join('/');
  const model = loadWebsiteModel();
  const adapter = model.adapters.find(({ id }) => id === 'custom')!;
  const copy = model.discoveryCopy.adapters.custom;
  try {
    mkdirSync(pagesDirectory, { recursive: true });
    writeFileSync(
      join(sourceDirectory, 'styles.css'),
      [
        "@import '@moldea.ai/website-ui/styles.css';",
        `@source ${JSON.stringify(sourceImport(sourceDirectory, 'src/components/adapter-row/adapter-row.astro'))};`,
        `@source ${JSON.stringify(sourceImport(sourceDirectory, 'src/components/adapter-details.astro'))};`,
      ].join('\n'),
    );
    writeFileSync(
      join(pagesDirectory, 'index.astro'),
      [
        '---',
        `import AdapterRow from ${JSON.stringify(sourceImport(pagesDirectory, 'src/components/adapter-row/adapter-row.astro'))};`,
        `import AdapterDetails from ${JSON.stringify(sourceImport(pagesDirectory, 'src/components/adapter-details.astro'))};`,
        "import '../styles.css';",
        `const adapter = ${JSON.stringify(adapter)};`,
        `const copy = ${JSON.stringify(copy)};`,
        "const maturities = ['supported', 'experimental', 'deprecated'];",
        '---',
        '<html lang="en"><head><title>Adapter maturity fixture</title></head><body><main class="page-shell py-4"><h1>Adapter maturity</h1>',
        '{maturities.map((maturity) => {',
        'const id = `${adapter.entry.targets[0].id}-${maturity}`;',
        'const target = { ...adapter.entry.targets[0], id, maturity };',
        'const fixture = { ...adapter, entry: { ...adapter.entry, targets: [target] } };',
        'const fixtureCopy = { ...copy, targets: { [id]: `${maturity} target` } };',
        'return <section aria-label={maturity}><AdapterRow adapter={fixture} copy={fixtureCopy} /><AdapterDetails adapter={fixture} copy={fixtureCopy} compact /></section>;',
        '})}',
        '</main></body></html>',
      ].join('\n'),
    );
    await build({
      root: fixtureDirectory,
      configFile: false,
      base: basePath,
      logLevel: 'silent',
      build: { inlineStylesheets: 'always' },
      vite: { plugins: [tailwindcss()] },
    });
    const html = readFileSync(join(fixtureDirectory, 'dist', 'index.html'), 'utf8');
    for (const width of [320, 1440]) {
      for (const theme of ['light', 'dark'] as const) {
        await page.setViewportSize({ width, height: 900 });
        await page.setContent(html);
        await page.locator('html').evaluate((root, activeTheme) => {
          root.classList.remove('light', 'dark');
          root.classList.add(activeTheme);
        }, theme);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const backgrounds: string[] = [];
        for (const maturity of ['supported', 'experimental', 'deprecated']) {
          const section = page.getByRole('region', { name: maturity, exact: true });
          const link = section.getByRole('link', {
            name: `${maturity} target, custom-${maturity}, ${maturity}`,
            exact: true,
          });
          await expect(
            section
              .getByRole('heading', { level: 2 })
              .locator('..')
              .getByText(maturity, { exact: true }),
          ).toBeVisible();
          if (maturity !== 'supported')
            await expect(link.getByText(maturity, { exact: true })).toBeVisible();
          const background = await link.evaluate(
            (element) => getComputedStyle(element).backgroundColor,
          );
          backgrounds.push(background);
          await link.hover();
          await expect(link).toHaveCSS('opacity', '1');
          await expect(link).not.toHaveCSS('background-color', background);
          const hoverBackground = await link.evaluate(
            (element) => getComputedStyle(element).backgroundColor,
          );
          await page.mouse.down();
          await expect(link).toHaveCSS('opacity', '1');
          await expect(link).not.toHaveCSS('background-color', hoverBackground);
          const accessibility = await new AxeBuilder({ page })
            .include(`section[aria-label="${maturity}"]`)
            .analyze();
          expect(
            accessibility.violations.filter(
              ({ impact }) => impact === 'critical' || impact === 'serious',
            ),
          ).toStrictEqual([]);
          await page.mouse.move(0, 0);
          await page.mouse.up();
        }
        expect(new Set(backgrounds).size).toBe(3);
        const widths = await page.evaluate(() => ({
          client: document.documentElement.clientWidth,
          scroll: document.documentElement.scrollWidth,
        }));
        expect(widths.scroll).toBeLessThanOrEqual(widths.client);
      }
    }
  } finally {
    rmSync(fixtureDirectory, { recursive: true, force: true });
  }
});

test('preserves every runtime and target once without repeating full adapter details', async ({
  page,
}) => {
  await page.goto(directoryPath);
  const directory = page.getByRole('list', { name: 'Available adapters', exact: true });
  const model = loadWebsiteModel();
  const available = model.adapters.filter(
    ({ entry }) => entry.implementationStatus === 'available',
  );
  await expect(directory.getByRole('article')).toHaveCount(available.length);
  for (const adapter of available) {
    const copy = model.discoveryCopy.adapters[adapter.id];
    const row = directory.getByRole('article', { name: copy.name, exact: true });
    await expect(row.getByRole('heading').getByRole('link')).toHaveAttribute(
      'href',
      withBase(adapter.route, basePath),
    );
    await expect(row).not.toContainText(copy.description);
    const targets = row.getByRole('list', { name: `${copy.name} inspection targets` });
    await expect(targets.getByRole('link')).toHaveCount(adapter.entry.targets?.length ?? 0);
    for (const target of adapter.entry.targets ?? []) {
      const link = targets.getByRole('link', {
        name: `${copy.targets[target.id]}, ${target.id}, ${target.maturity}`,
        exact: true,
      });
      await expect(link).toHaveAttribute(
        'href',
        `${withBase(adapter.route, basePath)}#${adapter.id}-${target.id}`,
      );
      if (target.maturity !== 'supported') await expect(link).toContainText(target.maturity);
    }
  }
  await expect(page.locator('main details, main table')).toHaveCount(0);
  await expect(page.locator('main')).toContainText(
    'Targets are supported within their published scope unless marked otherwise.',
  );
  await expect(page.locator('main')).toContainText('as the machine-readable compatibility JSON');
  await expect(page.getByRole('region', { name: 'Target maturity', exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'machine-readable compatibility JSON' }),
  ).toHaveAttribute('href', withBase('/compatibility/runtimes.json', basePath));
  await expect(
    page.locator('header, footer').getByRole('link', { name: 'Compatibility', exact: true }),
  ).toHaveCount(0);
});

for (const width of [320, 360, 768, 1024, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`keeps runtime rows readable and keyboard-accessible at ${width}px in ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto(directoryPath);
      if (width >= 1024) {
        const rows = await page
          .getByRole('list', { name: 'Available adapters', exact: true })
          .getByRole('article')
          .evaluateAll((elements) =>
            elements.map((element) => element.getBoundingClientRect().height),
          );
        for (const height of rows) expect(height).toBeLessThanOrEqual(80);
      }
      const target = page.getByRole('link', {
        name: 'Create agent, typescript-create-agent-1-5, supported',
        exact: true,
      });
      const unfocusedShadow = await target.evaluate(
        (element) => getComputedStyle(element).boxShadow,
      );
      const padding = await target.evaluate((element) => ({
        left: parseFloat(getComputedStyle(element).paddingLeft),
        right: parseFloat(getComputedStyle(element).paddingRight),
      }));
      expect(padding.left).toBeGreaterThanOrEqual(12);
      expect(padding.right).toBeGreaterThanOrEqual(12);
      await page
        .getByRole('article', { name: 'LangChain', exact: true })
        .getByRole('heading')
        .getByRole('link')
        .focus();
      await page.keyboard.press('Tab');
      await expect(target).toBeFocused();
      expect(await target.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
      expect(await target.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe(
        unfocusedShadow,
      );
      const widths = await page.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(widths.scroll).toBeLessThanOrEqual(widths.client);
      if (width === 320 || width === 1440) {
        const results = await new AxeBuilder({ page }).analyze();
        expect(
          results.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical'),
        ).toStrictEqual([]);
      }
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(
        new RegExp(
          `${withBase('/adapters/langchain/', basePath)}#langchain-typescript-create-agent-1-5$`,
        ),
      );
      await expect(
        page.getByRole('heading', { level: 2, name: 'Create agent', exact: true }),
      ).toBeVisible();
      await expect(page.locator('main')).toContainText('typescript-create-agent-1-5');
    });
  }
}

test('redirects the retired compatibility page and keeps target navigation usable without JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 740 },
  });
  const page = await context.newPage();
  try {
    await page.goto(withBase('/compatibility/', basePath));
    await expect(page).toHaveURL(new RegExp(`${directoryPath}$`));
    const target = page.getByRole('link', {
      name: 'Custom runtime declarations, custom, supported',
      exact: true,
    });
    await target.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(
      new RegExp(`${withBase('/adapters/custom/', basePath)}#custom-custom$`),
    );
    await expect(
      page.getByRole('link', { name: 'View qualification evidence for custom target custom' }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});

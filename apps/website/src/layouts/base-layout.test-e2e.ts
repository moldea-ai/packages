// @vitest-environment node
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { DEFAULT_BASE_PATH, normalizeBasePath, withBase } from '@moldea.ai/website-ui/site';

import { DEFAULT_SITE_URL, SITE_NAME, SOCIAL_IMAGE_ALT } from '../lib/site/constants.ts';

const siteUrl = process.env.SITE_URL ?? DEFAULT_SITE_URL;
const basePath = normalizeBasePath(process.env.BASE_PATH ?? DEFAULT_BASE_PATH);
const toPublicPath = (route: string): string => withBase(route, basePath);
const normalizeClipboardLineEndings = (text: string): string => text.replaceAll('\r\n', '\n');

for (const width of [320, 375, 768, 1024, 1100, 1279, 1280, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`keeps navigation labels and actions usable at ${width}px in ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(toPublicPath('/repository-format/'));
      const header = page.getByRole('banner');
      if (width < 1024) await header.getByLabel('Open navigation', { exact: true }).click();
      const navigation = header.getByRole('navigation', {
        name: width < 1024 ? 'Mobile navigation' : 'Primary navigation',
        exact: true,
      });
      const format = navigation.getByRole('link', { name: 'Repository Format', exact: true });
      await expect(format).toHaveAttribute('aria-current', 'page');
      await expect(format).toHaveAttribute('href', toPublicPath('/repository-format/'));
      const visibleLabel = width >= 1024 && width < 1280 ? 'Repo. Format' : 'Repository Format';
      expect(await format.innerText()).toBe(visibleLabel);
      await format.focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      await expect(format).toBeFocused();
      await expect(format).not.toHaveCSS('box-shadow', 'none');
      await expect(header.getByRole('button', { name: /Use (light|dark) theme/u })).toBeVisible();
      const linkRects = await navigation.getByRole('link').evaluateAll((links) =>
        links.map((link) => {
          const rect = link.getBoundingClientRect();
          return { x: rect.x, right: rect.right, y: rect.y, height: rect.height };
        }),
      );
      for (const rect of linkRects) {
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.right).toBeLessThanOrEqual(width);
      }
      if (width >= 1024) {
        expect(new Set(linkRects.map(({ y }) => y)).size).toBe(1);
        expect(new Set(linkRects.map(({ height }) => height)).size).toBe(1);
        const brand = await header
          .getByRole('link', { name: 'moldea packages home' })
          .boundingBox();
        const search = await header
          .getByRole('link', { name: 'Search documentation' })
          .boundingBox();
        expect(brand!.x + brand!.width).toBeLessThan(linkRects[0].x);
        expect(linkRects.at(-1)!.right).toBeLessThan(search!.x);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
    });
  }
}

for (const width of [320, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`keeps brand links background-free at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(toPublicPath('/'));

      const logos = page.getByRole('link', { name: 'moldea packages home', exact: true });
      await expect(logos).toHaveCount(2);

      for (const logo of await logos.all()) {
        await expect(logo).toHaveAttribute('href', toPublicPath('/'));
        await expect(logo).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
        await logo.hover();
        await expect(logo).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
        await page.mouse.down();
        await expect(logo).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
        await page.mouse.move(0, 0);
        await page.mouse.up();

        await logo.focus();
        await page.keyboard.press('Tab');
        await page.keyboard.press('Shift+Tab');
        await expect(logo).toBeFocused();
        expect(await logo.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
        await expect(logo).not.toHaveCSS('box-shadow', 'none');
        await expect(logo).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      }
    });

    test(`matches platform interaction roles at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto(toPublicPath('/adapters/'));
      const target = page.getByRole('link', {
        name: 'Create agent, typescript-create-agent-1-5, supported',
        exact: true,
      });
      const textLink = page.getByRole('link', {
        name: 'machine-readable compatibility JSON',
        exact: true,
      });
      const footerLink = page
        .getByRole('contentinfo')
        .getByRole('link', { name: 'Get started', exact: true });
      // resolve the platform's semantic state colors through the active Website UI theme
      const platformColors = await page.evaluate((activeTheme) => {
        const probe = document.createElement('span');
        probe.style.transitionProperty = 'none';
        document.body.append(probe);
        const resolveColor = (color: string): string => {
          probe.style.color = color;
          return getComputedStyle(probe).color;
        };
        const colors = {
          prose: resolveColor(
            activeTheme === 'dark' ? 'var(--primary-foreground)' : 'var(--primary)',
          ),
          navigationHover: resolveColor('var(--secondary)'),
          navigationPressed: resolveColor('color-mix(in oklab, var(--secondary) 80%, transparent)'),
          navigationSelected: resolveColor(
            `color-mix(in oklab, var(--secondary) ${activeTheme === 'dark' ? 50 : 70}%, transparent)`,
          ),
        };
        probe.remove();
        return colors;
      }, theme);
      await expect(textLink).toHaveCSS('text-decoration-line', 'underline');
      await expect(textLink).toHaveCSS('color', platformColors.prose);
      await expect(footerLink).toHaveCSS('text-decoration-line', 'none');
      const foreground = await page
        .locator('body')
        .evaluate((body) => getComputedStyle(body).color);
      for (const link of [target, textLink, footerLink]) {
        await page.mouse.move(0, 0);
        const restingBackground = await link.evaluate(
          (element) => getComputedStyle(element).backgroundColor,
        );
        await link.hover();
        await expect(link).toHaveCSS('opacity', link === textLink ? '0.7' : '1');
        if (link === textLink) await expect(link).toHaveCSS('color', platformColors.prose);
        if (link === target) {
          await expect(link).not.toHaveCSS('background-color', restingBackground);
        } else {
          await expect(link).toHaveCSS('background-color', restingBackground);
        }
        if (link === footerLink) await expect(link).toHaveCSS('color', foreground);
        const hoverBackground = await link.evaluate(
          (element) => getComputedStyle(element).backgroundColor,
        );
        await page.mouse.down();
        await expect(link).toHaveCSS('opacity', link === textLink ? '0.6' : '1');
        if (link === target) {
          await expect(link).not.toHaveCSS('background-color', hoverBackground);
        } else {
          await expect(link).toHaveCSS('background-color', restingBackground);
        }
        await expect(link).toHaveCSS('translate', 'none');
        const accessibility = await new AxeBuilder({ page })
          .include(link === footerLink ? 'footer' : 'main')
          .analyze();
        expect(
          accessibility.violations.filter(
            ({ impact }) => impact === 'critical' || impact === 'serious',
          ),
        ).toStrictEqual([]);
        await page.mouse.move(0, 0);
        await page.mouse.up();
        await expect(link).toHaveCSS('opacity', '1');
        expect(
          await link.evaluate((element) =>
            parseFloat(getComputedStyle(element).transitionDuration),
          ),
        ).toBeLessThanOrEqual(0.00001);
        await link.focus();
        await page.keyboard.press('Tab');
        await page.keyboard.press('Shift+Tab');
        await expect(link).toBeFocused();
        expect(await link.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
        await expect(link).not.toHaveCSS('box-shadow', 'none');
      }

      if (width < 1024) await page.getByLabel('Open navigation', { exact: true }).click();
      const navigation = page.getByRole('navigation', {
        name: width < 1024 ? 'Mobile navigation' : 'Primary navigation',
        exact: true,
      });
      const current = navigation.getByRole('link', { name: 'Adapters', exact: true });
      const inactive = navigation.getByRole('link', { name: 'Packages', exact: true });
      await expect(current).toHaveAttribute('aria-current', 'page');
      await expect(current).toHaveCSS('background-color', platformColors.navigationSelected);
      const selectedBackground = await current.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      );
      await current.hover();
      await expect(current).toHaveCSS('background-color', selectedBackground);
      await expect(current).toHaveCSS('opacity', '1');
      await inactive.hover();
      await expect(inactive).toHaveCSS('color', foreground);
      await expect(inactive).toHaveCSS('background-color', platformColors.navigationHover);
      const hoverBackground = await inactive.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      );
      await page.mouse.down();
      await expect(inactive).not.toHaveCSS('background-color', hoverBackground);
      await expect(inactive).toHaveCSS('background-color', platformColors.navigationPressed);
      await expect(inactive).toHaveCSS('opacity', '1');
      await page.mouse.move(0, 0);
      await page.mouse.up();
    });
  }
}

const REPRESENTATIVE_PATHS = [
  '/',
  '/getting-started/',
  '/capabilities/',
  '/packages/',
  '/packages/core/',
  '/packages/core/api/',
  '/packages/core/diagnostics/',
  '/adapters/',
  '/adapters/openai/',
  '/adapters/openai/api/',
  '/repository-format/',
  '/search/',
] as const;

// reserve visible scrollbar space only for the width regression's browser
const scrollbarTest = test.extend({
  launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] },
});

/** Converts an OKLCH token to clipped linear-sRGB relative luminance. */
const calculateRelativeLuminance = (color: string): number => {
  const match = /^oklch\(\s*([\d.]+)(%)?\s+([\d.]+)\s+([\d.]+)(?:deg)?(?:\s*\/[^)]+)?\s*\)$/u.exec(
    color.trim(),
  );

  if (match === null) {
    throw new Error(`Expected an OKLCH color token, received: ${color}`);
  }

  const lightness = Number(match[1]) / (match[2] === '%' ? 100 : 1);
  const chroma = Number(match[3]);
  const hue = (Number(match[4]) * Math.PI) / 180;
  const labA = chroma * Math.cos(hue);
  const labB = chroma * Math.sin(hue);
  const lPrime = lightness + 0.3963377774 * labA + 0.2158037573 * labB;
  const mPrime = lightness - 0.1055613458 * labA - 0.0638541728 * labB;
  const sPrime = lightness - 0.0894841775 * labA - 1.291485548 * labB;
  const lValue = lPrime ** 3;
  const mValue = mPrime ** 3;
  const sValue = sPrime ** 3;
  const clampChannel = (channel: number): number => Math.min(1, Math.max(0, channel));
  const red = clampChannel(4.0767416621 * lValue - 3.3077115913 * mValue + 0.2309699292 * sValue);
  const green = clampChannel(
    -1.2684380046 * lValue + 2.6097574011 * mValue - 0.3413193965 * sValue,
  );
  const blue = clampChannel(-0.0041960863 * lValue - 0.7034186147 * mValue + 1.707614701 * sValue);

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

/** Calculates the WCAG contrast ratio between two OKLCH color tokens. */
const calculateContrastRatio = (firstColor: string, secondColor: string): number => {
  const firstLuminance = calculateRelativeLuminance(firstColor);
  const secondLuminance = calculateRelativeLuminance(secondColor);
  const lighterLuminance = Math.max(firstLuminance, secondLuminance);
  const darkerLuminance = Math.min(firstLuminance, secondLuminance);

  return (lighterLuminance + 0.05) / (darkerLuminance + 0.05);
};

test('keeps multiline shared titles legible with Ubuntu Sans', async ({ page }) => {
  await page.setViewportSize({ height: 800, width: 1024 });
  await page.goto(toPublicPath('/'));

  const displayTitleTypography = await page
    .getByRole('heading', { level: 1 })
    .evaluate((element) => {
      const computedStyle = getComputedStyle(element);

      return {
        blockHeight: element.getBoundingClientRect().height,
        fontSize: Number.parseFloat(computedStyle.fontSize),
        lineHeight: Number.parseFloat(computedStyle.lineHeight),
      };
    });
  const sectionTitleTypography = await page
    .getByRole('heading', {
      level: 2,
      name: 'A file moves. The connection breaks.',
    })
    .evaluate((element) => {
      const computedStyle = getComputedStyle(element);

      return {
        blockHeight: element.getBoundingClientRect().height,
        fontSize: Number.parseFloat(computedStyle.fontSize),
        lineHeight: Number.parseFloat(computedStyle.lineHeight),
      };
    });

  expect(displayTitleTypography.blockHeight).toBeGreaterThan(displayTitleTypography.lineHeight);
  expect(displayTitleTypography.lineHeight).toBeGreaterThan(displayTitleTypography.fontSize);
  expect(sectionTitleTypography.blockHeight).toBeGreaterThan(sectionTitleTypography.lineHeight);
  expect(sectionTitleTypography.lineHeight).toBeGreaterThan(sectionTitleTypography.fontSize);
});

test('publishes unique canonical, social, and structured search metadata', async ({ page }) => {
  const homeUrl = new URL(toPublicPath('/'), siteUrl).href;

  await page.goto(toPublicPath('/'));
  await expect(page).toHaveTitle(`Keep agent instructions and code connected · ${SITE_NAME}`);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', homeUrl);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', homeUrl);
  await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
    'content',
    SOCIAL_IMAGE_ALT,
  );
  await expect(page.locator('meta[name="twitter:image:alt"]')).toHaveAttribute(
    'content',
    SOCIAL_IMAGE_ALT,
  );

  const homeStructuredData = page.locator('script[type="application/ld+json"]');

  if (basePath === '/') {
    const source = await homeStructuredData.textContent();

    expect(source).not.toBeNull();
    expect(JSON.parse(source ?? '')).toStrictEqual({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      alternateName: 'packages.moldea.ai',
      url: homeUrl,
    });
  } else {
    await expect(homeStructuredData).toHaveCount(0);
  }

  const limitationsRoute = '/adapters/openai/limitations/';
  const limitationsUrl = new URL(toPublicPath(limitationsRoute), siteUrl).href;

  await page.goto(toPublicPath(limitationsRoute));
  await expect(page).toHaveTitle(
    'Boundaries and limitations · @moldea.ai/adapter-openai · moldea packages',
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    /^@moldea\.ai\/adapter-openai: /u,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', limitationsUrl);

  const breadcrumbSource = await page.locator('script[type="application/ld+json"]').textContent();
  const breadcrumbStructuredData = JSON.parse(breadcrumbSource ?? '') as {
    '@type': string;
    itemListElement: Array<{ item?: string; name: string; position: number }>;
  };

  expect(breadcrumbStructuredData['@type']).toBe('BreadcrumbList');
  expect(breadcrumbStructuredData.itemListElement[0]).toStrictEqual({
    '@type': 'ListItem',
    position: 1,
    name: 'Home',
    item: homeUrl,
  });
});

test('renders standalone moldea references as inline code in visible prose', async ({ page }) => {
  await page.goto(toPublicPath('/'));

  const heroCopy = page
    .locator('main p')
    .filter({ hasText: 'Want help adopting moldea in your coding agent?' });
  const heroBrandName = heroCopy.locator('code');

  await expect(heroBrandName).toHaveText('moldea');
  await expect(heroCopy).toContainText('Want help adopting moldea in your coding agent?');

  await page.goto(toPublicPath('/packages/core/'));

  const description = page.locator('article > header > p').first();

  await expect(description.locator('code')).toHaveText('moldea');
  await expect(description).toContainText('composition for moldea repositories.');
});

test('formats the brand in homepage copy and the guide heading without changing its text', async ({
  page,
}) => {
  for (const route of ['/', '/getting-started/']) {
    await page.goto(toPublicPath(route));
    const unformatted = await page.locator('main').evaluate((main) => {
      const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
      const matches: string[] = [];
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (
          /\bmoldea\b/iu.test(node.textContent ?? '') &&
          !node.parentElement?.closest('code, pre, script, style')
        ) {
          matches.push(node.textContent ?? '');
        }
      }
      return matches;
    });
    expect(unformatted).toStrictEqual([]);
  }
  await expect(page.getByRole('heading', { level: 1 }).locator('code')).toHaveText('moldea');
});

test('joins the homepage closing section directly to the footer at mobile and desktop widths', async ({
  page,
}) => {
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(toPublicPath('/'));
      const gap = await page
        .locator('footer')
        .evaluate(
          (footer) =>
            footer.getBoundingClientRect().top -
            document.querySelector('main')!.getBoundingClientRect().bottom,
        );
      expect(gap).toBe(0);
    }
  }
});

test('connects the package architecture to the official Repository Format specification', async ({
  page,
}) => {
  await page.goto(toPublicPath('/'));

  const architecture = page.getByRole('region', {
    name: 'The structure behind every evaluation.',
  });
  const architectureLink = architecture.getByRole('link', {
    name: 'Read the format specification',
  });

  await expect(architectureLink).toHaveAttribute('href', toPublicPath('/repository-format/'));

  const documentationNavigation = page.getByRole('navigation', { name: 'Documentation' });
  const footerLink = documentationNavigation.getByRole('link', {
    name: 'Repository Format',
  });

  await expect(footerLink).toHaveAttribute('href', toPublicPath('/repository-format/'));
  const cloudLink = page.getByRole('contentinfo').getByRole('link', { name: 'Cloud', exact: true });
  await expect(cloudLink).toHaveAttribute('href', 'https://moldea.ai');
  await expect(cloudLink).toHaveAttribute('target', '_blank');
  await expect(cloudLink).toHaveAttribute('rel', 'noopener noreferrer');
});

for (const theme of ['light', 'dark'] as const) {
  test(`wraps only explicit plain text while keeping code scrollable in ${theme}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.emulateMedia({ colorScheme: theme });
    await page.goto(toPublicPath('/repository-format/'));
    const plainText = page.locator('pre:has(> code.language-text)').first();
    const yaml = page.locator('pre:has(> code.language-yaml)').first();
    await expect(plainText).toHaveCSS('white-space', 'pre-wrap');
    await expect(plainText).toHaveCSS('overflow-wrap', 'anywhere');
    await expect(yaml).toHaveCSS('white-space', 'pre');
    await expect(yaml).toHaveAccessibleName('Code block');
    await yaml.focus();
    await expect(yaml).not.toHaveCSS('box-shadow', 'none');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });
}

test('copies exact highlighted and literal code across direct and client navigation', async ({
  context,
  page,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(toPublicPath('/repository-format/'));

  const highlightedCode = page.locator('pre.shiki:has(> code)').first();
  const highlightedHeader = highlightedCode.locator(
    'xpath=preceding-sibling::*[1][@data-code-copy-header]',
  );
  const highlightedToolbar = highlightedHeader.locator('[data-code-copy-toolbar]');
  const highlightedButton = highlightedToolbar.getByRole('button', {
    name: 'Copy code',
    exact: true,
  });
  const highlightedSource = await highlightedCode.locator(':scope > code').textContent();

  if (highlightedSource === null) throw new Error('Highlighted source text is unavailable.');
  await expect(highlightedHeader.locator('[data-code-copy-language]')).toHaveText('Plain text');
  await expect(highlightedButton).toHaveText('');
  await expect(highlightedButton).toHaveAttribute('title', 'Copy code');
  await highlightedButton.click();
  await expect(highlightedButton).toBeFocused();
  await expect(highlightedToolbar.locator('[data-code-copy-feedback]')).toHaveText('Copied.');
  await expect(highlightedButton).toHaveAttribute('data-code-copy-state', 'copied');
  await expect(highlightedButton.locator('[data-code-copy-success-icon]')).toHaveCSS(
    'opacity',
    '1',
  );
  await expect(highlightedButton.locator('[data-code-copy-icon]')).toHaveCSS('opacity', '0');
  expect(
    normalizeClipboardLineEndings(await page.evaluate(() => navigator.clipboard.readText())),
  ).toBe(normalizeClipboardLineEndings(highlightedSource));

  const literalSource = `  const marker = '<div data-code-copy="false">café</div>';

${'long-line-'.repeat(32)}
`;

  await page.evaluate((source) => {
    const fixture = document.createElement('section');
    const pre = document.createElement('pre');
    const code = document.createElement('code');

    fixture.dataset.copyTestFixture = 'literal';
    code.textContent = source;
    pre.append(code);
    fixture.append(pre);
    document.querySelector('main')?.append(fixture);
    document.dispatchEvent(new Event('astro:page-load'));
    document.dispatchEvent(new Event('astro:page-load'));
  }, literalSource);

  const literalFixture = page.locator('[data-copy-test-fixture="literal"]');
  const literalButton = literalFixture.getByRole('button', { name: 'Copy code', exact: true });

  await expect(literalButton).toHaveCount(1);
  await literalButton.click();
  await literalButton.click();
  await expect(literalButton).toBeFocused();
  await expect(literalFixture.locator('[data-code-copy-feedback]')).toHaveText('Copied.');
  expect(
    normalizeClipboardLineEndings(await page.evaluate(() => navigator.clipboard.readText())),
  ).toBe(normalizeClipboardLineEndings(literalSource));

  await page.evaluate(() => {
    const filePreview = document.createElement('section');
    const filePreviewHeader = document.createElement('header');
    const pre = document.createElement('pre');
    const code = document.createElement('code');

    filePreview.dataset.copyTestFixture = 'file-preview';
    filePreview.dataset.filePreview = '';
    filePreviewHeader.dataset.filePreviewHeader = '';
    code.textContent = 'const filePreview = true;';
    pre.append(code);
    filePreview.append(filePreviewHeader, pre);
    document.querySelector('main')?.append(filePreview);
    document.dispatchEvent(new Event('astro:page-load'));
  });

  const filePreviewFixture = page.locator('[data-copy-test-fixture="file-preview"]');

  await expect(
    filePreviewFixture.locator(':scope > [data-file-preview-header] [data-code-copy-button]'),
  ).toHaveCount(1);
  await expect(filePreviewFixture.locator('[data-code-copy-frame]')).toHaveCount(0);

  await page.getByRole('link', { name: 'Packages', exact: true }).first().click();
  await expect(page).toHaveURL(toPublicPath('/packages/'));
  await page.getByRole('link', { name: 'Repository Format', exact: true }).first().click();
  await expect(page).toHaveURL(toPublicPath('/repository-format/'));

  const controlCounts = await page.evaluate(() => {
    const eligibleBlocks = [...document.querySelectorAll('pre')].filter(
      (pre) =>
        pre.firstElementChild?.tagName === 'CODE' &&
        pre.closest('[data-code-copy="false"]') === null,
    );

    return {
      eligible: eligibleBlocks.length,
      enhanced: eligibleBlocks.filter((pre) => pre.dataset.codeCopyEnhanced === 'true').length,
      toolbars: document.querySelectorAll('[data-code-copy-toolbar]').length,
    };
  });

  expect(controlCounts.enhanced).toBe(controlCounts.eligible);
  expect(controlCounts.toolbars).toBe(controlCounts.eligible);

  await page.goto(toPublicPath('/capabilities/'));
  expect(
    await page.locator('details:not([open]) pre[data-code-copy-enhanced="true"]').count(),
  ).toBeGreaterThan(0);
});

test('honors code-copy opt-outs without affecting neighboring blocks', async ({ page }) => {
  await page.goto(toPublicPath('/'));

  const optedOutExcerpt = page.locator('pre[data-code-copy="false"]');

  await expect(optedOutExcerpt).toHaveCount(1);
  await expect(optedOutExcerpt).not.toHaveAttribute('data-code-copy-enhanced');

  await page.goto(toPublicPath('/capabilities/'));
  const optedOutComponents = page.locator('[data-code-block][data-code-copy="false"]');

  expect(await optedOutComponents.count()).toBeGreaterThan(0);
  await expect(optedOutComponents.locator('[data-code-copy-toolbar]')).toHaveCount(0);

  await page.evaluate(() => {
    const fixture = document.createElement('section');
    const createBlock = (name: string, source: string): HTMLPreElement => {
      const pre = document.createElement('pre');
      const code = document.createElement('code');

      pre.dataset.copyTestBlock = name;
      code.textContent = source;
      pre.append(code);
      return pre;
    };
    const directOptOut = createBlock('direct-opt-out', 'direct');
    const containerOptOut = document.createElement('div');
    const literalMarker = createBlock('literal-marker', 'data-code-copy="false"');
    const neighbor = createBlock('neighbor', 'neighbor');

    fixture.dataset.copyTestFixture = 'opt-outs';
    directOptOut.dataset.codeCopy = 'false';
    containerOptOut.dataset.codeCopy = 'false';
    containerOptOut.append(createBlock('container-opt-out', 'container'));
    fixture.append(directOptOut, containerOptOut, literalMarker, neighbor);
    document.querySelector('main')?.append(fixture);
    document.dispatchEvent(new Event('astro:page-load'));
    document.dispatchEvent(new Event('astro:page-load'));
  });

  const fixture = page.locator('[data-copy-test-fixture="opt-outs"]');

  await expect(fixture.getByRole('button', { name: 'Copy code', exact: true })).toHaveCount(2);
  await expect(fixture.locator('[data-copy-test-block="direct-opt-out"]')).not.toHaveAttribute(
    'data-code-copy-enhanced',
  );
  await expect(fixture.locator('[data-copy-test-block="container-opt-out"]')).not.toHaveAttribute(
    'data-code-copy-enhanced',
  );
  await expect(fixture.locator('[data-copy-test-block="literal-marker"]')).toHaveAttribute(
    'data-code-copy-enhanced',
    'true',
  );
  await expect(fixture.locator('[data-copy-test-block="neighbor"]')).toHaveAttribute(
    'data-code-copy-enhanced',
    'true',
  );
});

for (const [clipboardMode, expectedFeedback] of [
  ['unavailable', 'Copy is unavailable. Select the code, then copy it manually.'],
  ['denied', 'Copy failed. Select the code, then copy it manually.'],
] as const) {
  test(`keeps code selectable when clipboard access is ${clipboardMode}`, async ({ page }) => {
    await page.addInitScript((mode) => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value:
          mode === 'denied'
            ? {
                writeText: (): Promise<void> =>
                  Promise.reject(new DOMException('Clipboard access denied.', 'NotAllowedError')),
              }
            : undefined,
      });
    }, clipboardMode);
    await page.goto(toPublicPath('/repository-format/'));

    const button = page.getByRole('button', { name: 'Copy code', exact: true }).first();
    const toolbar = button.locator('xpath=ancestor::*[@data-code-copy-toolbar]');
    const header = toolbar.locator('xpath=ancestor::*[@data-code-copy-header]');
    const code = header.locator('xpath=following-sibling::pre[1]/code');

    await button.click();
    await expect(button).toBeFocused();
    await expect(toolbar.locator('[data-code-copy-feedback]')).toHaveText(expectedFeedback);
    await expect(code).toHaveCSS('user-select', 'auto');
  });
}

test('keeps code readable without JavaScript and omits inert copy controls', async ({
  baseURL,
  browser,
}) => {
  if (baseURL === undefined) throw new Error('The Playwright base URL is unavailable.');

  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  try {
    await page.goto(new URL(toPublicPath('/repository-format/'), baseURL).href);
    await expect(page.locator('pre:has(> code)').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy code', exact: true })).toHaveCount(0);
    await expect(page.locator('[data-code-copy-toolbar]')).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('keeps code-copy controls usable across supported widths, themes, and reduced motion', async ({
  page,
}) => {
  for (const width of [320, 375, 768, 1440]) {
    for (const theme of ['light', 'dark'] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto(toPublicPath('/repository-format/'));

      const button = page.getByRole('button', { name: 'Copy code', exact: true }).first();
      const toolbar = button.locator('xpath=ancestor::*[@data-code-copy-toolbar]');
      const bounds = await button.boundingBox();

      expect(bounds).not.toBeNull();
      expect(bounds!.width).toBe(24);
      expect(bounds!.height).toBe(24);
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      expect(
        await button.evaluate((element) =>
          Number.parseFloat(getComputedStyle(element).transitionDuration),
        ),
      ).toBeLessThanOrEqual(0.00001);
      await button.focus();
      await expect(button).not.toHaveCSS('box-shadow', 'none');
      expect(
        await toolbar.evaluate((element) => element.getBoundingClientRect().width),
      ).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );

      const accessibility = await new AxeBuilder({ page })
        .include('[data-code-copy-toolbar]')
        .analyze();
      expect(
        accessibility.violations.filter(
          ({ impact }) => impact === 'critical' || impact === 'serious',
        ),
      ).toStrictEqual([]);
    }
  }
});

test('persists an explicit theme and exposes mobile navigation from the keyboard', async ({
  page,
}) => {
  await page.setViewportSize({ height: 740, width: 320 });
  await page.goto(toPublicPath('/'));

  await expect(
    page.getByRole('banner').getByLabel('moldea packages home').getByText('packages'),
  ).toBeVisible();

  const navigationButton = page.getByLabel('Open navigation');
  await navigationButton.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();

  const themeControl = page.getByRole('button', { name: 'Use dark theme' }).last();
  await themeControl.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await navigationButton.click();
  await expect(page.getByRole('button', { name: 'Use light theme' }).last()).toBeVisible();
});

test('uses smooth client-side navigation while preserving ordinary static routes', async ({
  page,
}) => {
  await page.goto(toPublicPath('/'));
  await expect(page.locator('meta[name="astro-view-transitions-enabled"]')).toHaveAttribute(
    'content',
    'true',
  );

  const navigationMarker = await page.evaluate(() => {
    const marker = crypto.randomUUID();
    (window as Window & { __moldeaNavigationMarker?: string }).__moldeaNavigationMarker = marker;

    return marker;
  });

  await page.getByRole('link', { name: 'Packages', exact: true }).first().click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'One foundation. Explicit responsibilities.' }),
  ).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(toPublicPath('/packages/'));
  expect(
    await page.evaluate(
      () => (window as Window & { __moldeaNavigationMarker?: string }).__moldeaNavigationMarker,
    ),
  ).toBe(navigationMarker);

  await page.getByRole('button', { name: 'Use dark theme' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('shows accessible progress during delayed client navigation and hides it after success', async ({
  page,
}) => {
  await page.setViewportSize({ height: 740, width: 320 });
  await page.goto(toPublicPath('/'));

  const progress = page.getByRole('progressbar', {
    includeHidden: true,
    name: 'Page navigation progress',
  });
  const delayedRequest = Promise.withResolvers<void>();

  await expect(progress).toBeHidden();
  await page.route(
    `**${toPublicPath('/packages/')}`,
    async (route) => {
      await delayedRequest.promise;
      await route.continue();
    },
    { times: 1 },
  );

  const navigation = page.getByRole('link', { name: 'Packages', exact: true }).first().click();

  await expect(progress).toBeVisible();
  await expect(progress).toHaveAttribute('aria-valuetext', 'Loading next page');
  expect((await progress.boundingBox())?.width).toBe(320);

  const accessibilityResults = await new AxeBuilder({ page })
    .include('[data-navigation-progress]')
    .analyze();

  expect(accessibilityResults.violations).toStrictEqual([]);

  delayedRequest.resolve();
  await navigation;
  await expect(page).toHaveURL(toPublicPath('/packages/'));
  await expect(progress).toBeHidden();
});

test('cleans up progress after failed and interrupted navigation and across browser history', async ({
  page,
}) => {
  await page.goto(toPublicPath('/'));

  const progress = page.getByRole('progressbar', {
    includeHidden: true,
    name: 'Page navigation progress',
  });
  await page.evaluate(() => {
    type IFailedPreparationEvent = Event & { loader: () => Promise<void> };
    type IFailedPreparationWindow = Window & {
      __moldeaFailedNavigationPreparation?: IFailedPreparationEvent;
    };
    const preparationEvent = new Event('astro:before-preparation') as IFailedPreparationEvent;

    preparationEvent.loader = (): Promise<void> =>
      Promise.reject(new Error('Deliberate navigation preparation failure.'));
    (window as IFailedPreparationWindow).__moldeaFailedNavigationPreparation = preparationEvent;
    document.dispatchEvent(preparationEvent);
  });

  await expect(progress).toBeVisible();
  await page.evaluate(async () => {
    type IFailedPreparationEvent = Event & { loader: () => Promise<void> };
    type IFailedPreparationWindow = Window & {
      __moldeaFailedNavigationPreparation?: IFailedPreparationEvent;
    };
    const failedPreparationWindow = window as IFailedPreparationWindow;
    const preparationEvent = failedPreparationWindow.__moldeaFailedNavigationPreparation;

    if (preparationEvent === undefined) {
      throw new Error('The failed navigation preparation event is unavailable.');
    }

    try {
      await preparationEvent.loader();
    } catch {
      // the rejected loader is the expected navigation failure under test
    }

    delete failedPreparationWindow.__moldeaFailedNavigationPreparation;
  });
  await expect(progress).toBeHidden();

  await page.goto(toPublicPath('/'));

  const interruptedRequest = Promise.withResolvers<void>();

  await page.route(
    `**${toPublicPath('/packages/')}`,
    async (route) => {
      await interruptedRequest.promise;
      await route.continue();
    },
    { times: 1 },
  );

  const interruptedNavigation = page
    .getByRole('link', { name: 'Packages', exact: true })
    .first()
    .click();

  await expect(progress).toBeVisible();
  await page.getByRole('link', { name: 'Adapters', exact: true }).first().click();
  await expect(page).toHaveURL(toPublicPath('/adapters/'));
  await expect(progress).toBeHidden();

  interruptedRequest.resolve();
  await interruptedNavigation;
  await expect(page).toHaveURL(toPublicPath('/adapters/'));

  await page.getByRole('link', { name: 'Packages', exact: true }).first().click();
  await expect(page).toHaveURL(toPublicPath('/packages/'));
  await expect(progress).toBeHidden();

  await page.goBack();
  await expect(page).toHaveURL(toPublicPath('/adapters/'));
  await expect(progress).toBeHidden();

  await page.goForward();
  await expect(page).toHaveURL(toPublicPath('/packages/'));
  await expect(progress).toBeHidden();
});

test('uses sufficient navigation progress contrast in light and dark themes', async ({ page }) => {
  await page.goto(toPublicPath('/'));

  const progress = page.locator('[data-navigation-progress]');
  const indicator = progress.locator('[data-navigation-progress-indicator]');

  for (const theme of ['light', 'dark'] as const) {
    await page.locator('html').evaluate((root, activeTheme) => {
      root.classList.remove('light', 'dark');
      root.classList.add(activeTheme);
    }, theme);

    const colors = await progress.evaluate((progressElement) => {
      const indicatorElement = progressElement.querySelector<HTMLElement>(
        '[data-navigation-progress-indicator]',
      );
      const rootStyles = getComputedStyle(document.documentElement);

      if (indicatorElement === null) {
        throw new Error('The navigation progress indicator is unavailable.');
      }

      return {
        backgroundToken: rootStyles.getPropertyValue('--background'),
        foregroundToken: rootStyles.getPropertyValue('--foreground'),
        indicatorColor: getComputedStyle(indicatorElement).backgroundColor,
        pageBackground: getComputedStyle(document.body).backgroundColor,
        pageForeground: getComputedStyle(document.body).color,
        trackColor: getComputedStyle(progressElement).backgroundColor,
      };
    });

    expect(colors.indicatorColor).toBe(colors.pageForeground);
    expect(colors.trackColor).toBe(colors.pageBackground);
    expect(
      calculateContrastRatio(colors.foregroundToken, colors.backgroundToken),
    ).toBeGreaterThanOrEqual(3);
    await expect(indicator).toHaveCSS('background-color', colors.pageForeground);
  }
});

test('shows a static navigation segment when reduced motion is preferred', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(toPublicPath('/'));

  const delayedRequest = Promise.withResolvers<void>();

  await page.route(
    `**${toPublicPath('/packages/')}`,
    async (route) => {
      await delayedRequest.promise;
      await route.continue();
    },
    { times: 1 },
  );

  const navigation = page.getByRole('link', { name: 'Packages', exact: true }).first().click();
  const progress = page.getByRole('progressbar', { name: 'Page navigation progress' });
  const indicator = progress.locator('[data-navigation-progress-indicator]');

  await expect(progress).toBeVisible();

  const initialPresentation = await indicator.evaluate((element) => {
    const styles = getComputedStyle(element);

    return {
      animationName: styles.animationName,
      opacity: styles.opacity,
      transform: styles.transform,
    };
  });
  const progressBounds = await progress.boundingBox();
  const indicatorBounds = await indicator.boundingBox();

  await page.waitForTimeout(100);

  expect(initialPresentation.animationName).toBe('none');
  expect(initialPresentation.opacity).toBe('1');
  expect(initialPresentation.transform).not.toBe('none');
  expect(await indicator.evaluate((element) => getComputedStyle(element).transform)).toBe(
    initialPresentation.transform,
  );
  expect(indicatorBounds?.width).toBeGreaterThan((progressBounds?.width ?? 0) * 0.2);
  expect(indicatorBounds?.width).toBeLessThan((progressBounds?.width ?? 0) * 0.4);

  delayedRequest.resolve();
  await navigation;
  await expect(progress).toBeHidden();
});

test('marks the current desktop and mobile navigation destinations', async ({ page }) => {
  await page.goto(toPublicPath('/packages/core/api/'));

  const primaryNavigation = page.getByRole('navigation', { name: 'Primary navigation' });
  const activeDesktopLink = primaryNavigation.locator('a[aria-current="page"]');
  const inactiveDesktopLink = primaryNavigation.getByRole('link', { name: 'Adapters' });

  await expect(activeDesktopLink).toHaveText('Packages');
  expect(
    await activeDesktopLink.evaluate((element) => getComputedStyle(element).backgroundColor),
  ).not.toBe(
    await inactiveDesktopLink.evaluate((element) => getComputedStyle(element).backgroundColor),
  );

  await page.getByRole('button', { name: 'Use dark theme' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  expect(
    await activeDesktopLink.evaluate((element) => getComputedStyle(element).backgroundColor),
  ).not.toBe(
    await inactiveDesktopLink.evaluate((element) => getComputedStyle(element).backgroundColor),
  );

  await page.goto(toPublicPath('/search/'));
  await expect(page.getByRole('link', { name: 'Search documentation' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await page.setViewportSize({ height: 740, width: 320 });
  await page.goto(toPublicPath('/adapters/openai/api/'));
  await page.getByLabel('Open navigation').click();

  const mobileNavigation = page.getByRole('navigation', { name: 'Mobile navigation' });
  const activeMobileLink = mobileNavigation.locator('a[aria-current="page"]');
  const inactiveMobileLink = mobileNavigation.getByRole('link', { name: 'Packages' });

  await expect(activeMobileLink).toHaveText('Adapters');
  expect(
    await activeMobileLink.evaluate((element) => getComputedStyle(element).backgroundColor),
  ).not.toBe(
    await inactiveMobileLink.evaluate((element) => getComputedStyle(element).backgroundColor),
  );
});

test('presents available runtime adapters without promoting planned inventory', async ({
  page,
}) => {
  await page.goto(toPublicPath('/'));

  const adapterSection = page.locator('section[aria-labelledby="available-adapters-title"]');

  await expect(
    adapterSection.getByRole('heading', {
      level: 2,
      name: 'Find your runtime.',
    }),
  ).toBeVisible();
  await expect(
    adapterSection.getByRole('link', { name: /Anthropic company logo Anthropic/ }),
  ).toBeVisible();
  await expect(adapterSection.getByText('Anthropic', { exact: true })).toBeVisible();
  await expect(adapterSection.getByText('Claude Agent SDK', { exact: true })).toBeVisible();
  await expect(adapterSection.getByText('Custom runtime', { exact: true })).toBeVisible();
  await expect(adapterSection.getByRole('link', { name: /Custom runtime/ })).toBeVisible();
  await expect(adapterSection.getByRole('link', { name: /OpenAI/ })).toHaveCount(2);
  await expect(adapterSection.getByAltText('Anthropic company logo')).toHaveCount(2);
  await expect(adapterSection.getByRole('img', { name: 'Custom adapter icon' })).toBeVisible();
  await expect(adapterSection.getByAltText('OpenAI company logo')).toHaveCount(2);
  await expect(adapterSection.getByRole('link', { name: /Claude Agent SDK/ })).toBeVisible();
  await expect(adapterSection.getByRole('link', { name: /Cloudflare Agents/ })).toBeVisible();
  await expect(adapterSection.getByRole('link', { name: /Eve/ })).toBeVisible();
  await expect(
    adapterSection.getByRole('link', { name: /LangChain company logo LangChain/ }),
  ).toBeVisible();
  await expect(
    adapterSection.getByRole('link', { name: /LangChain company logo LangGraph/ }),
  ).toBeVisible();
  await expect(adapterSection.getByRole('link', { name: /Vercel AI SDK/ })).toBeVisible();
  await expect(adapterSection.getByAltText('Vercel company logo')).toHaveCount(2);
  await expect(adapterSection.getByRole('link', { name: 'View all adapters' })).toHaveAttribute(
    'href',
    toPublicPath('/adapters/'),
  );
});

test('omits the planned adapter inventory when every adapter is available', async ({ page }) => {
  await page.goto(toPublicPath('/adapters/'));

  await expect(page.getByText('Matrix-approved inventory', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 2, name: 'Planned and evolving' })).toHaveCount(
    0,
  );
});

test('shows company marks for provider adapters and keeps the custom adapter icon', async ({
  page,
}) => {
  await page.goto(toPublicPath('/adapters/'));

  for (const [companyName, expectedCount] of [
    ['Anthropic', 2],
    ['Cloudflare', 1],
    ['Google', 1],
    ['LangChain', 2],
    ['OpenAI', 2],
    ['Vercel', 2],
  ] as const) {
    await expect(page.getByAltText(`${companyName} company logo`)).toHaveCount(expectedCount);
  }

  const companyMarks = page.locator('img[alt$=" company logo"]');

  await expect(companyMarks).toHaveCount(10);
  await companyMarks.last().scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      companyMarks.evaluateAll((images) =>
        images.every(
          (image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0,
        ),
      ),
    )
    .toBe(true);

  const customAdapterCard = page.getByRole('link', { name: /Custom adapter icon/ });

  await expect(customAdapterCard.getByRole('img', { name: 'Custom adapter icon' })).toBeVisible();
  await expect(customAdapterCard.locator('img')).toHaveCount(0);

  await page.getByRole('button', { name: 'Use dark theme' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  expect(
    await page
      .getByAltText('OpenAI company logo')
      .first()
      .evaluate((element) => getComputedStyle(element).filter),
  ).not.toBe('none');
});

test('shows company marks for runtime adapters on the packages page', async ({ page }) => {
  await page.goto(toPublicPath('/packages/'));

  const runtimeAdapters = page.locator('section[aria-labelledby="adapter-packages-title"]');

  await expect(runtimeAdapters.getByAltText('Anthropic company logo')).toHaveCount(2);
  await expect(runtimeAdapters.getByAltText('LangChain company logo')).toHaveCount(2);
  await expect(runtimeAdapters.getByAltText('OpenAI company logo')).toHaveCount(2);
  await expect(runtimeAdapters.getByRole('img', { name: 'Custom adapter icon' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Website Foundations' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /@moldea.ai\/website-ui/ })).toHaveCount(0);
});

test('has no page-level horizontal overflow at 320px on representative routes', async ({
  page,
}) => {
  await page.setViewportSize({ height: 740, width: 320 });

  for (const path of REPRESENTATIVE_PATHS) {
    await page.goto(toPublicPath(path));
    const widths = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));

    expect(widths.scroll, `${path} overflows horizontally`).toBeLessThanOrEqual(widths.client);
  }
});

for (const viewportWidth of [320, 360, 768, 1024, 1440]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    scrollbarTest(`gutter ${viewportWidth} ${colorScheme}`, async ({ page }) => {
      await page.setViewportSize({ height: 740, width: viewportWidth });
      await page.emulateMedia({ colorScheme });

      for (const path of REPRESENTATIVE_PATHS) {
        await page.goto(toPublicPath(path));
        // a sized Chromium scrollbar reserves space even on hosts with overlay scrollbars
        await page.addStyleTag({
          content: `
          html { overflow-y: scroll; scrollbar-gutter: stable; }
          html::-webkit-scrollbar { width: 16px; }
        `,
        });
        const widths = await page.evaluate(() => ({
          client: document.documentElement.clientWidth,
          scroll: document.documentElement.scrollWidth,
          viewport: window.innerWidth,
        }));

        expect(widths.client, `${path} did not reserve scrollbar space`).toBeLessThan(
          widths.viewport,
        );
        expect(widths.scroll, `${path} overflows horizontally`).toBeLessThanOrEqual(widths.client);
      }
    });
  }
}

test('keeps primary static routes free of serious automated accessibility violations', async ({
  page,
}) => {
  for (const path of REPRESENTATIVE_PATHS) {
    await page.goto(toPublicPath(path));
    const results = await new AxeBuilder({ page }).analyze();
    const materialViolations = results.violations.filter(
      ({ impact }) => impact === 'critical' || impact === 'serious',
    );

    expect(materialViolations, `${path} has material accessibility violations`).toStrictEqual([]);
  }
});

test('uses branded action states in both themes and respects reduced motion', async ({ page }) => {
  await page.goto(toPublicPath('/'));

  const primaryAction = page.getByRole('link', { name: 'See how it works' });
  const outlineAction = page.getByRole('link', { name: 'Start using the tools', exact: true });
  const inlineAction = page.getByRole('link', { name: 'View all packages' });
  const actionTransitionProperties = await primaryAction.evaluate((element) =>
    getComputedStyle(element)
      .transitionProperty.split(',')
      .map((property) => property.trim()),
  );
  const lightPrimaryBackground = await primaryAction.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  const lightOutlineBackground = await outlineAction.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );

  expect(actionTransitionProperties).toStrictEqual(['border-color', 'box-shadow', 'translate']);

  await primaryAction.hover();
  await expect
    .poll(() => primaryAction.evaluate((element) => getComputedStyle(element).backgroundColor))
    .not.toBe(lightPrimaryBackground);

  await outlineAction.hover();
  await expect
    .poll(() => outlineAction.evaluate((element) => getComputedStyle(element).backgroundColor))
    .not.toBe(lightOutlineBackground);

  const primaryActionBounds = await primaryAction.boundingBox();

  if (primaryActionBounds === null) {
    throw new Error('The primary action bounds could not be resolved.');
  }

  await page.mouse.move(
    primaryActionBounds.x + primaryActionBounds.width / 2,
    primaryActionBounds.y + primaryActionBounds.height / 2,
  );
  await page.mouse.down();
  await expect
    .poll(() => primaryAction.evaluate((element) => getComputedStyle(element).translate))
    .not.toBe('none');
  await page.mouse.move(0, 0);
  await page.mouse.up();

  await inlineAction.hover();
  await expect(inlineAction).toHaveCSS('opacity', '0.7');
  await expect(inlineAction).toHaveCSS('text-decoration-line', 'none');
  await page.mouse.down();
  await expect(inlineAction).toHaveCSS('opacity', '0.6');
  await expect(inlineAction).toHaveCSS('translate', 'none');
  await page.mouse.move(0, 0);
  await page.mouse.up();

  await inlineAction.evaluate((element) => element.setAttribute('aria-disabled', 'true'));
  await inlineAction.hover({ force: true });
  await expect(inlineAction).toHaveCSS('opacity', '0.5');
  await expect(inlineAction).toHaveCSS('cursor', 'not-allowed');
  await page.mouse.down();
  await expect(inlineAction).toHaveCSS('opacity', '0.5');
  await expect(inlineAction).toHaveCSS('translate', 'none');
  await page.mouse.move(0, 0);
  await page.mouse.up();
  await inlineAction.evaluate((element) => element.removeAttribute('aria-disabled'));

  await inlineAction.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  expect(await inlineAction.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe(
    'none',
  );

  await page.getByRole('button', { name: 'Use dark theme' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  const darkPrimaryBackground = await primaryAction.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );

  await primaryAction.hover();
  await expect
    .poll(() => primaryAction.evaluate((element) => getComputedStyle(element).backgroundColor))
    .not.toBe(darkPrimaryBackground);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await primaryAction.hover();
  await page.mouse.down();
  await expect(primaryAction).toHaveCSS('translate', 'none');
  await expect(primaryAction).toHaveCSS('transition-property', 'none');
  await page.mouse.move(0, 0);
  await page.mouse.up();
});

test('uses the branded input surface in light and dark themes', async ({ page }) => {
  await page.goto(toPublicPath('/search/'));

  const searchInput = page.getByRole('searchbox', { name: 'Search documentation' });
  await searchInput.blur();
  const lightInputStyles = await searchInput.evaluate((element) => {
    const styles = getComputedStyle(element);

    return {
      backgroundColor: styles.backgroundColor,
      borderTopWidth: styles.borderTopWidth,
      boxShadow: styles.boxShadow,
    };
  });

  expect(lightInputStyles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(lightInputStyles.borderTopWidth).toBe('1px');
  expect(lightInputStyles.boxShadow).not.toBe('none');

  await searchInput.focus();
  await expect(searchInput).toBeFocused();
  expect(await searchInput.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe(
    lightInputStyles.boxShadow,
  );

  await page.getByRole('button', { name: 'Use dark theme' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  expect(
    await searchInput.evaluate((element) => getComputedStyle(element).backgroundColor),
  ).not.toBe('rgba(0, 0, 0, 0)');
});

test('focuses the search input on direct and client-side page loads', async ({ page }) => {
  const searchInput = page.getByRole('searchbox', { name: 'Search documentation' });

  await page.goto(toPublicPath('/search/'));
  await expect(searchInput).toBeFocused();

  await page.goto(toPublicPath('/'));
  await page.getByRole('link', { name: 'Search documentation' }).click();
  await page.waitForURL((url) => url.pathname === toPublicPath('/search/'));
  await expect(searchInput).toBeFocused();
});

test('searches the generated local index with a keyboard-submitted query', async ({ page }) => {
  await page.goto(toPublicPath('/'));
  await page.getByRole('link', { name: 'Search documentation' }).click();
  await page.waitForURL((url) => url.pathname === toPublicPath('/search/'));
  expect(new URL(page.url()).pathname).toBe(toPublicPath('/search/'));
  await page.getByRole('searchbox', { name: 'Search documentation' }).fill('snapshot');
  await page.getByRole('searchbox', { name: 'Search documentation' }).press('Enter');

  await expect(page.locator('[data-search-results] li').first()).toBeVisible();
  await expect(page.locator('[data-search-status]')).toContainText(/results? for “snapshot”/);
});

test('renders product names safely in search results and keeps the latest request in control', async ({
  page,
}) => {
  const requestStarted = Promise.withResolvers<void>();
  const releaseResponse = Promise.withResolvers<void>();

  await page.route(
    '**/search-index.json',
    async (route) => {
      requestStarted.resolve();
      await releaseResponse.promise;
      await route.fulfill({
        json: [
          {
            description: 'Use <img src=x onerror=alert(1)> with moldea.',
            searchText: 'alpha beta moldea',
            title: 'moldea, MOLDEA!',
            url: toPublicPath('/'),
          },
        ],
      });
    },
    { times: 1 },
  );
  await page.goto(toPublicPath('/search/'));

  const input = page.getByRole('searchbox', { name: 'Search documentation' });
  await input.fill('alpha');
  await input.press('Enter');
  await requestStarted.promise;
  await input.fill('beta');
  await input.press('Enter');
  releaseResponse.resolve();

  const status = page.locator('[data-search-status]');
  const result = page.locator('[data-search-results] li').first();

  await expect(status).toHaveText('1 result for “beta”.');
  await expect(result).toBeVisible();
  await expect(result.locator('code')).toHaveCount(3);
  await expect(result.locator('code').nth(0)).toHaveText('moldea');
  await expect(result.locator('code').nth(1)).toHaveText('moldea');
  await expect(result.locator('code').nth(2)).toHaveText('moldea');
  await expect(result.locator('img')).toHaveCount(0);
  await expect(result).toContainText('<img src=x onerror=alert(1)>');

  await input.fill('moldea');
  await input.press('Enter');
  await expect(status.locator('code')).toHaveText('moldea');
  await expect(status).toHaveText('1 result for “moldea”.');
});

test('left-aligns generated API signatures without indentation whitespace', async ({ page }) => {
  for (const path of ['/packages/core/api/', '/adapters/openai/api/']) {
    await page.goto(toPublicPath(path));
    const signature = page.locator('pre').first();

    await expect(signature).toBeVisible();
    await expect(signature).toHaveAttribute('tabindex', '0');
    expect(
      await signature.evaluate((element) => element.textContent === element.textContent?.trim()),
      `${path} adds presentation whitespace around a signature`,
    ).toBe(true);
    await expect(signature).toHaveCSS('text-align', 'start');
    await signature.focus();
    await expect(signature).toBeFocused();
  }
});

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { DEFAULT_BASE_PATH, withBase } from '@moldea.ai/website-ui/site';

const basePath = process.env.BASE_PATH ?? DEFAULT_BASE_PATH;
const guidePath = withBase('/getting-started/', basePath);

for (const width of [320, 768, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`keeps the visual adoption guide usable at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(guidePath);
      const heading = page.getByRole('heading', { level: 1, name: 'Get started with moldea' });
      await expect(heading.locator('code')).toHaveCount(0);
      await expect(page.locator('[data-conversation-message]')).toHaveCount(2);
      await expect(page.locator('[data-ecosystem-section]')).toHaveCount(4);
      for (const section of await page.locator('[data-ecosystem-section]').all()) {
        await expect(section.locator('figure')).toBeVisible();
      }
      await expect(page.locator('#adoption-guide')).toBeVisible();
      const assurance = page.getByRole('figure', { name: 'PR Assurance review' });
      await expect(assurance).toContainText('It cannot approve refunds or change orders.');
      await expect(assurance).toContainText('Approve eligible refunds using the order details.');
      // the platform website's pull request header bar keeps one-line identity beside the outcome
      const pullRequest = assurance.locator('figcaption');
      const pullRequestTitle = pullRequest.getByTitle(
        'feat(support): let support approve refunds',
        {
          exact: true,
        },
      );
      const mergeOutcome = pullRequest.getByText('Merge blocked', { exact: true });
      await expect(pullRequest).toContainText('PR #418');
      await expect(pullRequest).toContainText('refund_approvals into main');
      await expect(mergeOutcome).toBeVisible();
      await expect(assurance.getByText('Illustrative', { exact: true })).toHaveCount(0);
      const titleBounds = (await pullRequestTitle.boundingBox())!;
      expect((await mergeOutcome.boundingBox())!.x).toBeGreaterThanOrEqual(
        titleBounds.x + titleBounds.width,
      );
      expect(titleBounds.height).toBe(
        await pullRequestTitle.evaluate((node) => parseFloat(getComputedStyle(node).lineHeight)),
      );
      const findingOpener = assurance.getByRole('link', {
        name: 'Blocking CONTEXT_CONTRADICTED: View result: Refund approval boundary',
        exact: true,
      });
      await expect(findingOpener.locator('svg.lucide-scroll-text')).toBeVisible();
      expect((await findingOpener.boundingBox())!.width).toBe(
        (await findingOpener.locator('..').boundingBox())!.width,
      );
      expect((await findingOpener.boundingBox())!.height).toBe(40);
      await findingOpener.hover();
      await findingOpener.evaluate(async (node) => {
        await Promise.all(node.getAnimations().map((animation) => animation.finished));
      });
      expect(
        (
          await new AxeBuilder({ page })
            .include('#pr-assurance [data-inspection-outcome]')
            .analyze()
        ).violations,
      ).toStrictEqual([]);
      await findingOpener.focus();
      await page.keyboard.press('Enter');
      const findingDialog = page.getByRole('dialog', {
        name: 'PR Assurance review',
        exact: true,
      });
      await expect(
        findingDialog.getByRole('heading', { name: 'Refund approval boundary', exact: true }),
      ).toHaveCount(1);
      await expect(findingDialog.getByText('Project context', { exact: true })).toBeVisible();
      await expect(findingDialog).toContainText('exceeding the authority set by the project rule');
      await expect(findingDialog.locator('[data-file-preview]')).toHaveCount(2);
      const rule = findingDialog
        .locator('[data-file-preview]')
        .filter({ hasText: 'moldea/project.md' });
      const changedInstruction = findingDialog
        .locator('[data-file-preview]')
        .filter({ hasText: 'moldea/agents/support/instruction.md' });
      await expect(rule).toHaveAttribute('data-file-preview-tone', 'neutral');
      await expect(rule).toContainText('Project rule excerpt');
      await expect(changedInstruction).toHaveAttribute('data-file-preview-tone', 'danger');
      await expect(changedInstruction).toContainText('Violates project rule');
      const diff = changedInstruction.getByRole('region', {
        name: 'moldea/agents/support/instruction.md: Before and after',
        exact: true,
      });
      await expect(diff).toContainText('Explain eligibility. Never approve refunds.');
      await expect(diff).toContainText('Approve eligible refunds using the order details.');
      await expect(diff.locator('[data-moldea-diff-change]')).toHaveCount(0);
      await expect(changedInstruction.locator('[data-code-block]')).toHaveCount(0);
      await diff.focus();
      await expect(diff).toBeFocused();
      await expect(diff).not.toHaveCSS('box-shadow', 'none');
      expect(
        await changedInstruction.evaluate((node) => getComputedStyle(node).borderColor),
      ).not.toBe(await rule.evaluate((node) => getComputedStyle(node).borderColor));
      await expect(findingDialog.getByRole('tab')).toHaveCount(0);
      await expect(findingDialog.locator('[data-inspection-output]')).toHaveCount(0);
      await findingDialog.evaluate(async (node) => {
        await Promise.all(
          node.getAnimations({ subtree: true }).map((animation) => animation.finished),
        );
      });
      expect(
        (await new AxeBuilder({ page }).include('#assurance-illustration-result').analyze())
          .violations,
      ).toStrictEqual([]);
      if (width >= 768) await page.mouse.click(1, 1);
      else await page.keyboard.press('Escape');
      await expect(findingDialog).not.toBeVisible();
      await expect(findingOpener).toBeFocused();
      for (const name of [
        'moldea Agent Skill (opens in a new tab)',
        'Explore moldea Cloud (opens in a new tab)',
      ]) {
        const productLink = page.getByRole('main').getByRole('link', { name, exact: true });
        await expect(productLink).toBeVisible();
        await expect(productLink).toHaveAccessibleName(name);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      const accessibility = await new AxeBuilder({ page }).include('main').analyze();
      expect(
        accessibility.violations.filter(
          ({ impact }) => impact === 'serious' || impact === 'critical',
        ),
      ).toStrictEqual([]);
    });

    // ordinary website interaction and presentation remain full-only at the root suite boundary
    test(`offers optional video walkthroughs at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') pageErrors.push(message.text());
      });
      await page.route('https://www.youtube-nocookie.com/**', async (route) => {
        await route.fulfill({
          contentType: 'text/html',
          body: '<!doctype html><html lang="en"><title>Video</title><body></body></html>',
        });
      });
      await page.goto(guidePath);
      const skill = page.getByRole('region', {
        name: 'Give your coding agent the project context.',
        exact: true,
      });
      await expect(skill.locator('iframe')).toHaveCount(0);
      for (const [triggerLabel, title, videoId] of [
        ['Watch installation walkthrough', 'moldea | Install and use the skill', 'dwl_RFm95Tg'],
        [
          'Watch context-alignment workflow',
          'moldea | Keeping project context and code aligned',
          'PyZiQXWS1ZE',
        ],
      ] as const) {
        const trigger = skill.getByRole('button', { name: triggerLabel, exact: true });
        await expect(trigger.locator('svg')).toBeVisible();
        await trigger.focus();
        await expect(trigger).toBeFocused();
        await expect(trigger).not.toHaveCSS('box-shadow', 'none');
        await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog', { name: title, exact: true });
        await expect(dialog).toBeVisible();
        await expect(dialog.locator('iframe')).toHaveCount(0);
        await expect(dialog.locator('img')).toBeVisible();
        await expect(dialog.locator('img')).toHaveAttribute('alt', '');
        await expect
          .poll(() =>
            dialog.locator('img').evaluate((node) => {
              const image = node as HTMLImageElement;
              return image.complete && image.naturalWidth > 0;
            }),
          )
          .toBe(true);
        const play = dialog.getByRole('button', { name: `Play ${title}`, exact: true });
        const restingShadow = await play.evaluate((node) => getComputedStyle(node).boxShadow);
        await page.keyboard.press('Tab');
        await expect(play).toBeFocused();
        await expect(play).not.toHaveCSS('box-shadow', restingShadow);
        await page.keyboard.press('Enter');
        await expect(dialog.locator('iframe')).toHaveAttribute(
          'src',
          `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`,
        );
        await expect(dialog.getByRole('link', { name: /Watch on YouTube/u })).toHaveCount(0);
        expect(
          (
            await new AxeBuilder({ page })
              .include(`#${await dialog.getAttribute('id')}`)
              .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
              .analyze()
          ).violations,
        ).toStrictEqual([]);
        await page.keyboard.press('Escape');
        await expect(dialog).not.toBeVisible();
        await expect(dialog.locator('iframe')).toHaveCount(0);
        await expect(trigger).toBeFocused();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      expect(pageErrors).toStrictEqual([]);
    });
  }
}

for (const width of [320, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`keeps entry free of YouTube until Play at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'no-preference' });
      const requests: string[] = [];
      await page.route('https://www.youtube-nocookie.com/**', async (route) => {
        requests.push(route.request().url());
        await route.fulfill({
          contentType: 'text/html',
          body: '<!doctype html><title>Video</title>',
        });
      });
      await page.goto(guidePath);
      const trigger = page.getByRole('button', {
        name: 'Watch installation walkthrough',
        exact: true,
      });
      const opening = await trigger.evaluate((node) => {
        (node as HTMLButtonElement).click();
        const dialog = document.getElementById(node.getAttribute('aria-controls')!)!;
        const body = dialog.querySelector<HTMLElement>(':scope > div')!;
        const animations = dialog.getAnimations();
        for (const animation of animations) animation.pause();
        return {
          animations: animations.length,
          frames: dialog.querySelectorAll('iframe').length,
          height: dialog.offsetHeight,
          bodyWidth: body.clientWidth,
          bodyScrollWidth: body.scrollWidth,
          playerHeight: dialog.querySelector<HTMLElement>('[data-youtube-dialog-player]')!
            .offsetHeight,
        };
      });
      expect(opening.animations).toBeGreaterThan(0);
      expect(opening.frames).toBe(0);
      expect(opening.playerHeight).toBeGreaterThanOrEqual(200);
      expect(opening.bodyScrollWidth).toBeLessThanOrEqual(opening.bodyWidth);
      expect(requests).toStrictEqual([]);
      const dialog = page.getByRole('dialog', {
        name: 'moldea | Install and use the skill',
        exact: true,
      });
      await dialog.evaluate((node) => {
        for (const animation of node.getAnimations()) animation.finish();
      });
      await expect(dialog.locator('iframe')).toHaveCount(0);
      expect(requests).toStrictEqual([]);
      await expect(dialog.locator('img')).toBeVisible();
      await dialog
        .getByRole('button', { name: 'Play moldea | Install and use the skill', exact: true })
        .click();
      await expect(dialog.locator('iframe')).toBeVisible();
      expect(await dialog.evaluate((node) => (node as HTMLElement).offsetHeight)).toBe(
        opening.height,
      );
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
    });

    test(`isolates pending video entries across reopening at ${width}px in ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'no-preference' });
      const requests: string[] = [];
      await page.route('https://www.youtube-nocookie.com/**', async (route) => {
        requests.push(route.request().url());
        await route.fulfill({
          contentType: 'text/html',
          body: '<!doctype html><title>Video</title>',
        });
      });
      await page.goto(guidePath);
      const trigger = page.getByRole('button', {
        name: 'Watch installation walkthrough',
        exact: true,
      });
      await trigger.evaluate(async (node) => {
        const opener = node as HTMLButtonElement;
        opener.click();
        const dialog = document.getElementById(
          node.getAttribute('aria-controls')!,
        ) as HTMLDialogElement;
        const play = dialog.querySelector<HTMLButtonElement>('[data-youtube-dialog-play]')!;
        play.click();
        play.click();
        const previousEntry = dialog.getAnimations();
        const previousCompletion = Promise.allSettled(
          previousEntry.map((animation) => animation.finished),
        );
        for (const animation of previousEntry) animation.pause();
        dialog.close();
        // flush native closure so the reopened dialog gets a distinct entry animation
        dialog.getAnimations();
        opener.click();
        for (const animation of dialog.getAnimations()) animation.pause();
        await previousCompletion;
      });
      const dialog = page.getByRole('dialog', {
        name: 'moldea | Install and use the skill',
        exact: true,
      });
      await expect(dialog.locator('iframe')).toHaveCount(0);
      expect(requests).toStrictEqual([]);
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
      expect(requests).toStrictEqual([]);
      await trigger.evaluate((node) => (node as HTMLButtonElement).click());
      await dialog
        .getByRole('button', { name: 'Play moldea | Install and use the skill', exact: true })
        .click();
      await expect(dialog.locator('iframe')).toBeVisible();
      await expect.poll(() => requests.length).toBe(1);
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
    });
  }
}

test('shows the renamed export and labels the project-intent diff', async ({ page }) => {
  await page.goto(guidePath);
  const packages = page.locator('#local-packages figure');
  await expect(packages).toContainText('checkEligibility');
  // a local CLI run is not a pull request, so its title has no leading icon
  await expect(packages.locator('figcaption svg')).toHaveCount(0);
  await expect(packages.locator('[data-inspection-outcome]').first()).toContainText('Blocking');
  await expect(packages.locator('svg.lucide-link-2').first()).toBeVisible();
  await packages.locator('[data-dialog-open]').first().click();
  const result = page.getByRole('dialog');
  await expect(result).toContainText('MOLDEA_REFERENCE_EXPORT_MISSING');
  await expect(result).toContainText('canReturn');
  const affected = result.locator('[data-file-preview-tone="danger"]');
  await expect(affected).toHaveCount(1);
  await expect(affected).toContainText('Missing export');
  await expect(affected).toContainText('canReturn');
  await expect(affected).not.toContainText('version: 1');
  await expect(
    result.locator('[data-file-preview-tone="neutral"]').filter({ hasText: 'version: 1' }),
  ).toContainText('Declared in');
  await result.getByRole('tab', { name: 'Output', exact: true }).click();
  await expect(result).toContainText('coverageCounts');
  await expect(result).toContainText('exportsFailed');
  await page.keyboard.press('Escape');

  const assurance = page.getByRole('figure', { name: 'PR Assurance review' });
  await expect(
    assurance.locator(
      '[data-file-preview-header]:visible code[title="moldea/agents/support/instruction.md"]',
    ),
  ).toBeVisible();
});

// Astro's native underscore prefix keeps this colocated page test out of route discovery.
test('connects homepage, desktop navigation, and footer to the guide', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(withBase('/', basePath));
  await page.getByRole('link', { name: 'Start using the tools', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${guidePath}$`));
  await expect(
    page.getByRole('heading', { level: 1, name: 'Get started with moldea' }),
  ).toBeVisible();
  await expect(
    page.locator('header nav').getByRole('link', { name: 'Get started', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(
    page
      .getByRole('navigation', { name: 'Documentation', exact: true })
      .getByRole('link', { name: 'Get started' }),
  ).toHaveAttribute('href', guidePath);

  const content = page.locator('main');
  await expect(
    content.getByRole('link', { name: 'moldea Agent Skill (opens in a new tab)', exact: true }),
  ).toHaveAttribute('href', 'https://skill.moldea.ai/');
  const skillSetup = content.getByRole('link', {
    name: 'Start with the Agent Skill (opens in a new tab)',
    exact: true,
  });
  await expect(skillSetup).toHaveAttribute('href', 'https://skill.moldea.ai/get-started/');
  await expect(skillSetup).toHaveAttribute('target', '_blank');
  const cloud = content.getByRole('link', {
    name: 'Explore moldea Cloud (opens in a new tab)',
    exact: true,
  });
  await expect(cloud).toHaveAttribute('href', 'https://moldea.ai');
  await expect(cloud).toHaveAttribute('target', '_blank');
  await expect(cloud).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(content).toContainText('Cloud review is in development.');
  await expect(
    content
      .locator('#adoption-guide')
      .getByRole('link', { name: 'CLI overview and installation guide' }),
  ).toHaveAttribute('href', withBase('/packages/cli/', basePath));
  for (const [name, route] of [
    ['Core', '/packages/core/'],
    ['Repository', '/packages/repository/'],
    ['Repository FS', '/packages/repository-fs/'],
    ['Runtime labels and guidance', '/runtimes/'],
  ] as const) {
    await expect(content.getByRole('link', { name, exact: true })).toHaveAttribute(
      'href',
      withBase(route, basePath),
    );
  }
  await expect(content).toContainText('not every coding-agent or Agent Skill workflow');
  await expect(content).toContainText('Installing a package alone does not adopt the repository');
});

test('keeps the guide usable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 740 },
  });
  const page = await context.newPage();
  try {
    await page.goto(guidePath);
    await expect(
      page
        .getByRole('main')
        .getByRole('link', { name: 'Explore moldea Cloud (opens in a new tab)', exact: true }),
    ).toHaveAttribute('href', 'https://moldea.ai');
    await expect(
      page.getByRole('heading', { name: 'Check the connections as your code changes.' }),
    ).toBeVisible();
    const assurance = page.getByRole('figure', { name: 'PR Assurance review' });
    await expect(
      assurance.getByRole('heading', { name: 'Refund approval boundary', exact: true }),
    ).toBeVisible();
    await expect(assurance).toContainText('exceeding the authority set by the project rule');
    await expect(assurance.locator('[data-inspection-output]')).toHaveCount(0);
    for (const [title, videoId] of [
      ['moldea | Install and use the skill', 'dwl_RFm95Tg'],
      ['moldea | Keeping project context and code aligned', 'PyZiQXWS1ZE'],
    ] as const) {
      const videoLink = page.getByRole('link', {
        name: `${title}: Watch on YouTube (opens in a new tab)`,
        exact: true,
      });
      await expect(videoLink).toBeVisible();
      await expect(videoLink).toHaveAttribute('href', `https://www.youtube.com/watch?v=${videoId}`);
      await expect(videoLink).toHaveAttribute('target', '_blank');
    }
    await expect(page.locator('iframe')).toHaveCount(0);
    await page
      .locator('#adoption-guide')
      .getByRole('link', { name: 'CLI overview and installation guide', exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`${withBase('/packages/cli/', basePath)}$`));
  } finally {
    await context.close();
  }
});

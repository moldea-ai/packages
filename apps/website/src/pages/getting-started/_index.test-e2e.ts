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
      for (const name of ['moldea Agent Skill (opens in a new tab)', 'Explore moldea Cloud']) {
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
  const cloud = content.getByRole('link', { name: 'Explore moldea Cloud', exact: true });
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
      page.getByRole('main').getByRole('link', { name: 'Explore moldea Cloud', exact: true }),
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
    await page
      .locator('#adoption-guide')
      .getByRole('link', { name: 'CLI overview and installation guide', exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`${withBase('/packages/cli/', basePath)}$`));
  } finally {
    await context.close();
  }
});

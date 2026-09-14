// @vitest-environment node
import { execFileSync, type ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { extractMessage } from 'error-message-utils';
import { afterEach, describe, expect, test } from 'vitest';

const projectDirectory = path.resolve(import.meta.dirname, '..');
const temporaryDirectories: string[] = [];

interface IPackDryRunResult {
  readonly files: readonly { readonly path: string }[];
  readonly name: string;
  readonly version: string;
}

/** Executes native or JavaScript package-manager entrypoints without a platform shell. */
const runPackageManager = (
  packageManagerEntrypoint: string,
  commandArguments: readonly string[],
  options: ExecFileSyncOptionsWithStringEncoding,
): string => {
  const isJavaScriptEntrypoint = /\.(?:c|m)?js$/u.test(packageManagerEntrypoint);

  try {
    return execFileSync(
      isJavaScriptEntrypoint ? process.execPath : packageManagerEntrypoint,
      isJavaScriptEntrypoint ? [packageManagerEntrypoint, ...commandArguments] : commandArguments,
      options,
    );
  } catch (error) {
    const standardError =
      error && typeof error === 'object' && 'stderr' in error
        ? (error as { stderr?: unknown }).stderr
        : undefined;
    const diagnostic = Buffer.isBuffer(standardError)
      ? standardError.toString('utf8')
      : typeof standardError === 'string'
        ? standardError
        : extractMessage(error);

    throw new Error(`The package-manager command failed: ${diagnostic}`, { cause: error });
  }
};

/** Returns the package-manager entrypoint provided to the integration test process. */
const getPackageManagerEntrypoint = (): string => {
  const packageManagerEntrypoint = process.env['npm_execpath'];

  if (packageManagerEntrypoint === undefined) {
    throw new Error('The package-manager entrypoint is unavailable.');
  }

  return packageManagerEntrypoint;
};

/** Creates one tracked temporary directory removed after the active test. */
const createTemporaryDirectory = (): string => {
  const directory = mkdtempSync(path.join(tmpdir(), 'moldea-website-ui-'));

  temporaryDirectories.push(directory);
  return directory;
};

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe('published website UI package', () => {
  test('packs only the documented runtime, component, style, and package files', () => {
    const output = runPackageManager(
      getPackageManagerEntrypoint(),
      ['pack', '--dry-run', '--json'],
      { cwd: projectDirectory, encoding: 'utf8' },
    );
    const packResult = JSON.parse(output) as IPackDryRunResult;
    const packedPaths = packResult.files.map((file) => file.path);

    expect(packResult).toMatchObject({ name: '@moldea.ai/website-ui', version: '1.7.3' });
    expect(packedPaths).toContain('src/components/accordion/accordion.component.astro');
    expect(packedPaths).toContain('src/components/code-block/code-block.component.astro');
    expect(packedPaths).toContain(
      'src/components/code-copy-controls/code-copy-controls.component.astro',
    );
    expect(packedPaths).toContain(
      'src/components/connection-label/connection-label.component.astro',
    );
    expect(packedPaths).toContain('src/components/hero-backdrop/hero-backdrop.component.astro');
    expect(packedPaths).toContain('dist/evaluation-replay.js');
    expect(packedPaths).toContain('dist/index.js');
    expect(packedPaths).toContain('dist/markdown.js');
    expect(packedPaths).toContain('dist/site/index.d.ts');
    expect(packedPaths).toContain('src/styles.css');
    expect(packedPaths).toContain('src/tokens.css');
    expect(packedPaths).toContain('src/components/local-search/local-search.component.astro');
    expect(packedPaths).toContain(
      'src/components/navigation-progress/navigation-progress.component.astro',
    );
    expect(packedPaths).toContain(
      'src/components/evaluation-replay/evaluation-replay.component.astro',
    );
    expect(packedPaths).toContain('src/components/tabbed-panels/tabbed-panels.component.astro');
    expect(packedPaths).toContain('src/components/dialog/dialog.component.astro');
    expect(packedPaths).toContain('src/components/file-preview/file-preview.component.astro');
    expect(packedPaths).toContain('src/components/result-summary/result-summary.component.astro');
    expect(packedPaths).toContain('LICENSE');
    expect(packedPaths).toContain('README.md');
    expect(packedPaths).toContain('cover.png');
    expect(packedPaths).toContain('package.json');
    expect(packedPaths.some((filePath) => filePath.includes('.test-'))).toBe(false);
    expect(packedPaths.some((filePath) => filePath.startsWith('docs/'))).toBe(false);
  });

  test('installs the real tarball and builds an Astro consumer using every public component', () => {
    const packageManagerEntrypoint = getPackageManagerEntrypoint();
    const temporaryDirectory = createTemporaryDirectory();
    const packDirectory = path.join(temporaryDirectory, 'pack');
    const fixtureDirectory = path.join(temporaryDirectory, 'fixture');
    const pagesDirectory = path.join(fixtureDirectory, 'src', 'pages');

    mkdirSync(packDirectory, { recursive: true });
    mkdirSync(pagesDirectory, { recursive: true });
    runPackageManager(packageManagerEntrypoint, ['pack', '--pack-destination', packDirectory], {
      cwd: projectDirectory,
      encoding: 'utf8',
    });

    const tarballName = readdirSync(packDirectory).find((fileName) => fileName.endsWith('.tgz'));

    if (tarballName === undefined) {
      throw new Error('The Website UI tarball was not created.');
    }

    const tarballPath = path.join(packDirectory, tarballName);

    writeFileSync(
      path.join(fixtureDirectory, 'package.json'),
      `${JSON.stringify(
        {
          name: 'moldea-website-ui-tarball-consumer',
          private: true,
          type: 'module',
          dependencies: {
            '@astrojs/check': '0.9.10',
            '@moldea.ai/website-ui': `file:${tarballPath}`,
            '@tailwindcss/vite': '4.3.3',
            astro: '7.2.2',
            tailwindcss: '4.3.3',
            typescript: '6.0.3',
          },
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(
      path.join(fixtureDirectory, 'astro.config.mjs'),
      [
        "import tailwindcss from '@tailwindcss/vite';",
        "import { defineConfig } from 'astro/config';",
        '',
        'export default defineConfig({',
        '  vite: { plugins: [tailwindcss()] },',
        '});',
        '',
      ].join('\n'),
    );
    writeFileSync(
      path.join(fixtureDirectory, 'tsconfig.json'),
      `${JSON.stringify(
        {
          extends: 'astro/tsconfigs/strict',
          include: ['.astro/types.d.ts', '**/*'],
          exclude: ['dist'],
        },
        null,
        2,
      )}\n`,
    );
    writeFileSync(
      path.join(fixtureDirectory, 'src', 'styles.css'),
      "@import '@moldea.ai/website-ui/styles.css';\n",
    );
    writeFileSync(
      path.join(pagesDirectory, 'index.astro'),
      [
        '---',
        "import type { ComponentProps } from 'astro/types';",
        "import { ClientRouter } from 'astro:transitions';",
        "import ActionButton from '@moldea.ai/website-ui/action-button';",
        "import Accordion from '@moldea.ai/website-ui/accordion';",
        "import ActionLink from '@moldea.ai/website-ui/action-link';",
        "import BrandLogo from '@moldea.ai/website-ui/brand-logo';",
        "import Breadcrumbs from '@moldea.ai/website-ui/breadcrumbs';",
        "import CodeBlock from '@moldea.ai/website-ui/code-block';",
        "import CodeCopyControls from '@moldea.ai/website-ui/code-copy-controls';",
        "import ConnectionLabel from '@moldea.ai/website-ui/connection-label';",
        "import DocumentationShell from '@moldea.ai/website-ui/documentation-shell';",
        "import Dialog from '@moldea.ai/website-ui/dialog';",
        "import EvaluationReplay from '@moldea.ai/website-ui/evaluation-replay';",
        "import FilePreview from '@moldea.ai/website-ui/file-preview';",
        "import HeroBackdrop from '@moldea.ai/website-ui/hero-backdrop';",
        "import InlineBrandText from '@moldea.ai/website-ui/inline-brand-text';",
        "import LocalSearch from '@moldea.ai/website-ui/local-search';",
        "import NavigationProgress from '@moldea.ai/website-ui/navigation-progress';",
        "import ResultSummary from '@moldea.ai/website-ui/result-summary';",
        "import SiteFooter from '@moldea.ai/website-ui/site-footer';",
        "import SiteHeader from '@moldea.ai/website-ui/site-header';",
        "import StatusBadge from '@moldea.ai/website-ui/status-badge';",
        "import TabbedPanels from '@moldea.ai/website-ui/tabbed-panels';",
        "import ThemeBootstrap from '@moldea.ai/website-ui/theme-bootstrap';",
        "import ThemeControl from '@moldea.ai/website-ui/theme-control';",
        "import { buildEvaluationReplayPathTree, type IEvaluationReplayModel } from '@moldea.ai/website-ui/evaluation-replay-model';",
        "import { renderMarkdownDocument } from '@moldea.ai/website-ui/markdown';",
        "import { withBase } from '@moldea.ai/website-ui/site';",
        "import '../styles.css';",
        '',
        "const rendered = await renderMarkdownDocument('# Fixture\\n\\n## moldea Shared Markdown', { productNameTreatment: 'code' });",
        "const tree = buildEvaluationReplayPathTree([{ path: 'src/index.ts', type: 'file' }]);",
        "const replay = { trials: [{ confirmationIndex: 3, evaluatedAt: '2026-09-10T00:00:00.000Z', id: 'confirmation-3', kind: 'confirmation', steps: [], title: 'Confirmation 3' }] } satisfies IEvaluationReplayModel;",
        "const navigationItems = [{ href: '/', isActive: true, label: 'moldea Home' }, { href: '/repository-format/', isActive: false, label: 'Repository Format', compactLabel: 'Repo. Format' }] satisfies ComponentProps<typeof SiteHeader>['navigationItems'];",
        'const fileProps = { path: "src/returns/policy.ts", label: "Return policy", tone: "warning" } satisfies ComponentProps<typeof FilePreview>;',
        'const codeProps = { source: "echo order-status", language: "sh", variant: "plain", copyable: true } satisfies ComponentProps<typeof CodeBlock>;',
        'const nonCopyableCodeProps = { source: "incomplete result", language: "text", copyable: false } satisfies ComponentProps<typeof CodeBlock>;',
        'const connectionProps = { tone: "danger" } satisfies ComponentProps<typeof ConnectionLabel>;',
        'const accordionProps = { id: "check-two", group: "fixture-accordion", title: "Second check", isOpen: true } satisfies ComponentProps<typeof Accordion>;',
        'const summaryProps = { title: "Reference not found", description: "The declared file is absent.", tone: "danger", as: "h2", headingId: "composed-result-title", hideIconOnMobile: true, ariaLabel: "Fixture outcome" } satisfies ComponentProps<typeof ResultSummary>;',
        'const dialogProps = { id: "fixture-wide", title: "Detailed evidence", triggerLabel: "Inspect evidence", triggerVariant: "primary", triggerSize: "lg", size: "large", description: "Recorded evidence details." } satisfies ComponentProps<typeof Dialog>;',
        '---',
        '<html lang="en" data-theme="system">',
        '  <head>',
        '    <ClientRouter />',
        '    <ThemeBootstrap storageKey="fixture-theme" />',
        '  </head>',
        '  <body>',
        '    <NavigationProgress />',
        '    <CodeCopyControls />',
        '    <SiteHeader navigationItems={navigationItems} searchAriaLabel="Search fixture" searchHref="/search/" searchIsActive={false} sourceAriaLabel="Fixture source" sourceHref="https://example.com/source" themeStorageKey="fixture-theme">',
        '      <span slot="brand">Fixture brand</span>',
        '    </SiteHeader>',
        '    <BrandLogo compact darkCompactLogoPath="/dark-icon.png" darkLogoPath="/dark.png" homeLabel="Fixture home" lightCompactLogoPath="/light-icon.png" lightLogoPath="/light.png" suffix="fixture" />',
        '    <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "moldea Fixture" }]} />',
        '    <InlineBrandText text="Use moldea here." />',
        '    <InlineBrandText text="Use MOLDEA compactly." variant="compact" />',
        '    <ActionButton>Run</ActionButton>',
        '    <section class="relative overflow-hidden"><HeroBackdrop /><h1 class="relative">Consumer hero</h1></section>',
        '    <CodeBlock source={JSON.stringify({ valid: false })} language="json" />',
        '    <CodeBlock {...codeProps} />',
        '    <CodeBlock {...nonCopyableCodeProps} />',
        '    <CodeBlock source="Plain text wraps in narrow containers." language="text" />',
        '    <ConnectionLabel {...connectionProps}><span slot="icon">!</span>Missing from <code class="inline-code">moldea.yaml</code></ConnectionLabel>',
        '    <ConnectionLabel>Linked file</ConnectionLabel>',
        '    <section><h2>Fixture checks</h2><Accordion id="check-one" group="fixture-accordion" title="First check" description="One concise outcome."><StatusBadge slot="status" label="Valid" tone="success" size="sm" /><p>First visual</p></Accordion><Accordion {...accordionProps}><FilePreview path="src/policy.ts" label="Policy"><p>Second visual</p></FilePreview></Accordion></section>',
        '    <Accordion id="closed-check" group="closed-accordion" title="Closed check"><p>Optional detail</p></Accordion>',
        '    <FilePreview {...fileProps}><span slot="icon">File</span><StatusBadge slot="status" label="Missing" size="sm" tone="danger" /><pre class="code-block" tabindex="0" role="region" aria-label="Return policy source"><code>export const returnWindowDays = 30;</code></pre></FilePreview>',
        '    <Dialog id="composed-result" title="Reference not found" triggerLabel="Inspect composed result" isOverlayCloseEnabled><ResultSummary slot="heading" {...summaryProps}><span slot="icon">!</span><StatusBadge slot="status" label="Invalid" size="sm" tone="danger" /></ResultSummary><p>Composed result body</p></Dialog>',
        '    <ResultSummary title="Metadata available" description="Logical paths only." as="h3" />',
        '    <Dialog id="fixture-result" title="Fixture result" triggerLabel="View result"><div slot="heading"><h2 id="fixture-result-title">Fixture result</h2><StatusBadge label="Invalid" size="sm" tone="danger" /><p>Recorded check</p></div><p>Result content</p></Dialog>',
        '    <Dialog id="fixture-details" title="Fixture details" triggerLabel="View details"><p>Details without a badge</p></Dialog>',
        '    <Dialog {...dialogProps}><p>Wide evidence content</p></Dialog>',
        '    <ActionLink href={withBase("/docs/")}>Docs</ActionLink>',
        '    <StatusBadge label="Available" tone="success" />',
        '    <TabbedPanels ariaLabel="Fixture views" id="fixture-tabs" items={[{ id: "first", label: "First", slotName: "first" }, { id: "second", label: "Second", slotName: "second" }]}><p slot="first">First panel</p><p slot="second">Second panel</p></TabbedPanels>',
        '    <EvaluationReplay id="fixture-replay" replay={replay} />',
        '    <DocumentationShell breadcrumbs={[{ href: "/", label: "Home" }, { label: "moldea Docs" }]} currentRoute="/docs/" headings={rendered.headings} navigationGroups={[{ label: "moldea Guides", items: [{ href: "/docs/", label: "moldea Start" }] }]} previousPage={{ href: "/previous/", label: "Previous moldea guide" }} nextPage={{ href: "/next/", label: "Next moldea guide" }}><div class="prose-moldea" set:html={rendered.html} /></DocumentationShell>',
        '    <p>{tree[0]?.name}</p>',
        '    <ThemeControl storageKey="fixture-theme" />',
        '    <LocalSearch action="/search/" failureMessage="Search unavailable." initialPrompt="Enter a query." placeholder="e.g. repository snapshots" searchIndexUrl="/search-index.json" shouldFocusOnLoad />',
        '    <SiteFooter hasTopSpacing={false}><p slot="brand">Fixture footer</p><nav slot="primary-navigation" aria-label="Fixture documentation">Docs</nav><nav slot="secondary-navigation" aria-label="Fixture project">Project</nav></SiteFooter>',
        '  </body>',
        '</html>',
        '',
      ].join('\n'),
    );

    runPackageManager(
      packageManagerEntrypoint,
      ['install', '--prefer-offline', '--ignore-scripts', '--frozen-lockfile=false'],
      { cwd: fixtureDirectory, encoding: 'utf8' },
    );
    runPackageManager(packageManagerEntrypoint, ['exec', 'astro', 'check'], {
      cwd: fixtureDirectory,
      encoding: 'utf8',
    });
    runPackageManager(packageManagerEntrypoint, ['exec', 'astro', 'build'], {
      cwd: fixtureDirectory,
      encoding: 'utf8',
    });

    expect(readFileSync(path.join(fixtureDirectory, 'dist', 'index.html'), 'utf8')).toContain(
      'Fixture home',
    );
    expect(readFileSync(path.join(fixtureDirectory, 'dist', 'index.html'), 'utf8')).toContain(
      'Page navigation progress',
    );
    expect(readFileSync(path.join(fixtureDirectory, 'dist', 'index.html'), 'utf8')).toContain(
      'Shared Markdown',
    );
    expect(readFileSync(path.join(fixtureDirectory, 'dist', 'index.html'), 'utf8')).toContain(
      'First panel',
    );
    expect(readFileSync(path.join(fixtureDirectory, 'dist', 'index.html'), 'utf8')).toContain(
      'Result content',
    );
    const fixtureHtml = readFileSync(path.join(fixtureDirectory, 'dist', 'index.html'), 'utf8');
    expect(fixtureHtml).toContain('Consumer hero');
    expect(fixtureHtml).toContain('language-json');
    expect(fixtureHtml).toContain('language-sh');
    expect(fixtureHtml).toContain('language-text');
    expect(fixtureHtml).toContain('role="region" aria-label="Code block"');
    expect(fixtureHtml).toContain('data-code-copy-controls-template');
    expect(fixtureHtml).toContain('data-code-copy="false"');
    expect(fixtureHtml.match(/<code[^>]*>moldea<\/code>/gu)?.length).toBeGreaterThanOrEqual(8);
    expect(fixtureHtml).toContain('Linked file');
    expect(fixtureHtml).toContain('Missing from <code class="inline-code">moldea.yaml</code>');
    expect(fixtureHtml).toContain('data-search-focus-on-load="true"');
    expect(fixtureHtml).toContain('aria-labelledby="fixture-result-title"');
    expect(fixtureHtml).toMatch(
      /<h2[^>]*id="fixture-result-title"[^>]*>Fixture result<\/h2>\s*<span[^>]*>\s*Invalid\s*<\/span>/u,
    );
    expect(fixtureHtml).toContain('Details without a badge');
    expect(fixtureHtml).toContain('src/returns/policy.ts');
    expect(fixtureHtml).toContain('Return policy source');
    expect(fixtureHtml).toContain('aria-labelledby="composed-result-title"');
    expect(fixtureHtml).toMatch(
      /<h2[^>]*id="composed-result-title"[^>]*>Reference not found<\/h2>/u,
    );
    expect(fixtureHtml).toContain('Composed result body');
    expect(fixtureHtml).toMatch(
      /<details\b[^>]*id="check-one"[^>]*name="fixture-accordion"(?![^>]*\bopen\b)/u,
    );
    expect(fixtureHtml).toMatch(
      /<details\b[^>]*id="check-two"[^>]*name="fixture-accordion"[^>]*\bopen\b/u,
    );
    expect(fixtureHtml).toMatch(
      /<details\b[^>]*id="closed-check"[^>]*name="closed-accordion"(?![^>]*\bopen\b)/u,
    );
    expect(fixtureHtml).toContain('aria-describedby="check-one-description"');
    expect(fixtureHtml).toContain('First visual');
    expect(fixtureHtml).toContain('Second visual');
    expect(fixtureHtml).toContain('Repo. Format');
    expect(fixtureHtml).toContain('aria-label="Repository Format"');
    expect(fixtureHtml).toMatch(/<footer class="border-t border-border">/u);
    expect(fixtureHtml).toMatch(/<h3[^>]*>Metadata available<\/h3>/u);
    expect(fixtureHtml).toMatch(/<dialog\b[^>]*id="fixture-wide"[^>]*sm:max-w-5xl/u);
    expect(fixtureHtml).toContain('aria-describedby="fixture-wide-description"');
    expect(fixtureHtml).toMatch(
      /<button\b[^>]*action-primary action-size-lg[^>]*aria-controls="fixture-wide"/u,
    );
  }, 180_000);
});

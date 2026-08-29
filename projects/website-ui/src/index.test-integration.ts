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

    expect(packResult).toMatchObject({ name: '@moldea.ai/website-ui', version: '1.2.0' });
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
        "import { ClientRouter } from 'astro:transitions';",
        "import ActionButton from '@moldea.ai/website-ui/action-button';",
        "import ActionLink from '@moldea.ai/website-ui/action-link';",
        "import BrandLogo from '@moldea.ai/website-ui/brand-logo';",
        "import Breadcrumbs from '@moldea.ai/website-ui/breadcrumbs';",
        "import DocumentationShell from '@moldea.ai/website-ui/documentation-shell';",
        "import EvaluationReplay from '@moldea.ai/website-ui/evaluation-replay';",
        "import InlineBrandText from '@moldea.ai/website-ui/inline-brand-text';",
        "import LocalSearch from '@moldea.ai/website-ui/local-search';",
        "import NavigationProgress from '@moldea.ai/website-ui/navigation-progress';",
        "import SiteFooter from '@moldea.ai/website-ui/site-footer';",
        "import SiteHeader from '@moldea.ai/website-ui/site-header';",
        "import StatusBadge from '@moldea.ai/website-ui/status-badge';",
        "import TabbedPanels from '@moldea.ai/website-ui/tabbed-panels';",
        "import ThemeBootstrap from '@moldea.ai/website-ui/theme-bootstrap';",
        "import ThemeControl from '@moldea.ai/website-ui/theme-control';",
        "import { buildEvaluationReplayPathTree } from '@moldea.ai/website-ui/evaluation-replay-model';",
        "import { renderMarkdownDocument } from '@moldea.ai/website-ui/markdown';",
        "import { withBase } from '@moldea.ai/website-ui/site';",
        "import '../styles.css';",
        '',
        "const rendered = await renderMarkdownDocument('# Fixture\\n\\n## Shared Markdown');",
        "const tree = buildEvaluationReplayPathTree([{ path: 'src/index.ts', type: 'file' }]);",
        "const navigationItems = [{ href: '/', isActive: true, label: 'Home' }];",
        '---',
        '<html lang="en" data-theme="system">',
        '  <head>',
        '    <ClientRouter />',
        '    <ThemeBootstrap storageKey="fixture-theme" />',
        '  </head>',
        '  <body>',
        '    <NavigationProgress />',
        '    <SiteHeader navigationItems={navigationItems} searchAriaLabel="Search fixture" searchHref="/search/" searchIsActive={false} sourceAriaLabel="Fixture source" sourceHref="https://example.com/source" themeStorageKey="fixture-theme">',
        '      <span slot="brand">Fixture brand</span>',
        '    </SiteHeader>',
        '    <BrandLogo compact darkCompactLogoPath="/dark-icon.png" darkLogoPath="/dark.png" homeLabel="Fixture home" lightCompactLogoPath="/light-icon.png" lightLogoPath="/light.png" suffix="fixture" />',
        '    <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Fixture" }]} />',
        '    <InlineBrandText text="Use moldea here." />',
        '    <InlineBrandText text="Use MOLDEA compactly." variant="compact" />',
        '    <ActionButton>Run</ActionButton>',
        '    <ActionLink href={withBase("/docs/")}>Docs</ActionLink>',
        '    <StatusBadge label="Available" tone="success" />',
        '    <TabbedPanels ariaLabel="Fixture views" id="fixture-tabs" items={[{ id: "first", label: "First", slotName: "first" }, { id: "second", label: "Second", slotName: "second" }]}><p slot="first">First panel</p><p slot="second">Second panel</p></TabbedPanels>',
        '    <EvaluationReplay id="fixture-replay" replay={null} />',
        '    <DocumentationShell breadcrumbs={[{ href: "/", label: "Home" }, { label: "Docs" }]} currentRoute="/docs/" headings={rendered.headings}><div class="prose-moldea" set:html={rendered.html} /></DocumentationShell>',
        '    <p>{tree[0]?.name}</p>',
        '    <ThemeControl storageKey="fixture-theme" />',
        '    <LocalSearch action="/search/" failureMessage="Search unavailable." initialPrompt="Enter a query." placeholder="e.g. repository snapshots" searchIndexUrl="/search-index.json" />',
        '    <SiteFooter><p slot="brand">Fixture footer</p><nav slot="primary-navigation" aria-label="Fixture documentation">Docs</nav><nav slot="secondary-navigation" aria-label="Fixture project">Project</nav></SiteFooter>',
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
  }, 180_000);
});

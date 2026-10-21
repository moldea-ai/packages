// @vitest-environment node
/// <reference lib="dom" />
import { execFileSync, type ExecFileSyncOptionsWithStringEncoding } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

import { AxeBuilder } from '@axe-core/playwright';
import { chromium, type Locator } from '@playwright/test';
import { extractMessage } from 'jg-exception';
import { afterEach, describe, expect, test } from 'vitest';

import { RUNTIME_CATALOG } from './runtime-catalog/index.js';

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
  // native resolution also expands Windows short paths used by CI temporary directories
  return realpathSync.native(directory);
};

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

/**
 * Checks rendered text baselines and icon centers at the current viewport.
 * Zero-height inline markers expose text baselines without changing line height.
 * @returns A promise that resolves after the alignment assertions.
 */
const expectInspectionActionAlignment = async (opener: Locator): Promise<void> => {
  const layout = await opener.evaluate(async (node) => {
    await document.fonts.ready;
    const textGroup = node.querySelector(':scope > span');
    if (textGroup === null) throw new Error('Missing inspection action text.');
    const measureBaseline = (text: Element): number => {
      const marker = document.createElement('span');
      marker.style.cssText =
        'display:inline-block;width:0;height:0;vertical-align:baseline;line-height:0;font-size:0';
      text.append(marker);
      try {
        return marker.getBoundingClientRect().top;
      } finally {
        marker.remove();
      }
    };
    const bounds = node.getBoundingClientRect();
    return {
      baselines: [...textGroup.children].map(measureBaseline),
      center: bounds.top + bounds.height / 2,
      iconCenters: [...node.querySelectorAll(':scope > svg')].map((icon) => {
        const iconBounds = icon.getBoundingClientRect();
        return iconBounds.top + iconBounds.height / 2;
      }),
    };
  });
  expect(layout.baselines.length).toBeGreaterThan(0);
  expect(Math.max(...layout.baselines) - Math.min(...layout.baselines)).toBeLessThanOrEqual(0.5);
  expect(layout.iconCenters).toHaveLength(2);
  for (const center of layout.iconCenters)
    expect(Math.abs(center - layout.center)).toBeLessThanOrEqual(0.5);
};

describe('published website UI package', () => {
  test('packs only the documented runtime, component, style, and package files', () => {
    const output = runPackageManager(
      getPackageManagerEntrypoint(),
      ['pack', '--dry-run', '--json'],
      { cwd: projectDirectory, encoding: 'utf8' },
    );
    const packResult = JSON.parse(output) as IPackDryRunResult;
    const packedPaths = packResult.files.map((file) => file.path);

    expect(packResult).toMatchObject({ name: '@moldea.ai/website-ui', version: '4.2.0' });
    expect(packedPaths).toContain('src/components/inspection-list/inspection-list.component.astro');
    expect(packedPaths).toContain(
      'src/components/inspection-dialog/inspection-dialog.component.astro',
    );
    expect(packedPaths).toContain(
      'src/components/inspection-dialog/output/inspection-output.component.astro',
    );
    expect(packedPaths).toContain('src/components/accordion/accordion.component.astro');
    expect(packedPaths).toContain('src/components/code-block/code-block.component.astro');
    expect(packedPaths).toContain(
      'src/components/code-copy-controls/code-copy-controls.component.astro',
    );
    expect(packedPaths).toContain(
      'src/components/connection-label/connection-label.component.astro',
    );
    expect(packedPaths).toContain('src/components/hero-backdrop/hero-backdrop.component.astro');
    expect(packedPaths).toContain('src/components/icon-tile/icon-tile.component.astro');
    expect(packedPaths).toContain('src/components/code-text/code-text.component.astro');
    expect(packedPaths).toContain('dist/evaluation-replay.js');
    expect(packedPaths).toContain('dist/index.js');
    expect(packedPaths).toContain('dist/runtime-catalog.js');
    expect(packedPaths).toContain('dist/runtime-catalog/index.d.ts');
    expect(packedPaths).toContain('runtime-logos/microsoft.png');
    expect(packedPaths).toContain('src/components/runtime-grid/runtime-grid.component.astro');
    expect(packedPaths).toContain('dist/code-diff.js');
    expect(packedPaths).toContain('dist/code-presentation.js');
    expect(packedPaths).toContain('dist/code-presentation/index.d.ts');
    expect(packedPaths).toContain('src/components/code-diff/code-diff.component.astro');
    expect(packedPaths).toContain('src/components/code-diff/rows/code-diff-rows.component.astro');
    expect(packedPaths).toContain('src/components/code-diff/line/code-diff-line.component.astro');
    expect(packedPaths).toContain('dist/markdown.js');
    expect(packedPaths).toContain('src/components/conversation/conversation.component.astro');
    expect(packedPaths).toContain(
      'src/components/conversation-message/conversation-message.component.astro',
    );
    expect(packedPaths.some((file) => file.includes('inline-brand-text'))).toBe(false);
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
    expect(packedPaths).toContain('src/components/file-tree/file-tree.component.astro');
    expect(packedPaths).toContain('src/components/result-summary/result-summary.component.astro');
    expect(packedPaths).toContain('LICENSE');
    expect(packedPaths).toContain('README.md');
    expect(packedPaths).toContain('cover.png');
    expect(packedPaths).toContain('package.json');
    expect(packedPaths.some((filePath) => filePath.includes('.test-'))).toBe(false);
    expect(packedPaths.some((filePath) => filePath.startsWith('docs/'))).toBe(false);
  });

  test('installs the real tarball and builds an Astro consumer using every public component', async () => {
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
            astro: '7.2.8',
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
        "import CodeDiff from '@moldea.ai/website-ui/code-diff';",
        "import CodeBlock from '@moldea.ai/website-ui/code-block';",
        "import CodeCopyControls from '@moldea.ai/website-ui/code-copy-controls';",
        "import ConnectionLabel from '@moldea.ai/website-ui/connection-label';",
        "import DocumentationShell from '@moldea.ai/website-ui/documentation-shell';",
        "import Dialog from '@moldea.ai/website-ui/dialog';",
        "import EvaluationReplay from '@moldea.ai/website-ui/evaluation-replay';",
        "import InspectionFinding from '@moldea.ai/website-ui/inspection-finding';",
        "import InspectionList from '@moldea.ai/website-ui/inspection-list';",
        "import InspectionDialog from '@moldea.ai/website-ui/inspection-dialog';",
        "import type { IInspectionResultView } from '@moldea.ai/website-ui/inspection-presentation';",
        "import { DIAGNOSTIC_GROUP_PRESENTATIONS } from '@moldea.ai/website-ui/inspection-presentation';",
        "import FilePreview from '@moldea.ai/website-ui/file-preview';",
        "import FileTree from '@moldea.ai/website-ui/file-tree';",
        "import HeroBackdrop from '@moldea.ai/website-ui/hero-backdrop';",
        "import IconTile from '@moldea.ai/website-ui/icon-tile';",
        "import CodeText from '@moldea.ai/website-ui/code-text';",
        "import Conversation from '@moldea.ai/website-ui/conversation';",
        "import ConversationMessage from '@moldea.ai/website-ui/conversation-message';",
        "import LocalSearch from '@moldea.ai/website-ui/local-search';",
        "import NavigationProgress from '@moldea.ai/website-ui/navigation-progress';",
        "import RuntimeGrid from '@moldea.ai/website-ui/runtime-grid';",
        "import ResultSummary from '@moldea.ai/website-ui/result-summary';",
        "import SiteFooter from '@moldea.ai/website-ui/site-footer';",
        "import SiteHeader from '@moldea.ai/website-ui/site-header';",
        "import StatusBadge from '@moldea.ai/website-ui/status-badge';",
        "import TabbedPanels from '@moldea.ai/website-ui/tabbed-panels';",
        "import ThemeBootstrap from '@moldea.ai/website-ui/theme-bootstrap';",
        "import ThemeControl from '@moldea.ai/website-ui/theme-control';",
        "import { buildEvaluationReplayPathTree, type IEvaluationReplayModel } from '@moldea.ai/website-ui/evaluation-replay-model';",
        "import { renderMarkdownDocument, renderMarkdownFragment } from '@moldea.ai/website-ui/markdown';",
        "import { withBase } from '@moldea.ai/website-ui/site';",
        "import '../styles.css';",
        '',
        "const rendered = await renderMarkdownDocument('# Fixture\\n\\n## moldea Shared Markdown');",
        "const conversationDocument = await renderMarkdownDocument('> **You**\\n>\\n> Inspect `@moldea.ai/core`.\\n\\n> **Coding agent**\\n>\\n> The declared export exists.', { conversations: true });",
        "const tree = buildEvaluationReplayPathTree([{ path: 'src/index.ts', type: 'file' }]);",
        "const replay = { trials: [{ confirmationIndex: 3, evaluatedAt: '2026-09-10T00:00:00.000Z', id: 'confirmation-3', kind: 'confirmation', steps: [{ kind: 'message', role: 'coding-agent', source: 'recorded', content: 'Added the greeting helper.\\n\\n' + String.fromCharCode(96).repeat(3) + 'js\\nexport const greet = (name) => name;\\n' + String.fromCharCode(96).repeat(3) }], title: 'Confirmation 3' }] } satisfies IEvaluationReplayModel;",
        "const navigationItems = [{ href: '/', isActive: true, label: 'moldea Home' }, { href: '/repository-format/', isActive: false, label: 'Repository Format', compactLabel: 'Repo. Format' }] satisfies ComponentProps<typeof SiteHeader>['navigationItems'];",
        'const fileProps = { path: "src/returns/policy.ts", label: "Return policy", tone: "warning" } satisfies ComponentProps<typeof FilePreview>;',
        'const codeProps = { source: "echo order-status", language: "sh", variant: "plain", copyable: true, ariaLabel: "Order status command" } satisfies ComponentProps<typeof CodeBlock>;',
        'const contextBefore = Array.from({ length: 16 }, (_, index) => `const slot${index} = "${"booking-time-".repeat(16)}";`).join("\\n") + "\\n";',
        'const contextAfter = contextBefore.replace("slot8", "availableSlot8");',
        'const diffProps = { oldValue: "const hours = getHours(10);\\n// Previous hours\\n", newValue: "const hours = getHours(14);\\n// Updated hours\\n", language: "typescript", ariaLabel: "Booking changes", view: "unified", variant: "plain" } satisfies ComponentProps<typeof CodeDiff>;',
        'const nonCopyableCodeProps = { source: "incomplete result", language: "text", copyable: false, ariaLabel: "Incomplete result" } satisfies ComponentProps<typeof CodeBlock>;',
        'const longProse = "Offer available times and send same-day requests to staff. ".repeat(32);',
        'const longCode = JSON.stringify({ instructions: longProse });',
        'const fence = String.fromCharCode(96).repeat(3);',
        'let fenceIndex = 0;',
        'const fenceHtml = (await renderMarkdownFragment(["markdown", "text", "yaml", "json", ""].map((language) => [fence + language, longProse, fence].join("\\n")).join("\\n\\n"))).replaceAll(\'aria-label="Code block"\', () => `aria-label="Fenced source ${++fenceIndex}"`);',
        'const mixedPatch = ["--- a/policy.md", "+++ b/policy.md", "@@ -1 +1 @@", "-" + longProse, "+" + longProse + "Ask for approval.", "--- a/service.ts", "+++ b/service.ts", "@@ -1 +1 @@", "-const before = " + longCode + ";", "+const after = " + longCode + ";", ""].join("\\n");',
        'const unchangedSource = "const approval = true;\\nconst confirmed = false;\\n";',
        'const connectionProps = { tone: "danger" } satisfies ComponentProps<typeof ConnectionLabel>;',
        'const accordionProps = { id: "check-two", group: "fixture-accordion", title: "Second check", isOpen: true } satisfies ComponentProps<typeof Accordion>;',
        'const summaryProps = { title: "Reference not found", description: "The declared file is absent.", tone: "danger", as: "h2", headingId: "composed-result-title", ariaLabel: "Fixture outcome" } satisfies ComponentProps<typeof ResultSummary>;',
        'const dialogProps = { id: "fixture-wide", title: "Detailed evidence", triggerLabel: "Inspect evidence", triggerVariant: "primary", triggerSize: "lg", size: "large", panelClass: "sm:h-[32rem]!", description: "Recorded evidence details." } satisfies ComponentProps<typeof Dialog>;',
        'const iconDialogProps = { id: "fixture-icon", title: "Complete source", triggerLabel: "Open complete source", triggerAriaLabel: "Open complete source in a larger view", triggerVariant: "ghost", triggerSize: "icon-xs", size: "large" } satisfies ComponentProps<typeof Dialog>;',
        'const passed = { title: "Validation complete", label: "Passed", tone: "success", findings: [], outputLabel: "JSON", output: JSON.stringify({ valid: true, diagnostics: [], coverage: { checked: ["references"], unchecked: [] } }), redactions: [] } satisfies IInspectionResultView;',
        'const failed = { ...passed, title: "Validation failed", label: "Blocking", tone: "danger", outputLabel: "JSON", command: "moldea validate --json", exitStatus: 1, output: JSON.stringify({ version: 1, command: "validate", status: "invalid", result: { valid: false, coverage: { checked: ["references"], unchecked: ["agents"] } }, diagnostics: [{ code: "MOLDEA_REFERENCE_NOT_FOUND" }], error: null }), findings: [{ id: "missing", title: "Reference not found", code: "MOLDEA_REFERENCE_NOT_FOUND", severity: "error", group: "references", message: "The declared policy file is absent.", path: "/moldea/moldea.yaml", pointer: "/context/~1moldea~1policy.md/bindings/0", evidence: [{ path: "/moldea/moldea.yaml", language: "yaml", content: "references:\\n  - path: src/policy.ts" }, { path: "src/policy.ts", language: "typescript", label: "Referenced target", isMissing: true, issueLabel: "Missing target" }] }] } satisfies IInspectionResultView;',
        'const multiple = { ...failed, title: "Inspection complete", findings: [{ id: "accepted", title: "Unmatched relationship", code: "MOLDEA_IMPACT_PATTERN_UNMATCHED", severity: "warning", group: "references", accepted: true, reason: "Generated files arrive during the release build.", message: "No current file matches the declared pattern.", path: "src/" + "long-directory/".repeat(8) + "policy.ts", evidence: [] }, ...failed.findings, { ...failed.findings[0], id: "warning", title: "Integration needs attention", severity: "warning", group: "integration" }] } satisfies IInspectionResultView;',
        'const illustrated = { title: "Illustrative policy review", label: "Blocking", tone: "danger", findings: [{ id: "authority", title: "Approval authority", code: "CONTEXT_CONTRADICTED", severity: "error", category: "context", message: "Only managers can approve refunds.", evidence: [{ path: "project.md", language: "markdown", content: "Only managers can approve refunds.", isExcerpt: true }, { path: "instruction.md", language: "markdown", beforeContent: "Explain the refund policy.", content: "Approve refunds for customers.", isExcerpt: true, issueLabel: "Violates project rule" }] }], redactions: [], limitation: "Illustrative finding." } satisfies IInspectionResultView;',
        'const many = { ...illustrated, title: "Policy findings", findings: Array.from({ length: 32 }, (_, index) => ({ ...illustrated.findings[0], id: `policy-${index}`, title: `Policy finding ${index + 1}`, evidence: [] })) } satisfies IInspectionResultView;',
        'const refused = { ...passed, title: "Operation refused", label: "Refused", tone: "warning", code: "INVALID_PAGE_REQUEST" } satisfies IInspectionResultView;',
        'const statusResults = [{ ...passed, title: "Reader result", label: "Result", tone: "neutral" }, { ...failed, title: "Review warning", label: "Warning", tone: "warning", findings: [{ ...failed.findings[0], severity: "warning" }] }, { ...failed, title: "Accepted warning", label: "Accepted", tone: "info", findings: [{ ...failed.findings[0], severity: "warning", accepted: true }] }] satisfies IInspectionResultView[];',
        '---',
        '<html lang="en" data-theme="system">',
        '  <head>',
        '    <meta charset="utf-8" />',
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
        '    <p>Use moldea here and preserve @moldea.ai/core as one token.</p>',
        '    {conversationDocument.blocks.map((block) => block.kind === "html" ? <div set:html={block.html} /> : <Conversation>{block.messages.map((message) => <ConversationMessage role={message.role}><div set:html={message.html} /></ConversationMessage>)}</Conversation>)}',
        '    <Conversation><ConversationMessage role="assistant"><p>Recorded change</p><div class="conversation-message-footer" data-bubble-footer><p>Files changed</p></div></ConversationMessage></Conversation>',
        '    <ActionLink href="https://example.com" target="_blank" rel="author">External action</ActionLink>',
        '    <ActionButton>Run</ActionButton>',
        '    <section class="relative overflow-hidden"><HeroBackdrop /><h1 class="relative">Consumer hero</h1></section>',
        '    <CodeBlock source={JSON.stringify({ valid: false })} language="json" />',
        '    <CodeBlock {...codeProps} />',
        '    <CodeDiff {...diffProps} overflow="wrap" />',
        '    <CodeDiff {...diffProps} overflow="wrap" view="split" ariaLabel="Booking changes split" />',
        '    <CodeDiff oldValue={contextBefore} newValue={contextAfter} language="typescript" ariaLabel="Availability changes" view="split" overflow="wrap" />',
        '    <CodeDiff oldValue={contextBefore} newValue={contextAfter} language="typescript" ariaLabel="Availability changes scroll" overflow="scroll" />',
        '    <CodeDiff oldValue={contextBefore} newValue={contextAfter} language="typescript" ariaLabel="Availability changes split scroll" view="split" overflow="scroll" />',
        '    <CodeDiff oldValue="" newValue={\'<script>literal</script>\'} />',
        '    <CodeDiff patch={"--- a/policy.ts\\n+++ b/policy.ts\\n@@ -8 +8 @@\\n-const hours = getHours(10);\\n+const hours = getHours(14);\\n"} language="typescript" view="split" ariaLabel="Recorded policy change" />',
        '    <CodeDiff patch={"Binary files a/image.png and b/image.png differ\\n"} ariaLabel="Recorded binary change" />',

        '    <CodeBlock {...nonCopyableCodeProps} />',
        '    <CodeBlock source="Plain text wraps in narrow containers." language="text" ariaLabel="Plain excerpt" />',
        '    <section data-wrapping-fixtures>',
        '      <CodeBlock source={longProse} language="markdown" ariaLabel="Markdown block" />',
        '      <CodeBlock source={longProse} language="text" ariaLabel="Text block" />',
        '      <CodeBlock source={longCode} language="json" ariaLabel="JSON block" />',
        '      <CodeBlock source={"instructions: " + longProse} language="yaml" ariaLabel="YAML block" />',
        '      <CodeBlock source={longCode} language="json" overflow="wrap" ariaLabel="Wrapped code block" />',
        '      <CodeBlock source={longProse} language="markdown" overflow="scroll" ariaLabel="Scrolling Markdown block" />',
        '      <div class="prose-moldea" data-overflow-fences set:html={fenceHtml} />',
        '      <CodeDiff oldValue={longProse} newValue={longProse + "Ask for approval."} language="markdown" ariaLabel="Markdown diff" />',
        '      <CodeDiff oldValue={longProse} newValue={longProse + "Ask for approval."} language="text" ariaLabel="Text diff" />',
        '      <CodeDiff oldValue={longCode} newValue={longCode.replace("instructions", "current")} language="json" ariaLabel="JSON diff" />',
        '      <CodeDiff oldValue={longProse} newValue={"New " + longProse} language="markdown" overflow="scroll" ariaLabel="Scrolling Markdown diff" />',
        '      <CodeDiff oldValue={longCode} newValue={longProse + longCode} language="typescript" view="split" overflow="wrap" ariaLabel="Wrapped split diff" />',
        '      <CodeDiff patch={mixedPatch} ariaLabel="Mixed patch" view="split" />',
        '      <CodeDiff patch={mixedPatch} overflow="wrap" ariaLabel="Wrapped mixed patch" />',
        '      <CodeDiff patch={mixedPatch} overflow="scroll" ariaLabel="Scrolling mixed patch" />',
        '      <FilePreview path="src/policy.ts"><CodeDiff {...diffProps} ariaLabel="Changed edge spacing" variant="plain" /></FilePreview>',
        '      <FilePreview path="src/policy.ts"><CodeDiff oldValue={unchangedSource} newValue={unchangedSource} language="typescript" ariaLabel="Unchanged edge spacing" variant="plain" /></FilePreview>',
        '    </section>',
        '    <ConnectionLabel {...connectionProps}><span slot="icon">!</span>Missing from <code class="inline-code">moldea.yaml</code></ConnectionLabel>',
        '    <ConnectionLabel>Linked file</ConnectionLabel>',
        '    <section><h2>Fixture checks</h2><Accordion id="check-one" group="fixture-accordion" title="First check" description="One concise outcome."><StatusBadge slot="status" label="Valid" tone="success" size="sm" /><p>First visual</p></Accordion><Accordion {...accordionProps}><FilePreview path="src/policy.ts" label="Policy"><p>Second visual</p></FilePreview></Accordion></section>',
        '    <Accordion id="closed-check" title="Closed check"><p>Optional detail</p></Accordion>',
        '    <FilePreview {...fileProps}><span slot="icon">File</span><StatusBadge slot="status" label="Missing" size="sm" tone="danger" /><pre class="code-block" tabindex="0" role="region" aria-label="Return policy source"><code>export const returnWindowDays = 30;</code></pre></FilePreview>',
        '    <FileTree ariaLabel="Repository files" nodes={[{ kind: "file", name: "policy.md", path: "policy.md", removed: true }]} />',
        '    <Dialog id="composed-result" title="Reference not found" triggerLabel="Inspect composed result" isOverlayCloseEnabled><ResultSummary slot="heading" {...summaryProps}><span slot="icon">!</span><StatusBadge slot="status" label="Invalid" size="sm" tone="danger" /></ResultSummary><p>Composed result body</p></Dialog>',
        '    <ResultSummary title="Metadata available" description="Logical paths only." as="h3" />',
        '    <p><IconTile size="sm" tone="success">1</IconTile><CodeText value={"a".repeat(64)} /><CodeText value="src/answer-cache.ts" /><CodeText value="sha256-digest" title="Recorded digest" /></p>',
        '    <Dialog id="fixture-result" title="Fixture result" triggerLabel="View result"><div slot="heading"><h2 id="fixture-result-title">Fixture result</h2><StatusBadge label="Invalid" size="sm" tone="danger" /><p>Recorded check</p></div><p>Result content</p></Dialog>',
        '    <Dialog id="fixture-details" title="Fixture details" triggerLabel="View details"><p>Details without a badge</p></Dialog>',
        '    <Dialog {...dialogProps}><p>Wide evidence content</p></Dialog>',
        '    <Dialog {...iconDialogProps}><p>Expanded source content</p></Dialog>',
        '    <main data-inspection-fixture class="mx-auto max-w-3xl px-3"><h2>Inspection examples</h2><InspectionList id="passed" result={passed} /><InspectionList id="single" result={failed} /><InspectionList id="illustrated" result={illustrated} /><InspectionList id="many" result={many} /><InspectionList id="refused" result={refused} />{statusResults.map((result) => <InspectionList id={`hover-${result.tone}`} result={result} />)}<Dialog id="outer-case" title="Case details" triggerLabel="Open case"><InspectionList id="multiple" result={multiple} /></Dialog><a href="#standalone" data-dialog-open="standalone">Open standalone output</a><InspectionDialog id="standalone" result={passed} /><a href="/runtimes/">Navigate to runtimes</a></main>',
        '    <ActionLink href={withBase("/docs/")}>Docs</ActionLink>',
        '    <StatusBadge label="Available" tone="success" />',
        '    <InspectionFinding title="Declared export missing" code="MOLDEA_REFERENCE_EXPORT_MISSING" severity="error" presentation={DIAGNOSTIC_GROUP_PRESENTATIONS.references} />',
        '    <InspectionFinding title="Impact pattern documented early" code="MOLDEA_IMPACT_PATTERN_UNMATCHED" severity="warning" presentation={DIAGNOSTIC_GROUP_PRESENTATIONS.references} accepted />',
        '    <CodeDiff patch={"--- a/policy.ts\\n+++ b/policy.ts\\n@@ -1000 +1000 @@\\n-export const days = 30;\\n+export const days = 60;\\n"} ariaLabel="Four-digit lines" overflow="wrap" />',
        '    <TabbedPanels ariaLabel="Fixture views" id="fixture-tabs" items={[{ id: "first", label: "First", slotName: "first" }, { id: "second", label: "Second", slotName: "second" }]}><p slot="first">First panel</p><p slot="second">Second panel</p></TabbedPanels>',
        '    <EvaluationReplay id="fixture-replay" replay={replay} />',
        '    <DocumentationShell breadcrumbs={[{ href: "/", label: "Home" }, { label: "moldea Docs" }]} currentRoute="/docs/" headings={rendered.headings} navigationGroups={[{ label: "moldea Guides", items: [{ href: "/docs/", label: "moldea Start" }] }]} previousPage={{ href: "/previous/", label: "Previous moldea guide" }} nextPage={{ href: "/next/", label: "Next moldea guide" }}><div class="prose-moldea" set:html={rendered.html} /></DocumentationShell>',
        '    <p>{tree[0]?.name}</p>',
        '    <section data-runtime-fixture><h2>Runtime labels</h2><RuntimeGrid /></section>',
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
    const consumerRequire = createRequire(path.join(fixtureDirectory, 'package.json'));
    expect(() => consumerRequire.resolve('@moldea.ai/website-ui/inline-brand-text')).toThrow(
      'Package subpath',
    );
    writeFileSync(
      path.join(pagesDirectory, 'runtimes.astro'),
      [
        '---',
        "import RuntimeGrid from '@moldea.ai/website-ui/runtime-grid';",
        "import { RUNTIME_CATALOG } from '@moldea.ai/website-ui/runtime-catalog';",
        "import microsoftLogo from '@moldea.ai/website-ui/runtime-logos/microsoft.png?url';",
        "import '../styles.css';",
        '---',
        '<html lang="en"><head><title>Runtime labels</title></head><body>',
        '<main data-runtime-count={RUNTIME_CATALOG.length}><RuntimeGrid />',
        '<img src={microsoftLogo} width="32" height="32" alt="Microsoft logo" /></main>',
        '</body></html>',
      ].join('\n'),
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
    const runtimeHtml = readFileSync(
      path.join(fixtureDirectory, 'dist', 'runtimes', 'index.html'),
      'utf8',
    );
    expect(runtimeHtml).toContain('data-runtime-count="35"');
    expect(runtimeHtml).toContain('href="https://openai.com/"');
    expect(fixtureHtml).toContain('Consumer hero');
    expect(fixtureHtml).toContain('data-code-diff="unified"');
    expect(fixtureHtml).toContain('data-code-diff="split"');
    expect(fixtureHtml).toContain('aria-label="Booking changes"');
    expect(fixtureHtml).not.toContain('1 removed, 1 added');
    expect(fixtureHtml).toContain('&lt;script&gt;literal&lt;/script&gt;');
    expect(fixtureHtml).not.toContain('<script>literal</script>');
    const stylesheetName = readdirSync(path.join(fixtureDirectory, 'dist', '_astro')).find((name) =>
      name.endsWith('.css'),
    );
    if (stylesheetName === undefined) {
      throw new Error('The Astro fixture did not emit its configured external stylesheet.');
    }
    const stylesheet = readFileSync(
      path.join(fixtureDirectory, 'dist', '_astro', stylesheetName),
      'utf8',
    );
    const browser = await chromium.launch();
    try {
      for (const theme of ['light', 'dark']) {
        for (const width of [320, 768, 1440]) {
          const context = await browser.newContext({
            viewport: { width, height: 900 },
            reducedMotion: 'reduce',
          });
          try {
            const page = await context.newPage();
            await page.route('https://runtime-fixture.example/**', async (route) => {
              const assetName = new URL(route.request().url()).pathname.split('/').at(-1);
              if (assetName === undefined || !/^[a-zA-Z0-9_.-]+\.(?:svg|png)$/u.test(assetName)) {
                await route.abort();
                return;
              }
              await route.fulfill({
                contentType: assetName.endsWith('.png') ? 'image/png' : 'image/svg+xml',
                body: readFileSync(path.join(fixtureDirectory, 'dist', '_astro', assetName)),
              });
            });
            await page.setContent(
              fixtureHtml
                .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gu, '')
                .replaceAll('src="/_astro/', 'src="https://runtime-fixture.example/_astro/'),
            );
            await page.addStyleTag({ content: stylesheet });
            await page.evaluate((selectedTheme) => {
              document.documentElement.className = selectedTheme;
            }, theme);
            const finding = page.getByRole('article', {
              name: 'Declared export missing: MOLDEA_REFERENCE_EXPORT_MISSING',
            });
            expect(await finding.locator('svg.lucide-link-2').count()).toBe(1);
            expect(await finding.locator('svg.lucide-circle-alert').count()).toBe(1);
            const badgeStyle = await finding
              .getByText('Blocking', { exact: true })
              .evaluate((node) => ({
                transform: getComputedStyle(node).textTransform,
                weight: getComputedStyle(node).fontWeight,
              }));
            expect(badgeStyle).toStrictEqual({ transform: 'none', weight: '600' });
            // axe skips icons, so the info tile's icon is held to 3:1 against its composited tint
            const acceptedTileContrast = await page
              .getByRole('article', {
                name: 'Impact pattern documented early: MOLDEA_IMPACT_PATTERN_UNMATCHED',
              })
              .locator('[data-icon-tile="info"]')
              .evaluate((tile) => {
                const canvas = document.createElement('canvas');
                canvas.width = 1;
                canvas.height = 1;
                const context = canvas.getContext('2d', { willReadFrequently: true })!;
                const paint = (colors: string[]) => {
                  context.clearRect(0, 0, 1, 1);
                  for (const color of colors) {
                    context.fillStyle = color;
                    context.fillRect(0, 0, 1, 1);
                  }
                  return context.getImageData(0, 0, 1, 1).data;
                };
                const layers: string[] = [];
                for (let node: Element | null = tile; node; node = node.parentElement) {
                  layers.unshift(getComputedStyle(node).backgroundColor);
                  if (paint([layers[0]!])[3] === 255) break;
                }
                const luminance = (colors: string[]) => {
                  const [red, green, blue] = Array.from(paint(colors).slice(0, 3), (channel) => {
                    const value = channel / 255;
                    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
                  });
                  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
                };
                const tint = luminance(layers);
                const icon = luminance([
                  ...layers,
                  getComputedStyle(tile.querySelector('svg')!).color,
                ]);
                return (Math.max(tint, icon) + 0.05) / (Math.min(tint, icon) + 0.05);
              });
            expect(acceptedTileContrast).toBeGreaterThanOrEqual(3);
            // the accepted label's text contrast is scanned on its own, before any dialog covers the page
            expect(
              (
                await new AxeBuilder({ page })
                  .include('[data-finding-code="MOLDEA_IMPACT_PATTERN_UNMATCHED"]')
                  .analyze()
              ).violations,
            ).toStrictEqual([]);
            // finding codes wrap only after separators, never mid-word
            const separatedCode = finding.locator('code');
            expect(await separatedCode.textContent()).toBe('MOLDEA_REFERENCE_EXPORT_MISSING');
            expect(await separatedCode.evaluate((node) => node.innerHTML)).toBe(
              'MOLDEA_<wbr>REFERENCE_<wbr>EXPORT_<wbr>MISSING',
            );
            expect(
              await page
                .getByRole('link', { name: 'Fixture source', exact: true, includeHidden: true })
                .first()
                .locator('svg.lucide-git-branch[data-external-link-icon]')
                .count(),
            ).toBe(1);
            const gutter = await page
              .getByRole('region', { name: 'Four-digit lines', exact: true })
              .evaluate((node) =>
                Array.from(node.querySelectorAll('[data-diff-line]')).map((row) => {
                  const cells = Array.from(row.children) as HTMLElement[];
                  const visibleNumbers = cells
                    .slice(0, -2)
                    .filter((cell) => getComputedStyle(cell).display !== 'none');
                  const number = visibleNumbers.at(-1)!;
                  const marker = cells.at(-2)!;
                  const content = cells.at(-1)!;
                  const numberRange = document.createRange();
                  numberRange.selectNodeContents(number);
                  const markerRange = document.createRange();
                  markerRange.selectNodeContents(marker);
                  const sourceRange = document.createRange();
                  sourceRange.selectNodeContents(content.querySelector('code')!);
                  return {
                    numberGap:
                      markerRange.getBoundingClientRect().left -
                      numberRange.getBoundingClientRect().right,
                    sourceGap:
                      sourceRange.getBoundingClientRect().left -
                      markerRange.getBoundingClientRect().right,
                    overflow: number.scrollWidth > number.clientWidth,
                  };
                }),
              );
            for (const row of gutter) {
              expect(row.numberGap).toBeGreaterThanOrEqual(8);
              expect(row.sourceGap).toBeGreaterThanOrEqual(6);
              expect(row.overflow).toBe(false);
            }
            const gutterWidth = (name: string) =>
              page
                .getByRole('region', { name, exact: true })
                .locator('[data-diff-line]')
                .first()
                .evaluate(
                  (row) =>
                    Array.from(row.children)
                      .slice(0, -2)
                      .filter((cell) => getComputedStyle(cell).display !== 'none')
                      .at(-1)!
                      .getBoundingClientRect().width,
                );
            expect(await gutterWidth('Booking changes')).toBeLessThan(
              await gutterWidth('Four-digit lines'),
            );
            expect(await page.locator('#single-result').isVisible()).toBe(true);
            expect(
              await page
                .locator('#single-result')
                .getByText('moldea validate --json', { exact: true })
                .isVisible(),
            ).toBe(true);
            expect(
              await page
                .locator('#single-result')
                .getByText('Missing target', { exact: true })
                .isVisible(),
            ).toBe(true);
            const runtimeGrid = page.getByRole('list', { name: 'Runtime guidance', exact: true });
            expect(await runtimeGrid.getByRole('link').count()).toBe(35);
            const runtimeLink = runtimeGrid.getByRole('link', {
              name: /^OpenAI openai \(opens in a new tab\)$/u,
            });
            expect(await runtimeLink.getAttribute('href')).toBe('https://openai.com/');
            await runtimeLink.focus();
            expect(await runtimeLink.evaluate((node) => getComputedStyle(node).boxShadow)).not.toBe(
              'none',
            );
            await page.keyboard.press('Tab');
            expect(
              await runtimeGrid
                .getByRole('link', {
                  name: /^Vercel AI SDK vercel-ai-sdk \(opens in a new tab\)$/u,
                })
                .evaluate((node) => node === document.activeElement),
            ).toBe(true);
            await runtimeGrid.scrollIntoViewIfNeeded();
            for (const image of await runtimeGrid.locator('img').all()) {
              expect(await image.getAttribute('loading')).toBe('lazy');
              expect(await image.getAttribute('decoding')).toBe('async');
              expect(await image.getAttribute('alt')).toBe('');
              expect(await image.getAttribute('width')).toBe('56');
              expect(await image.getAttribute('height')).toBe('56');
              if (await image.isVisible()) {
                await image.scrollIntoViewIfNeeded();
                await image.evaluate((node) => (node as HTMLImageElement).decode());
                expect(
                  await image.evaluate((node) => (node as HTMLImageElement).naturalWidth),
                ).toBeGreaterThan(0);
              }
            }
            expect(
              (await new AxeBuilder({ page }).include('[data-runtime-grid]').analyze()).violations,
            ).toStrictEqual([]);
            for (const name of ['Documentation navigation', 'On this page']) {
              expect(await page.getByRole('complementary', { name, exact: true }).count()).toBe(
                width === 1440 ? 1 : 0,
              );
            }
            expect(
              (
                await new AxeBuilder({ page })
                  .include('aside')
                  .withRules(['landmark-unique'])
                  .analyze()
              ).violations,
            ).toStrictEqual([]);
            await page.evaluate((selectedTheme) => {
              document.documentElement.className = selectedTheme;
              document.title = 'Code diff fixture';
              const main = document.createElement('main');
              const heading = document.createElement('h1');
              heading.textContent = 'File comparison examples';
              const examples = Array.from(
                document.querySelectorAll(
                  '[data-code-diff], [data-code-block], [data-wrapping-fixtures], [data-runtime-fixture]',
                ),
              ).filter(
                (element) =>
                  !element.parentElement?.closest(
                    '[data-code-diff], [data-wrapping-fixtures], [data-inspection-fixture]',
                  ),
              );
              main.append(heading, ...examples);
              document.body.replaceChildren(main);
            }, theme);
            const diff = page.getByRole('region', { name: 'Availability changes', exact: true });
            expect(
              await page.getByRole('region', { name: 'Booking changes', exact: true }).innerText(),
            ).not.toMatch(/Before|After|removed,|added/u);
            await diff.focus();
            expect(await diff.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe(
              'none',
            );
            const summary = diff.locator('summary').first();
            await summary.focus();
            await summary.press('Enter');
            expect(
              await summary.evaluate((element) => element.parentElement!.hasAttribute('open')),
            ).toBe(true);
            await summary.press('Enter');
            expect(
              await summary.evaluate((element) => element.parentElement!.hasAttribute('open')),
            ).toBe(false);
            if (width === 320) {
              expect(await diff.locator('[data-diff-unified]:visible').count()).toBeGreaterThan(0);
              expect(await diff.locator('[data-diff-split]:visible').count()).toBe(0);
            } else {
              expect(await diff.locator('[data-diff-unified]:visible').count()).toBe(0);
              expect(await diff.locator('[data-diff-split]:visible').count()).toBeGreaterThan(0);
              // container width, rather than the page viewport, controls the fallback
              await diff.evaluate((element) => {
                element.style.width = '320px';
              });
              expect(await diff.locator('[data-diff-unified]:visible').count()).toBeGreaterThan(0);
              expect(await diff.locator('[data-diff-split]:visible').count()).toBe(0);
            }
            const pageDimensions = await page.evaluate(() => ({
              width: document.documentElement.clientWidth,
              scrollWidth: document.documentElement.scrollWidth,
              regions: Array.from(document.querySelectorAll('[data-code-diff]')).map((node) => ({
                name: node.getAttribute('aria-label'),
                width: node.getBoundingClientRect().width,
                scrollWidth: node.scrollWidth,
                overflow: getComputedStyle(node).overflowX,
                childWidth: node.children[0]?.getBoundingClientRect().width,
              })),
            }));
            expect(
              pageDimensions.scrollWidth <= pageDimensions.width,
              JSON.stringify(pageDimensions),
            ).toBe(true);
            for (const element of await page.locator('[data-code-diff]').all()) {
              const isScrollable = (await element.getAttribute('data-diff-overflow')) === 'scroll';
              const hasOverflow = await element.evaluate(
                (node) => node.scrollWidth > node.clientWidth,
              );
              if (!isScrollable) expect(hasOverflow).toBe(false);
              if ((await element.getAttribute('data-diff-overflow')) === 'mixed') continue;
              const code = element.locator('[data-diff-line] code:visible').first();
              if (await code.count()) {
                expect(await code.evaluate((node) => getComputedStyle(node).whiteSpace)).toBe(
                  isScrollable ? 'pre' : 'pre-wrap',
                );
              }
              if (isScrollable && hasOverflow) {
                await element.focus();
                await element.press('ArrowRight');
                await expect
                  .poll(() => element.evaluate((node) => node.scrollLeft))
                  .toBeGreaterThan(0);
                const rows = element.locator('[data-diff-line]:visible');
                expect(
                  await rows.first().evaluate((node) => getComputedStyle(node).lineHeight),
                ).toBe('24px');
                const splitRows = element.locator('[data-diff-split]:visible');
                const hasSplitRows =
                  (await element.getAttribute('data-code-diff')) === 'split' && width >= 768;
                expect((await splitRows.count()) > 0).toBe(hasSplitRows);
                const context = element.locator('summary').first();
                if (await context.count()) {
                  await context.focus();
                  await context.press('Enter');
                  expect(
                    await context.evaluate((node) => node.parentElement!.hasAttribute('open')),
                  ).toBe(true);
                  await context.press('Enter');
                }
              }
            }
            for (const [name, mode] of [
              ['Markdown block', 'wrap'],
              ['Text block', 'wrap'],
              ['JSON block', 'scroll'],
              ['YAML block', 'scroll'],
              ['Wrapped code block', 'wrap'],
              ['Scrolling Markdown block', 'scroll'],
            ] as const) {
              const block = page.getByRole('region', { name, exact: true });
              expect(await block.getAttribute('data-code-overflow')).toBe(mode);
              expect(await block.evaluate((node) => getComputedStyle(node).whiteSpace)).toBe(
                mode === 'wrap' ? 'pre-wrap' : 'pre',
              );
              expect(await block.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(
                mode === 'scroll',
              );
              await block.focus();
              expect(await block.evaluate((node) => getComputedStyle(node).boxShadow)).not.toBe(
                'none',
              );
              if (mode === 'scroll') {
                await block.press('ArrowRight');
                await expect
                  .poll(() => block.evaluate((node) => node.scrollLeft))
                  .toBeGreaterThan(0);
              }
            }
            expect(
              await page.locator('[data-overflow-fences] pre').evaluateAll((nodes) =>
                nodes.map((node) => ({
                  mode: node.getAttribute('data-code-overflow'),
                  whiteSpace: getComputedStyle(node).whiteSpace,
                  hasOverflow: node.scrollWidth > node.clientWidth,
                })),
              ),
            ).toStrictEqual([
              { mode: 'wrap', whiteSpace: 'pre-wrap', hasOverflow: false },
              { mode: 'wrap', whiteSpace: 'pre-wrap', hasOverflow: false },
              { mode: 'scroll', whiteSpace: 'pre', hasOverflow: true },
              { mode: 'scroll', whiteSpace: 'pre', hasOverflow: true },
              { mode: 'scroll', whiteSpace: 'pre', hasOverflow: true },
            ]);
            for (const [name, rowCount] of [
              ['Changed edge spacing', 4],
              ['Unchanged edge spacing', 2],
            ] as const) {
              const comparison = page.getByRole('region', { name, exact: true });
              const spacing = await comparison.evaluate((node) => {
                const rows = Array.from(node.querySelectorAll('[data-diff-line]'));
                const first = rows[0]!;
                const last = rows.at(-1)!;
                return {
                  height: node.getBoundingClientRect().height,
                  leadingGap: first.getBoundingClientRect().top - node.getBoundingClientRect().top,
                  trailingGap:
                    node.getBoundingClientRect().bottom - last.getBoundingClientRect().bottom,
                  firstPadding: getComputedStyle(first).paddingTop,
                  lastPadding: getComputedStyle(last).paddingBottom,
                };
              });
              expect(spacing).toStrictEqual({
                height: rowCount * 24 + 8,
                leadingGap: 0,
                trailingGap: 0,
                firstPadding: '4px',
                lastPadding: '4px',
              });
            }
            const mixed = page.getByRole('region', { name: 'Mixed patch', exact: true });
            expect(await mixed.getAttribute('data-diff-overflow')).toBe('mixed');
            const markdownGroup = mixed.locator('[data-diff-group-overflow="wrap"]');
            expect(
              await markdownGroup.evaluate((node) => node.scrollWidth <= node.clientWidth),
            ).toBe(true);
            expect(
              await markdownGroup
                .locator('code:visible')
                .first()
                .evaluate((node) => getComputedStyle(node).whiteSpace),
            ).toBe('pre-wrap');
            const codeGroup = mixed.getByRole('region', {
              name: 'Mixed patch: scrollable changes 2',
              exact: true,
            });
            expect(await codeGroup.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(
              true,
            );
            await codeGroup.focus();
            await codeGroup.press('ArrowRight');
            await expect
              .poll(() => codeGroup.evaluate((node) => node.scrollLeft))
              .toBeGreaterThan(0);
            for (const mode of ['wrap', 'scroll'] as const) {
              const overridden = page.getByRole('region', {
                name: mode === 'wrap' ? 'Wrapped mixed patch' : 'Scrolling mixed patch',
                exact: true,
              });
              expect(await overridden.getAttribute('data-diff-overflow')).toBe(mode);
              expect(await overridden.locator('[data-diff-group-overflow]').count()).toBe(0);
            }
            if (width >= 768) {
              const pairs = await page
                .getByRole('region', { name: 'Wrapped split diff', exact: true })
                .locator('[data-diff-split]:visible > div')
                .evaluateAll((rows) =>
                  rows.map((row) =>
                    Array.from(row.children).map(
                      (cell) => cell.firstElementChild!.getBoundingClientRect().height,
                    ),
                  ),
                );
              expect(pairs.length).toBeGreaterThan(0);
              for (const pair of pairs) expect(pair[0]).toBe(pair[1]);
            }
            const recorded = page.getByRole('region', {
              name: 'Recorded policy change',
              exact: true,
            });
            expect(
              (await page.locator('[data-diff-line]').allTextContents()).join('\n'),
            ).not.toContain('No newline at end of file');
            expect(await recorded.innerText()).not.toMatch(/b\/policy\.ts|@@/u);
            const raw = recorded.getByText('View recorded patch', { exact: true });
            await raw.focus();
            await raw.press('Enter');
            expect(
              await recorded
                .getByRole('region', {
                  name: 'Recorded policy change: recorded source',
                  exact: true,
                })
                .innerText(),
            ).toContain('@@ -8 +8 @@');
            await raw.press('Enter');
            expect(
              await page
                .getByRole('region', {
                  name: 'Recorded binary change: recorded source',
                  exact: true,
                })
                .innerText(),
            ).toContain('Binary files a/image.png and b/image.png differ');
            const accessibility = await new AxeBuilder({ page }).analyze();
            expect(accessibility.violations).toStrictEqual([]);
          } finally {
            await context.close();
          }
        }
      }
      // Execute the packed scripts against real built HTML, without a shared server or captures.
      for (const theme of ['light', 'dark']) {
        for (const width of [320, 768, 1440]) {
          const context = await browser.newContext({
            viewport: { width, height: 900 },
            reducedMotion: 'reduce',
          });
          try {
            const page = await context.newPage();
            const pageErrors: string[] = [];
            page.on('pageerror', (error) => pageErrors.push(error.message));
            await page.route('https://ui-consumer.example/**', async (route) => {
              const pathname = new URL(route.request().url()).pathname;
              if (pathname === '/' || pathname === '/runtimes/') {
                await route.fulfill({
                  contentType: 'text/html',
                  body: pathname === '/' ? fixtureHtml : runtimeHtml,
                });
                return;
              }
              const asset = /^\/_astro\/([a-zA-Z0-9_.-]+)$/u.exec(pathname)?.[1];
              if (asset === undefined) {
                await route.abort();
                return;
              }
              const contentType = asset.endsWith('.js')
                ? 'text/javascript'
                : asset.endsWith('.css')
                  ? 'text/css'
                  : asset.endsWith('.svg')
                    ? 'image/svg+xml'
                    : asset.endsWith('.png')
                      ? 'image/png'
                      : 'font/woff2';
              await route.fulfill({
                contentType,
                body: readFileSync(path.join(fixtureDirectory, 'dist', '_astro', asset)),
              });
            });
            await page.goto('https://ui-consumer.example/');
            await page.waitForSelector(
              '[data-inspection-dialog-root][data-inspection-enhanced="true"]',
              { state: 'attached' },
            );
            await page.evaluate((selectedTheme) => {
              document.documentElement.className = selectedTheme;
            }, theme);
            const flatCode = page.getByRole('region', {
              name: 'Order status command',
              exact: true,
            });
            expect(await flatCode.locator('..').getAttribute('data-code-copy-frame')).toBeNull();
            expect(await flatCode.evaluate((node) => getComputedStyle(node).paddingLeft)).toBe(
              '0px',
            );
            expect(
              await flatCode
                .locator('..')
                .getByRole('button', { name: 'Copy code', exact: true })
                .count(),
            ).toBe(1);
            // the shared bubble footer cancels the bubble padding so its divider meets the border
            const bubbleFooterInsets = await page
              .locator('[data-bubble-footer]')
              .evaluate((footer) => {
                const bubble = footer.closest('article')!;
                const bubbleBounds = bubble.getBoundingClientRect();
                const footerBounds = footer.getBoundingClientRect();
                const bubbleStyle = getComputedStyle(bubble);
                return [
                  footerBounds.left - bubbleBounds.left - parseFloat(bubbleStyle.borderLeftWidth),
                  bubbleBounds.right -
                    parseFloat(bubbleStyle.borderRightWidth) -
                    footerBounds.right,
                ];
              });
            for (const inset of bubbleFooterInsets) expect(Math.abs(inset)).toBeLessThan(0.5);
            const replayMarkdown = page.locator('.replay-markdown');
            expect(await replayMarkdown.locator('pre code').count()).toBe(1);
            expect(await replayMarkdown.locator('[data-code-copy-button]').count()).toBe(0);
            // an operation without findings shows its result code the way one finding shows its own
            const refusedOpener = page.getByRole('link', {
              name: 'Refused INVALID_PAGE_REQUEST: View result: Operation refused',
              exact: true,
            });
            expect(await refusedOpener.locator('code').innerText()).toBe('INVALID_PAGE_REQUEST');
            expect(await page.locator('[data-dialog-open="passed-result"] code').count()).toBe(0);
            for (const id of [
              'passed',
              'single',
              'refused',
              'hover-neutral',
              'hover-warning',
              'hover-info',
            ]) {
              const opener = page.locator(`[data-dialog-open="${id}-result"]`);
              await expectInspectionActionAlignment(opener);
              await page.mouse.move(0, 0);
              const restingColor = await opener.evaluate(
                (node) => getComputedStyle(node).backgroundColor,
              );
              const restingBorder = await opener.evaluate(
                (node) => getComputedStyle(node).borderColor,
              );
              await opener.hover();
              expect(
                await opener.evaluate((node) => getComputedStyle(node).backgroundColor),
              ).not.toBe(restingColor);
              expect(await opener.evaluate((node) => getComputedStyle(node).borderColor)).not.toBe(
                restingBorder,
              );
              expect(
                await opener.evaluate((node) =>
                  Number.parseFloat(getComputedStyle(node).transitionDuration),
                ),
              ).toBeLessThanOrEqual(0.00001);
              expect((await opener.boundingBox())!.height).toBe(40);
            }
            const illustrationOpener = page.locator('[data-dialog-open="illustrated-result"]');
            await expectInspectionActionAlignment(illustrationOpener);
            expect(await illustrationOpener.locator('svg.lucide-scroll-text').count()).toBe(1);
            await illustrationOpener.focus();
            await illustrationOpener.press('Enter');
            const illustrationDialog = page.getByRole('dialog', {
              name: 'Illustrative policy review',
              exact: true,
            });
            expect(
              await illustrationDialog.getByText('Project context', { exact: true }).isVisible(),
            ).toBe(true);
            expect(
              await illustrationDialog
                .getByRole('heading', { name: 'Approval authority', exact: true })
                .count(),
            ).toBe(1);
            expect(await illustrationDialog.getByRole('tab').count()).toBe(0);
            expect(await illustrationDialog.locator('[data-inspection-output]').count()).toBe(0);
            const instructionDiff = illustrationDialog.getByRole('region', {
              name: 'instruction.md: Before and after',
              exact: true,
            });
            expect(await instructionDiff.innerText()).toContain('Explain the refund policy.');
            expect(await instructionDiff.innerText()).toContain('Approve refunds for customers.');
            expect(await illustrationDialog.locator('[data-file-preview]').count()).toBe(2);
            expect(
              await illustrationDialog.locator('[data-file-preview-tone="danger"]').count(),
            ).toBe(1);
            await instructionDiff.focus();
            expect(await instructionDiff.evaluate((node) => node === document.activeElement)).toBe(
              true,
            );
            expect(
              await instructionDiff.evaluate((node) => getComputedStyle(node).boxShadow),
            ).not.toBe('none');
            expect(
              await illustrationDialog
                .getByText('Illustrative finding.', { exact: true })
                .isVisible(),
            ).toBe(true);
            expect(
              (await new AxeBuilder({ page }).include('#illustrated-result').analyze()).violations,
            ).toStrictEqual([]);
            await page.keyboard.press('Escape');
            await expect
              .poll(() => illustrationOpener.evaluate((node) => node === document.activeElement))
              .toBe(true);
            const passedOpener = page.getByRole('link', {
              name: 'Passed: View result: Validation complete',
              exact: true,
            });
            await passedOpener.click();
            const passedDialog = page.getByRole('dialog', {
              name: 'Validation complete',
              exact: true,
            });
            expect(await passedDialog.isVisible()).toBe(true);
            expect(await passedDialog.getByRole('tab').count()).toBe(0);
            expect(
              JSON.parse(
                await passedDialog.locator('[data-inspection-output] pre code').innerText(),
              ),
            ).toStrictEqual({
              valid: true,
              diagnostics: [],
              coverage: { checked: ['references'], unchecked: [] },
            });
            expect(await passedDialog.evaluate((dialog) => dialog.getAnimations().length)).toBe(0);
            /*
             * the browser restores focus on close, but the dialog's own close handler refocuses the
             * opener in a later task; a listener added now runs after that handler, so moving focus
             * only after it fires keeps the late refocus from stealing it back
             */
            const passedClose = await passedDialog.evaluateHandle((dialog) => ({
              done: new Promise<void>((resolve) => {
                dialog.addEventListener('close', () => resolve(), { once: true });
              }),
            }));
            await page.keyboard.press('Escape');
            await passedClose.evaluate(({ done }) => done);
            await expect
              .poll(() => passedOpener.evaluate((node) => node === document.activeElement))
              .toBe(true);
            const singleOpener = page.locator('[data-dialog-open="single-result"]');
            await page.keyboard.press('Tab');
            await singleOpener.focus();
            expect(
              await singleOpener.evaluate((node) => getComputedStyle(node).boxShadow),
            ).not.toBe('none');
            await singleOpener.press('Enter');
            const singleDialog = page.getByRole('dialog', {
              name: 'Validation failed',
              exact: true,
            });
            expect(
              await singleDialog
                .getByRole('heading', { name: 'Reference not found', exact: true })
                .count(),
            ).toBe(1);
            expect(
              await singleDialog.getByRole('tab', { name: 'Finding', selected: true }).count(),
            ).toBe(1);
            expect(await singleDialog.locator('[data-file-preview]').count()).toBe(2);
            expect(await singleDialog.locator('[data-file-preview-tone="danger"]').count()).toBe(1);
            expect(await singleDialog.getByText('Missing target', { exact: true }).count()).toBe(1);
            // beside the path the status shares the role's line; otherwise it wraps below the path
            expect(
              await singleDialog
                .locator('[data-file-preview-tone="danger"] [data-file-preview-header]')
                .evaluate((header) => {
                  const status = header
                    .querySelector('[data-file-preview-status]')!
                    .getBoundingClientRect();
                  const role = header
                    .querySelector('[data-file-preview-role]')!
                    .getBoundingClientRect();
                  const path = header.querySelector('code[title]')!.getBoundingClientRect();
                  return status.top < path.bottom
                    ? Math.abs(status.top - role.top) <= 1
                    : status.top >= path.bottom;
                }),
            ).toBe(true);
            // repository paths display without their leading slash; the pointer is decoded into a Field row
            const findingDetails = singleDialog.locator('[data-inspection-finding-card] dl');
            expect(
              await findingDetails
                .locator('div', { has: page.locator('dt', { hasText: /^Location$/u }) })
                .locator('dd')
                .innerText(),
            ).toBe('moldea/moldea.yaml');
            const field = findingDetails.locator('[data-inspection-field]');
            expect(await field.getAttribute('title')).toBe(
              '/context/~1moldea~1policy.md/bindings/0',
            );
            expect(await field.locator('code').allInnerTexts()).toStrictEqual([
              'context',
              '/moldea/policy.md',
              'bindings',
              '0',
            ]);
            // single-word and wrapping chips share one height, so every details row keeps its spacing
            const chipFragmentHeights = await findingDetails
              .locator('dd code')
              .evaluateAll((codes) =>
                codes.flatMap((code) => [...code.getClientRects()].map(({ height }) => height)),
              );
            for (const height of chipFragmentHeights)
              expect(Math.abs(height - chipFragmentHeights[0]!)).toBeLessThan(0.5);
            expect(
              await singleDialog
                .locator('[data-file-preview]')
                .first()
                .locator('code[title]')
                .getAttribute('title'),
            ).toBe('moldea/moldea.yaml');
            expect(
              await singleDialog
                .locator('[data-inspection-finding-card] [data-file-preview]')
                .count(),
            ).toBe(0);
            expect(
              await singleDialog
                .locator('[data-inspection-finding-card]')
                .getByText('References', { exact: true })
                .isVisible(),
            ).toBe(true);
            const rowBounds = await singleOpener.boundingBox();
            const listBounds = await singleOpener.locator('..').boundingBox();
            expect(rowBounds?.width).toBe(listBounds?.width);
            const findingCode = singleOpener.locator('code');
            expect(await findingCode.innerText()).toBe('MOLDEA_REFERENCE_NOT_FOUND');
            expect(await findingCode.evaluate((node) => getComputedStyle(node).fontWeight)).toBe(
              '400',
            );
            expect(await findingCode.evaluate((node) => getComputedStyle(node).whiteSpace)).toBe(
              'nowrap',
            );
            expect(await findingCode.evaluate((node) => getComputedStyle(node).textOverflow)).toBe(
              'ellipsis',
            );
            expect(rowBounds!.height).toBe(40);
            expect((await passedOpener.boundingBox())!.height).toBe(40);
            const findingHeader = singleDialog.locator('[data-inspection-finding-header]');
            expect(await findingHeader.getByText('References', { exact: true }).isVisible()).toBe(
              true,
            );
            expect(
              await findingHeader
                .getByRole('heading', { name: 'Reference not found', exact: true })
                .isVisible(),
            ).toBe(true);
            expect(
              await singleDialog.locator('[data-file-preview]').last().locator('pre').count(),
            ).toBe(0);
            await singleDialog.getByRole('tab', { name: 'Finding', exact: true }).focus();
            await page.keyboard.press('ArrowRight');
            expect(
              await singleDialog.getByRole('tab', { name: 'Output', selected: true }).count(),
            ).toBe(1);
            const outputHeader = singleDialog.locator(
              '[data-inspection-output] [data-code-block-header]',
            );
            expect(
              await outputHeader.getByText('moldea validate --json', { exact: true }).isVisible(),
            ).toBe(true);
            expect(await outputHeader.getByText('Exit 1', { exact: true }).isVisible()).toBe(true);
            // recorded output is evidence, not something a reader pastes elsewhere
            expect(
              await outputHeader.getByRole('button', { name: 'Copy code', exact: true }).count(),
            ).toBe(0);
            expect(
              await singleDialog.getByText('Complete recorded response', { exact: true }).count(),
            ).toBe(0);
            expect(
              JSON.parse(
                await singleDialog.locator('[data-inspection-output] pre code').innerText(),
              ),
            ).toStrictEqual({
              version: 1,
              command: 'validate',
              status: 'invalid',
              result: {
                valid: false,
                coverage: { checked: ['references'], unchecked: ['agents'] },
              },
              diagnostics: [{ code: 'MOLDEA_REFERENCE_NOT_FOUND' }],
              error: null,
            });
            expect(
              (await new AxeBuilder({ page }).include('#single-result').analyze()).violations,
            ).toStrictEqual([]);
            await page.keyboard.press('Escape');
            await expect
              .poll(() => singleOpener.evaluate((node) => node === document.activeElement))
              .toBe(true);
            const outerOpener = page.getByRole('button', { name: 'Open case', exact: true });
            await outerOpener.click();
            const multipleOpener = page.locator('[data-dialog-open="multiple-result"]');
            await expectInspectionActionAlignment(multipleOpener);
            expect(await multipleOpener.innerText()).toContain('3 findings');
            expect(await multipleOpener.innerText()).toContain(
              '1 blocking · 1 warning · 1 accepted',
            );
            await multipleOpener.click();
            expect(await page.locator('dialog:modal').count()).toBe(2);
            const acceptedDialog = page.getByRole('dialog', {
              name: 'Inspection complete',
              exact: true,
            });
            expect(
              await acceptedDialog.getByRole('tab', { name: 'Findings', selected: true }).count(),
            ).toBe(1);
            const overview = acceptedDialog.getByRole('list', { name: 'Inspection findings' });
            expect(await overview.isVisible()).toBe(true);
            const rows = overview.getByRole('link');
            expect(await rows.count()).toBe(3);
            expect(await rows.nth(0).getAttribute('data-inspection-show')).toBe('missing');
            const missingRowPath = rows.nth(0).locator('code[id$="-path-missing"]');
            expect(await missingRowPath.innerText()).toBe('moldea/moldea.yaml');
            expect(await missingRowPath.getAttribute('title')).toBe('moldea/moldea.yaml');
            expect(await rows.nth(1).getAttribute('data-inspection-show')).toBe('warning');
            expect(await rows.nth(2).getAttribute('data-inspection-show')).toBe('accepted');
            expect(await acceptedDialog.locator('[data-inspection-detail]:visible').count()).toBe(
              0,
            );
            const acceptedOpener = rows.nth(2);
            await acceptedOpener.focus();
            await acceptedOpener.press('Enter');
            expect(await page.locator('dialog:modal').count()).toBe(2);
            expect(await overview.isVisible()).toBe(false);
            expect(
              await acceptedDialog
                .locator('[data-inspection-detail="accepted"]')
                .evaluate((node) => node === document.activeElement),
            ).toBe(true);
            expect(
              await acceptedDialog
                .locator('[data-inspection-detail="accepted"]')
                .getByText('Accepted', { exact: true })
                .isVisible(),
            ).toBe(true);
            expect(
              await acceptedDialog
                .getByText('Generated files arrive during the release build.', { exact: true })
                .isVisible(),
            ).toBe(true);
            await acceptedDialog.getByRole('tab', { name: 'Output', exact: true }).click();
            expect(await acceptedDialog.locator('[data-inspection-output]').isVisible()).toBe(true);
            await acceptedDialog.getByRole('tab', { name: 'Findings', exact: true }).click();
            expect(
              await acceptedDialog.locator('[data-inspection-detail="accepted"]').isVisible(),
            ).toBe(true);
            await acceptedDialog
              .getByRole('link', { name: 'Back to findings', exact: true })
              .click();
            expect(await acceptedOpener.evaluate((node) => node === document.activeElement)).toBe(
              true,
            );
            expect(await overview.isVisible()).toBe(true);
            await rows.nth(1).click();
            expect(
              await acceptedDialog.locator('[data-inspection-detail="warning"]').isVisible(),
            ).toBe(true);
            expect(
              await acceptedDialog
                .locator('[data-inspection-detail="warning"] [data-file-preview-tone="warning"]')
                .count(),
            ).toBe(1);
            expect(
              (await new AxeBuilder({ page }).include('#multiple-result').analyze()).violations,
            ).toStrictEqual([]);
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
              ),
            ).toBe(true);
            await page.keyboard.press('Escape');
            await expect.poll(() => page.locator('dialog:modal').count()).toBe(1);
            await expect
              .poll(() => multipleOpener.evaluate((node) => node === document.activeElement))
              .toBe(true);
            await multipleOpener.click();
            expect(await overview.isVisible()).toBe(true);
            expect(
              await acceptedDialog.getByRole('tab', { name: 'Findings', selected: true }).count(),
            ).toBe(1);
            await page.keyboard.press('Escape');
            await expect.poll(() => page.locator('dialog:modal').count()).toBe(1);
            await page.keyboard.press('Escape');
            await expect
              .poll(() => outerOpener.evaluate((node) => node === document.activeElement))
              .toBe(true);
            await page.locator('[data-dialog-open="many-result"]').click();
            const manyDialog = page.getByRole('dialog', { name: 'Policy findings', exact: true });
            expect(await manyDialog.getByRole('tab').count()).toBe(0);
            const lastRow = manyDialog.getByRole('link', {
              name: 'View finding: Policy finding 32 CONTEXT_CONTRADICTED',
              exact: true,
            });
            await lastRow.focus();
            await lastRow.press('Enter');
            expect(
              await manyDialog.locator('[data-inspection-detail="policy-31"]').isVisible(),
            ).toBe(true);
            expect(await manyDialog.locator('[data-inspection-output]').count()).toBe(0);
            await manyDialog.getByRole('link', { name: 'Back to findings', exact: true }).click();
            expect(await lastRow.evaluate((node) => node === document.activeElement)).toBe(true);
            const lastBounds = (await lastRow.boundingBox())!;
            expect(lastBounds.y).toBeGreaterThanOrEqual(0);
            expect(lastBounds.y + lastBounds.height).toBeLessThanOrEqual(900);
            await page.keyboard.press('Escape');
            const standaloneOpener = page.getByRole('link', {
              name: 'Open standalone output',
              exact: true,
            });
            await standaloneOpener.click();
            if (width >= 768) await page.mouse.click(1, 1);
            else await page.keyboard.press('Escape');
            await expect
              .poll(() => standaloneOpener.evaluate((node) => node === document.activeElement))
              .toBe(true);
            await page.getByRole('button', { name: 'Inspect evidence', exact: true }).click();
            expect(
              await page
                .locator('#fixture-wide')
                .evaluate((dialog) => Math.round(dialog.getBoundingClientRect().height)),
            ).toBe(width >= 768 ? 512 : 900);
            await page.keyboard.press('Escape');
            await page.getByRole('link', { name: 'Navigate to runtimes', exact: true }).click();
            await page.waitForURL('https://ui-consumer.example/runtimes/');
            expect(await page.locator('dialog:modal').count()).toBe(0);
            await page.goBack();
            await page.waitForSelector(
              '[data-inspection-dialog-root][data-inspection-enhanced="true"]',
              { state: 'attached' },
            );
            await page.locator('[data-dialog-open="single-result"]').click();
            expect(
              await page
                .getByRole('dialog', { name: 'Validation failed', exact: true })
                .isVisible(),
            ).toBe(true);
            await page.keyboard.press('Escape');
            expect(pageErrors).toStrictEqual([]);
          } finally {
            await context.close();
          }
        }
      }
    } finally {
      await browser.close();
    }
    expect(fixtureHtml).toContain('language-json');
    expect(fixtureHtml).toContain('language-sh');
    expect(fixtureHtml).toContain('language-text');
    expect(fixtureHtml).toContain('role="region" aria-label="Code block"');
    expect(fixtureHtml).toContain('role="region" aria-label="Order status command"');
    expect(fixtureHtml).toContain('data-code-copy-controls-template');
    expect(fixtureHtml).toContain('data-code-copy="false"');
    expect(fixtureHtml).not.toMatch(/<code[^>]*>moldea<\/code>/u);
    expect(fixtureHtml).toContain('data-conversation-message="assistant"');
    expect(fixtureHtml).toContain('rel="author noopener noreferrer"');
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
    // icon tiles are decorative by default and carry their named size and tone
    expect(fixtureHtml).toMatch(
      /<span(?=[^>]*data-icon-tile="success")(?=[^>]*data-size="sm")(?=[^>]*aria-hidden="true")[^>]*>1<\/span>/u,
    );
    // unbreakable code keeps its full value and title; breakable code wraps only after separators
    expect(fixtureHtml).toMatch(
      /<code(?=[^>]*data-code-text="unbreakable")(?=[^>]*title="a{64}")[^>]*>a{64}<\/code>/u,
    );
    expect(fixtureHtml).toContain('<code>src/<wbr>answer-<wbr>cache.ts</code>');
    expect(fixtureHtml).toContain('<code title="Recorded digest">sha256-<wbr>digest</code>');
    expect(fixtureHtml).not.toContain('prettier-ignore');
    expect(fixtureHtml).toMatch(
      /<details\b[^>]*id="check-one"[^>]*name="fixture-accordion"(?![^>]*\bopen\b)/u,
    );
    expect(fixtureHtml).toMatch(
      /<details\b[^>]*id="check-two"[^>]*name="fixture-accordion"[^>]*\bopen\b/u,
    );
    expect(fixtureHtml).toMatch(
      /<details\b[^>]*id="closed-check"(?![^>]*\bname=)(?![^>]*\bopen\b)/u,
    );
    expect(fixtureHtml).toContain('aria-describedby="check-one-description"');
    expect(fixtureHtml).toContain('First visual');
    expect(fixtureHtml).toContain('Second visual');
    expect(fixtureHtml).toContain('Repo. Format');
    expect(fixtureHtml).toContain('aria-label="Repository Format"');
    expect(fixtureHtml).toContain('lucide-external-link');
    expect(fixtureHtml).toMatch(/<footer class="border-t border-border">/u);
    expect(fixtureHtml).toMatch(/<h3[^>]*>Metadata available<\/h3>/u);
    expect(fixtureHtml).toMatch(/<dialog\b[^>]*id="fixture-wide"[^>]*sm:max-w-5xl/u);
    expect(fixtureHtml).toContain('aria-describedby="fixture-wide-description"');
    expect(fixtureHtml).toMatch(
      /<button\b[^>]*action-primary action-size-lg[^>]*aria-controls="fixture-wide"/u,
    );
    expect(fixtureHtml).toMatch(
      /<button\b[^>]*action-ghost action-size-icon-xs[^>]*aria-label="Open complete source in a larger view"[^>]*aria-controls="fixture-icon"/u,
    );
    expect(fixtureHtml).toMatch(/<span\b[^>]*class="sr-only"[^>]*>Open complete source<\/span>/u);
    expect(fixtureHtml).toContain('lucide-maximize-2');
    expect(fixtureHtml).toContain('Expanded source content');
    expect(fixtureHtml.match(/data-external-link-icon/gu)).toHaveLength(3 + RUNTIME_CATALOG.length);
  }, 240_000);
});

// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { renderCodeBlock, renderMarkdownDocument, renderMarkdownFragment } from './index.js';

describe('website Markdown rendering', () => {
  test('renders literal code without allowing embedded fences or HTML to escape', async () => {
    const html = await renderCodeBlock(
      '```\n# Not a heading\n<script>alert("example")</script>\n[Not a link](https://example.com)\n```',
    );

    expect(html.match(/<pre\b/gu)).toHaveLength(1);
    expect(html).toContain('tabindex="0" role="region" aria-label="Code block"');
    expect(html).toContain('```\n# Not a heading\n&#x3C;script>');
    expect(html).toContain('[Not a link](https://example.com)');
    expect(html).not.toMatch(/<(?:h1|script|a)\b/u);
  });

  test.each(['json', 'sh', 'text', 'txt', 'plaintext', ''])(
    'renders literal %s source through the shared language and accessibility policy',
    async (language) => {
      const html = await renderCodeBlock('  example\n\n', language);

      expect(html).toContain('  example');
      expect(html).toContain('role="region" aria-label="Code block"');
      if (language) expect(html).toContain(`class="language-${language}"`);
      else expect(html).not.toContain('language-');
      if (language === 'json' || language === 'sh') expect(html).toContain('shiki');
    },
  );

  test('renders a sanitized base-aware document and stable heading outline', async () => {
    const rendered = await renderMarkdownDocument(
      '# Page\n\n## Use `moldea`\n\n[Local](/packages/) [External](https://example.com) <script>unsafe</script>',
      { basePath: '/docs/' },
    );

    expect(rendered.headings).toStrictEqual([
      {
        depth: 2,
        html: 'Use <code>moldea</code>',
        id: 'use-moldea',
        text: 'Use moldea',
      },
    ]);
    expect(rendered.html).toContain('href="/docs/packages/"');
    expect(rendered.html).toContain(
      'href="https://example.com" target="_blank" rel="noopener noreferrer"',
    );
    expect(rendered.html).not.toContain('<script>');
  });

  test('wraps tables in an accessible scrolling region', async () => {
    const rendered = await renderMarkdownDocument(
      '| Name | Value |\n| --- | --- |\n| Core | Stable |',
      { hasDocumentTitle: false },
    );

    expect(rendered.html).toContain(
      '<div class="table-scroll" tabindex="0" role="region" aria-label="Scrollable table">',
    );
  });

  test('loads fenced code languages lazily for syntax highlighting', async () => {
    const rendered = await renderMarkdownDocument(
      "```ts\nconst projectName: string = 'moldea';\n```",
      { hasDocumentTitle: false },
    );

    expect(rendered.html).toContain(
      '<pre class="shiki shiki-themes github-dark-default github-light-default"',
    );
    expect(rendered.html).toContain('class="line"');
    expect(rendered.html).toContain('projectName');
  });

  test.each(['ts', 'json', 'yaml', 'text', 'txt', 'plaintext', ''])(
    'retains the explicit %s language and exposes keyboard-accessible code regions',
    async (language) => {
      const source = `\`\`\`${language}\n  example\n\`\`\``;
      for (const html of [
        await renderMarkdownFragment(source),
        (await renderMarkdownDocument(source, { hasDocumentTitle: false })).html,
      ]) {
        expect(html).toContain('tabindex="0"');
        expect(html.match(/tabindex="0"/gu)).toHaveLength(1);
        expect(html).toContain('role="region" aria-label="Code block"');
        if (language) expect(html).toContain(`class="language-${language}"`);
        else expect(html).not.toContain('language-');
        expect(html).toContain('  example');
      }
    },
  );

  test('renders allowlisted strong labels as semantic badges', async () => {
    const rendered = await renderMarkdownDocument('# Page\n\nUse **Supported** maturity.', {
      strongLabelBadges: [{ id: 'supported', label: 'Supported', tone: 'success' }],
    });

    expect(rendered.html).toContain('data-markdown-badge="supported"');
    expect(rendered.html).toContain('>Supported</span>');
  });

  test('rejects malformed or duplicate strong-label badge configuration', async () => {
    await expect(
      renderMarkdownDocument('**Supported**', {
        strongLabelBadges: [
          { id: 'supported', label: 'Supported', tone: 'success' },
          { id: 'supported-again', label: 'Supported', tone: 'neutral' },
        ],
      }),
    ).rejects.toThrow('Markdown strong-label badge configuration is invalid.');
  });

  test('unwraps local fragment links and treats product names outside code elements', async () => {
    const html = await renderMarkdownFragment(
      '[Local](./source.md) and moldea with `moldea` plus [Web](https://example.com).',
      { localLinks: 'unwrap', productNameTreatment: 'code' },
    );

    expect(html).toContain('Local and <code>moldea</code> with <code>moldea</code>');
    expect(html).toContain('href="https://example.com" target="_blank" rel="noopener noreferrer"');
    expect(html).not.toContain('href="./source.md"');
  });
});

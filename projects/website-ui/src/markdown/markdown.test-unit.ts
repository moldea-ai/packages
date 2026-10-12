// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { renderCodeBlock, renderMarkdownDocument, renderMarkdownFragment } from './index.js';

describe('website Markdown rendering', () => {
  test('groups explicitly authored turns and preserves document-wide headings and technical content', async () => {
    const rendered = await renderMarkdownDocument(
      [
        '# Guide',
        '## Result',
        '',
        '> **You**',
        '>',
        '> Inspect `@moldea.ai/core`.',
        '',
        '> **Coding agent**',
        '>',
        '> ## Result',
        '>',
        '> ```yaml',
        '> valid: true',
        '> ```',
        '',
        '## Result',
        '',
        'Continue reading.',
      ].join('\n'),
      { conversations: true },
    );
    expect(rendered.headings.map(({ id }) => id)).toStrictEqual(['result', 'result-1', 'result-2']);
    expect(rendered.blocks.map(({ kind }) => kind)).toStrictEqual(['html', 'conversation', 'html']);
    const conversation = rendered.blocks[1];
    expect(conversation?.kind).toBe('conversation');
    if (conversation?.kind !== 'conversation') throw new Error('Expected conversation block');
    expect(conversation.messages.map(({ role }) => role)).toStrictEqual(['user', 'assistant']);
    expect(conversation.messages[0]?.html).toContain('<code>@moldea.ai/core</code>');
    expect(conversation.messages[1]?.html).toContain('id="result-1"');
    expect(conversation.messages[1]?.html).toContain('language-yaml');
    expect(conversation.messages[1]?.html).toContain('shiki');
    expect(conversation.messages[1]?.html).not.toContain('<strong>Coding agent</strong>');
    expect(rendered.html).toContain('<strong>Coding agent</strong>');
  });

  test.each([
    '> **You**\n>\n> A question.',
    '> A quotation about **You**.\n>\n> An ordinary quote.',
    '> **Developer**\n>\n> A question.',
    '> **You** asks\n>\n> A question.',
    '> **You**',
    '> **You**\n>\n> **Coding agent**\n>\n> Reply.',
  ])('keeps ordinary, incomplete, or disabled structures as HTML: %s', async (source) => {
    const disabled = await renderMarkdownDocument(source, { hasDocumentTitle: false });
    expect(disabled.blocks.map(({ kind }) => kind)).toStrictEqual(['html']);
    if (source === '> **You**\n>\n> A question.') return;
    const enabled = await renderMarkdownDocument(source, {
      hasDocumentTitle: false,
      conversations: true,
    });
    expect(enabled.blocks.map(({ kind }) => kind)).toStrictEqual(['html']);
  });

  test('sanitizes conversation messages, retains nested quotes, and does not infer roles from raw HTML', async () => {
    const source =
      '> **Coding agent**\n>\n> [Unsafe](javascript:alert%281%29) <script>unsafe()</script>\n>\n> > **You**\n> >\n> > Nested quotation.\n\n<div data-conversation-role="user">Forged</div>';
    const rendered = await renderMarkdownDocument(source, {
      hasDocumentTitle: false,
      conversations: true,
    });
    expect(rendered.blocks).toHaveLength(1);
    const conversation = rendered.blocks[0];
    if (conversation?.kind !== 'conversation') throw new Error('Expected conversation block');
    expect(conversation.messages).toHaveLength(1);
    expect(conversation.messages[0]?.html).toContain('<blockquote>');
    expect(conversation.messages[0]?.html).not.toMatch(/<script|javascript:|Forged/u);
  });

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

  test.each(['json', 'sh', 'markdown', 'md', 'text', 'txt', 'plaintext', ''])(
    'renders literal %s source through the shared language and accessibility policy',
    async (language) => {
      const html = await renderCodeBlock('  example\n\n', language);

      expect(html).toContain('  example');
      expect(html).toContain('role="region" aria-label="Code block"');
      expect(html).toContain(
        `data-code-overflow="${['markdown', 'md', 'text', 'txt', 'plaintext'].includes(language) ? 'wrap' : 'scroll'}"`,
      );
      if (language) expect(html).toContain(`class="language-${language}"`);
      else expect(html).not.toContain('language-');
      if (language === 'json' || language === 'sh') expect(html).toContain('shiki');
    },
  );

  test.each(['wrap', 'scroll'] as const)(
    'applies the explicit %s override to literal code and Markdown fences',
    async (overflow) => {
      const source = 'A long source line with its original indentation.\n';
      for (const language of ['markdown', 'text', 'yaml', 'json']) {
        expect(await renderCodeBlock(source, language, 'Source', overflow)).toContain(
          `data-code-overflow="${overflow}"`,
        );
        const markdown = `\`\`\`${language}\n${source}\`\`\``;
        expect(await renderMarkdownFragment(markdown, { codeOverflow: overflow })).toContain(
          `data-code-overflow="${overflow}"`,
        );
        expect((await renderMarkdownDocument(markdown, { codeOverflow: overflow })).html).toContain(
          `data-code-overflow="${overflow}"`,
        );
      }
    },
  );

  test('renders an escaped application-owned accessible label for literal code', async () => {
    const html = await renderCodeBlock(
      'const refundWindowDays = 14;',
      'ts',
      'Refund policy <source> "current" & verified',
    );

    expect(html).toContain(
      'aria-label="Refund policy &lt;source&gt; &quot;current&quot; &amp; verified"',
    );
    expect(html).not.toContain('aria-label="Refund policy <source>');
  });

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
    expect(rendered.html).toContain('data-external-link-icon');
    expect(rendered.html).toContain('<span class="whitespace-nowrap">External&#160;<svg');
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

  test('keeps external-link indicators with the final path segment without blocking earlier wraps', async () => {
    const html = await renderMarkdownFragment(
      '[https://packages.moldea.ai/compatibility/runtimes.json](https://packages.moldea.ai/compatibility/runtimes.json)',
    );

    expect(html).toContain(
      'https://packages.moldea.ai/compatibility/<span class="whitespace-nowrap">runtimes.json&#160;<svg',
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

  test.each(['ts', 'json', 'yaml', 'markdown', 'md', 'text', 'txt', 'plaintext', ''])(
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
        expect(html).toContain(
          `data-code-overflow="${['markdown', 'md', 'text', 'txt', 'plaintext'].includes(language) ? 'wrap' : 'scroll'}"`,
        );
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

  test('unwraps local fragment links and preserves authored prose and code', async () => {
    const html = await renderMarkdownFragment(
      '[Local](./source.md) and moldea with `moldea` plus [Web](https://example.com).',
      { localLinks: 'unwrap' },
    );

    expect(html).toContain('Local and moldea with <code>moldea</code>');
    expect(html).toContain('href="https://example.com" target="_blank" rel="noopener noreferrer"');
    expect(html.match(/data-external-link-icon/gu)).toHaveLength(1);
    expect(html).not.toContain('href="./source.md"');
  });
});

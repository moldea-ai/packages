# `@moldea.ai/website-ui`

Shared Astro foundations for `moldea` public websites.

The package owns the reusable design tokens, global website primitives, interaction states, base-path and theme utilities, and small accessible Astro components used by the package and skill websites. Each website continues to own its page composition, navigation copy, content generation, SEO identity, public assets, site URL, and theme storage key.

## Install after release

```bash
pnpm add @moldea.ai/website-ui@1.7.3
```

The package currently supports Astro `7.2.2` and Tailwind CSS `4.3.3` exactly. Import the shared stylesheet once from the website's global stylesheet:

```css
@import '@moldea.ai/website-ui/styles.css';
```

Tailwind scans the shipped Astro components through the package stylesheet's explicit source declaration.

## Composition guidelines

- Keep reusable presentation, interaction behavior, tokens, and design guidance in this package. Websites own routes, content, fixtures, domain status mappings, result selection, and page composition. Compose public exports instead of copying their markup, querying their private DOM, or overriding their state styles.
- Use `page-shell`, `section-title`, and `eyebrow` for the shared width and type hierarchy. For a two-column hero, keep badges inside the text column, followed by a `mb-7` gap, then the eyebrow with `mb-4` before the heading. Use `py-14 sm:py-18 lg:py-20` for hero insets, and align the example with the complete text column. Badge content and column proportions remain site-owned.
- Use `HeroBackdrop` inside a `relative overflow-hidden` section, with foreground content positioned `relative`. It owns the static, theme-aware radial/grid background shared with the Skill website. Do not duplicate its gradients in page markup.
- Section introductions may place the title on the left and a concise explanation on the right at `lg`, stacking on mobile. Alternate this with compact stacked introductions when the content warrants it; do not force every section into the same composition.
- Demonstrations should show recognizable files, one visible connection or mismatch, and a concise outcome. Compose `FilePreview`, `ConnectionLabel`, `ResultSummary`, `StatusBadge`, `CodeBlock`, and `Dialog`. Keep the essential result visible without interaction; dialogs contain optional evidence. Use `Accordion` when several examples share a section.
- Preserve semantic inline code for filenames, variables, operations, and package names using `inline-code`; use `InlineBrandText` for prose containing the product name. Breadcrumbs, documentation navigation, the site header, and local-search results apply the same product-name treatment to their string labels. Keep code wrapping and interaction feedback in the shared policies below.
- Verify compositions at 320px through desktop, in both themes, with keyboard focus and reduced motion. Flatten unnecessary mobile panels and preserve legible filenames, labels, and status text. Use icons and explicit text together rather than relying on color alone.

## Surface-aware selection

Add `dark-surface-selection` to an intentionally dark surface and `light-surface-selection` to an intentionally light surface when it differs from the active theme. Use `theme-surface-selection` when a nested surface returns to the active website theme. These utilities keep ordinary and inline-code text selection legible across nested light and dark surfaces.

## Link states

Interaction roles follow the platform's `TextLink`, footer, navigation, button, and linked package-card patterns. Shared branding does not mean every anchor has the same feedback:

- `text-link` uses the platform's primary text colors, a persistent underline, 70% hover opacity, 60% pressed opacity, and a current-color focus ring. Markdown links inherit this treatment.
- `ActionLink` with `variant="link"` is a standalone text action: the same opacity feedback, no underline or pressed translation. `link-feedback` is available for high-contrast text compositions, not muted text or whole cards.
- `plain-link` keeps footer, breadcrumb, and outline links muted at rest and uses foreground on hover and press, without fading or underlining them.
- `navigation-link` uses secondary hover/pressed fills and a separate `aria-current="page"` selected treatment.
- `surface-link` adds secondary hover/pressed fills to compact linked surfaces. `surface-link-warning` and `surface-link-danger` retain semantic tints throughout interaction.
- `interactive-card` uses the platform's small lift, pressed translation, and border feedback without fading its contents. Reduced motion removes all movement.
- Button-style `ActionLink` variants and `ActionButton` retain button interaction states. The button's `link` variant retains its hover underline and pressed translation.

The global stylesheet keeps keyboard focus visible; text-only links use their role-specific focus treatment. Both themes and reduced-motion preferences are supported. The Astro package remains independent of the platform's React package.

Dark prose keeps its primary foreground opaque before the 70%/60% opacity feedback. Compounding the platform's additional 80% dark hover text alpha with pressed opacity falls below 4.5:1 contrast on the shared dark background. This accessibility correction preserves the interaction scale without fading muted navigation or entire cards.

`BrandLogo` stays background-free in its resting, hover, and pressed states while retaining the global keyboard focus ring.

## Utilities

```typescript
import { searchDocuments } from '@moldea.ai/website-ui/search';
import { renderMarkdownDocument } from '@moldea.ai/website-ui/markdown';
import { withBase } from '@moldea.ai/website-ui/site';
import { isDarkTheme } from '@moldea.ai/website-ui/theme';
```

`parseSearchDocuments` accepts only complete search records with safe root-relative result URLs. Base-path failures and invalid generated search indexes throw `WebsiteUiConfigurationException` with stable error codes.

`LocalSearch` loads its index on the first non-empty submitted query and shares that request across overlapping searches. Only the latest submission can update results or status, including when a query is cleared. Failed or malformed index responses produce the consumer's failure message; a later submission retries the load. Successful indexes remain cached for that component instance.

Set `shouldFocusOnLoad` on a dedicated search page to focus its input without scrolling on direct loads and Astro client navigation. It defaults to `false` for embedded searches. Opt in at most one search per page; consumers do not need a separate focus script.

## Components

Every component has a dedicated public subpath:

- `@moldea.ai/website-ui/accordion`
- `@moldea.ai/website-ui/action-button`
- `@moldea.ai/website-ui/action-link`
- `@moldea.ai/website-ui/brand-logo`
- `@moldea.ai/website-ui/breadcrumbs`
- `@moldea.ai/website-ui/code-block`
- `@moldea.ai/website-ui/code-copy-controls`
- `@moldea.ai/website-ui/connection-label`
- `@moldea.ai/website-ui/documentation-shell`
- `@moldea.ai/website-ui/dialog`
- `@moldea.ai/website-ui/evaluation-replay`
- `@moldea.ai/website-ui/evaluation-replay-model`
- `@moldea.ai/website-ui/file-preview`
- `@moldea.ai/website-ui/hero-backdrop`
- `@moldea.ai/website-ui/inline-brand-text`
- `@moldea.ai/website-ui/local-search`
- `@moldea.ai/website-ui/markdown`
- `@moldea.ai/website-ui/navigation-progress`
- `@moldea.ai/website-ui/result-summary`
- `@moldea.ai/website-ui/site-footer`
- `@moldea.ai/website-ui/site-header`
- `@moldea.ai/website-ui/status-badge`
- `@moldea.ai/website-ui/tabbed-panels`
- `@moldea.ai/website-ui/theme-bootstrap`
- `@moldea.ai/website-ui/theme-control`

`ThemeBootstrap` belongs in the document head before rendered content. Pass the same app-owned storage key to `ThemeControl`. Mount `NavigationProgress` once near the start of the document body in websites that use Astro's `ClientRouter`; it reports client navigation preparation without taking ownership of the app's layout. Mount `CodeCopyControls` once in the body to add compact header copy actions to eligible code blocks on direct loads and client navigation. `BrandLogo` receives app-owned asset paths and labels rather than embedding one site's identity. `LocalSearch` receives app-owned copy, routes, and the generated index URL.

`SiteHeader`, `SiteFooter`, and `DocumentationShell` own responsive structure while consumers retain navigation data, accessible labels, copy, branding, actions, and page content. `SiteFooter` keeps its standard section gap by default; pass `hasTopSpacing={false}` when the preceding page section already provides the intended separation. `TabbedPanels` keeps every panel readable without JavaScript and adds WAI-ARIA tab behavior, including Arrow Left, Arrow Right, Home, and End, after enhancement. `StatusBadge` exposes semantic tones and border treatments without defining domain status mappings.

Each `SiteHeader` navigation item accepts `href`, `isActive`, `label`, and optional `compactLabel`. The desktop navigation shows the compact label below `xl` (1280px) when supplied. Wider desktop navigation and the mobile menu show the full label. Accessible names always identify the full destination. The header's existing `md` or `lg` desktop breakpoint remains independent of label selection.

### Accordions

`Accordion` is one native disclosure item. Keep related items together in a section, give each a document-unique `id`, and use the same document-unique `group` for mutually exclusive items. At most one item in a group can be open; users can also close every item. Pass `isOpen` to the first item to show an example immediately. Do not mark multiple items in one group initially open.

```astro
---
import Accordion from '@moldea.ai/website-ui/accordion';
import StatusBadge from '@moldea.ai/website-ui/status-badge';
---

<section aria-labelledby="checks-heading">
  <h2 id="checks-heading">Repository checks</h2>
  <div class="grid gap-3">
    <Accordion
      id="file-check"
      group="repository-checks"
      title="Check file connections"
      description="One referenced file is missing."
      isOpen
    >
      <StatusBadge
        slot="status"
        label="Invalid"
        tone="danger"
        size="sm"
      />
      <p>A consumer-owned visual goes here.</p>
    </Accordion>
    <Accordion
      id="variable-check"
      group="repository-checks"
      title="Check variable declarations"
    >
      <p>Another consumer-owned visual goes here.</p>
    </Accordion>
  </div>
</section>
```

Required props are `id`, `group`, and `title`. Optional `description` stays visible when closed and supplies the control's accessible description; `isOpen` defaults to `false`. The default slot accepts arbitrary content, including files and dialogs. The optional `status` slot accepts a compact non-interactive status, not another button or link. Consumers can derive props using `ComponentProps<typeof Accordion>` through the public subpath.

Native disclosure and group exclusivity work without JavaScript. JavaScript reveals hash-linked items on initial load, hash changes, and Astro client navigation without adding history entries or taking focus. Variable-height panels use a short fade; reduced motion removes it and the chevron transition. Mobile items use a flat surface, while desktop items retain the shared border, radius, colors, and interaction states. The package owns no example content or domain status mapping.

### Files and result summaries

`ConnectionLabel` places a short relationship label between visual examples. Its default slot accepts text and inline markup; the optional `icon` slot takes a decorative 16px icon. `tone` is `neutral` by default or `danger` for a broken connection. It owns spacing, icon alignment, and narrow-screen wrapping, not the meaning of a connection.

`FilePreview` receives `path`, optional `label`, and optional `tone`. Its header preserves an identifiable filename while truncating the directory prefix; the complete path remains selectable and readable by assistive technology without hover. Long filenames can wrap within the header. The default slot owns the body, `icon` replaces the default file icon, and `status` accepts a consumer-owned badge. This component does not parse files, choose excerpts, or define result semantics.

`ResultSummary` receives `title`, `description`, optional `tone`, `headingId`, `as` (`p`, `h2`, or `h3`), `hideIconOnMobile`, and `ariaLabel`. Defaults are a paragraph heading, neutral tone, visible icon, and “Result” group label. The optional `icon` slot renders inside a 40px badge; supply a 20px decorative icon. The `status` slot sits beside the heading, outside its accessible name. Titles use 14px type and descriptions 12px, both with 20px line height. Both components use the `danger`, `info`, `neutral`, `success`, and `warning` semantic tones.

For a dialog heading, compose `ResultSummary` in Dialog's `heading` slot, set `as="h2"` and `headingId` to `${id}-title`, keep `title` equal to Dialog's title, and use `hideIconOnMobile`. Consumer-owned status badges can use `size="sm"`. Neither component depends on Core, runs checks, or maps domain statuses. Derive their props with Astro's `ComponentProps` through the documented public subpaths.

`StatusBadge` defaults to `size="md"`. Use `size="sm"` for secondary status beside compact headings: a 20px minimum height, tighter padding, and lighter 10px lettering. Both sizes retain the same semantic colors and wrapping behavior.

`InlineBrandText` renders standalone product names as semantic inline code. Its default `badge` variant includes the code background and padding; `compact` omits them. Both variants scale with surrounding text and use normal letter spacing so display headings do not compress the monospace token.

For other hand-authored inline tokens, use `<code class="inline-code">`. This shared class matches rendered Markdown's code background, padding, monospace weight, and theme colors. `FilePreview` uses it for paths while retaining filename-preserving truncation. It does not parse text or add code semantics to plain strings; consumers must mark filenames and variable tokens explicitly.

The compiled `markdown` entry renders sanitized documents and fragments with stable headings, syntax highlighting, safe external links, base-aware internal links, and keyboard-scrollable tables. Raw HTML is disabled. The replay component accepts only the normalized contracts from `evaluation-replay-model`, including one initial trial and up to three ordered confirmation trials; semantic and qualification evidence conversion remains application-owned.

### Code and text wrapping

`CodeBlock` receives literal `source`, optional `language`, `copyable`, and `variant="panel"` (default) or `variant="plain"` for use inside another surface. It owns compact typography, syntax highlighting, keyboard scrolling, and light/dark presentation. The plain variant has no inset, border, background, or shadow; its enclosing surface supplies the padding. Pass raw code rather than constructing a Markdown fence; embedded fences and HTML remain literal source. `renderCodeBlock` from the public `markdown` subpath exposes the same rendering for non-component consumers.

```astro
---
import CodeBlock from '@moldea.ai/website-ui/code-block';
---

<CodeBlock
  source={JSON.stringify({ valid: false }, null, 2)}
  language="json"
/>
<CodeBlock
  source="pnpm test"
  language="sh"
  variant="plain"
/>
<CodeBlock
  source="Illustrative excerpt"
  language="text"
  copyable={false}
/>
```

Code preserves its source line breaks and scrolls horizontally when needed. This includes JSON, YAML, shell commands, diffs, and Markdown source. Unlabelled fences also preserve lines, since they may contain code or aligned file trees. Only fences explicitly labelled `text`, `txt`, or `plaintext` wrap long lines while retaining their original line breaks. Use these labels for prose, not as a shortcut to force code to fit.

With `CodeCopyControls` mounted, `CodeBlock` is copyable by default. Set `copyable={false}` for an illustrative or incomplete block that does not need a copy action. For rendered Markdown and hand-authored code, place `data-code-copy="false"` on the `pre` element or an owning container. An opted-out ancestor disables every code block inside it, while neighboring blocks remain eligible. Opted-out blocks have no copy action or extra focus stop and remain selectable.

The icon-only action follows the compact code header used by the platform UI instead of adding a separate toolbar row. Existing `FilePreview` headers receive the action directly; other eligible blocks receive a language header. The control copies the complete displayed code text, including indentation and blank lines, only after a visitor activates its button. Success is announced after the browser accepts the write and shown by a temporary check icon. When clipboard access is unavailable or denied, the code stays selectable and the button exposes the failure through its title and live status. The button keeps the stable accessible name “Copy code.”

Markdown and literal code renderers apply this policy through `styles.css`. Rendered code blocks are named, keyboard-focusable regions with visible focus indicators. Hand-authored `<pre>` elements use the shared `code-block` class, `tabindex="0"`, `role="region"`, and a descriptive `aria-label`; add `data-code-language="text"` only for plain text. Do not add page-wide wrapping overrides to code, diagnostics, or replay content.

### Optional detail dialogs

`Dialog` defaults to a compact outline trigger, a named native modal, and a slotted scrolling body. It follows the platform's medium dialog: a bordered desktop surface, full-screen mobile layout, fixed header, 28px desktop close control, and 36px mobile back control. Opening takes 300ms with a fade and small slide, plus a subtle desktop scale. Closing takes 200ms on desktop and 300ms on mobile; native modality and background scroll locking remain active through the exit. Reduced motion skips animations. Escape and the close control dismiss it and return focus to the trigger. Set `isOverlayCloseEnabled` for read-only content to also dismiss on backdrop clicks; dragging between the panel and backdrop does not dismiss it. Astro client navigation dismisses immediately and initializes new triggers.

```astro
---
import Dialog from '@moldea.ai/website-ui/dialog';
---

<Dialog
  id="check-result"
  title="Check passed"
  triggerLabel="View result"
  triggerAriaLabel="View repository check result"
  closeLabel="Close check result"
  isOverlayCloseEnabled
>
  <p>No broken references were found.</p>
</Dialog>
```

Supply a unique document `id`, `title`, and `triggerLabel`. `description` and `triggerAriaLabel` are optional; `closeLabel` defaults to “Close dialog” and `isOverlayCloseEnabled` defaults to `false`, matching the platform. Consumers own content, status mapping, and any result transformation. The package does not depend on Core or execute checks. Triggers remain hidden without JavaScript, so keep essential information visible outside the dialog.

The optional `heading` slot replaces the default heading with an application-owned summary, such as an icon, outcome, description, and status badge. Supply an `h2` whose ID is `${id}-title` and whose text matches `title`; that heading alone provides the dialog's accessible name. Keep supplemental copy and badges outside the `h2`, and preserve readable wrapping on narrow screens. The dialog continues to own the close control and header layout.

Use these typed props to customize presentation without replacing the shared controls:

- `triggerVariant`: `outline` (default), `primary`, `secondary`, `ghost`, or `link`, using the corresponding `ActionButton` variant.
- `triggerSize`: `compact` (default) preserves the existing result-card button; `sm`, `md`, and `lg` use standard `ActionButton` text-button sizes. The trigger remains a labelled text button.
- `size`: `medium` (default) caps desktop width at 42rem; `large` uses the platform's 64rem cap for wider evidence. Both retain the viewport gutter, full-screen mobile layout, fixed header, scrolling body, and the same focus and dismissal behavior.

For example, add `size="large" triggerVariant="primary" triggerSize="lg"` to the example above. Import the component through `@moldea.ai/website-ui/dialog`; consumers can derive its props with Astro's `ComponentProps<typeof Dialog>`.

### Website composition

Each website owns its dependency and lockfile. Use the documented public component subpaths, shared code-wrapping policy, semantic tones, and supported slots. Verify long code, replay content, keyboard scrolling, and both themes at mobile and desktop widths. Website UI does not modify consumer source files or lockfiles.

## Development

From the monorepo root:

```bash
pnpm --filter @moldea.ai/website-ui typecheck
pnpm --filter @moldea.ai/website-ui build
pnpm --filter @moldea.ai/website-ui test:unit
pnpm --filter @moldea.ai/website-ui test:integration
pnpm --filter @moldea.ai/website-ui test
```

The integration suite verifies the packed public surface and a real Astro consumer fixture. Publishing the package is a separate release operation and is not part of ordinary website development.

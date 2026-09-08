# `@moldea.ai/website-ui`

Shared Astro foundations for `moldea` public websites.

The package owns the reusable design tokens, global website primitives, interaction states, base-path and theme utilities, and small accessible Astro components used by the package and skill websites. Each website continues to own its page composition, navigation copy, content generation, SEO identity, public assets, site URL, and theme storage key.

## Install after release

```bash
pnpm add @moldea.ai/website-ui@1.3.0
```

The package currently supports Astro `7.2.2` and Tailwind CSS `4.3.3` exactly. Import the shared stylesheet once from the website's global stylesheet:

```css
@import '@moldea.ai/website-ui/styles.css';
```

Tailwind scans the shipped Astro components through the package stylesheet's explicit source declaration.

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

## Components

Every component has a dedicated public subpath:

- `@moldea.ai/website-ui/action-button`
- `@moldea.ai/website-ui/action-link`
- `@moldea.ai/website-ui/brand-logo`
- `@moldea.ai/website-ui/breadcrumbs`
- `@moldea.ai/website-ui/documentation-shell`
- `@moldea.ai/website-ui/dialog`
- `@moldea.ai/website-ui/evaluation-replay`
- `@moldea.ai/website-ui/evaluation-replay-model`
- `@moldea.ai/website-ui/inline-brand-text`
- `@moldea.ai/website-ui/local-search`
- `@moldea.ai/website-ui/markdown`
- `@moldea.ai/website-ui/navigation-progress`
- `@moldea.ai/website-ui/site-footer`
- `@moldea.ai/website-ui/site-header`
- `@moldea.ai/website-ui/status-badge`
- `@moldea.ai/website-ui/tabbed-panels`
- `@moldea.ai/website-ui/theme-bootstrap`
- `@moldea.ai/website-ui/theme-control`

`ThemeBootstrap` belongs in the document head before rendered content. Pass the same app-owned storage key to `ThemeControl`. Mount `NavigationProgress` once near the start of the document body in websites that use Astro's `ClientRouter`; it reports client navigation preparation without taking ownership of the app's layout. `BrandLogo` receives app-owned asset paths and labels rather than embedding one site's identity. `LocalSearch` receives app-owned copy, routes, and the generated index URL.

`SiteHeader`, `SiteFooter`, and `DocumentationShell` own responsive structure while consumers retain navigation data, accessible labels, copy, branding, actions, and page content. `TabbedPanels` keeps every panel readable without JavaScript and adds WAI-ARIA tab behavior, including Arrow Left, Arrow Right, Home, and End, after enhancement. `StatusBadge` exposes semantic tones and border treatments without defining domain status mappings.

`StatusBadge` defaults to `size="md"`. Use `size="sm"` for secondary status beside compact headings: a 20px minimum height, tighter padding, and lighter 10px lettering. Both sizes retain the same semantic colors and wrapping behavior.

`InlineBrandText` renders standalone product names as semantic inline code. Its default `badge` variant includes the code background and padding; `compact` omits them. Both variants scale with surrounding text and use normal letter spacing so display headings do not compress the monospace token.

The compiled `markdown` entry renders sanitized documents and fragments with stable headings, syntax highlighting, safe external links, base-aware internal links, and keyboard-scrollable tables. Raw HTML is disabled. The replay component accepts only the normalized contracts from `evaluation-replay-model`; semantic and qualification evidence conversion remains application-owned.

### Code and text wrapping

Code preserves its source line breaks and scrolls horizontally when needed. This includes JSON, YAML, shell commands, diffs, and Markdown source. Unlabelled fences also preserve lines, since they may contain code or aligned file trees. Only fences explicitly labelled `text`, `txt`, or `plaintext` wrap long lines while retaining their original line breaks. Use these labels for prose, not as a shortcut to force code to fit.

Both Markdown renderers apply this policy through `styles.css`. Rendered code blocks are named, keyboard-focusable regions with visible focus indicators. Hand-authored `<pre>` elements use the shared `code-block` class, `tabindex="0"`, `role="region"`, and a descriptive `aria-label`; add `data-code-language="text"` only for plain text. Do not add page-wide wrapping overrides to code, diagnostics, or replay content.

### Optional detail dialogs

`Dialog` provides a compact outline trigger, a named native modal, and a slotted scrolling body. It follows the platform's medium dialog: a bordered desktop surface, full-screen mobile layout, fixed header, 28px desktop close control, and 36px mobile back control. Opening takes 300ms with a fade and small slide, plus a subtle desktop scale. Closing takes 200ms on desktop and 300ms on mobile; native modality and background scroll locking remain active through the exit. Reduced motion skips animations. Escape and the close control dismiss it and return focus to the trigger. Set `isOverlayCloseEnabled` for read-only content to also dismiss on backdrop clicks; dragging between the panel and backdrop does not dismiss it. Astro client navigation dismisses immediately and initializes new triggers.

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

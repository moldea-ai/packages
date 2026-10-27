# `@moldea.ai/website-ui`

Shared Astro foundations for `moldea` public websites.

The package owns the reusable design tokens, global website primitives, interaction states, base-path and theme utilities, and small accessible Astro components used by the package and skill websites. Each website continues to own its page composition, navigation copy, content generation, SEO identity, public assets, site URL, and theme storage key.

## Install after release

```bash
pnpm add @moldea.ai/website-ui@4.6.1
```

The package currently supports Astro `7.2.8` and Tailwind CSS `4.3.3` exactly. Import the shared stylesheet once from the website's global stylesheet:

```css
@import '@moldea.ai/website-ui/styles.css';
```

Tailwind scans the shipped Astro components through the package stylesheet's explicit source declaration.

## Composition guidelines

- Keep reusable presentation, interaction behavior, tokens, and design guidance in this package. Websites own routes, content, fixtures, domain status mappings, result selection, and page composition. Compose public exports instead of copying their markup, querying their private DOM, or overriding their state styles.
- Use `page-shell`, the appropriate shared title role, and `eyebrow` for the shared width and type hierarchy. For a two-column hero, keep badges inside the text column, followed by a `mb-7` gap, then the eyebrow with `mb-4` before the heading. Use `py-14 sm:py-18 lg:py-20` for hero insets, and align the example with the complete text column. Badge content and column proportions remain site-owned.
- Use `HeroBackdrop` inside a `relative overflow-hidden` section, with foreground content positioned `relative`. It owns the static, theme-aware radial/grid background shared with the Skill website. Do not duplicate its gradients in page markup.
- Section introductions may place the title on the left and a concise explanation on the right at `lg`, stacking on mobile. Alternate this with compact stacked introductions when the content warrants it; do not force every section into the same composition.
- Demonstrations should show recognizable files, one visible connection or mismatch, and a concise outcome. Compose `FilePreview`, `ConnectionLabel`, `ResultSummary`, `StatusBadge`, `CodeBlock`, and `Dialog`. Keep the essential result visible without interaction; dialogs contain optional evidence. Use `Accordion` when several examples share a section.
- Frame an example with `example-card`: a bordered, rounded card from `sm` with 24px padding that flattens into the page below `sm`. Put the optional 20px icon and the `example-card-title` (semibold, `text-base`, `text-lg` from `sm`) in an `example-card-header`, and the result in an `example-card-footer`. The footer's divider runs edge to edge with 16px, or 24px from `sm`, on each side. Inside a website-ui `Dialog`, it also reaches the full-screen dialog's edges on mobile. Section dividers in other surfaces run edge to edge the same way; dividers between rows or groups inside a body stay at the content width. Use mobile-only host treatments with `max-sm:` variants so they don't override the card from `sm`.
- In an assistant `ConversationMessage`, put a result or file list after the message in `conversation-message-footer`. Its divider meets the bubble's border.
- Use semantic inline code for complete existing product names in authored prose, subheadings, and prose links, including `moldea`, `moldea Skill`, `moldea Agent Skill`, and `moldea Cloud`. Keep titles and matching H1s, navigation, metadata, accessible string labels, artwork, actions, and string-only surfaces plain. Mark complete technical tokens using `inline-code`; when a surface cannot render inline code correctly, leave the complete name or token plain. Preserve recorded evidence and source payloads. Never style only the brand substring within a technical token. Keep code wrapping and interaction feedback in the shared policies below.
- Verify compositions at 320px through desktop, in both themes, with keyboard focus and reduced motion. Flatten unnecessary mobile panels and preserve legible filenames, labels, and status text. Use icons and explicit text together rather than relying on color alone.

## Heading roles

Website UI owns three public title roles. Choose the role from the heading's visual purpose, independently of its semantic `h1` or `h2` level.

| Role    | Class           | Responsive font size                        | Weight | Line height | Letter spacing | Use                                                 |
| ------- | --------------- | ------------------------------------------- | ------ | ----------- | -------------- | --------------------------------------------------- |
| Display | `display-title` | `48px` base, `60px` at `sm`, `72px` at `xl` | `700`  | `1.1`       | `-0.045em`     | The primary marketing statement on a landing page   |
| Page    | `page-title`    | `36px` base, `48px` at `sm`, `60px` at `lg` | `700`  | `1.15`      | `-0.04em`      | The main title of an inner public page              |
| Section | `section-title` | `30px` base, `36px` at `sm`, `48px` at `lg` | `700`  | `1.2`       | `-0.025em`     | A major landing-page or long-form section statement |

Each class owns its complete font size, weight, line height, letter spacing, balanced wrapping, and safe word wrapping. Consumers may add layout, spacing, color, scroll, or focus utilities, but must not add conflicting `font-*`, `text-*`, `leading-*`, or `tracking-*` utilities. Card, table, navigation, Markdown, and nested headings remain compact semibold elements on their local scale instead of using a public title role.

## Surface-aware selection

Add `dark-surface-selection` to an intentionally dark surface and `light-surface-selection` to an intentionally light surface when it differs from the active theme. Use `theme-surface-selection` when a nested surface returns to the active website theme. These utilities keep ordinary and inline-code text selection legible across nested light and dark surfaces.

## Link states

Interaction roles follow the platform's `TextLink`, footer, navigation, button, and linked package-card patterns. Shared branding does not mean every anchor has the same feedback:

- `text-link` uses the platform's primary text colors, a persistent underline, 70% hover opacity, 60% pressed opacity, and a current-color focus ring. Markdown links inherit this treatment, and absolute web links add a consistent external-link icon when they open in a new tab.
- `ActionLink` with `variant="link"` is a standalone text action: the same opacity feedback, no underline or pressed translation. `link-feedback` is available for high-contrast text compositions, not muted text or whole cards.
- `plain-link` keeps footer, breadcrumb, and outline links muted at rest and uses foreground on hover and press, without fading or underlining them.
- `navigation-link` uses secondary hover/pressed fills and a separate `aria-current="page"` selected treatment.
- `surface-link` adds secondary hover/pressed fills to compact linked surfaces. `surface-link-warning` and `surface-link-danger` retain semantic tints throughout interaction.
- `interactive-card` uses the platform's small lift, pressed translation, and border feedback without fading its contents. Reduced motion removes all movement.
- Button-style `ActionLink` variants and `ActionButton` retain button interaction states. The button's `link` variant retains its hover underline and pressed translation.

The global stylesheet keeps keyboard focus visible; text-only links use their role-specific focus treatment. Both themes and reduced-motion preferences are supported. The Astro package remains independent of the platform's React package.

Dark prose keeps its primary foreground opaque before the 70%/60% opacity feedback. Compounding the platform's additional 80% dark hover text alpha with pressed opacity falls below 4.5:1 contrast on the shared dark background. This accessibility correction preserves the interaction scale without fading muted navigation or entire cards.

`BrandLogo` stays background-free in its resting, hover, and pressed states while retaining the global keyboard focus ring.

`SiteHeaderShell` marks both source links as external destinations because they open in a new tab. The desktop source button uses `GitBranch`; the mobile text link retains the external-link indicator. Both keep an explicit accessible name that announces the new tab. Icon-size `ActionLink` controls supply their own icon.

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

## Runtime labels

`@moldea.ai/website-ui/runtime-catalog` exports `RUNTIME_CATALOG` and `IRuntimeCatalogEntry`. Its 35 stable runtime IDs select guidance; they do not certify SDK compatibility or vendor endorsement. Each entry contains its display name, official website or repository URL, and icon assets. Optional dark variants preserve contrast. `padded-icon` optical sizing accounts for clear space inside source assets, including Anthropic, Cloudflare, Convex, node-llama-cpp, and Pi Agent.

`RuntimeGrid` displays the recognizable icon, display name, and complete runtime ID. Every entry opens its official destination in a new tab with an external-link indicator. Widely used SDKs and frameworks appear first. Three responsive rows appear initially; Load more reveals every remaining entry and disappears. Focus moves to the first revealed link. Runtime search fragments reveal the requested entry before scrolling to it. Without JavaScript, all 35 entries remain available. Entry-level hover and focus use shared theme tokens. Assets resolve at build time and load lazily with explicit dimensions.

The `@moldea.ai/website-ui/runtime-logos/*` export exposes static SVG and PNG assets to other frameworks. Import named files through that public path. Catalog synchronization and asset safety are tested. The repository's [runtime logo record](../../docs/runtime-logos.md) records provenance and deferred permission follow-up; it is not shipped in the package.

## Conversations

Compose `Conversation` and `ConversationMessage` for illustrative interactions. Messages accept `role="user"` or `role="assistant"`, rich slot content, and an optional `avatar` slot. The shared presentation retains the avatar column, connecting line, user bubble, and bordered assistant response panel. The avatar slot supplies only the icon or image; the component owns its circular surface. Websites own domain artifacts, outcomes, and recorded evaluation evidence.

For explicitly authored Markdown examples, opt in with `renderMarkdownDocument(markdown, { conversations: true })`. A top-level blockquote must begin with a paragraph containing only the exact strong speaker label `You` or `Coding agent`, followed by a separate content paragraph. For example:

```markdown
> **You**
>
> Check `/src/returns.ts` against the policy.

> **Coding agent**
>
> The declared export is missing. No files were changed.
```

The returned `blocks` preserve document order. An `html` block contains sanitized `html`; a `conversation` block contains ordered `messages`, each with a `role` and sanitized `html`. Render HTML blocks normally and conversation blocks through the shared components. Existing `html` and `headings` remain available, with document-wide heading IDs. The full HTML retains speaker labels for non-component consumers.

Unrecognized, nested, incomplete, and non-opted-in quotes stay ordinary Markdown. The renderer never infers conversations from prose or code fences. Use this only for authored illustrative examples, not recorded evidence. Sanitization, highlighting, local-link policy, and external-link indicators run through the existing Markdown pipeline once.

## Components

Every component has a dedicated public subpath:

- `@moldea.ai/website-ui/accordion`
- `@moldea.ai/website-ui/action-button`
- `@moldea.ai/website-ui/action-link`
- `@moldea.ai/website-ui/brand-logo`
- `@moldea.ai/website-ui/breadcrumbs`
- `@moldea.ai/website-ui/code-block`
- `@moldea.ai/website-ui/code-diff`
- `@moldea.ai/website-ui/code-diff-model`
- `@moldea.ai/website-ui/code-copy-controls`
- `@moldea.ai/website-ui/code-text`
- `@moldea.ai/website-ui/connection-label`
- `@moldea.ai/website-ui/documentation-shell`
- `@moldea.ai/website-ui/dialog`
- `@moldea.ai/website-ui/evaluation-replay`
- `@moldea.ai/website-ui/evaluation-replay-model`
- `@moldea.ai/website-ui/file-preview`
- `@moldea.ai/website-ui/file-tree`
- `@moldea.ai/website-ui/hero-backdrop`
- `@moldea.ai/website-ui/icon-tile`
- `@moldea.ai/website-ui/inspection-finding`
- `@moldea.ai/website-ui/inspection-list`
- `@moldea.ai/website-ui/inspection-dialog`
- `@moldea.ai/website-ui/inspection-presentation`
- `@moldea.ai/website-ui/conversation`
- `@moldea.ai/website-ui/conversation-message`
- `@moldea.ai/website-ui/local-search`
- `@moldea.ai/website-ui/markdown`
- `@moldea.ai/website-ui/navigation-progress`
- `@moldea.ai/website-ui/result-summary`
- `@moldea.ai/website-ui/runtime-grid`
- `@moldea.ai/website-ui/site-footer`
- `@moldea.ai/website-ui/site-header`
- `@moldea.ai/website-ui/status-badge`
- `@moldea.ai/website-ui/tabbed-panels`
- `@moldea.ai/website-ui/theme-bootstrap`
- `@moldea.ai/website-ui/theme-control`

`ThemeBootstrap` belongs in the document head before rendered content. Pass the same app-owned storage key to `ThemeControl`. Mount `NavigationProgress` once near the start of the document body in websites that use Astro's `ClientRouter`; it reports client navigation preparation without taking ownership of the app's layout. Mount `CodeCopyControls` once in the body to add compact header copy actions to eligible code blocks on direct loads and client navigation. `BrandLogo` receives app-owned asset paths and labels rather than embedding one site's identity. `LocalSearch` receives app-owned copy, routes, and the generated index URL.

`FileTree` presents static file and folder paths, with an optional removed marker. Evaluation replay uses it for path-only workspace changes. `ActionLink` adds the external-link indicator, a visually hidden “(opens in a new tab)”, and `noopener noreferrer` whenever `target="_blank"` is supplied; an explicit `aria-label`, such as an icon-size action’s, gains the notice instead. Raw anchors and handlers opening a new tab need their own indicator and notice.

`SiteHeader`, `SiteFooter`, and `DocumentationShell` own responsive structure while consumers retain navigation data, accessible labels, copy, branding, actions, and page content. `SiteFooter` keeps its standard section gap by default; pass `hasTopSpacing={false}` when the preceding page section already provides the intended separation. `TabbedPanels` keeps every panel readable without JavaScript and adds WAI-ARIA tab behavior, including Arrow Left, Arrow Right, Home, and End, after enhancement. `StatusBadge` exposes semantic tones and border treatments without defining domain status mappings.

Each `SiteHeader` navigation item accepts `href`, `isActive`, `label`, and optional `compactLabel`. The desktop navigation shows the compact label below `xl` (1280px) when supplied. Wider desktop navigation and the mobile menu show the full label. Accessible names always identify the full destination. The header's existing `md` or `lg` desktop breakpoint remains independent of label selection.

The native mobile disclosure switches from a menu icon to a close icon when open, without JavaScript. Its accessible name switches from `mobileMenuLabel` (default `Open navigation`) to `mobileMenuCloseLabel` (default `Close navigation`).

### Accordions

`Accordion` is one native disclosure item. Keep related items together in a section and give each a document-unique `id`. Items without `group` open independently, so several can remain open. Use the same document-unique `group` only when items should be mutually exclusive; at most one item in a group can be open, and users can also close every item. Pass `isOpen` to show an example immediately. Do not mark multiple items in one group initially open.

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
        label="Blocking"
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

Required props are `id` and `title`. Optional `group` enables native mutual exclusion; without it, items stay independent. Optional `description` stays visible when closed and supplies the control's accessible description; `isOpen` defaults to `false`. The default slot accepts arbitrary content, including files and dialogs. The optional `status` slot accepts a compact non-interactive status, not another button or link. Consumers can derive props using `ComponentProps<typeof Accordion>` through the public subpath.

Native disclosure, independent opening, and optional group exclusivity work without JavaScript. JavaScript reveals hash-linked items on initial load, hash changes, and Astro client navigation without adding history entries or taking focus. Variable-height panels use a short fade; reduced motion removes it and the chevron transition. Every item uses the shared card background, full border, and rounded corners. Mobile summaries and panels have compact 12px horizontal insets; desktop insets remain 20px. Consumers should avoid adding redundant mobile padding inside the default slot. The package owns no example content or domain status mapping.

### Icon tiles

`IconTile` holds a leading icon, stacked media icon or step number. `size` is `sm` (32px tile, 16px icon), `md` (40px, 20px, the default) or `lg` (48px, 24px); the tile sizes any descendant SVG or image and step-number text. `tone` is `neutral` (default), `brand`, or one of the `danger`, `info`, `success` and `warning` status tones. The tile is `aria-hidden` by default; pass `aria-hidden="false"` when its content, such as a step number, must be announced. `class` is for layout only, such as margins or `mx-auto`; the component owns size, radius and color.

Place the tile beside its text, top-aligned with the first line and 12px away, so titles, descriptions and actions share one text edge and nothing wraps under it. Above a title, in feature cards and empty states, it sits on its own row. A neutral tile tints from the surrounding text color, so place it in foreground text, or inverse foreground on dark surfaces, never inside muted or link-colored text.

```astro
---
import IconTile from '@moldea.ai/website-ui/icon-tile';
import { GitBranch } from '@lucide/astro';
---

<div class="flex items-start gap-3">
  <IconTile><GitBranch /></IconTile>
  <div class="min-w-0">
    <p class="font-semibold">Branch mapping</p>
    <p class="text-sm text-muted-foreground">Follows the branch for this environment.</p>
  </div>
</div>
```

### Files and result summaries

`ConnectionLabel` places a short relationship label between visual examples. Its default slot accepts text and inline markup; the optional `icon` slot takes a decorative 16px icon. `tone` is `neutral` by default or `danger` for a broken connection. It owns spacing, icon alignment, and narrow-screen wrapping, not the meaning of a connection.

`FilePreview` receives `path`, optional `label`, and optional `tone`. It displays root-relative repository paths without their leading slash (`/moldea/project.md` reads `moldea/project.md`), so consumers pass the native path. Error, warning and information tones distinguish the card outline while retaining a neutral header. The `label` slot replaces the role text. Its header preserves an identifiable filename while truncating the directory prefix; the complete path remains selectable and readable by assistive technology without hover. Long filenames and directory paths truncate visually within the header; the complete path remains in the accessible text and title. The default slot owns the body; a divider appears only when that body is present. `icon` replaces the default file icon, and `status` accepts a consumer-owned issue badge at the header's right edge, aligned with the role line when a label is present. The default `statusLayout="responsive"` moves it onto its own line below the path in headers narrower than 24rem so it never takes the filename's space. Use `statusLayout="inline"` for compact change markers that must remain at the right edge on the same row at every width; long paths retain filename-preserving truncation. This component does not parse files, choose excerpts, or define result semantics.

`ResultSummary` receives `title`, `description`, optional `tone`, `headingId`, `as` (`p`, `h2`, or `h3`), and `ariaLabel`. Defaults are a paragraph heading, neutral tone, and “Result” group label. The optional `icon` slot renders inside an `md` `IconTile` in the same tone, top-aligned with the title at every width; supply a decorative icon. The `status` slot sits beside the heading, outside its accessible name. Titles use 14px type and descriptions 12px, both with 20px line height. Both components use the `danger`, `info`, `neutral`, `success`, and `warning` semantic tones.

For a dialog heading, compose `ResultSummary` in Dialog's `heading` slot, set `as="h2"` and `headingId` to `${id}-title`, and keep `title` equal to Dialog's title. Consumer-owned status badges can use `size="sm"`. Neither component depends on Core, runs checks, or maps domain statuses. Derive their props with Astro's `ComponentProps` through the documented public subpaths.

`StatusBadge` defaults to `size="md"`. Use `size="sm"` for secondary status beside compact headings: a 20px minimum height, tighter padding, and lighter 10px lettering. Badge labels stay on one line so short values such as “Exit 3” remain intact in tight flex rows. Use `truncate` when a longer label must fit a constrained width. Both sizes retain the same semantic colors.

For hand-authored complete product names and technical tokens, use `<code class="inline-code">`. This shared class matches rendered Markdown's code background, padding, monospace weight, and theme colors. `FilePreview` uses it for paths while retaining filename-preserving truncation. Rendered Markdown inline code and this package's own code labels (inspection findings and dialogs, file trees, runtime IDs and replay operations) wrap only after `/`, `_`, `.` or `-`, never mid-word and never between a name and its final extension (`refund-policy.ts` wraps after `refund-`, not before `ts`). Hand-authored `<code class="inline-code">` keeps normal wrapping; do not add `break-all`. Use `CodeText` instead when a code value should wrap only at those separators. It does not parse text or add code semantics to plain strings; consumers must mark filenames and variable tokens explicitly.

`CodeText` (`@moldea.ai/website-ui/code-text`) renders a `code` element from its `value` prop and accepts the element's other attributes. Its text wraps only after `/`, `_`, `.` or `-` between other characters. A value with none of those breaks and no whitespace, such as a SHA-256 digest or a run ID, stays on one line and truncates with an ellipsis at the available width. Its full text stays in the DOM, so selection, copying, find-in-page and screen readers get the whole value, and the element carries a `title` with the value unless the caller passes its own. Layout utilities such as `block` still apply.

The compiled `markdown` entry renders sanitized documents and fragments with stable headings, syntax highlighting, safe external links, base-aware internal links, keyboard-scrollable tables, and inline code that wraps only after `/`, `_`, `.` or `-`; code blocks keep their exact source. Unsupported syntax languages render as plain text with their source preserved, including in `renderCodeBlock`. Raw HTML is disabled. The replay component nests recorded headings below the trial heading without changing their text. It accepts only the normalized contracts from `evaluation-replay-model`, including one initial trial and up to three ordered confirmation trials; semantic and qualification evidence conversion remains application-owned.

### Code and text wrapping

`CodeBlock` receives literal `source`, optional `language`, `overflow`, `copyable`, `ariaLabel`, `headerLabel`, and `variant="panel"` (default) or `variant="plain"` for use inside another surface. It owns compact typography, syntax highlighting, keyboard scrolling, and light/dark presentation. `ariaLabel` names the focusable code group and defaults to “Code block”; prefer a label that describes the code. The plain variant has no inset, border, background, or shadow; its enclosing surface supplies the padding. Pass raw code rather than constructing a Markdown fence; embedded fences and HTML remain literal source. `renderCodeBlock` from the public `markdown` subpath accepts the same label and an optional fourth `overflow` argument for non-component consumers.

```astro
---
import CodeBlock from '@moldea.ai/website-ui/code-block';
---

<CodeBlock
  source={JSON.stringify({ valid: false }, null, 2)}
  language="json"
  overflow="scroll"
  ariaLabel="Validation result"
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

`overflow="wrap"` or `overflow="scroll"` always takes precedence over the shared default. Without an override, Markdown (`markdown`, `md`, `mdx`) and plain text (`text`, `txt`, `plaintext`) wrap long lines while retaining their original line breaks. Code, JSON, YAML, shell commands, diffs, and unlabelled source preserve their line layout and scroll horizontally when needed. Unlabelled fences may contain code or aligned file trees. `renderMarkdownDocument` and `renderMarkdownFragment` accept `codeOverflow` to override the mode of their fenced blocks.

`headerLabel` replaces the generated language label without changing syntax highlighting or copied source. The `header-icon` and `header-end` slots compose a decorative icon and execution context beside it. Copy controls join this header rather than creating a second one. Plain blocks retain their flat surface after enhancement.

With `CodeCopyControls` mounted, `CodeBlock` is copyable by default. Offer copy only for content a reader runs or pastes somewhere else: install and setup commands and snippets, and documentation code samples. Set `copyable={false}` for example evidence, including the command that produced a recorded result, and for excerpts, diffs, recorded output, and reference signatures. For rendered Markdown and hand-authored code, place `data-code-copy="false"` on the `pre` element or an owning container; recorded replay messages and inspection output already opt out. An opted-out ancestor disables every code block inside it, while neighboring blocks remain eligible. Opted-out blocks have no copy action or extra focus stop and remain selectable.

The icon-only action follows the compact code header used by the platform UI instead of adding a separate toolbar row. Existing `FilePreview` headers receive the action directly; other eligible blocks receive a language header. The control copies the complete displayed code text, including indentation and blank lines, only after a visitor activates its button. Success is announced after the browser accepts the write and shown by a temporary check icon. When clipboard access is unavailable or denied, the code stays selectable and the button exposes the failure through its title and live status. The button keeps the stable accessible name “Copy code.”

The compiled `code-presentation` boundary exposes `ICodeOverflow`, `formatRepositoryPath(path)`, `resolveCodeOverflow(language?, overflow?, filePath?)` and `splitCodeSegments(value)`, the inline-code wrapping rule that `CodeText` and rendered Markdown share. `formatRepositoryPath` removes one leading slash for display, so visible text, titles and accessible names read `moldea/moldea.yaml`; copied values, JSON output and code samples keep the exact path. `resolveCodeOverflow` is the default resolver used by both code blocks and diffs. A recorded file path selects the default before a patch-wide language hint; an explicit overflow choice takes precedence over both. Markdown and literal code renderers record the resolved mode in `data-code-overflow`, which `styles.css` applies. Rendered code blocks and wide tables are named, keyboard-focusable groups with visible focus indicators; groups are not landmarks, so several can share a generic name on one page. Hand-authored `<pre>` elements use the shared `code-block` class, `tabindex="0"`, `role="group"`, and a descriptive `aria-label`; identify Markdown/plain text with `data-code-language`, or select a mode with `data-code-overflow="wrap"` or `"scroll"`. Do not add page-wide wrapping overrides to code, diagnostics, or replay content.

### File changes

`CodeDiff` compares complete `oldValue` and `newValue` strings at build time. It uses the same light/dark syntax themes as `CodeBlock`, subtle removed/added row backgrounds, a theme-aware foreground blend to retain syntax contrast on those tints, line numbers, explicit change markers, and accessible row labels. It shares `CodeBlock`'s Markdown/plain-text wrapping and code scrolling defaults; unlabelled comparisons preserve source lines. Below 24rem of container width, unified rows use one source-line gutter; wider unified rows show both original and replacement line numbers. No diff engine, highlighter, or component JavaScript is sent to the browser. Supply a descriptive, document-unique `ariaLabel` when rendering several comparisons.

Eligible replacement blocks automatically emphasize changed words and punctuation with subtle inner backgrounds and medium-weight semantic insertions/deletions, retaining syntax hues and exact source text in both views. Emphasis requires at least half of each side's non-whitespace tokens to remain. Blocks below that threshold, standalone added/removed lines, and whitespace-only changes retain row-level presentation. A changed phrase that crosses original line breaks keeps its emphasis across continuation lines. Changed fragments have no underline or strike-through; semibold weight keeps them distinct in forced-colors mode.

```astro
---
import CodeDiff from '@moldea.ai/website-ui/code-diff';
---

<CodeDiff
  oldValue="const returnWindowDays = 14;"
  newValue="const returnWindowDays = 30;"
  language="typescript"
  ariaLabel="Return policy changes"
  view="unified"
  overflow="scroll"
/>
```

`view` defaults to `unified`, which suits narrow examples and dialogs. Unified rows start directly with the code, without a legend or change-count summary. Consumers can select `split` for side-by-side before/after rows. Split view adapts to the component's own available width: below 42rem it shows unified rows, even on a wide screen. Consumers own placement and preferred view; the component does not add a view toggle. Split column labels `beforeLabel` and `afterLabel` default to “Before” and “After”. `variant="plain"` removes the outer border and radius for composition inside `FilePreview`; row backgrounds remain.

Consumers can override the default with `overflow="wrap"` or `"scroll"`, independently of unified or split view and its narrow-container fallback. An explicit choice applies to every file in a recorded patch. Without an override, recorded `.md`, `.markdown`, `.mdx`, `.txt`, and `.text` files wrap, while other files scroll. Adjacent files with the same mode share a viewport; mixed patches keep wrapping groups within their available width and give scrolling groups named, keyboard-focusable regions. Split rows share their group's horizontal viewport and stretch both cell backgrounds to the row height, with source aligned at the top. The small leading/trailing inset belongs to the edge rows, so changed backgrounds fill it and unchanged context keeps its breathing room. Raw patches scroll by default and honor an explicit override.

By default, three unchanged lines remain beside each change. Distant unchanged lines appear in native, keyboard-accessible disclosures that work without JavaScript or motion. Set `contextLines={Infinity}` to show every line. All source remains in the rendered HTML. CRLF and LF compare equally; final-newline metadata stays in the model without adding annotations to the rendered rows. Unsupported languages use plain text. Comparisons exceeding 1024 line edits fall back to a complete replacement, explicitly labelled as a large change, to bound diff search work. Consumers should supply bounded file previews; this component does not fetch or paginate repository contents.

Recorded evidence can pass `patch={unifiedPatch}` instead of `oldValue`/`newValue`. The model preserves recorded file names and hunk ranges; rendered rows retain their line numbers and ordering without Git paths or hunk-coordinate headings. Consumers provide the file or example context around the component. Missing source outside the hunks is never reconstructed. A native “View recorded patch” disclosure retains the complete original patch, including newline, rename, mode, and binary metadata. Patches without parseable text hunks show their raw source directly. `contextLines` applies only to complete-file comparisons; recorded hunks retain all supplied context. Highlighting recorded excerpts cannot recover syntax context outside those excerpts.

The compiled `code-diff-model` boundary exposes `buildCodeDiff`, `buildCodePatch`, and the normalized row contracts for build-time consumers. Highlighting reuses Shiki's singleton language/theme loader; files are highlighted once per version, preserving multiline syntax context. No separate source cache is retained.

`ICodeDiffToken.isChanged?: boolean` marks emphasized syntax fragments with `true`; unmarked fragments omit the property. Refinement compares lexical words and punctuation without splitting grapheme clusters. It stays within each replacement block and recorded hunk, with a 16,384 UTF-16 code-unit block limit, a shared 65,536 code-unit comparison/patch budget, and a 256-token edit-search limit. Blocks that exceed these limits keep complete source rows without inner emphasis. Existing large-change line fallback also remains row-only.

### Optional detail dialogs

`Dialog` defaults to a compact outline trigger, a named native modal, and a slotted scrolling body. It follows the platform's medium dialog: a bordered desktop surface, full-screen mobile layout, fixed header, 28px desktop close control, and 36px mobile back control. The shared root stylesheet reserves a stable desktop scrollbar gutter so modal scroll locking does not shift the page; mobile retains its full viewport width. The scrolling body starts at the top each time the dialog opens. On mobile, the backdrop is transparent and the opaque page scales from 96% to full size over 300ms. Where supported, closing captures the dialog before revealing the returning page with the same scale and no text cross-fade. That scale anchors to the top. When the last modal closes, `SiteHeader` returns immediately in a separate stationary snapshot above the scaling content; it stays covered when another modal remains open. The old dialog snapshot is hidden so its text cannot show through translucent sticky headers. Named content snapshots from Astro navigation are folded into the root during that return so they cannot overlap the site header. Browsers without View Transitions and reduced-motion users dismiss immediately. Desktop retains its fade-and-slide entrance and 200ms exit. Escape and the close control dismiss the modal and return focus to the trigger. Set `isOverlayCloseEnabled` for read-only content to also dismiss on backdrop clicks; dragging between the panel and backdrop does not dismiss it. Astro client navigation dismisses immediately and initializes new triggers.

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
- `triggerSize`: `compact` (default) preserves the existing result-card button; `sm`, `md`, and `lg` use standard text-button sizes. `icon` and `icon-xs` use compact icon buttons with a default expand icon; a decorative `trigger-icon` slot can replace it. `triggerLabel` remains the accessible fallback and tooltip; use `triggerAriaLabel` when the surrounding context requires a more specific name.
- `triggerClass` adds consumer-owned layout classes to the trigger; a `trigger` slot supplies custom non-interactive text or badges inside text triggers while `triggerLabel` remains the fallback.
- `fallbackOpen` renders the same dialog body inline before enhancement for pages that must remain readable without JavaScript. The shared fallback stays in document flow with its close control hidden; initialization closes it before enabling the trigger. Pages with many fallbacks can hide them before first paint when native modal support is available.
- `panelClass` adds consumer-owned panel sizing classes. For a stable desktop frame use an explicit responsive height override, for example `sm:h-[32rem]!`; the shared viewport maximum and scrolling body remain active.
- `size`: `medium` (default) caps desktop width at 42rem; `large` uses the platform's 64rem cap for wider evidence. Both retain the viewport gutter, full-screen mobile layout, fixed header, scrolling body, and the same focus and dismissal behavior.

For example, add `size="large" triggerVariant="primary" triggerSize="lg"` to the example above. Import the component through `@moldea.ai/website-ui/dialog`; consumers can derive its props with Astro's `ComponentProps<typeof Dialog>`.

```astro
<Dialog
  id="complete-source"
  title="Complete source"
  triggerLabel="Open complete source"
  triggerAriaLabel="Open complete source in a larger view"
  triggerVariant="ghost"
  triggerSize="icon-xs"
  size="large"
>
  <CodeBlock
    source={source}
    language="yaml"
  />
</Dialog>
```

External links or buttons can set `data-dialog-open="<dialog-id>"` and `aria-controls` to the same ID. Links should retain a real fallback fragment. The shared controller prevents ordinary navigation only when it can open the dialog, preserves modified link clicks, and returns focus to the actual opener. This supports a case dialog plus one result dialog without a second modal controller.

`TabbedPanels` supports the `website-ui:select-tab` DOM event on its public root ID, with `detail: { id: "<item-id>" }`. It reuses normal selection without moving focus; unknown IDs are ignored.

### Website composition

Each website owns its dependency and lockfile. Use the documented public component subpaths, shared code-wrapping policy, semantic tones, and supported slots. Verify long code, replay content, keyboard scrolling, and both themes at mobile and desktop widths. Website UI does not modify consumer source files or lockfiles.

`DocumentationShell` names its desktop sidebar landmarks with `navigationAriaLabel` and `outlineLabel`, so assistive navigation can distinguish documentation navigation from the page outline.

## Development

From the monorepo root:

```bash
pnpm --filter @moldea.ai/website-ui typecheck
pnpm --filter @moldea.ai/website-ui build
pnpm --filter @moldea.ai/website-ui test:unit
pnpm --filter @moldea.ai/website-ui test:integration
pnpm --filter @moldea.ai/website-ui test
```

The packed-consumer integration also checks diff layouts and accessibility in real Chromium. Install Chromium with `pnpm --filter @moldea.ai/website-ui exec playwright install chromium` when it is not already available. The Website UI integration task forwards `PLAYWRIGHT_BROWSERS_PATH` through Turborepo so CI reuses the browsers in its existing Playwright container.

The integration suite verifies the packed public surface and a real Astro consumer fixture. Publishing the package is a separate release operation and is not part of ordinary website development.

## Inspection presentation

`InspectionFinding` composes a severity-tinted subject icon, category and inline severity, one title, secondary code/path, and an optional trailing `action` slot. `accepted` distinguishes an accepted warning. Import it from `@moldea.ai/website-ui/inspection-finding`. `@moldea.ai/website-ui/inspection-presentation` exports `DIAGNOSTIC_GROUP_PRESENTATIONS`, `FINDING_CATEGORY_PRESENTATIONS`, and `INSPECTION_SEVERITY_PRESENTATIONS`, with their public types. Subject IDs and icon choices follow the shared platform design reference.

Use `InspectionList` from `@moldea.ai/website-ui/inspection-list` with a unique `id` and `IInspectionResultView`. Every outcome has one full-width, compact action with its icon and status. Visitor-facing inspection statuses are Blocking, Warning, Passed, Accepted and Not checked; native severity keys and recorded output remain unchanged. Operational outcomes such as Returned and Refused retain their separate meaning. Every action remains one line and has a tone-specific hover surface and border in both themes, with color transitions disabled under reduced motion. Labels, counts and diagnostic codes share a text baseline; leading icons and trailing arrows stay vertically centered. Finding actions show the diagnostic code beside the outcome in smaller regular-weight type, and a result without findings shows its optional `code` the same way, such as a refusal's native code; long codes truncate visually while their complete text remains in the accessible name, title and dialog or output. Zero findings open Output; one finding opens Finding; several show a findings count with separate blocking, outstanding-warning and accepted-warning totals. The list owns exactly one result dialog. Multiple findings open a Findings overview, with errors first, outstanding warnings next and accepted warnings last. Ordering stays stable within each group and never changes recorded output. Each overview row shows its subject icon, severity, title, code and available path. Selecting a row shows its details in the same dialog; Back to findings restores focus to that row. Reopening the aggregate action restores the overview. The dialog header identifies the result; the Finding card holds the selected diagnostic title once. Warnings, accepted warnings and error counts remain distinct.

`InspectionDialog` is also available through `@moldea.ai/website-ui/inspection-dialog` for standalone composition with external controls. Supply `triggerLabel` to use its own visible trigger; `triggerAriaLabel`, `triggerClass` and the `trigger` slot compose an application-owned entry without another dialog. Its Finding/Output tabs reuse `TabbedPanels`; the first tab is Findings for multiple findings, while zero findings have Output directly. Switching to Output and back preserves the selected finding. The native dialog body scrolls longer lists, with no additional modal for selecting a finding. An illustrative finding omits `output` and `outputLabel` and shows the same finding card without tabs or invented JSON. Findings identify either a structural `group` or a semantic `category`, using the corresponding shared icon and label. Finding shows one diagnostic card with category and title together in its header, alongside the subject icon and severity. The card retains the exact message and code. Location shows the reported file without its leading slash. When the finding carries a JSON Pointer, a Field row shows its decoded keys (`~1` becomes `/`, `~0` becomes `~`) separated by chevrons, with the exact pointer as the row's title. Its outline and lightly tinted header distinguish errors, warnings and accepted warnings without coloring the file headers. Severity icons retain their status color; small error labels use foreground text for contrast. File evidence sits beside that card in separate FilePreview surfaces, never inside a second result frame. Evidence uses `FilePreview` and `CodeBlock`; absent content yields a header without invented source. Supply `beforeContent` together with `content` only for two explicit revisions of the same file. The dialog then uses one unified `CodeDiff`, without padding its changed rows away from the file edges. It keeps the complete supplied excerpts, wraps Markdown and lets code scroll horizontally with keyboard focus. Supporting files remain separate; the package never guesses revision pairs. Finding cards and overview rows use roomier desktop spacing while preserving compact mobile insets. Producers identify affected evidence with `issueLabel`. Its card receives the finding’s severity outline and a compact issue badge beside its label; accepted warnings use the information tone. File icons and headers stay neutral, and supporting files retain their normal outline. A diagnostic’s reported path alone does not identify the defective file. Highlighting never guesses a line range or marks every related file as incorrect. Producers may mark a target `isMissing` only when the diagnostic proves it is absent; merely unprovided content is not evidence of absence. Label excerpts with `isExcerpt`. Evidence, excerpts and output have no copy control, because they are recorded evidence rather than content to paste. Output contains the complete serialized response supplied by the producer, optional command/exit context in the code header outside JSON, explicit redaction notices and a limitation. The package does not execute checks, infer diagnostic meaning, validate native output or redact fields. Websites own those operations and pass typed views (`IInspectionResultView`, `IInspectionFindingView`, `IInspectionEvidence`) through the public presentation boundary. All details and output remain readable inline without JavaScript.

`StatusBadge` uses sentence case, medium `text-xs` type, and an optional `icon` slot. Success uses the green-teal success token in both themes. `CodeDiff` computes gutter width once from the largest displayed line number, rather than reserving a fixed width. Consumers must not pad plain diffs inside file previews: changed backgrounds should reach the file edges. Preserve complete relevant Markdown rules; top-align substantially taller desktop examples instead of clipping their content.

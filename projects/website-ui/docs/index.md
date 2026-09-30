---
title: Website UI foundations
navigationTitle: Overview
description: Shared Astro and Tailwind foundations for moldea public websites.
order: 0
---

# Shared foundations without shared site identity

`@moldea.ai/website-ui` centralizes the visual and interactive contracts that must stay consistent between moldea public websites. It owns semantic design tokens, common global classes, accessible action controls, theme behavior, base-aware navigation primitives, responsive site and documentation shells, optional detail dialogs, sanitized Markdown, generic tabs and status badges, evaluation replay presentation, indeterminate client-navigation progress, static local search behavior, and build-time unified or responsive split file comparisons.

The package does not own site metadata, navigation data, domain status mappings, evidence transformation, generated documentation content, marketing copy, public assets, canonical origins, or persistence keys. Those contracts remain with each website so shared structure does not turn distinct applications into a single coupled product.

## Public boundaries

- `styles.css` provides Tailwind, the Ubuntu Sans variable font, shared tokens, global focus behavior, responsive shells, action states, surface-aware text selection, prose, tables, light/dark themes, and reduced-motion behavior. Platform-aligned interaction roles stay distinct: `text-link` and standalone text actions use 70%/60% opacity, `plain-link` changes muted text to foreground, `navigation-link` and `surface-link` use background feedback, and `interactive-card` uses border feedback with reduced-motion-aware movement. Semantic surface variants preserve warning and danger tints. Navigation derives current-page styling from `aria-current="page"`; keyboard focus remains visible independently of pointer feedback.
- `tokens.css` exposes the design tokens without the global component layer when a consumer needs only the theme contract.
- `site`, `search`, `theme`, and `evaluation-replay-model` expose typed utilities and normalized contracts.
- `code-diff` renders file comparisons with `code-diff-model` build-time rows, line numbers, explicit change markers, syntax highlighting, and native unchanged-line disclosures. Unified is the default; consumers can request split layout, which falls back to unified inside narrow containers. Recorded patches preserve original hunks, file paths, and raw source without reconstructing missing files. Both layouts share the source-wrapping defaults, allow an explicit `overflow` override, and support both themes without client JavaScript. Mixed recorded patches resolve the default per file.
- `code-presentation` exposes the shared overflow type and default resolver for code blocks, Markdown fences, and diffs. Markdown/plain text wraps; code and structured source scroll horizontally. Explicit consumer choices take precedence.
- `markdown` exposes a build-time renderer with raw HTML disabled, sanitization, Shiki highlighting, safe new-tab links with visible external-link indicators, stable headings, and accessible table wrappers.
- component subpaths expose source Astro components compiled by the consuming Astro application. This includes responsive site and documentation shells, progressive-enhancement tabs, semantic status badges, normalized evaluation replay, and navigation progress for Astro `ClientRouter` preparation feedback.

`TabbedPanels` leaves all panel content in server-rendered HTML and applies WAI-ARIA tab roles only after client enhancement. `EvaluationReplay` renders messages as sanitized Markdown, contains command and file-system evidence, distinguishes created, modified, and deleted paths, and keeps verdict detail in a native disclosure. Consumer modules remain responsible for transforming their evidence into the replay model.

`Dialog` owns optional detail triggers, native modality, a fixed header and scrolling body, full-screen mobile presentation, focus restoration, Escape/close dismissal, and background scroll locking. Read-only consumers can enable backdrop dismissal with `isOverlayCloseEnabled`, matching the platform's opt-in behavior. Opening and closing follow the platform's fade, small slide, and desktop scale without animating content dimensions. Native modality lasts through exit; reduced motion and Astro navigation dismiss immediately. Consumers supply unique IDs, copy, optional custom heading summaries, and slotted content; required information must remain outside the dialog because triggers are hidden without JavaScript. The public usage contract is in the package README.

Dialog presentation stays package-owned through typed `triggerVariant`, `triggerSize`, and `size` props. The default remains the compact outline trigger and medium panel; standard text-button variants and sizes, compact icon triggers with a package-owned expand icon and optional decorative slot, and a large panel support other websites without private selectors or copied controls. Both panel sizes retain full-screen mobile behavior.

`LocalSearch` shares an on-demand index request, permits only the latest submitted query to render, and invalidates pending display work when a query is cleared. Index failures are presented with consumer-owned copy and can be retried by submitting again.

The source-presentation resolver, Markdown renderer, and shared stylesheet own the wrapping policy. Markdown/plain text wraps; code and unlabelled fences preserve lines with keyboard-accessible horizontal scrolling. `CodeBlock` and `CodeDiff` accept `overflow="wrap"` or `"scroll"`; Markdown document/fragment renderers accept `codeOverflow`. The package README documents the policy and hand-authored block attributes.

Use the generated API reference for the exact TypeScript utility surface and the package README for component entry points.

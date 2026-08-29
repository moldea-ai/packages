---
title: Website UI foundations
navigationTitle: Overview
description: Shared Astro and Tailwind foundations for moldea public websites.
order: 0
---

# Shared foundations without shared site identity

`@moldea.ai/website-ui` centralizes the visual and interactive contracts that must stay consistent between moldea public websites. It owns semantic design tokens, common global classes, accessible action controls, theme behavior, base-aware navigation primitives, responsive site and documentation shells, sanitized Markdown, generic tabs and status badges, evaluation replay presentation, indeterminate client-navigation progress, and static local search behavior.

The package does not own site metadata, navigation data, domain status mappings, evidence transformation, generated documentation content, marketing copy, public assets, canonical origins, or persistence keys. Those contracts remain with each website so shared structure does not turn distinct applications into a single coupled product.

## Public boundaries

- `styles.css` provides Tailwind, the Ubuntu Sans variable font, shared tokens, global focus behavior, responsive shells, action states, prose, tables, light/dark themes, and reduced-motion behavior.
- `tokens.css` exposes the design tokens without the global component layer when a consumer needs only the theme contract.
- `site`, `search`, `theme`, and `evaluation-replay-model` expose typed utilities and normalized contracts.
- `markdown` exposes a build-time renderer with raw HTML disabled, sanitization, Shiki highlighting, safe link treatment, stable headings, and accessible table wrappers.
- component subpaths expose source Astro components compiled by the consuming Astro application. This includes responsive site and documentation shells, progressive-enhancement tabs, semantic status badges, normalized evaluation replay, and navigation progress for Astro `ClientRouter` preparation feedback.

`TabbedPanels` leaves all panel content in server-rendered HTML and applies WAI-ARIA tab roles only after client enhancement. `EvaluationReplay` renders messages as sanitized Markdown, contains command and file-system evidence, distinguishes created, modified, and deleted paths, and keeps verdict detail in a native disclosure. Consumer modules remain responsible for transforming their evidence into the replay model.

Use the generated API reference for the exact TypeScript utility surface and the package README for component entry points.

# Packages website

`@moldea.ai/packages-website` is the private Astro application that renders the public technical documentation for the open-source `moldea` packages ecosystem. It is an application under `/apps/**`, not a first-class package, npm artifact, or package-catalog entry. It owns the public maturity assigned to each runtime target.

## Source model

The build discovers immediate public implemented projects from `/projects/**`, validates their manifests and package-owned `docs/**`, derives dependencies from manifests, extracts API reference data from actual public TypeScript exports, reads the official Repository Format source from `/specifications/repository-format.md`, and reads technical adapter compatibility and optional skill-owned qualification links through the repository's strict parser for `compatibility/runtimes.yaml`. Target maturity is edited in `content/runtime-target-maturity.yaml`; generation fails unless that file contains exactly one maturity for every matrix target and no stale targets. The generated UI and `https://packages.moldea.ai/compatibility/runtimes.json` use the same combined publication model.

The ignored `.generated/model.json` file is a deterministic build cache. Do not edit it. Package behavior belongs in each project's docs, the Repository Format contract belongs only in `/specifications/repository-format.md`, technical adapter compatibility belongs in the matrix, and target maturity belongs in the website content file. Updating and deploying the maturity YAML file is the complete maturity-management workflow. The public JSON publication uses schema version `1`, identifies technical matrix version `2`, recursively orders object keys, normalizes unordered collections, and contains no generated timestamp or installed CLI state.

Website UI is intentionally excluded from the visitor-facing package model. Its implementation and repository documentation remain under `projects/website-ui/`, but this website does not publish its overview, error documentation, API reference, search records, sitemap URLs, or `llms.txt` entries.

`content/getting-started.md` owns the guide's frontmatter, rendered body, and search text. It hands adoption to the Agent Skill and links the CLI's canonical documentation without copying installation commands. `src/lib/discovery-copy/` owns friendly package, runtime, and target labels, validated for complete and non-stale canonical ID coverage. This presentation metadata never changes the compatibility JSON contract.

`src/lib/inspection-example/` owns three synthetic repository snapshots: a path resolves, moving its source breaks the binding, and updating that binding restores it. Generation runs public `createCore` and `createMemoryRepositoryReader` exports, derives snippets from those same snapshots, and publishes only the selected validation fields. An unexpected result fails generation. The example checks declared paths, not source semantics, and does not run in visitors' browsers or read their files. Its component composes Website UI tabs, badges, and sanitized Markdown; all three states remain readable without JavaScript.

`createWebsiteModel` is asynchronous and must be awaited by callers; `loadWebsiteModel` synchronously reads its completed output. Model generation has no timestamps or environment-dependent example values. Root `turbo.json` is the authoritative owner of website cache inputs, including repository-owned generation sources outside the app, dependency builds, and `SITE_URL`/`BASE_PATH`. It caches `.generated/model.json` together with `dist/`, so restored content and rendered artifacts agree.

Reusable website foundations come from the public `@moldea.ai/website-ui` workspace package. That package owns shared semantic design tokens, global interaction states, base-path and theme utilities, sanitized Markdown, responsive site and documentation shells, local-search behavior, generic tabs and badges, and normalized evaluation replay. This application owns the `https://packages.moldea.ai` origin, `moldea-website-theme` storage key, navigation data, page composition, source validation, package discovery, generated content, and packages-specific copy.

## Commands

Run these from the repository root:

| Command                                                        | Purpose                                                                                                                             |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm website:dev`                                             | Generate the content model and run Astro locally.                                                                                   |
| `pnpm website:prepare`                                         | Build Core and its dependency closure plus Website UI before low-level website tasks.                                               |
| `pnpm docs:generate`                                           | Write the ignored deterministic content model.                                                                                      |
| `pnpm docs:check`                                              | Validate discovery, docs, exports, adapters, and routes without writing source.                                                     |
| `pnpm website:build`                                           | Generate, build static HTML and the local search index, then validate artifact links.                                               |
| `pnpm website:check`                                           | Run the complete non-browser website verification sequence.                                                                         |
| `pnpm turbo run test:e2e --filter @moldea.ai/packages-website` | Run focused browser accessibility, theme, navigation, search, and 320px overflow checks on an automatically selected loopback port. |
| `pnpm --filter @moldea.ai/packages-website check:links`        | Revalidate an existing production artifact.                                                                                         |

Root `docs:check`, `docs:generate`, `website:dev`, and `website:check` prepare their executable dependencies automatically. Direct `pnpm --filter @moldea.ai/packages-website ...` tasks require `pnpm website:prepare` first. Root `website:build` retains Turbo dependency ordering. Preparation builds ignored dependency artifacts; it does not modify package sources or continuously watch dependency changes.

The uncached website `clean:build` task runs before Turbo executes or restores the website build. It removes only this application's `dist/` and `.generated/`, preventing retired pages from surviving an older cache restore. It leaves dependency output, source files, and Turbo caches intact. A direct application build already regenerates the model and lets Astro replace its static output.

The default build inputs are `SITE_URL=https://packages.moldea.ai` and `BASE_PATH=/`, matching the established custom-domain deployment. Supply both variables through the process environment for another mount point, for example `SITE_URL` set to `https://moldea-ai.github.io` and `BASE_PATH` set to `/packages/`. Internal links, assets, canonical metadata, Open Graph images, sitemap URLs, search results, robots, and `llms.txt` are all derived from these inputs.

Check root build artifacts with `check:links` before running Playwright, because its server setup rebuilds the site. Cache verification must inspect fresh source markers in model and static artifacts immediately after root `website:build`, then confirm an unchanged warm hit. Run clean-command and source-mutation checks in an isolated checkout with its own installation. Alternate-origin verification must retain exact expected metadata URLs and test Turbo-mediated E2E environment forwarding, including `PLAYWRIGHT_BROWSERS_PATH`.

## Design and rendering

The application uses Astro static output, Tailwind CSS 4's CSS-first configuration, Ubuntu Sans Variable, and Lucide Astro icons. Website UI supplies the platform-aligned semantic OKLCH tokens, action and link states, accessible breadcrumbs, pre-paint theme initialization, theme controls, local static search, and shared responsive prose primitives. Light and dark themes have distinct token sets, reduced-motion behavior is centralized, and documentation remains ordinary static HTML when JavaScript is disabled.

Every indexable page publishes a unique title and description, an absolute self-canonical URL, complete Open Graph and Twitter image metadata, and Schema.org breadcrumbs. The canonical root also publishes the `WebSite` identity used for the search-result site name. Production artifact verification requires the sitemap to match the complete canonical page set and rejects duplicate metadata, malformed structured data, noindex sitemap entries, and missing social-card fields.

Page-local tests use Astro's native underscore exclusion, such as `src/pages/getting-started/_index.test-e2e.ts`. The prefix is the framework-specific exception to ordinary source-derived test naming: Astro ignores the route, Playwright still discovers the test, and TypeScript still checks it. Artifact verification rejects emitted test filenames and verifies the guide, search/LLM handoffs, and real example states. A Vite preview server's fallback status is not proof that a route was or was not emitted.

The sibling platform repository is a design and specification reference only. The build never imports it, links it as a workspace, fetches private files, or requires it in CI.

## Deployment

Pull requests build and verify the site without deploying it. Relevant pushes to `main` rebuild from the exact pushed commit, read the configured host and base path from GitHub Pages, build the canonical HTTPS origin from that host, pass those values to Astro and the artifact checks, upload `apps/website/dist` with GitHub's official Pages artifact action, and deploy through the `github-pages` environment. After deployment, the workflow submits `https://packages.moldea.ai/sitemap-index.xml` to the `sc-domain:moldea.ai` Google Search Console property. The workflow is separate from npm publication.

If Pages has never been enabled, a repository owner must once select **GitHub Actions** under **Settings → Pages → Build and deployment → Source**. Normal publication is automatic after that setting; no recurring manual dispatch or artifact promotion is required.

Search Console submission authenticates with the `GOOGLE_SEARCH_CONSOLE_CREDENTIALS` organization-level Actions secret, with this repository included in its selected-repository policy. The secret contains the JSON key for `moldea-sitemap-submitter@moldea-prod.iam.gserviceaccount.com`, which must remain an owner of the Search Console property and retain `Service Account Token Creator` on itself. Manual workflow dispatches do not submit the sitemap. A submission failure leaves the deployed Pages artifact live and fails only the post-deployment submission job.

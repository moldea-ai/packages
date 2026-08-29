# Packages website

`@moldea.ai/packages-website` is the private Astro application that renders the public technical documentation for the open-source `moldea` packages ecosystem. It is an application under `/apps/**`, not a first-class package, npm artifact, or package-catalog entry. It owns the public maturity assigned to each runtime target.

## Source model

The build discovers immediate public implemented projects from `/projects/**`, validates their manifests and package-owned `docs/**`, derives dependencies from manifests, extracts API reference data from actual public TypeScript exports, reads the official Repository Format source from `/specifications/repository-format.md`, and reads technical adapter compatibility and optional skill-owned qualification links through the repository's strict parser for `compatibility/runtimes.yaml`. Target maturity is edited in `content/runtime-target-maturity.yaml`; generation fails unless that file contains exactly one maturity for every matrix target and no stale targets. The generated UI and `https://packages.moldea.ai/compatibility/runtimes.json` use the same combined publication model.

The ignored `.generated/model.json` file is a deterministic build cache. Do not edit it. Package behavior belongs in each project's docs, the Repository Format contract belongs only in `/specifications/repository-format.md`, technical adapter compatibility belongs in the matrix, and target maturity belongs in the website content file. Updating and deploying the maturity YAML file is the complete maturity-management workflow. The public JSON publication uses schema version `1`, identifies technical matrix version `2`, recursively orders object keys, normalizes unordered collections, and contains no generated timestamp or installed CLI state.

Reusable website foundations come from the public `@moldea.ai/website-ui` workspace package. That package owns shared semantic design tokens, global interaction states, base-path and theme utilities, sanitized Markdown, responsive site and documentation shells, local-search behavior, generic tabs and badges, and normalized evaluation replay. This application owns the `https://packages.moldea.ai` origin, `moldea-website-theme` storage key, navigation data, page composition, source validation, package discovery, generated content, and packages-specific copy.

## Commands

Run these from the repository root:

| Command                                                        | Purpose                                                                                                                             |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm website:dev`                                             | Generate the content model and run Astro locally.                                                                                   |
| `pnpm docs:generate`                                           | Write the ignored deterministic content model.                                                                                      |
| `pnpm docs:check`                                              | Validate discovery, docs, exports, adapters, and routes without writing source.                                                     |
| `pnpm website:build`                                           | Generate, build static HTML and the local search index, then validate artifact links.                                               |
| `pnpm website:check`                                           | Run the complete non-browser website verification sequence.                                                                         |
| `pnpm turbo run test:e2e --filter @moldea.ai/packages-website` | Run focused browser accessibility, theme, navigation, search, and 320px overflow checks on an automatically selected loopback port. |
| `pnpm --filter @moldea.ai/packages-website check:links`        | Revalidate an existing production artifact.                                                                                         |

The default build inputs are `SITE_URL=https://packages.moldea.ai` and `BASE_PATH=/`, matching the established custom-domain deployment. Set both values explicitly to build for another mount point, such as `SITE_URL=https://moldea-ai.github.io BASE_PATH=/packages/` for the GitHub project-site URL. Internal links, assets, canonical metadata, Open Graph images, sitemap URLs, search results, robots, and `llms.txt` are all derived from these inputs.

## Design and rendering

The application uses Astro static output, Tailwind CSS 4's CSS-first configuration, Ubuntu Sans Variable, and Lucide Astro icons. Website UI supplies the platform-aligned semantic OKLCH tokens, action and link states, accessible breadcrumbs, pre-paint theme initialization, theme controls, local static search, and shared responsive prose primitives. Light and dark themes have distinct token sets, reduced-motion behavior is centralized, and documentation remains ordinary static HTML when JavaScript is disabled.

The sibling platform repository is a design and specification reference only. The build never imports it, links it as a workspace, fetches private files, or requires it in CI.

## Deployment

Pull requests build and verify the site without deploying it. Relevant pushes to `main` rebuild from the exact pushed commit, read the configured host and base path from GitHub Pages, build the canonical HTTPS origin from that host, pass those values to Astro and the artifact checks, upload `apps/website/dist` with GitHub's official Pages artifact action, and deploy through the `github-pages` environment. After deployment, the workflow submits `https://packages.moldea.ai/sitemap-index.xml` to the `sc-domain:moldea.ai` Google Search Console property. The workflow is separate from npm publication.

If Pages has never been enabled, a repository owner must once select **GitHub Actions** under **Settings → Pages → Build and deployment → Source**. Normal publication is automatic after that setting; no recurring manual dispatch or artifact promotion is required.

Search Console submission authenticates with the `GOOGLE_SEARCH_CONSOLE_CREDENTIALS` organization-level Actions secret, with this repository included in its selected-repository policy. The secret contains the JSON key for `moldea-sitemap-submitter@moldea-prod.iam.gserviceaccount.com`, which must remain an owner of the Search Console property and retain `Service Account Token Creator` on itself. Manual workflow dispatches do not submit the sitemap. A submission failure leaves the deployed Pages artifact live and fails only the post-deployment submission job.

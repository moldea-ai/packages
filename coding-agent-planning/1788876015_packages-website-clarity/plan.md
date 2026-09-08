# Packages website: clarity, demonstration, and discovery

## Objective

Make the packages website impressive and understandable to technical and non-technical visitors. Lead with the problem Moldea helps address, demonstrate a real deterministic check, and make the next step obvious without weakening the technical documentation or overstating product capabilities.

This plan covers the packages website and the shared stylesheet responsible for its confirmed mobile overflow. It does not redesign the Skill website or implement platform features.

## Repository evidence and current behavior

Planning baseline: `3cdf816f0a8157f45b4ed2306da0891d4c92ff84`. The worktree was clean before this planning document was created. HEAD and implementation files remain unchanged at this revision; implementation has not begun.

This revision incorporates the latest challenge correction: track the complete repository-owned generation inputs in the website build cache and verify source-only changes against the root build's output. It retains the earlier corrections for executable dependency preparation, configured-origin assertions, and Turbo environment forwarding. The product and visual scope are unchanged. No breakdown exists to invalidate; previous challenges apply only to their superseded plan versions.

The preceding review covered the product specifications under `../platform/moldea/`, including product positioning, Agent Skill, Cloud and Assurance, package ownership, Repository Format, and runtime-adapter boundaries. Those documents remain reference material only. Current public package implementations and canonical documentation determine what this website can claim today.

Relevant implementation evidence:

- `README.md` and `apps/website/README.md` establish a private, static Astro application, repository-owned content generation, shared Website UI ownership, search and machine-readable publications, and GitHub Pages deployment.
- `apps/website/src/pages/index.astro` leads with “Behavioral integrity” and implementation terminology. It renders the complete available-adapter catalog and repeats adapter information in its architecture section.
- `apps/website/src/components/repository-format-overview/repository-format-overview.astro` omits the required manifest from its illustration and describes an obsolete returned project index.
- `projects/core/src/contracts/index.ts` exposes content-free validation results and bounded inspection pages. The actual validation result contains `valid`, `formatVersion`, `summary`, `source`, `evidence`, and `diagnostics`, not the illustrated project-content object.
- `projects/cli/docs/index.md` already owns repository-local installation and the first validation command. The CLI performs no network requests, model calls, telemetry, or repository writes. Its installation instructions apply to an adopted repository, not an arbitrary checkout.
- `compatibility/runtimes.yaml` owns technical scope; `apps/website/content/runtime-target-maturity.yaml` owns target maturity. Their combined publication drives HTML and `/compatibility/runtimes.json`. Implementation availability and target maturity are different concepts.
- `adapter-card.astro` currently uses only the first target's maturity. Several adapters have multiple targets, so a redesigned card must not imply that the first target represents the entire adapter.
- The live-site review found horizontal overflow at a 320px viewport with a space-consuming scrollbar. `projects/website-ui/src/styles.css` applies `min-w-80` to `body`, keeping it 320px wide when the document's available width is smaller.
- Website UI already exports the required actions, badges, tabs, navigation shells, theme support, and sanitized Markdown renderer. No new UI dependency or client framework is necessary.
- Core and Repository public imports resolve to compiled `dist` files. Root `website:dev` and `website:check` currently build only Website UI; `docs:check` and `docs:generate` invoke generation directly. Adding executable Core imports requires explicit dependency preparation in these normal workflows, not only in the verification checklist.
- `astro.config.ts` and the artifact verifier honor `SITE_URL`, but the canonical URL assertions in `base-layout.test-e2e.ts` always use `DEFAULT_SITE_URL`. Root `turbo.json` also omits `SITE_URL` and `BASE_PATH` from website task environments.
- `generation.ts` reads root specification and compatibility files, package manifests and documentation, and the root runtime-compatibility parser. `api-reference.ts` resolves exports through manifests and sources under both `projects/` and private `packages/`. These inputs extend beyond the website's declared dependency graph. The artifact verifier compares output with the generated model, so mutually stale cached files can pass without proving source freshness.

Installed tooling: Astro 7.2.2, Tailwind CSS 4.3.3, TypeScript 6.0.3, Vitest 4.1.10, Playwright 1.62.1, axe-core Playwright 4.13.0, Turbo 2.10.9, and pnpm 11.9.0. Website UI is 1.2.2; Core is 3.0.1 and Repository is 2.0.0. The website already declares Core and Repository as development dependencies.

### Planning verification already completed

A read-only, in-memory experiment using the installed public Core and Repository exports confirmed the proposed example:

1. A declared reference to `/src/refund-policy.ts` resolves: `valid: true`.
2. The file moves to `/src/payments/refund-policy.ts` without updating its reference: `valid: false`.
3. Updating the declared reference restores `valid: true`.

The broken state returns:

```json
{
  "code": "MOLDEA_REFERENCE_MISSING",
  "message": "The referenced repository path does not exist.",
  "path": "/moldea/moldea.yaml",
  "pointer": "/context/~1moldea~1project.md/bindings/0",
  "details": {
    "referencedPath": "/src/refund-policy.ts"
  }
}
```

This is an excerpt of the real diagnostic, not a proposed CLI envelope. No implementation tests, builds, or visual verification of a redesigned site have run.

## Scope and acceptance criteria

### In scope

- A benefit-led homepage with one concrete, near-top example.
- A new `/getting-started/` orientation page and clear routes to the CLI, libraries, adapters, and Agent Skill.
- Correct Repository Format and Core illustrations.
- Job-oriented package discovery, readable adapter names, and correctly scoped maturity presentation.
- Clear boundaries between deterministic packages, agent-assisted Skill workflows, and separate Cloud capabilities.
- Responsive visual refinement, keyboard accessibility, both themes, reduced-motion behavior, and the shared mobile overflow correction.
- Directly affected search, metadata, route validation, tests, documentation, and Website UI patch-release bookkeeping.
- Minimal root command preparation, complete website-specific Turbo file/environment inputs and cache outputs, configured-origin assertions, and cache regression checks required by the challenge findings.

### Explicit exclusions

No Core, CLI, reader, or adapter behavior changes; new runtime support; compatibility-schema changes; maturity promotions; copied qualification evidence; Cloud or Assurance implementation; hosted demo backend; repository uploads; analytics; accounts; new framework, dependency, font, theme system, or animation library.

Do not import the sibling platform repository into the build. Do not rewrite all package documentation, introduce a second Skill onboarding flow, change existing documentation URLs, or reorganize unrelated modules.

No deployment, npm publication, commit, push, or Git configuration change is authorized by this plan.

### Finished-state criteria

- The hero and first example answer what the tools do, why someone would use them, and where to go next without requiring knowledge of “deterministic readers” or “behavioral integrity.”
- The homepage shows the real connected, broken, and repaired reference states. Its “valid” result is explicitly a structural check, not proof that a business rule or agent behavior is correct.
- A new visitor can choose agent-assisted adoption, local validation of an adopted repository, or programmatic integration.
- The repository illustration includes `moldea/moldea.yaml` and `moldea/project.md`, distinguishes optional material, and makes no obsolete Core return-shape claims.
- Existing package and adapter documentation, API references, target anchors, evidence links, canonical URLs, and machine-readable compatibility contracts remain usable.
- Changed pages work from 320px through large desktop widths without page-level horizontal overflow, including a reserved scrollbar gutter. Code and wide technical tables may scroll inside named, keyboard-accessible regions.
- Light and dark themes, keyboard navigation, visible focus, no-JavaScript reading, and reduced-motion preferences remain supported.
- Static output remains static. The example adds no browser-side Core runtime, repository access, model calls, or network requests.
- Normal root documentation, development, and website-check commands prepare their executable workspace dependencies without relying on an earlier repository build. The website build retains its existing dependency-ordered Turbo workflow.
- Default and alternate-site verification assert the exact configured origin and base path. A cached default build cannot stand in for an alternate-site artifact.
- With the environment unchanged, edits to any repository-owned generation input invalidate the website build cache. Specification-only, compatibility-only, and package-documentation-only edits must appear in the generated model and public artifact before any subsequent generation or browser-test rebuild.

## Content and visual design

### Homepage sequence

Use one authoritative narrative, in this order:

1. **Purpose and entry points.** Lead with “The open-source foundation for keeping agent instructions and code aligned.” Supporting copy explains Git-owned project knowledge, declared connections to code, and repeatable structural checks. Keep “behavioral integrity” as secondary product positioning. Present “See how it works” linking to `#how-it-works`, “Start using the tools” linking to `/getting-started/`, and a clearly labeled Agent Skill link.
2. **A reference breaks, and the check explains why.** Show the three-state example immediately after the hero. Use plain-language explanations first, with inspectable file snippets and exact diagnostics underneath.
3. **What lives in your repository.** Rework the existing Repository Format overview into a compact explanation of required files and optional context, decisions, and agent declarations. Link to the canonical specification. The new example owns the actual result illustration; remove the separate invented project-index object.
4. **Choose tools by the job.** Present the CLI as the usual local entry point, Core for programmatic checks, and Repository/Repository FS for source access. Keep exact package names and versions as secondary technical identifiers. Include one concise composition explanation, not another full adapter grid.
5. **Find your runtime.** Show a compact, name-led list of available adapters linking to their existing detail routes. Preserve current inventory ownership and the built-in custom distinction. Keep full target scope, limitations, and qualification links in the adapter and compatibility pages.
6. **Trust and boundaries.** Explain Git ownership, read-only local CLI checks, scoped adapter interpretation, and the distinction from semantic judgment. End with the getting-started and Agent Skill actions.

Remove superseded homepage sections, duplicated adapter listings, dead imports, and tests that encode their old sequence. Do not retain the previous architecture presentation as a parallel hidden or alternate experience.

### Visual direction

Preserve the Moldea logo, Ubuntu Sans, semantic OKLCH tokens, Lucide icons, and existing Website UI variants. Make the real example the main visual feature: identifiable files, a changed path, a readable diagnostic, and a clear repaired state.

Use restrained surfaces and strong typography rather than adding decorative mockups, large gradients, looping motion, or a long wall of equally weighted cards. On mobile, flatten redundant containers, reduce nested borders and spacing, and let explanatory content use the available width. On desktop, align input and result panels where that makes the relationship easier to follow.

Do not impose an arbitrary homepage-height target. The concrete reduction is removing duplicate inventories and recomposing technical panels for narrow screens.

Keep example state changes immediate. No new animation is required; preserve existing shared reduced-motion behavior and anchor/navigation accessibility.

### Product boundaries and copy

Explain the layers without presenting three equally available products:

- Packages provide deterministic inspection and validation tools. Qualify the no-network, no-model, no-telemetry, and no-write claims as properties of the local CLI and relevant package operations.
- The Agent Skill uses coding-agent workflows for semantic evaluation and maintenance. Link to `https://skill.moldea.ai/`; do not duplicate installation procedures or imply its entire workflow has the CLI's privacy boundary.
- Cloud is separate from using these local packages. If mentioned, describe only the distinction and verified availability; do not advertise feature-gated Assurance or a future SDK as available here.

Use restrained, concrete public copy. No invented usage numbers, customer logos, reliability percentages, endorsements, or evaluation scores. Avoid em dashes and decorative Unicode in newly written external-facing prose.

### Getting started and discovery

Create `apps/website/content/getting-started.md` as the single authored source for the new page's title, description, body, and search text. Use the existing Markdown rendering and frontmatter-validation patterns.

The page must answer:

- “I want help adopting Moldea in my coding agent”: follow the Agent Skill link.
- “My repository already has Moldea files and I want to check it”: use the canonical CLI overview, which owns installation, invocation, and the repository-local trust boundary.
- “I am building an integration”: start with Core and the appropriate repository reader.
- “I need to know whether my runtime is covered”: use Adapters and Compatibility, checking exact targets and limitations.

Do not duplicate CLI commands or version requirements into a second manually maintained tutorial. Provide a visible direct link to the existing command block's page.

Add “Get started” to the existing header navigation. Put Agent Skill in the homepage entry points, getting-started page, and footer project links. Keep search, source access, theme controls, and existing documentation navigation. Verify the wider navigation at its current desktop breakpoint before changing shared header behavior.

Use website-owned display copy for friendly package jobs, adapter names, and target labels. Examples include “OpenAI,” “Google Gen AI,” “Cloudflare Agents,” “Responses API,” and “StateGraph.” Preserve exact IDs, package names, version ranges, language, and anchors alongside or beneath those labels.

Make maturity definitions readable without hovering. Show maturity per target on detailed catalog cards and compatibility surfaces, including multiple-target adapters. Never summarize an adapter with only its first target's badge. The compact homepage list can omit target maturity and link to full details instead.

## Architecture and ownership

### Build-time example

Add an application-owned `inspection-example` module. Its public operation, `createInspectionExample`, creates the three fixed synthetic snapshots with `createMemoryRepositoryReader` from `@moldea.ai/repository/memory` and validates them with `createCore` from `@moldea.ai/core`.

The initial manifest is:

```yaml
version: 1
context:
  /moldea/project.md:
    bindings:
      - path: /src/refund-policy.ts
```

The project document describes manager approval for refunds; the synthetic source exports a corresponding flag. The demonstration moves the source file and then repairs its binding. It does not claim to validate the flag's meaning, resolve a symbol, execute the source, or automatically modify a user's repository.

Generate displayed snippets from those same fixture strings. Derive diagnostic text from returned Core results, not independently authored JSON. Label displayed output as a Core result excerpt.

Fail generation if the intended pass/fail/pass contract changes or the broken state no longer identifies the expected missing reference. Propagate unexpected errors through the existing build-failure path rather than publishing invented success data.

The module's collections are durably bounded to three authored states and their fixed files. Do not add a general fixture editor, scenario framework, pagination system, server endpoint, or persistence layer.

Compose the example with `@moldea.ai/website-ui/tabbed-panels`, `status-badge`, and the existing sanitized Markdown renderer. All panels remain readable without JavaScript; shared tabs supply keyboard behavior after enhancement. The component owns product-specific explanations, not a new generic tab or code-block primitive.

Do not use Evaluation Replay for this example: its recorded-trial and verdict contract does not describe a synthetic structural check.

### Generation integration

Extend `IWebsiteModel` with the generated example, the authored getting-started document, and presentation-only discovery metadata kept separate from canonical compatibility entries.

Make `createWebsiteModel` asynchronous so it can await real Core validation. Update its complete known caller set: `scripts/check.ts`, `scripts/generate.ts`, and the generation integration suite's setup. Keep `loadWebsiteModel` synchronous for pages reading the completed cache.

Register `/getting-started/` in `createRouteManifest`. Extend `createSearchRecords` and `createLlmsText` from the same authored guide and discovery labels. Include the external Agent Skill destination in `llms.txt` without creating an internal search result pointing off-site.

Continue generating `.generated/model.json`; never hand-edit it. Update its generated-source notice. Preserve deterministic ordering and omit timestamps, machine paths, private package identities, and environment-dependent example data.

Keep display metadata in a small typed `discovery-copy` module, keyed by the current canonical package, adapter, and target identifiers. Validate coverage against the discovered inventory so missing or stale labels are caught during generation. Do not copy technical version ranges, maturity values, patterns, or evidence into this module.

### Website command preparation

Keep orchestration in the existing root package scripts. Add one `website:prepare` script with the exact command `turbo run build --filter @moldea.ai/core... --filter @moldea.ai/website-ui`. Core's declared dependency graph includes Repository, so this prepares the complete executable dependency set without building the CLI or unrelated adapters.

Update these root scripts:

- `docs:check`: `pnpm website:prepare && pnpm --filter @moldea.ai/packages-website docs:check`
- `docs:generate`: `pnpm website:prepare && pnpm --filter @moldea.ai/packages-website docs:generate`
- `website:dev`: `pnpm website:prepare && pnpm --filter @moldea.ai/packages-website dev`
- `website:check`: `pnpm website:prepare && pnpm --filter @moldea.ai/packages-website check`

Keep `website:build` as `turbo run build --filter @moldea.ai/packages-website`; its existing `^build` dependency ordering prepares the same packages. Remove the superseded Website-UI-only preparation from `website:dev` and `website:check` rather than running both paths.

Package-filtered commands remain low-level task bodies, not additional self-preparing wrappers. Document `pnpm website:prepare` as the prerequisite when invoking those bodies directly, including website typechecking, focused generator tests, or the package-local development script. Root commands are the supported self-preparing entry points. Do not add nested Turbo calls inside application task bodies, implicit installation hooks, deep source imports, or a second build system.

Dependency source changes must invalidate the normal Turbo build cache before subsequent command invocations. Restart the development command after changing a dependency's implementation; continuous dependency watching is not introduced by this change.

### Configured-origin verification and task environments

In `base-layout.test-e2e.ts`, derive a module-level `siteUrl` from `process.env.SITE_URL ?? DEFAULT_SITE_URL`. Use it for homepage and documentation canonical URLs, Open Graph URLs, and breadcrumb/WebSite URL expectations. Preserve the existing base-path normalization, exact assertions, and product identity constants. Never derive expected metadata from the rendered metadata being tested.

Add website-specific task definitions to the existing root `turbo.json`:

- `@moldea.ai/packages-website#build`: retain `dependsOn: ["^build"]`; declare `outputs: ["dist/**", ".generated/model.json"]`; add `env: ["SITE_URL", "BASE_PATH"]` and the complete `inputs` array below.
- `@moldea.ai/packages-website#test:integration`: retain `dependsOn: ["build", "^test:integration"]`; add `env: ["SITE_URL", "BASE_PATH"]`.
- `@moldea.ai/packages-website#test:e2e`: retain `dependsOn: ["build", "^build"]`; declare `env: ["PLAYWRIGHT_BROWSERS_PATH", "SITE_URL", "BASE_PATH"]`.

Package-specific root definitions replace the corresponding generic task configuration, so explicitly retain these existing dependencies and browser environment settings. Keep other packages' task definitions unchanged. Caching the generated model alongside `dist` ensures later artifact checks can read the matching model after a cache restore. [Turborepo package-task configuration](https://turborepo.dev/docs/reference/package-configurations)

Use hashed `env` inputs, not passthrough-only variables or loose environment mode. The variables must reach Astro and test processes, and changing either must select a different website cache key. Their names, defaults, and public deployment meaning remain unchanged. [Turborepo environment-variable guidance](https://turborepo.dev/docs/crafting-your-repository/using-environment-variables)

These are disclosed changes to local orchestration and website task configuration, not a deployment redesign. No workflow, provider, secret, or remote setting changes are needed. Verify the root build's artifact before browser tests start, because Playwright's separate rebuild must not hide an incorrectly configured root build.

### Repository-owned generation inputs

Set the website-specific build task's `inputs` to:

```json
[
  "$TURBO_DEFAULT$",
  "$TURBO_ROOT$/specifications/repository-format.md",
  "$TURBO_ROOT$/compatibility/runtimes.yaml",
  "$TURBO_ROOT$/scripts/runtime-compatibility/**",
  "$TURBO_ROOT$/projects/*/package.json",
  "$TURBO_ROOT$/projects/*/docs/**/*.md",
  "$TURBO_ROOT$/projects/*/src/**",
  "$TURBO_ROOT$/packages/*/package.json",
  "$TURBO_ROOT$/packages/*/src/**",
  "!$TURBO_ROOT$/**/_archive/**",
  "!$TURBO_ROOT$/**/_archives/**",
  "!$TURBO_ROOT$/**/_backup/**",
  "!$TURBO_ROOT$/**/_backups/**"
]
```

`$TURBO_DEFAULT$` preserves the website's normal Git-aware inputs, including its source, configuration, scripts, public assets, authored guide, and maturity file. Root-relative patterns add the external files read by generation without replacing that default set. Keep the four subtree exclusions on the combined input set. [Turborepo input configuration](https://turborepo.dev/docs/reference/configuration#inputs)

The public-project patterns cover discovery metadata, package-owned Markdown, and the source exports used for API references, including packages outside the website dependency graph. Private workspace manifests and sources also participate in TypeScript export resolution; hashing them does not authorize publishing private package identities or implementation details. The parser subtree covers its imported validation, normalization, and support modules. Root manifests and the lockfile retain Turbo's automatic tracking, while `^build` retains executable dependency ordering and hash propagation.

Use globs rather than a fixed list of today's packages or documents so matching additions, removals, and renames also invalidate the cache. Keep generated models, `dist`, dependency installations, the sibling platform repository, and unrelated root documentation out of the added input set. Do not add every adapter as a runtime dependency, introduce repository-wide `globalDependencies`, disable caching, or create a second freshness model.

During implementation, compare this inventory with the generator's final file reads and imported source closure, and inspect resolved task inputs and hashes in the isolated verification copy. Integration and E2E tasks already depend on the website build and therefore inherit its changed hash; do not duplicate this input inventory across those tasks. Model/artifact agreement is necessary but insufficient: the warm-cache checks below must independently assert the edited source content.

### Shared stylesheet and release boundary

Remove the fixed body minimum width from `projects/website-ui/src/styles.css`. Preserve the existing theme, wrapping, and layout primitives. Do not hide the bug using global `overflow-x: hidden` or an application override.

This is a public package source change. Under `docs/npm-releases.md`, bump Website UI from 1.2.2 to 1.2.3, update its README installation example and packed-package version assertion, and synchronize the lockfile only if the package manager changes the affected workspace metadata.

Do not change exports, dependency ranges, framework compatibility, or downstream package versions. The website already consumes Website UI through `workspace:*`. If another Website UI version has been released before implementation, stop and reconcile the release baseline rather than reuse an occupied version.

This shared CSS fix also affects other consumers of a future Website UI release. Verify the existing packed Astro consumer and packages website; do not edit or deploy the Skill website.

## File-level implementation scope

Paths below are repository-relative. Existing Astro component placement and naming remain intact; new meaningful components and support modules receive dedicated directories.

### Add

- `apps/website/content/getting-started.md`: authored orientation content.
- `apps/website/src/pages/getting-started/index.astro`: static guide using BaseLayout, Breadcrumbs, and sanitized Markdown.
- `apps/website/src/pages/getting-started/index.test-e2e.ts`: visitor routes, no-JavaScript reading, and guide accessibility.
- `apps/website/src/lib/inspection-example/index.ts`, `types.ts`, `constants.ts`, and `inspection-example.ts`: thin exports, typed display contract, fixed source fixtures, and real Core evaluation.
- `apps/website/src/lib/inspection-example/inspection-example.test-integration.ts`: actual Core/reader integration and deterministic output.
- `apps/website/src/components/inspection-example/index.ts`, `inspection-example.astro`, and `inspection-example.test-e2e.ts`: feature composition and browser behavior.
- `apps/website/src/lib/discovery-copy/index.ts`, `types.ts`, `constants.ts`, `validations.ts`, and `validations.test-unit.ts`: presentation metadata and meaningful inventory-coverage checks. Do not add tests merely to repeat constant strings.

### Modify

- Root `package.json`: add `website:prepare` and route the four documented root commands through it; preserve the existing website build command and all unrelated scripts.
- Root `turbo.json`: website-specific build/integration/E2E task definitions with preserved dependencies, complete repository-owned generation inputs and exclusions, explicit site environment inputs, and matching generated-model cache output described above.
- `apps/website/src/pages/index.astro`: new narrative, real example, reduced repetition, and page metadata.
- `apps/website/src/pages/packages/index.astro`, `pages/adapters/index.astro`, `pages/adapters/[adapter]/[...path].astro`, and `pages/compatibility/index.astro`: job-led introductions, friendly labels, and accurate target-level presentation without changing routes.
- `apps/website/src/components/package-card.astro`, `adapter-card.astro`, `adapter-details.astro`, and `target-maturity-legend.astro`: readable discovery, compact homepage composition, mobile density, and visible maturity explanations.
- `apps/website/src/components/repository-format-overview/repository-format-overview.astro`: correct required files, current Core boundaries, and removal of obsolete result illustration.
- `apps/website/src/components/site-header.astro` and `site-footer.astro`: entry points and boundary-aware copy.
- `apps/website/src/lib/model/types.ts`, `lib/generation/generation.ts`, `scripts/check.ts`, and `scripts/generate.ts`: model, async generation, new route, search, and machine-readable orientation.
- `apps/website/scripts/verify-build.ts` and its existing integration test: require the new guide, example, search entry, and internal destinations while retaining existing artifact safeguards.
- `apps/website/src/lib/generation/generation.test-integration.ts`: async setup, route/search/llms consistency, deterministic generation, and unchanged canonical compatibility publication.
- `apps/website/src/layouts/base-layout.test-e2e.ts`, `components/repository-format-overview/repository-format-overview.test-e2e.ts`, `components/adapter-details.test-e2e.ts`, and `components/target-maturity-legend.test-e2e.ts`: revised narrative and labels, configured-origin URL assertions, preserved contracts, responsive regressions, themes, and accessibility.
- `projects/website-ui/src/styles.css`, `package.json`, `README.md`, and `src/index.test-integration.ts`: width fix and 1.2.3 release synchronization.
- `README.md` and `apps/website/README.md`: directly affected blueprint, content ownership, example generation, self-preparing root commands, direct-task prerequisites, and verification instructions.
- `pnpm-lock.yaml` only if necessary to synchronize the Website UI version metadata; no unrelated resolution changes.

All discovery and verification must exclude `_archive`, `_archives`, `_backup`, and `_backups`. For the two affected test boundaries, add explicit exclusions to their existing `vitest/test-unit.config.ts` and `vitest/test-integration.config.ts`, retaining inherited defaults and category isolation. Add equivalent `testIgnore` entries to `apps/website/playwright.config.ts`. This is test-discovery protection only; do not refactor shared runner configuration or migrate unrelated tests.

Keep test sources out of production artifacts while retaining test typechecking. Existing source-derived test names and category scripts remain the authoritative conventions; no new test category is needed.

## Ordered implementation and review checkpoints

These are strategic steps within one plan, not independently authorized milestones.

1. **Establish the example and authored content contracts.** Add the fixed fixtures, real Core integration, typed presentation data, inventory validation, and getting-started source. Verify the pass/fail/pass result and copy boundaries before composing pages. Review checkpoint: the example proves a reference check and does not imply semantic correctness or live repository access.
2. **Integrate static generation and discovery.** Await the example, load the guide, register the route, and update search, llms, generated notices, and build verification together. Add root dependency preparation and complete website-specific file/environment/cache wiring in the same step; update configured-origin test expectations. Verify normal entry points without prebuilt dependencies, source-only warm-cache invalidation, and the root build's origin before any browser-server rebuild. Keep canonical compatibility data unchanged in the implementation. Review checkpoint: all new content has one owner, normal commands prepare their dependencies, cache keys cover the generator's complete repository-owned input set, and the deployed artifact needs no sibling repository or request-time service.
3. **Compose the visitor experience.** Rework the homepage in the agreed order, add the guide, refine package and adapter discovery, correct the repository overview, and update navigation. Remove superseded sections and update affected tests in this step. Review checkpoint: a non-technical reader can explain the example; a developer can still reach exact contracts and compatibility scope.
4. **Complete responsive and shared-package work.** Fix body sizing at its owner, synchronize Website UI 1.2.3, and verify compact layouts, both themes, classic scrollbar conditions, keyboard behavior, and no-JavaScript reading. Review checkpoint: the shared change is only a sizing correction, with no new visual system or public API.
5. **Synchronize documentation and perform final verification.** Update current-state documentation, format touched files, run the affected suites and builds, review screenshots and artifacts, and audit the final diff against this scope. Report limitations and stop without publication.

Required tests and directly affected documentation accompany their production changes; step 5 is the final consistency pass, not permission to leave earlier work knowingly incomplete.

## Verification strategy

### Focused correctness coverage

The example integration suite must use real public Core and memory-reader exports, not mocked validation. Cover exact missing-reference identity, valid states, fixture-to-snippet consistency, repeated deterministic generation, no stale project-content object, and failure when the expected example contract is violated.

Generation tests must cover the new route, one guide search record, useful non-technical search terms, llms links, async completion, missing/stale display metadata, existing route collision checks, and byte-equivalent canonical compatibility publication for unchanged source inputs.

Browser tests must cover all example states; Arrow Left/Right, Home, and End tab behavior; correct selected panels and focus; navigation away and back through Astro client routing; and all panels readable without JavaScript. Do not test private component state or reimplement shared keyboard logic.

Check homepage, getting started, package discovery, adapters, compatibility, and representative documentation at 320px, 360px, 768px, 1024px, and 1440px. Use both themes. Include a genuinely reserved scrollbar gutter and compare document scroll width with available client width, not only with `window.innerWidth`. Confirm the regression fails against the old body minimum width.

Verify mobile menu focus and theme persistence, readable long identifiers, accessible maturity definitions, target-specific statuses for multiple-target adapters, safe external links, visible focus, contrast, and reduced-motion behavior. Run axe on changed page states and manually inspect screenshots for hierarchy, density, alignment, and clipping.

Update stale exact-copy and section-order assertions to the intended new content while preserving their underlying accessibility, typography, selection, navigation, and metadata checks.

### Command and cache regression checks

Use a disposable repository copy containing the implementation under review, with its own workspace installation and no shared workspace-package links back to the developer's checkout. Exclude the four protected archive/backup directory names and omit generated package outputs and Turbo caches. Do not delete, rename, or move dependency artifacts in the developer's workspace to simulate a clean state.

From an independently output-empty state for each command, exercise `pnpm docs:check`, `pnpm docs:generate`, `pnpm website:dev`, `pnpm website:check`, and `pnpm website:build`. Do not run `website:prepare` manually first. Confirm the commands themselves build or restore valid dependency artifacts before importing Core. For the long-running development command, verify the homepage and generated example over loopback, then stop only the process started for that check. Record any unavailable verification prerequisites rather than weakening the check.

After those clean-state checks, run a warm repeat and inspect dependency task/cache outcomes. In the disposable copy only, make a harmless comment change to a Core source file and confirm a subsequent normal command rebuilds Core rather than using stale output. The main worktree's runtime-package sources remain untouched. Do not add a permanent fixture-copy framework or test source files solely for this script wiring; real command execution supplies the integration evidence.

For source-freshness checks, first populate and reuse a valid baseline website cache. Keep site variables, application code, task configuration, and dependency versions unchanged. Apply each following schema-valid edit independently in the disposable copy, then run only `pnpm website:build` before inspecting `.generated/model.json` and `dist`. Require a changed website task hash, a cache miss for the newly edited state, and the expected content below; a successful build or model/artifact equality alone is not enough.

| Isolated source edit                                                                                                                                             | Required fresh output                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Add a unique prose marker to `specifications/repository-format.md`, preserving required sections and examples.                                                   | The marker appears in the model's specification Markdown and `dist/repository-format/index.html`.                                                          |
| Add a unique marker to the Anthropic entry's existing `runtimeGuidance.notes` in `compatibility/runtimes.yaml`, without changing target IDs, scope, or maturity. | The marker appears in the model's compatibility publication, `dist/compatibility/runtimes.json`, and `dist/adapters/anthropic/index.html`.                 |
| Add a unique prose marker to `projects/adapter-openai/docs/index.md`, preserving frontmatter and links.                                                          | The marker appears in the model's package document and `dist/adapters/openai/index.html`, despite that adapter not being an executable website dependency. |

For each case, run `check:links` only after those source-based assertions, repeat the unchanged root build to prove a cache hit with the same fresh output, and restore only that verification copy's deliberate edit before the next case. Do not run `docs:generate`, integration tests, or Playwright between the root build and artifact inspection, and do not use forced builds or clear the populated cache.

Also verify input/hash sensitivity to a public-project manifest description change, a public API documentation comment change, a private workspace source change, and a runtime-compatibility parser source change. Verify a valid package-document addition and removal updates route/model/artifact membership across warm builds. Keep these temporary mutations confined to the isolated copy; they are verification fixtures, not approved changes to package behavior or canonical product content. Confirm the resolved input inventory retains website defaults and excludes all four protected directory names without reading or creating excluded content.

Verify cache restoration of the website artifact and its matching generated model in the disposable copy. For alternate-site checks, assert the built homepage canonical URL is exactly `https://moldea-ai.github.io/packages/` before the E2E server starts. The guide must resolve beneath `/packages/getting-started/`, and existing exact metadata checks must continue passing against the configured origin.

### Commands and execution order

Use the installed Node/pnpm toolchain. Do not install new verification tooling. Run from the repository root after implementation approval:

```bash
pnpm website:prepare
pnpm --filter @moldea.ai/packages-website test:unit
pnpm --filter @moldea.ai/packages-website test:integration src/lib/inspection-example/inspection-example.test-integration.ts src/lib/generation/generation.test-integration.ts
pnpm --filter @moldea.ai/website-ui test
pnpm --filter @moldea.ai/website-ui typecheck
pnpm --filter @moldea.ai/packages-website typecheck
pnpm --filter @moldea.ai/website-ui lint --ignore-pattern '**/{_archive,_archives,_backup,_backups}/**'
pnpm --filter @moldea.ai/packages-website lint --ignore-pattern '**/{_archive,_archives,_backup,_backups}/**'
pnpm website:build
pnpm --filter @moldea.ai/packages-website check:links
pnpm --filter @moldea.ai/packages-website test
```

Format only the actual touched file list using the installed Prettier and root `.prettierrc`, then run its check mode on that same list before the final build. Do not run the repository-wide write-format command.

The initial preparation makes real workspace exports available for the direct low-level verification commands; it does not replace the independently clean root-command checks above. The focused integration invocation avoids artifact tests until a production artifact exists. Check links immediately after the root build, before the full website `test` command can rebuild through Playwright. That command runs every existing correctness category; its browser server rebuild is part of the established workflow. Run package integration work serially rather than concurrently.

Because runner exclusions change, confirm each affected granular script discovers only its category. Inspect the built website and packed Website UI artifact for test-file leakage and request-time server output.

Repeat website build, immediate link/artifact verification, and full website tests with `SITE_URL=https://moldea-ai.github.io` and `BASE_PATH=/packages/` supplied through the process environment. Use the same commands, without introducing POSIX-only environment-setting scripts. Verify the task receives both variables and that default and alternate builds have different website task hashes. Confirm guide links, example anchors, search, canonical metadata, sitemap, assets, and llms work under that mount point. Rebuild with the default environment and verify the default origin again; include warm-cache runs so successful uncached builds do not conceal cache-key errors. Run the Turbo-mediated website E2E entry point under the alternate environment as well to verify its retained browser path and environment forwarding.

```bash
pnpm turbo run test:e2e --filter @moldea.ai/packages-website
```

The repository's release-change checker requires two exact commits. Do not create a commit to run it. Audit the version increment against the planning baseline during implementation; leave the commit-based release gate to the separately authorized publication workflow.

For typechecking and other recursive tooling, enforce the same excluded-directory boundary through scoped inputs or local exclusion settings. If a required tool cannot respect that boundary, report the verification limitation instead of consuming excluded content or silently expanding tooling scope.

### Documentation and final diff

Update the root blueprint and website README to explain the guide source, synthetic build-time example, async generation, and ownership boundaries. Document `website:prepare`, which root commands call it automatically, prerequisites for direct package tasks, and configured-origin/cache verification. Identify `turbo.json` as the website cache-input owner and require synchronization when generation gains another repository source; do not duplicate the full glob list in documentation. Keep `/docs` reserved for concise durable concepts and processes; API and HTTP contract documentation stays in its established locations outside `/docs`.

No runtime error contract changes are planned. Reuse the existing Core diagnostic exactly; do not invent error codes or modify canonical error documentation for presentation alone. Document any new intentional build-helper failures where required by their public module contracts.

Review every touched path and generated diff. Preserve unrelated user changes. Inspect protected coding instructions without editing them; provide a handoff prompt only if completed work reveals missing durable guidance.

## Risks, compatibility, and rollback

- **Misleading certainty:** structural success does not establish semantic correctness. Keep this limitation beside the example result, not only in a footer.
- **Content drift:** use actual validation results, canonical package docs, and one presentation-data owner. Treat new runtime targets without display metadata as an actionable generation failure.
- **Shared CSS impact:** verify the packed consumer and representative shared shells. Cross-platform browser behavior cannot be claimed from a single host; report which environments were exercised and rely on existing CI for remaining supported hosts.
- **Build integration:** async generation must be awaited at every caller. Generated cache writes and static page reads must remain ordered. Normal root commands must prepare executable dependencies without a prior manual build; direct low-level task prerequisites must be explicit.
- **Environment and cache correctness:** exact metadata expectations must honor the configured origin. Website cache keys must include both site variables and every repository-owned generation input, not only declared package dependencies. Validate source-only changes against the root artifact before other generators or browser tests can rebuild and mask stale output.
- **Navigation density:** verify the existing desktop breakpoint and mobile disclosure before considering any shared shell change. A shared header redesign is outside this plan.
- **Publication:** Website UI requires a patch release, but publishing remains a separate authorized workflow. Already published versions cannot be overwritten.
- **Reversibility:** no database, persistence, authentication, authorization, migration, or environment contract changes are involved. Before publication, an ordinary follow-up change can restore the previous page composition and CSS. After package publication, correct issues through a new patch version rather than attempting to replace 1.2.3.

No material product decision remains unresolved for planning. Approval adopts the proposed homepage sequence, fixed reference example, getting-started route, discovery improvements, and narrowly scoped shared CSS fix. Recheck repository and release state before implementation; stop for direction if that evidence materially changes this scope.

## Approval required

Approve the packages website redesign described here: benefit-led positioning, a real build-time Core reference-check example, the getting-started page and visitor paths, corrected repository illustrations, clearer package and target-level adapter discovery, responsive and accessible presentation, and the shared Website UI width fix with a 1.2.3 patch increment.

Approval also covers the directly required generation, search, metadata, tests, test-discovery exclusions, documentation, and release bookkeeping, plus root command preparation, website-specific Turbo file/environment/cache configuration, configured-origin assertions, and isolated warm-cache source-freshness checks. It does not authorize runtime-package behavior changes, Cloud features, Skill-site changes, unrelated cleanup, commits, deployment, or publication.

Implementation has not begun. Await explicit approval before changing anything outside this planning directory.

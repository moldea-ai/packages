# Packages website implementation milestones

## Basis and execution boundaries

This sequence implements `coding-agent-planning/1788876015_packages-website-clarity/plan.md`, SHA-256 `2d9b5d4340632d7868ee06b607a06eff55dbaf07ebedc7310821adff57c30186`, against repository baseline `3cdf816f0a8157f45b4ed2306da0891d4c92ff84`. The plan and implementation files remain unchanged. Both milestones are pending; implementation has not begun, and neither the plan nor this sequence has been approved.

There are two coherent checkpoints: the independently releasable shared sizing correction, followed by the complete website experience. The homepage, example, guide, discovery presentation, and generation changes stay together because they share content and integration contracts.

- Each milestone includes its required production changes, tests, documentation, and verification. The final website regression pass does not defer correctness evidence for the shared-package change.
- Preserve the plan's exclusions: no runtime-package behavior changes, compatibility-schema changes, maturity promotions, Cloud features, Skill-site edits, new dependencies or frameworks, uploads, analytics, accounts, deployment, npm publication, commits, pushes, or Git configuration changes.
- Preserve existing package exports, documentation routes, target anchors, compatibility publications, theme ownership, and public integration contracts. The new `/getting-started/` route is additive.
- Exclude `_archive`, `_archives`, `_backup`, and `_backups` and their complete subtrees from discovery, copying, hashing, tests, and other inspection. Preserve inherited test exclusions and category isolation. If required tooling cannot respect this boundary, report the limitation rather than consuming excluded content or expanding tooling scope.
- Use the installed Node/pnpm toolchain and existing verification dependencies. Run package integration work serially. Format and check only touched files with the installed Prettier and root `.prettierrc` before final build verification.
- Before each milestone, inspect worktree and release state. Preserve unrelated changes and stop if repository evidence requires materially changing the plan or crossing the authorized milestone boundary.
- At each checkpoint, review the final diff and relevant state-bearing documentation, inspect protected coding instructions without editing them, and report actual checks, failures, unavailable verification, and any necessary instruction handoff. No database or migration work is involved.

## Milestone 1: Correct the shared mobile sizing foundation

### Objective and dependencies

Deliver the shared Website UI body-width correction, its responsive regression coverage, and complete `1.2.3` patch-version bookkeeping. Existing website content remains unchanged.

Dependencies: explicit approval of this sequence and authorization to implement Milestone 1. Confirm Website UI remains at the planned `1.2.2` baseline and that `1.2.3` has not been occupied before applying the increment. No earlier implementation milestone or package publication is required.

### Owned files and contracts

- `projects/website-ui/src/styles.css`: remove the fixed body minimum width at its shared owner.
- `projects/website-ui/package.json`, `README.md`, and `src/index.test-integration.ts`: synchronize version `1.2.3`, the installation example, and the packed-package version assertion.
- `pnpm-lock.yaml`: only affected workspace metadata if synchronization requires a change; no unrelated dependency resolutions.
- `apps/website/src/layouts/base-layout.test-e2e.ts`: the body-width and reserved-scrollbar regression only. Milestone 2 separately owns content and configured-origin changes in this file.
- `projects/website-ui/vitest/test-unit.config.ts`, `projects/website-ui/vitest/test-integration.config.ts`, `apps/website/vitest/test-unit.config.ts`, and `apps/website/vitest/test-integration.config.ts`: the plan's four excluded-directory guards, needed before running these affected suites.
- `apps/website/playwright.config.ts`: equivalent discovery exclusions only. Preserve the existing browser, server, port, and environment behavior.

### Implementation work

Remove `min-w-80` from the shared body styling without an application override or global overflow clipping. Preserve tokens, layout primitives, font, themes, interaction states, and exports.

Strengthen the existing browser regression to reserve a genuine scrollbar gutter at a 320px viewport and compare document scroll width with available client width. Demonstrate that the assertion catches the old fixed body minimum. Keep that comparison in the eventual redesigned website suite.

Complete release bookkeeping and the Website UI README update in the same change. Check the root and website READMEs for directly affected statements, but do not describe future Milestone 2 behavior or make unrelated documentation edits.

### Tests and verification

Run the affected package and application checks from the repository root:

```bash
pnpm --filter @moldea.ai/website-ui test
pnpm --filter @moldea.ai/website-ui typecheck
pnpm --filter @moldea.ai/packages-website typecheck
pnpm --filter @moldea.ai/website-ui lint --ignore-pattern '**/{_archive,_archives,_backup,_backups}/**'
pnpm --filter @moldea.ai/packages-website lint --ignore-pattern '**/{_archive,_archives,_backup,_backups}/**'
pnpm website:build
pnpm --filter @moldea.ai/packages-website check:links
pnpm --filter @moldea.ai/packages-website test
```

The existing Website UI integration script builds the package before exercising its packed consumer. Do not invoke the future `website:prepare` script in this milestone. Use the default website origin; alternate-origin test corrections belong to Milestone 2.

Verify both themes and representative current routes at 320px, 360px, 768px, 1024px, and 1440px. Include reserved-scrollbar conditions, readable technical regions, keyboard navigation, visible focus, mobile menu behavior, theme persistence, and existing reduced-motion behavior. Inspect screenshots for clipping and layout regressions, and run the relevant existing accessibility checks.

Confirm each affected granular test script discovers only its category and that generic tests cover all existing correctness categories. Inspect the website output and packed Website UI artifact for test-file leakage. Preserve test typechecking and existing source-derived test names.

Audit the version increment against the planning baseline. The commit-based release checker requires two exact commits; do not create a commit or publish a package to run it. Report the packed-consumer and current-host verification actually completed, without claiming untested cross-platform behavior.

### Acceptance criteria and review checkpoint

- The shared body no longer forces horizontal page overflow when the available document width is below 320px because of a scrollbar gutter.
- The regression detects the old behavior and passes with the fix; existing responsive, accessibility, theme, and interaction checks remain valid.
- Website UI manifest, README installation example, and packed version assertion agree on `1.2.3`; exports and dependency ranges remain unchanged.
- Required suites and checks have completed successfully, or any blocker remains explicitly unresolved rather than being presented as a finished milestone.
- No website narrative, generation, runtime-package behavior, or Skill-site change is included.

Review the reserved-gutter evidence, packed consumer, minimal shared CSS diff, release bookkeeping, and test-discovery guards. Report the milestone result and stop. Completion does not authorize Milestone 2 or package publication.

## Milestone 2: Deliver the complete website experience

### Objective and dependencies

Deliver the benefit-led website with a real build-time example, getting-started guide, accurate discovery surfaces, reliable generation/cache behavior, and complete correctness and visual verification.

Dependencies: Milestone 1 is complete and reviewed, and the developer explicitly authorizes Milestone 2. The website consumes Website UI through `workspace:*`; publishing `1.2.3` is not a prerequisite. Retain Milestone 1's sizing correction and regression coverage.

### Owned files and contracts

Add these files, relative to `apps/website/`:

- `content/getting-started.md`.
- `src/pages/getting-started/index.astro` and `index.test-e2e.ts`.
- `src/lib/inspection-example/index.ts`, `types.ts`, `constants.ts`, `inspection-example.ts`, and `inspection-example.test-integration.ts`.
- `src/components/inspection-example/index.ts`, `inspection-example.astro`, and `inspection-example.test-e2e.ts`.
- `src/lib/discovery-copy/index.ts`, `types.ts`, `constants.ts`, `validations.ts`, and `validations.test-unit.ts`.

Modify these existing application files:

- `src/pages/index.astro`, `src/pages/packages/index.astro`, `src/pages/adapters/index.astro`, `src/pages/adapters/[adapter]/[...path].astro`, and `src/pages/compatibility/index.astro`.
- `src/components/package-card.astro`, `adapter-card.astro`, `adapter-details.astro`, `target-maturity-legend.astro`, `repository-format-overview/repository-format-overview.astro`, `site-header.astro`, and `site-footer.astro`.
- `src/lib/model/types.ts`, `src/lib/generation/generation.ts`, `scripts/check.ts`, and `scripts/generate.ts`.
- `scripts/verify-build.ts` and its existing integration test, plus `src/lib/generation/generation.test-integration.ts`.
- `src/layouts/base-layout.test-e2e.ts`, `src/components/repository-format-overview/repository-format-overview.test-e2e.ts`, `src/components/adapter-details.test-e2e.ts`, and `src/components/target-maturity-legend.test-e2e.ts`.
- `README.md` within the application.

Also modify repository-root `package.json`, `turbo.json`, and `README.md` for the planned command, cache, and documentation contracts. Do not change shared UI implementation or release bookkeeping again unless required corrections are brought back to the developer under the milestone-boundary rules.

### Implementation work

**Real example and generation.** Implement `createInspectionExample` using the public `createCore` and `createMemoryRepositoryReader` exports. Use the plan's three fixed synthetic snapshots: the binding to `/src/refund-policy.ts` resolves, moving the file to `/src/payments/refund-policy.ts` breaks the old binding, and updating the binding repairs it. Preserve the manifest's `version: 1` and `/moldea/project.md` context entry.

The project document describes manager approval for refunds, and the synthetic source exports the corresponding flag. Label the output as a Core result excerpt. This checks the declared path, not the flag's meaning or a symbol, and never executes the source or repairs a visitor's repository. Keep the example bounded to its three authored states; add no editor, scenario framework, or pagination mechanism.

Generate snippets from the actual fixtures and diagnostics from actual Core results. Require pass/fail/pass and the existing `MOLDEA_REFERENCE_MISSING` diagnostic with message `The referenced repository path does not exist.`, manifest path `/moldea/moldea.yaml`, pointer `/context/~1moldea~1project.md/bindings/0`, and referenced path `/src/refund-policy.ts`. Unexpected results fail generation through the existing failure path. Do not invent a CLI envelope, runtime error code, semantic verdict, or simulated success fallback.

Extend `IWebsiteModel` with the example, authored guide, and presentation-only discovery metadata. Make `createWebsiteModel` asynchronous and await it in both generation/check scripts and generation-test setup; keep `loadWebsiteModel` synchronous. Generate `.generated/model.json` and its notice through the existing owner, with stable ordering and no timestamps, machine paths, private identities, or environment-dependent example content.

**Content, routes, and discovery.** Make `content/getting-started.md` the single authored source for its metadata, body, and search text. Register `/getting-started/` through `createRouteManifest`, render it with BaseLayout, Breadcrumbs, and sanitized Markdown, and integrate `createSearchRecords`, `createLlmsText`, and artifact verification. Link to the canonical CLI overview for installation and invocation rather than duplicating commands or requirements. Distinguish agent-assisted adoption, local checks of an adopted repository, programmatic integration, and exact runtime compatibility.

Use existing frontmatter validation. Include the external Agent Skill destination in `llms.txt` without creating an internal search result pointing off-site. Present CLI as the usual local entry point, Core for programmatic checks, and Repository/Repository FS for source access. Preserve the built-in custom runtime distinction and omit a duplicate adapter grid from the composition explanation.

Create typed display metadata keyed by canonical package, adapter, and target identifiers. Fail generation on missing or stale coverage. Use it for job-led package discovery and friendly runtime names while preserving exact IDs, versions, anchors, limitations, and evidence links. Keep compatibility scope and target maturity in their existing canonical sources. Show maturity per target, never as an adapter-wide inference from its first target; definitions must be visible without hover. Keep the machine-readable compatibility contract unchanged for unchanged source inputs.

**Visitor experience.** Compose the homepage in the plan's order: purpose and entry points; connected/broken/repaired example; repository contents; tools by job; compact runtime discovery; trust and boundaries. Lead with “The open-source foundation for keeping agent instructions and code aligned.” Include “See how it works” at `#how-it-works`, “Start using the tools” at `/getting-started/`, and clearly labeled Agent Skill access.

Correct the repository illustration to include required `moldea/moldea.yaml` and `moldea/project.md`, distinguish optional material, and remove the obsolete project-index result. Remove superseded homepage sections, duplicate adapter inventories, dead imports, and stale sequence assertions. Keep no hidden parallel presentation.

Add “Get started” to the existing header and Agent Skill links to the homepage, guide, and footer. Preserve search, source links, theme controls, and documentation navigation. Verify navigation density before considering any shared-header change; a shared-header redesign remains excluded.

Reuse Website UI actions, badges, tabs, shells, tokens, typography, icons, and sanitized Markdown. The example is a feature composition of `tabbed-panels` and `status-badge`, not Evaluation Replay or a new generic primitive. Keep all example panels readable without JavaScript and state changes immediate. Flatten redundant mobile panels and preserve keyboard behavior, both themes, and reduced motion.

Place the structural-versus-semantic limitation beside the example. Qualify privacy and read-only claims to the local CLI and relevant package operations. Keep Agent Skill workflows distinct and link to `https://skill.moldea.ai/`; do not portray Cloud, Assurance, or a future SDK as package capabilities. Follow the plan's restrained copy rules, without invented metrics, decorative Unicode, or new em dashes.

**Command preparation and cache correctness.** Add root `website:prepare` as `turbo run build --filter @moldea.ai/core... --filter @moldea.ai/website-ui`. Prefix root `docs:check`, `docs:generate`, `website:dev`, and `website:check` with `pnpm website:prepare &&` before their corresponding existing package task. Remove the old Website-UI-only preparation. Preserve root `website:build` as `turbo run build --filter @moldea.ai/packages-website`. Document direct package tasks as low-level commands requiring preparation; introduce no nested Turbo task bodies, install hooks, source deep imports, or continuous dependency watching.

Apply these complete website-specific root Turbo task contracts:

- Build: `dependsOn: ["^build"]`, `outputs: ["dist/**", ".generated/model.json"]`, and `env: ["SITE_URL", "BASE_PATH"]`.
- Integration tests: `dependsOn: ["build", "^test:integration"]` and `env: ["SITE_URL", "BASE_PATH"]`.
- E2E tests: `dependsOn: ["build", "^build"]` and `env: ["PLAYWRIGHT_BROWSERS_PATH", "SITE_URL", "BASE_PATH"]`.

The build's complete input list is:

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

Compare the final generation read/import set with this inventory. Preserve defaults, executable dependency ordering, and existing environment meanings. Do not duplicate the input list across dependent test tasks, add runtime dependencies for documentation discovery, introduce global cache invalidation, or disable caching. Cache and restore the generated model with the matching site artifact.

Update `base-layout.test-e2e.ts` to derive the expected origin from `process.env.SITE_URL ?? DEFAULT_SITE_URL`, preserving base-path normalization and exact canonical, social, breadcrumb, and WebSite URL assertions. Expected URLs must not be derived from the rendered metadata.

**Documentation.** Synchronize the root blueprint and website README with the completed guide, example, async generation, ownership, preparation commands, direct-task prerequisites, and cache/origin verification. Identify `turbo.json` as cache-input owner without duplicating its glob list. Keep API documentation outside `/docs`. Reuse the existing Core diagnostic without changing canonical runtime error documentation; document intentional new build-helper failures at their applicable module boundaries.

### Tests and verification

Keep tests with the behavior they verify:

- Real Core/reader integration: exact diagnostic identity, pass/fail/pass, fixture/snippet consistency, repeated determinism, content-free output, and generation failure when the expected example contract is violated. Do not mock validation.
- Generation and discovery: async completion, guide route and search uniqueness, non-technical search terms, llms links, missing/stale display metadata, route collisions, artifact destinations, and unchanged canonical compatibility publication.
- Browser behavior: all example states; Arrow Left/Right, Home, and End; selected panels and focus; Astro navigation away and back; no-JavaScript reading; and all guide entry paths.
- Changed-page quality: homepage, guide, package discovery, adapters, compatibility, and representative documentation at 320px, 360px, 768px, 1024px, and 1440px in both themes. Retain the reserved-gutter regression, internal technical scrolling, mobile focus behavior, theme persistence, visible focus, accessible names, readable identifiers and maturity definitions, correct multi-target statuses, safe links, and reduced-motion behavior. Run axe on changed states and inspect screenshots for branding, hierarchy, typography, spacing, density, alignment, and clipping.

Run the plan's command sequence:

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

Check links and inspect the root artifact before the full website suite invokes Playwright's separate rebuild. Verify new tests follow co-location and source-derived naming, categories remain isolated, test typechecking is retained, and production/packed artifacts contain neither tests nor request-time server output. Update stale copy assertions only when supported by the new intended content, without weakening behavioral assertions.

**Independently clean commands.** Use a disposable copy of the implementation with its own installation, no workspace-package links back to the developer checkout, and no excluded directories, generated outputs, or Turbo caches. From an independently output-empty state for each command, run root `docs:check`, `docs:generate`, `website:dev`, `website:check`, and `website:build` without manual preparation. Verify dependency preparation, the generated example, and loopback development rendering; stop only the development process started for verification. Then verify warm repeats, dependency cache outcomes, and invalidation after a harmless Core source-comment edit confined to that copy.

**Source-only warm-cache regressions.** Populate a baseline cache and hold environment, application code, task configuration, and dependency versions fixed. In separate temporary cases, edit only:

- Specification prose: require the marker in the model and `dist/repository-format/index.html`.
- Anthropic `runtimeGuidance.notes` in `compatibility/runtimes.yaml`: require it in the model, `dist/compatibility/runtimes.json`, and `dist/adapters/anthropic/index.html` without changing target IDs, scope, or maturity.
- `projects/adapter-openai/docs/index.md`: require it in the model and `dist/adapters/openai/index.html` while preserving valid frontmatter and links.

For each case, require a changed website task hash, a miss for the new state, and source-based artifact assertions immediately after root `website:build`. Only then run `check:links` and an unchanged repeat that demonstrates a cache hit with the same fresh content. Restore only deliberate temporary edits between cases. Do not run another generator, integration tests, or Playwright before inspection; do not force builds or clear the populated cache.

Also check hash sensitivity to public manifests, public API documentation comments, private workspace sources, and parser sources; verify package-document additions and removals update model, route, and artifact membership. Inspect resolved inputs and matching model/artifact restoration without consuming excluded content. These are isolated verification mutations, not production edits or a new permanent fixture-copy framework.

**Alternate origin and base path.** Supply `SITE_URL=https://moldea-ai.github.io` and `BASE_PATH=/packages/` through the process environment and repeat website build, immediate artifact/link verification, and full website tests. Before any E2E rebuild, require homepage canonical `https://moldea-ai.github.io/packages/` and guide route `/packages/getting-started/`. Verify assets, links, example anchors, search, canonical/social/structured metadata, sitemap, and llms. Require environment forwarding and different default/alternate build hashes, including warm-cache runs, then rebuild and verify the default origin again. Also run under the alternate environment:

```bash
pnpm turbo run test:e2e --filter @moldea.ai/packages-website
```

Preserve the browser-path forwarding check. Do not introduce platform-specific environment-setting scripts. Record unavailable prerequisites, failing signals, and untested host behavior rather than claiming complete verification.

### Acceptance criteria and review checkpoint

- The first screen and example explain what Moldea's packages do, why they help, and the next step for technical and non-technical visitors.
- The example displays real deterministic results and an adjacent structural-check limitation; the guide, navigation, discovery labels, and machine-readable orientation have authoritative owners.
- Required repository files, current Core boundaries, target-level maturity, exact compatibility details, and existing documentation contracts are represented accurately.
- Superseded homepage content and obsolete result illustrations are removed. No parallel implementation, backend, browser Core runtime, model call, repository upload, or extra product capability is introduced.
- The redesigned pages satisfy the plan's responsive, accessibility, theme, no-JavaScript, reduced-motion, branding, and visual-quality criteria while preserving Milestone 1's fix.
- Clean root commands prepare dependencies, warm caches respond to all generation inputs, matching models/artifacts restore together, and exact default/alternate-site assertions pass before browser rebuilds.
- Required tests, documentation synchronization, artifact checks, final formatting, and scoped diff review are complete. Any unresolved material failure prevents reporting the milestone complete.

Review the homepage and guide as a new non-technical visitor, then follow the developer paths to exact APIs and target limitations. Inspect the real example results, mobile/light/dark screenshots, cache-freshness evidence, normal-command behavior, and alternate-origin artifacts. Confirm the full plan is covered, report the result, and stop without committing, deploying, or publishing.

## Approval required

Approve the complete two-milestone sequence: (1) the shared mobile sizing correction with its tests and Website UI `1.2.3` bookkeeping; (2) the complete website experience with generation, discovery, command/cache corrections, documentation, and all required verification.

The underlying plan is not yet approved. Explicit approval of this sequence also approves that plan unless you limit the approval. Sequence approval alone does not authorize implementation: each milestone requires explicit authorization naming it. You may approve the sequence and authorize Milestone 1 in the same instruction. Completing Milestone 1 never authorizes Milestone 2.

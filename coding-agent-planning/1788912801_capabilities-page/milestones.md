# Capabilities implementation milestones

## Basis and execution rules

This breakdown implements `coding-agent-planning/1788912801_capabilities-page/plan.md`, SHA-256 `ec50b9d92d09330384c9a18cb165805701284afd87b0d299e7729e3671d378c3`, against repository HEAD `a70774a4c2743eacefce3fc4e8f5fef0a958baa4`.

All three milestones are pending. The plan and this milestone sequence still require explicit approval. No implementation is authorized by this breakdown.

The sequence separates three finished outcomes: trustworthy generated content, reusable presentation already consumed by the website, and the complete visitor-facing page. Keep all capability generators together so coverage enforcement never requires placeholder cases, disabled guards, or a temporarily incomplete compatibility inventory.

Every milestone includes its own tests, applicable regression checks, directly affected documentation, and review checkpoint. No required correctness work is deferred to a separate hardening milestone.

The plan's exclusions remain binding: no deterministic package behavior changes, provider execution, visitor repository access, automatic repair, sibling-repository edits, protected instruction edits, new third-party dependencies, compatibility changes, infrastructure changes, migrations, commits, publication, or deployment.

## Milestone 1: Complete executable capability catalog

### Objective

Produce the complete, validated capability catalog through the normal website generation flow. Every published claim planned for the page must have real supporting execution or an explicitly identified documented boundary before presentation work begins.

The finished deliverable is the capabilities portion of the existing internal generated model, consumed by `createWebsiteModel`, `docs:check`, `docs:generate`, and the website build. It is not a new public JSON API. The visitor route and its navigation belong to Milestone 3.

### Dependencies

- Approval of the plan and milestone sequence, plus explicit authorization to implement Milestone 1.
- Existing Node.js, pnpm, and package build prerequisites. Repository-backed CLI fixtures also require the CLI-supported Git version.
- No earlier milestone.

### Scope and owned files

Add the following under `apps/website/src/lib/capabilities/`:

- `index.ts`, `types.ts`, `catalog.ts`, `coverage.ts`, `capabilities.ts`, `validations.ts`, and `transformers.ts`.
- `core-examples/`: `index.ts`, `types.ts`, `constants.ts`, `structure.ts`, `agents.ts`, `decisions.ts`, `inspection.ts`, and `core-examples.ts`.
- `runtime-examples/`: `index.ts`, `types.ts`, `runtime-examples.ts`, `fixtures.ts`, and the ten provider fixture files specified in the plan.
- `reader-examples/` and `cli-examples/`, each with `index.ts`, `types.ts`, `constants.ts`, and its correspondingly named implementation file.
- `fixture-workspace/`: `index.ts`, `types.ts`, and `fixture-workspace.ts`.
- Colocated `capabilities.test-integration.ts`, `validations.test-unit.ts`, `transformers.test-unit.ts`, and integration tests named after each example generator and `fixture-workspace.ts`.

Modify:

- `apps/website/src/lib/model/types.ts`: capabilities model field.
- `apps/website/src/lib/generation/generation.ts`: invoke `createCapabilities`, incorporate its completed output, and update the generated notice. Do not add the visitor route, search records, or machine-navigation links yet.
- `apps/website/src/lib/generation/generation.test-integration.ts`: model integration and repeatability.
- `apps/website/package.json`, root `package.json`, and `pnpm-lock.yaml`: direct build-time workspace dependencies and preparation.
- Root `README.md` and `apps/website/README.md`: generation ownership, dependency architecture, preparation, temporary I/O, and prerequisites.

Keep module entry files thin. Apply the plan's allowance to colocate genuinely trivial contracts, without combining distinct execution, validation, transformation, or rendering responsibilities.

### Implementation work

1. Define the six-section catalog, stable capability/case/group IDs, source references, and separate validation, adapter-evidence, reader/comparison, and CLI result families.
2. Implement the full coverage ledger. Cover all eight Core operations; account for all 81 current Core diagnostic codes; reject stale or missing target/pattern IDs, duplicate IDs, unsupported claims, and missing source references. Distinguish a demonstrated code variant from a linked documented boundary.
3. Implement every universal structure and agent family from the plan:
   - Canonical layout, manifest parsing, IDs, paths, globs, duplicate declarations, context/reference connections, and exact impact paths.
   - Text normalization, digests, encoding/Unicode/NUL failures, and meaningful content changes.
   - Agent registration, directories, identity, instructions, agent/handoff descriptions, and capability descriptions.
   - Declared/used variables, undeclared or malformed placeholders, unused declarations, and undeclared providers.
   - Tool/skill implementations and bindings; mirror existence, equality, destinations, types, and ownership.
   - Runtime guidance and adapter composition; unresolved declarations and related-reference traceability.
4. Implement decision examples: document parsing, filenames/frontmatter/timestamps/body/IDs, missing/self references, supersession cycles, status/orphan consistency, valid replacement chains, and active decision relationships.
5. Implement all runtime targets and their full/partial patterns through public adapter singletons and Core:
   - Built-in `custom`.
   - Anthropic Messages; Claude Agent SDK query/subagents.
   - Both Cloudflare targets: Think and AIChatAgent.
   - Eve filesystem agents; Google Gen AI generate-content; LangChain createAgent.
   - Both LangGraph targets: StateGraph and Functional API.
   - OpenAI Responses; OpenAI Agents SDK agents/handoffs.
   - Both Vercel AI SDK targets: ToolLoopAgent and generate/stream text.
   - Cover all 14 exact target IDs and all 91 current full/partial pattern entries listed by the plan and canonical matrix. Shared fixtures are valid only when assertions establish each mapped behavior.
   - Include representative dynamic-source “not established” cases and account for ambiguous/unsupported patterns through limitations and existing scope links.
   - Derive package ranges, technical support, maturity, and qualification links from the existing combined publication model.
6. Implement source-neutral and filesystem examples: entry metadata, immutable memory snapshots, deterministic listing, byte ranges, added/removed/modified/type-changed comparisons, unchanged files, continuation, explicit versus directory selection, and snapshot/resource/cancellation boundaries.
7. Implement Core inspection, Unicode-safe canonical content ranges, and manifest-only change relevance. Cover metadata/diagnostic/evidence views, counts/digests, exact and glob matches, ownership, unrelated changes, and unresolved-related paths without equating relevance to semantic impact.
8. Execute the public CLI bin for `validate`, `inspect`, `scope` with both input forms, `content`, and `composition`. Preserve schema 4, real exit statuses, metadata/content separation, Git selection behavior, bounded continuation, and operational refusals.
9. Keep fixture execution safe and portable:
   - Memory snapshots for Core/adapters; disposable filesystem/Git workspaces only where needed.
   - Resolve the declared CLI bin within its owning package and invoke it with `process.execPath` and explicit arguments, not a shell or private CLI import.
   - Isolate Git configuration/templates; validate paths and containment; clean temporary workspaces in `finally`; never inspect or mutate the developer's worktree through an example command.
   - Ordinary generation must not require native symlink privileges.
10. Assert actual results before projecting them. Derive visible snippets from executed fixtures, reject additional diagnostics or altered outcomes, and retain real relevant facts through typed allowlists. Omit host paths, opaque identities/cursors, unrelated bodies, and process details without fabricating replacement values.
11. Run each distinct case once per model generation and reuse its result. Add direct website build dependencies on Repository FS, CLI, and the ten adapters. Change `website:prepare` to `turbo run build --filter @moldea.ai/cli... --filter @moldea.ai/website-ui`. Synchronize documentation and only the affected lockfile entries.

Do not add a partial page, temporary route, fabricated result, placeholder case, or bypass for incomplete coverage.

### Tests and verification

- Unit-test coverage validation and projection at their application-owned boundaries, including missing/stale mappings, duplicate IDs, unsafe links, incorrect result classification, and sensitive-field exclusion.
- Integration-test every generator using real public packages and the real CLI executable. Verify complete expected diagnostics and material evidence/source locations.
- Repair a failure fixture, remove a claimed relationship, and introduce an extra diagnostic; stale expectations must fail generation.
- Verify repeated model generation and different temporary workspace locations yield the same intended published facts.
- Test first/final pages, exact boundaries, empty results, stable ordering, continuation, comparison kinds, Unicode boundaries, invalid cursors, and changed snapshots.
- Verify CLI schema/status/exit handling, both scope inputs, selected/unselected Git files, metadata/content separation, and representative operational errors.
- Verify command read-only behavior and temporary cleanup on success/failure. Check path containment, generated-name portability, and absence of unintended filesystem or Git changes.
- Check source-change cache invalidation and an unchanged warm hit in the established isolated-checkout workflow. Inspect model/artifact correspondence and cold/warm build behavior; do not change timeouts speculatively.

Run the relevant commands from the repository root:

```bash
pnpm website:prepare
pnpm --filter @moldea.ai/packages-website test:unit
pnpm website:build
pnpm --filter @moldea.ai/packages-website test:integration
pnpm --filter @moldea.ai/packages-website test
pnpm test:root
pnpm typecheck:root
pnpm --filter @moldea.ai/packages-website typecheck
pnpm lint:root
pnpm --filter @moldea.ai/packages-website lint
pnpm compatibility:check
pnpm docs:check
pnpm website:build
pnpm --filter @moldea.ai/packages-website check:links
```

Format and check only the milestone-touched files with installed Prettier and `.prettierrc`. Keep tests colocated and excluded from production output. Report unavailable platform checks; Linux execution alone is not cross-platform proof.

### Acceptance criteria

- The generated model contains the complete planned catalog, not scaffolding or placeholders.
- All required capability families, eight Core operations, 81 diagnostic-code mappings, 14 targets, and 91 full/partial pattern entries are accounted for.
- Every affirmative claim has executed evidence, and every depicted failure is real.
- Coverage drift and inaccurate outcomes fail generation or typechecking.
- No fixture operation reads visitor files, executes illustrated runtime code, contacts providers, or mutates the real repository.
- Existing pages, compatibility publication, and build checks remain valid; temporary generation I/O and new prerequisites are documented.
- All applicable milestone checks pass before handoff.

### Review checkpoint

Review the complete generated examples and coverage ledger before reviewing their visual treatment. Confirm that results prove the stated claims, partial runtime support remains explicit, evidence excerpts are useful and safe, and build-time fixture execution is appropriately contained. Stop after this checkpoint.

## Milestone 2: Reusable presentation and compact navigation

### Objective

Deliver the backward-compatible Website UI 1.5.0 surface and use it in existing website examples without changing their stories. Deliver compact desktop navigation labeling before introducing the fifth page link.

### Dependencies

- Milestone 1 completed and reviewed.
- Explicit authorization to implement Milestone 2.
- No Capabilities route or placeholder navigation destination is required for this milestone.

### Scope and owned files

Add:

- `projects/website-ui/src/components/file-preview/file-preview.component.astro`.
- `projects/website-ui/src/components/result-summary/result-summary.component.astro`.

Modify:

- `projects/website-ui/src/components/site-header/site-header.component.astro`.
- `projects/website-ui/package.json`: explicit component subpath exports and version 1.5.0.
- `projects/website-ui/README.md`: component contracts, customization, compact-label behavior, installation version, and consumer adoption guidance.
- `projects/website-ui/src/index.test-integration.ts`: packed paths, version, typed props, and real Astro consumer coverage.
- `apps/website/src/components/site-header.astro`: supply the Repository Format compact label, without adding Capabilities yet.
- `apps/website/src/components/inspection-summary/inspection-summary.astro`.
- `apps/website/src/components/repository-check-preview/repository-check-preview.astro`.
- Existing `base-layout.test-e2e.ts`, inspection-summary/result browser tests, and repository-check-preview browser tests.
- `apps/website/README.md`: updated presentation ownership. Update root documentation only where this milestone changes a documented responsibility.

### Implementation work

1. Add FilePreview with the plan's path, label, semantic tone, and icon/status/body-slot contract. Preserve an identifiable filename on narrow screens and expose the complete path without requiring hover.
2. Add ResultSummary with the plan's title, description, tone, heading ID, restricted heading element, mobile-icon option, and icon/status slots. Keep Core status and copy mapping out of Website UI.
3. Compose ResultSummary from the existing app-owned InspectionSummary and use FilePreview for the homepage instruction file. Remove the presentation markup these extractions replace; do not retain parallel implementations. Preserve homepage copy, paths, diagnostics, missing-file state, and visual proportions.
4. Add optional `compactLabel?: string` to `ISiteHeaderNavigationItem`. Show it below `xl` in desktop navigation, show the full label from `xl`, and keep the full label in the mobile menu and accessible naming.
5. Supply “Repo. Format” for the existing Repository Format item. Preserve the `lg` desktop breakpoint, typography, spacing conventions, actions, active state, and logo behavior.
6. Expose and document the new components through public Astro subpaths. Bump Website UI from 1.4.0 to 1.5.0, preserve existing props/defaults/imports, and verify real tarball consumption.
7. Reuse Dialog, StatusBadge, Markdown rendering, semantic tokens, and interaction primitives. Do not add a second dialog implementation, new CSS theme, runtime evaluator, or domain result schema to Website UI.

### Tests and verification

- Extend the real tarball consumer to import/render/customize both components and typecheck compact-label usage. Verify ordinary header consumers that omit the prop remain supported.
- Verify the published artifact contains the new components and no tests.
- Run the website's complete existing correctness suite, with focused regression assertions for the extracted homepage presentation and dialog headings.
- Check mobile-hidden dialog icons, compact statuses, heading names, existing dismissal/focus behavior, filename preservation, code scrolling, and no-JavaScript readability.
- Test compact/full navigation labels, accessible names, keyboard focus, and existing link/logo states.
- Inspect 320, 375, 768, 1024, 1100, 1279, 1280, and 1440px where relevant, in both themes. Verify reduced motion and compare screenshots with the existing platform-aligned presentation.
- This milestone verifies the compact-label contract; Milestone 3 must verify fit with the actual fifth navigation link.

Run:

```bash
pnpm website:prepare
pnpm --filter @moldea.ai/website-ui test:unit
pnpm --filter @moldea.ai/website-ui test
pnpm website:build
pnpm --filter @moldea.ai/packages-website test
pnpm --filter @moldea.ai/website-ui typecheck
pnpm --filter @moldea.ai/packages-website typecheck
pnpm --filter @moldea.ai/website-ui lint
pnpm --filter @moldea.ai/packages-website lint
pnpm docs:check
pnpm website:build
pnpm --filter @moldea.ai/packages-website check:links
```

Format and check only touched files with the installed Prettier configuration. Synchronize documentation in this milestone, not at page completion.

### Acceptance criteria

- Both new UI exports work through the installed tarball with the documented customization contracts.
- Existing consumers and homepage examples preserve their behavior and appearance.
- Generic presentation has one owner in Website UI; Core-specific mapping remains in the application.
- Compact labels behave correctly across the desktop breakpoint and do not alter full mobile labels.
- No premature Capabilities link or placeholder route exists.
- Applicable package, application, visual, accessibility, theme, and motion checks pass.

### Review checkpoint

Review the real-consumer API, unchanged homepage examples, filename treatment, outcome proportions, mobile dialogs, and compact navigation behavior. Confirm Website UI remains independent of Core and the new API is suitable for later Skill adoption. Stop after this checkpoint.

## Milestone 3: Complete Capabilities page and discovery

### Objective

Deliver the complete visitor-facing Capabilities page, connected to navigation, search, sitemap, and machine navigation, with full visual and production verification.

### Dependencies

- Milestones 1 and 2 completed and reviewed.
- Explicit authorization to implement Milestone 3.
- The complete validated catalog and consumable shared presentation must already exist.

### Scope and owned files

Add:

- `apps/website/src/pages/capabilities/index.astro`.
- `apps/website/src/pages/capabilities/_index.test-e2e.ts`.
- `apps/website/src/components/capability-section/`, `capability-card/`, `capability-visual/`, and `capability-result/`, each with a thin `index.ts`, relevant `types.ts`, and matching `.component.astro` implementation. Keep meaningful family-specific visual implementations in focused child modules when needed, as allowed by the plan.

Modify:

- `apps/website/src/lib/generation/generation.ts`: route manifest, search records, and `llms.txt`.
- Its generation integration tests and the capabilities catalog only where needed to finalize the planned visible grouping/copy without weakening evidence or coverage.
- `apps/website/src/components/site-header.astro` and `site-footer.astro`.
- `apps/website/src/components/inspection-example/inspection-example.astro`: Explore capabilities discovery link.
- `apps/website/src/layouts/base-layout.test-e2e.ts`: navigation fit and active-state integration.
- `apps/website/scripts/verify-build.ts` and `verify-build.test-integration.ts`.
- Root `README.md` and `apps/website/README.md`: complete route, discovery, rendering, source ownership, and verification state.

Reuse BaseLayout, existing search and SEO verification, shared site utilities, and the existing sitemap integration. Do not hand-edit generated output or add a capability JSON API.

### Implementation work

1. Render all six planned sections with stable fragment IDs and ordinary wrapping in-page navigation. Use the existing split desktop headers, mobile stacking, distinct section separation, typography, and tokens.
2. Build concise visual example groups from the completed catalog. Show files, relationships, decision graphs, comparisons, and records according to their actual meaning. Keep outcomes, responsible packages, exact runtime identity, and material limitations visible without interaction.
3. Keep all distinct planned capabilities visible through concise groups/rows; avoid a full-sized card per syntax variant or repeating the adapter directory's full compatibility tables.
4. Compose FilePreview and ResultSummary with existing shared controls. Keep domain diagrams, copy, provenance, result projection, and outcome mapping application-owned.
5. Add compact View result controls using the existing Dialog. Use balanced outcome headings, small status badges, mobile-hidden icons, unique title IDs, labelled excerpts, and the existing dismissal/focus lifecycle. Do not add redundant descriptions.
6. Derive source excerpts from executed fixtures. Keep code unwrapped inside named keyboard-scrollable regions and allow only explicit plain-text prose to wrap. Preserve accessible full paths and filename visibility.
7. Keep standalone visible `moldea` references in inline code. Use realistic non-secret examples distinct from the homepage's principal stories. Explain synthetic inputs, structural scope, partial evidence, and lack of runtime execution or automatic repair.
8. Add `/capabilities/` to the route manifest and add Capabilities after Get started in the header/footer. Add the homepage discovery link. Verify the actual five-link header fits smaller desktops with “Repo. Format”.
9. Generate stable group/case fragment search records from visible content, package/operation names, and relevant diagnostic terms. Add Capabilities to `llms.txt` and allow the existing sitemap integration to emit its canonical page once, without fragment entries.
10. Preserve base-path-aware links, metadata, Open Graph data, active navigation, compatibility redirects/JSON, and Website UI's visitor-catalog exclusion.
11. Extend artifact verification to detect missing page/groups/results, invalid fragments, discovery omissions, stale metadata, and test/private-output leakage. Update related documentation immediately.
12. Finish the page without client-side package evaluation, per-card scripts, unnecessary full-result payloads, React islands, or duplicate generated sources.

Review the initial section and one example of each result family for visual quality before applying the established treatment to the remaining groups. This is an internal review point within the milestone, not permission to finish with partial coverage.

### Tests and verification

- Extend generation integration tests for the route, search fragment records, machine navigation, and consistency with the completed model.
- Add artifact mutation tests proving that missing capabilities, broken fragments/discovery, or leaked test artifacts are detected.
- Browser-test the complete page and representative results in both themes, with and without JavaScript.
- Verify keyboard navigation, accessible names, heading relationships, focus visibility, Axe results, overlay/Escape/close behavior, focus return, sequential dialog use, and navigation away from an open dialog.
- Check reduced motion and preserve the shared dialog animations without adding decorative motion.
- Inspect all planned widths: 320, 375, 768, 1024, 1100, 1279, 1280, and 1440px. Confirm no page overflow, crowded/wrapped desktop navigation, hidden actions, obstructed anchor destinations, or redundant mobile nesting.
- Verify that core explanations work while scrolling without clicks. Inspect visual hierarchy, file clarity, balanced summaries, section separation, and platform/Skill consistency.
- Inspect generated HTML/JavaScript size and confirm the browser receives no runtime packages or full fixture snapshots.
- Audit the complete plan coverage against rendered groups and real results. Do not weaken tests to accommodate an incorrect example.
- Recheck relevant cache behavior after final generation/discovery changes, using the isolated-checkout workflow where source mutation is required.

Run the final affected verification:

```bash
pnpm website:prepare
pnpm --filter @moldea.ai/packages-website test:unit
pnpm --filter @moldea.ai/website-ui test:unit
pnpm website:build
pnpm --filter @moldea.ai/packages-website test:integration
pnpm --filter @moldea.ai/website-ui test
pnpm --filter @moldea.ai/packages-website test
pnpm test:root
pnpm typecheck:root
pnpm --filter @moldea.ai/website-ui typecheck
pnpm --filter @moldea.ai/packages-website typecheck
pnpm lint:root
pnpm --filter @moldea.ai/website-ui lint
pnpm --filter @moldea.ai/packages-website lint
pnpm compatibility:check
pnpm docs:check
pnpm website:build
pnpm --filter @moldea.ai/packages-website check:links
```

Format/check only touched files with installed Prettier. Repeat the production build, artifact link checks, and website E2E suite with process environment `SITE_URL=https://moldea-ai.github.io` and `BASE_PATH=/packages/`, using the existing portable invocation approach. Verify exact metadata, sitemap, search, and fragment URLs, then restore and verify the default build.

Review the final diff, documentation state, public exports, and production artifacts. Report checks actually run and any remaining environment limitations; do not claim readiness with material unresolved failures.

### Acceptance criteria

- The complete six-section page demonstrates every capability family and target required by the plan, using the validated catalog.
- Essential explanations and outcomes remain understandable without JavaScript, dialogs, tabs, hover, or animation.
- Core verdicts, runtime evidence, unsupported analysis, operational errors, and maturity are communicated distinctly and accurately.
- Header/footer/homepage discovery, active navigation, search, sitemap, and `llms.txt` agree under both deployment configurations.
- Five-link navigation fits the required desktop widths; mobile keeps full labels and usable controls.
- Shared UI remains reusable, existing pages remain stable, and the page meets branding, accessibility, responsiveness, theme, code-wrapping, and reduced-motion requirements.
- All applicable verification passes and directly affected documentation is synchronized.

### Review checkpoint

Review the complete page on small desktop and mobile screens, representative result dialogs, and the source-to-claim coverage audit. Confirm that breadth has not made the page difficult to scan and that discovery and production artifacts are correct.

This is the final implementation checkpoint. Stop without committing, publishing, deploying, or changing sibling websites.

## Plan-to-milestone coverage

- Milestone 1 owns the full content inventory, coverage enforcement, all public-package execution, temporary workspace safety, typed result projection, generation integration, build dependencies/preparation, related tests, cache verification, and generation documentation.
- Milestone 2 owns FilePreview, ResultSummary, optional compact header labels, Website UI 1.5.0 exports and consumer documentation, real tarball verification, homepage presentation reuse, and its complete regression/visual verification.
- Milestone 3 owns the complete six-section page, all visible capability groups and dialogs, five-link navigation, homepage/footer discovery, routes/search/sitemap/machine navigation, artifact guards, deployment-prefix verification, final documentation, and complete production/visual acceptance.
- Each milestone owns its required correctness evidence and documentation at the time its behavior changes. No additional implementation or hardening milestone is reserved.
- No migration is required. Static-artifact rollback and backward-compatible UI adoption remain as described in the plan; sibling consumers update separately.
- If a real package defect blocks an example or new evidence materially changes the plan, stop and request direction instead of changing package behavior or silently shrinking coverage.
- If publication is separately authorized after implementation, run `pnpm release:check-changes a70774a4c2743eacefce3fc4e8f5fef0a958baa4 HEAD` once the implementation commit exists. This sequence does not authorize creating it.
- At each implementation handoff, inspect protected instruction guidance without editing it. Provide a separate coding-instructions handoff prompt only if completed changes reveal missing durable guidance; otherwise state that existing guidance covers the work.

## Approval required

Approve the current plan and this complete three-milestone sequence:

1. Complete executable capability catalog.
2. Reusable presentation and compact navigation.
3. Complete Capabilities page and discovery.

Approval alone does not authorize implementation. Each milestone requires explicit authorization identifying its number or name, and work stops at that milestone's review checkpoint. You may combine approval with authorization to start Milestone 1. Completing one milestone never authorizes the next.

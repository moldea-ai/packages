# Testing

## Commands and completion

| Root command                                               | Selection                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------------ |
| `pnpm test`                                                | Essential unit, integration, and installed CLI coverage, in order. |
| `pnpm test:full`                                           | Every deterministic category, including website browsers.          |
| `pnpm test unit` / `pnpm test:full integration`            | One selected stage. The other supported stage is `e2e`.            |
| `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e` | Complete granular categories when `MOLDEA_TEST_SUITE` is unset.    |

Root commands force their mode for children. Only `essential` and `full` are valid explicit `MOLDEA_TEST_SUITE` values. Invalid root modes/stages/extra arguments fail before setup. Missing tests fail; intentionally full-only categories are omitted before invoking their scripts.

Complete ordinary work with essential plus complete focused tests for changed behavior and affected consumers. For example, use `pnpm test:root:integration scripts/test-suite/runner.test-integration.ts` or `pnpm --filter @moldea.ai/website-ui test:unit src/search/index.test-unit.ts` with `MOLDEA_TEST_SUITE` unset. Shared changes broaden affected consumers. [Local development](local-development.md#test-conventions) retains category placement, timeouts, fixtures, and artifact exclusions.

Run full explicitly with a coding agent, normally every 1–4 weeks. No scheduled full run is added. Model/provider evaluations remain separate. Full-only frontend cases still belong in complete focused verification of touched UI, including meaningful keyboard/accessibility, 320px/mobile, light/dark, and motion behavior.

## Classification

| Essential guarantees                                                                                                                                   | Full-only coverage                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Primary Repository, Repository FS, Core, and CLI containment, identity, bounded reads/output, cursors, validation/refusal, and read-only Git behavior. | Additional representation, scale, compatibility, and installed-consumer permutations supported by focused coverage.                        |
| Artifact/package-content integrity, consequential release/CI gates, and a compact installed CLI journey.                                               | Secondary tooling and calibration qualification.                                                                                           |
| Markdown escaping/sanitization/literal-source safety and rejection of unsafe search URLs.                                                              | Ordinary website rendering, search ranking, components, badges, themes, viewports, focus matrices, motion, branding, and SEO presentation. |

Classify each new or materially changed scenario family by its concrete failure consequence. Keep tests co-located and preserve unit/integration/E2E categories. An expensive unique consequential guarantee stays essential. A security/error keyword or a module's CI role alone establishes no importance. Unclassified cases remain essential until assessed; never remove meaningful assertions to improve timing.

Use Vitest's native `{ tags: ['full'] }` options for secondary cases in mixed files. Unsafe-URL refusal stays untagged while search ranking is full-only. Shared configuration registers the tag and skips it only in essential mode.

Use `FULL_ONLY_TEST_FILES` in `scripts/test-suite/constants.ts` for whole secondary files that should not be imported. It covers presentation-only Website UI modules and resource calibration. Root per-stage workspace filters omit all packages-website categories and Website UI's installed integration before their setup. Add no parallel test trees or priority registries. Do not enable `passWithNoTests` to accommodate empty categories.

Primary Repository/Repository FS/Core/CLI families remain essential unless explicitly classified secondary. Compact packed CLI coverage establishes installed commands, safe JSON errors, POSIX SIGINT/SIGTERM shutdown without partial output, and unchanged Git state. These cases share one installed read-only fixture; the larger installed regression corpus remains reachable in full and complete focused runs. Markdown/search retain distinct content-security cases in essential.

## Preparation, cache, and interruption

The runner prepares the CLI closure for essential and uses `website:prepare` for full, then runs selected stages in order. Integration and E2E stay serial. Granular commands retain their existing preparation requirements. Private root `#test-suite` imports share the implementation between native Node TypeScript and workspace configuration typechecking without changing public package configuration.

Turbo hashes `MOLDEA_TEST_SUITE` and shared suite/Vitest inputs for affected test tasks. Essential/full cache entries are distinct. Existing integration/E2E cacheability and ordering remain; unrelated production build inputs are unchanged.

Commands inherit stdio. Interruption waits for bounded owned teardown and fails even if a child returns zero. No later stage starts after failure. Known cleanup failures report the command/root PID and remaining manual action. There is no output buffer/drain or orphan supervisor. On Windows, the installed helper cannot discover every descendant after its parent exits; helper completion is not exhaustive cleanup proof.

Configuration messages are `MOLDEA_TEST_SUITE must be essential or full when set.` and `Expected essential or full and optionally unit, integration, or e2e.` Installed failures propagate, including:

- PACKAGE_MANAGER_NOT_FOUND: The package manager's executable couldn't be found.
- PROCESS_TREE_SURVIVED: The process tree is still running after it was force-stopped

## CI and publication

CI keeps affected-workspace scope (`mode`) independent of correctness priority (`testSuite`). Ordinary PR and non-release main verification use essential; `CI_RELEASE_BUILD=true` forces full priority and all workspaces. Manual `test_suite: full` also selects every workspace without publication. Invalid `CI_TEST_SUITE` values fail before planning. The runner overrides inherited `MOLDEA_TEST_SUITE` from its validated plan.

Essential omits website test categories and evaluator/presentation preparation while retaining build, lint, types, formatting, root contracts, selected primary package tests, and applicable packed CLI/Repository FS consumers on Ubuntu with Node 22.17.0 and 24.15.0. The minimum supported runtime is a primary compatibility guarantee. Required macOS and Windows correctness lanes remain eligible whenever any workspace is selected; their priority follows the plan. Full priority retains the existing broad runtime/package-manager/Vitest compatibility qualifications and explicit granular stages. See [affected CI](local-development.md#affected-ci).

Complete local full includes packages-website browsers; shared CI excludes them. Publication runs them only for Website UI, in parallel with shared verification. Pages retains source, quality, production-artifact validation, exact-source and advertised-version gates without frontend test permutations. No new local-full attestation, semantic evidence, or approval is required for publication.

Daily Registry Canary uses essential packed consumers with fresh live registry resolution and failure reporting. This provides reduced compatibility assurance. Explicit full live canary qualification remains required before advancing the reviewed registry snapshot; daily essential success alone is insufficient.

## Measurement

Record source, commands, versions, selected/passed/skipped counts, preparation/test/elapsed times, retries/failures, and cache conditions. Compare essential/full on the same source and host using separate cold task caches; preserve developer caches.

That ratio is selection context, not before/after proof. The target is at least 50% shorter comparable routine test execution against pre-change evidence. Match workspaces, runtime, image, and command boundary for CI comparisons. Report critical-path and runner time separately with the same platform coverage, and release duration separately. Keep unavailable local-baseline or CI proof pending instead of comparing local seconds with CI seconds.

The 2026-10-30 Linux sample on Node 24.15.0/pnpm 11.9.0 used separate cold Turbo caches and source tree `ee25f58926cd6411a8166bbad5bfc9164e454b67` (the initial local-suite implementation over `5ee4df6`). Essential passed in 98.431 seconds; full passed in 795.267 seconds, including 410 browser cases. This is an 8.1× selection-cost difference. The sample ran 1,901 essential tests with 44 skips, versus 2,880 full tests with three platform skips. A focused cleanup-failure regression and comment/documentation refinements were added afterward; their checks are recorded separately rather than represented as part of this measured source. Comparable pre-change local and before/after CI proof remains pending.

[Essential CI on `bff55307`](https://github.com/moldea-ai/packages/actions/runs/41102648103) passed after fixing native Windows package-manager environment lookup, including native OS verification and packed CLI/Repository FS consumers. Its global tooling change selects all workspaces; the historical `5ee4df6` CI baseline selected Website UI only. Those scopes cannot establish a comparable before/after speed improvement. No release was run, so release elapsed-time savings remain unmeasured.

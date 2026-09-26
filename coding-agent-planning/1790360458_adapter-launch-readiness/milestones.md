# Package launch-readiness milestones

This breakdown follows the revised [plan](plan.md). Milestones 1–8 are complete and pushed through packages commit `9e7ec9ae011acbedf471f9fb7c2c36d437c90cbf`; the Repository FS platform specification was pushed as `113f5f74b9170e90880bed3de7df6c3c760affc5`. The developer's later approval of the bounded Eve 0.67.0 correction adds a separate finished adapter slice before the final launch gates. Milestone 9 has uncommitted work in progress. Do not reopen completed milestones solely to repeat their checks.

## Completed milestones 1–8

1. **Native diagnostics across the complete inspection path:** Core-owned severity and closed warning details, adapter catalogs, CLI schema 5, counts and exit behavior, coordinated versions, platform contracts, and the resource baseline were implemented and reviewed.
2. **Effective request analysis and upstream verification:** shared request-method and options handling, Anthropic/OpenAI effective request and structured-output support, Google streaming, and reproducible upstream checks were implemented and reviewed.
3. **Claude query and prompt capabilities:** `/core` imports, query-local relationships, and prompt controls were implemented and reviewed.
4. **Cloudflare version semantics and shared AI SDK tools:** the Think boundary and Cloudflare/Vercel deferred-tool recognition were implemented and reviewed without runtime version ceilings.
5. **Eve discovery and registration correctness:** nested/workspace ownership, exposure, defaults, exclusions, and bounded indexing were implemented and reviewed.
6. **LangGraph updates and remaining adapter verification:** resume schemas and the LangChain/OpenAI Agents SDK advertised-surface audits were completed and reviewed.
7. **Website examples and Website UI verification:** executable schema-5 examples, user-facing warning/error presentation, browser/accessibility gates, and the packed Website UI consumer were completed and reviewed.
8. **Remaining package audits and complete-workflow resources:** Repository FS stable root/ancestor rechecks, bounded page cache, real-filesystem and packed-CLI regressions, all fifteen package audits, resource calibration, and the trusted-tree platform specification were completed, reviewed, and pushed. The combined final operating-system matrix remains a later gate.

The completed files, tests, documentation, and evidence are recorded in `docs/launch-readiness.md` and the pushed history. Final regression and artifact gates still apply to the combined result.

## Milestone 9: Release propagation and independent package versions

**Objective:** Make release selection follow every shipped private build input and prepare the independent Repository FS patch version, with a reviewable packed-artifact proof.

**Dependencies:** Completed Milestones 1–8. The current uncommitted selector, tests, documentation, and version edits belong to this milestone. Eve 0.67.0 behavior is reserved for Milestone 10; final fifteen-package and operating-system evidence belongs to Milestone 11.

### Scope and implementation

- Finish `scripts/npm-release/project-changes.ts`, `git.ts`, `types.ts`, and their colocated tests. Build base/current committed private-workspace graphs from private `dependencies` and `devDependencies`; handle removed, renamed, replaced, missing, and cyclic inputs; propagate through private nodes to public consumers; and stop at public package boundaries. Exclude test-only, hard-excluded directories, and nonshipped documentation. Map release-relevant `configs/vite/` and `configs/typescript/` files to public library-build consumers without selecting test-only config changes.
- Verify the actual bundled static-analysis change selects affected adapters and requires their version increases without forcing an unchanged CLI patch for compatible adapter changes. Use the real Vite build and packed tarball comparison in `scripts/npm-release/project-changes.test-integration.ts`, rather than selection assertions alone. Keep existing release ordering, trusted publishing, checksum, and recovery behavior.
- Complete `projects/repository-fs/package.json` version `2.0.2` and its affected `projects/repository-fs/src/index.test-integration.ts`, `projects/cli/src/composition/composition.test-fixtures.ts`, and `projects/cli/src/cli-execution/runner.test-unit.ts` expectations. Inspect `pnpm-lock.yaml` and change it only if the repository's lockfile contract requires it. Keep CLI `9.0.0` and the independent versions of the other public packages unless their shipped Milestone 9 work requires a release.
- Synchronize `docs/npm-releases.md` and the Repository FS version reference in the isolated `platform/moldea/context/repository-fs-package.md`. Preserve unrelated concurrent platform work. Review the complete packages diff, including the revised plan and this breakdown, and the isolated platform diff before signed pushes.

### Verification and acceptance

- Run focused release-selection unit/integration coverage, including old/new graphs, private transitivity, graph failures, shared config mapping, test-only exclusion, and packed artifact comparison. Run the Repository FS correctness suite and affected CLI composition/runner checks; then the root regression, typecheck, lint, touched-file formatting, `pnpm docs:check`, and `git diff --check` checks appropriate to the changed paths.
- After each reviewed signed push, run `pnpm release:check-changes` against the exact relevant base and pushed packages commit. Correct a failed release decision or version selection, review, and push again before proceeding. Validate the platform specification with its existing structural/format checks before its signed push.
- Confirm no invalid private dependency graph can be silently skipped, no unchanged public boundary is selected merely because a compatible adapter changed, and Repository FS `2.0.2` accurately represents its shipped correction. Do not claim final production readiness or current-change macOS/Windows verification here.

**Acceptance criteria:** Release selection covers committed private and shared build inputs from both graph states; its decision follows an actual changed public tarball; package versions and affected fixtures agree; relevant checks and exact-commit release selection pass; and the matching platform Repository FS version is pushed without touching unrelated agent work.

**Review checkpoint:** Inspect graph ownership, public-boundary stopping, failure behavior, artifact comparison, independent version choices, lockfile state, the complete packages diff, and the isolated platform specification diff before the signed pushes.

## Milestone 10: Eve 0.67.0 agent output-schema boundary

**Objective:** Interpret the confirmed Eve agent-definition schema removal without losing older eligible behavior or presenting uncertain and invalid source as verified evidence.

**Dependencies:** Completed, reviewed, and pushed Milestone 9. Use the existing severity, version-classifier, Core, website, and platform-specification contracts; do not add a runtime ceiling or another compatibility layer.

### Scope and implementation

- Update `projects/adapter-eve/src/constants/index.ts`, `contracts/index.ts`, `inspection/package-inspection.ts`, and `inspection/agent-inspection.ts` to classify the `0.67.0` boundary for direct agent `outputSchema` source/bindings. Keep pre-0.67 evidence; use the existing confirmed-feature error when a wholly post-boundary declaration uses the removed relationship; and use the existing scoped, nonblocking version-dependent warning with withheld dependent evidence when a declaration spans the boundary. No warning arises solely from a new version. Keep no-schema `defineAgent` evidence and independent tool `outputSchema` behavior.
- Add public Core integration cases in `projects/adapter-eve/src/inspection/inspection.test-integration.ts` for exact older/newer/spanning/minimum-only declarations, authored property with and without binding, binding without property, dependent handoff/routing suppression, and unaffected tool schema evidence. Update fixtures only when an actual catalog or witness contract changes.
- Add an integrity-pinned Eve `0.67.0` target in `scripts/upstream-compatibility/targets.ts` and adjust `eve-scenarios.ts` or its current fixture owner to verify the real SDK accepts the current form and rejects the removed field, while the pinned `0.66.3` form remains accepted. Use no provider call or credential.
- Synchronize `projects/adapter-eve/README.md`, `docs/verified-target.md`, `docs/evidence-and-diagnostics.md`, and `docs/binding-example.md`; retain the explicit older pinned example. Update `compatibility/runtimes.yaml` and generated `docs/runtime-compatibility.md`; move `apps/website/src/lib/capabilities/runtime-examples/eve.ts` and its exact executed witness to current `0.67.0` syntax while retaining tool schema evidence. Update only `platform/moldea/context/adapter-eve-package.md` in the isolated worktree for this behavior. Rebuild affected generated website presentation and synchronize its copy. Do not change the global Repository Format or the next skill.

### Verification and acceptance

- Run Eve unit/integration and Core-boundary regressions, pinned/latest upstream checks, executed website capability cases, the website build and browser checks for the changed example, `pnpm compatibility:check`, `pnpm docs:check`, affected root/CLI regressions, typecheck, lint, touched-file formatting, and diff checks. Inspect production artifacts for accidental test/source inclusion. Run the platform documentation's applicable structural and formatting checks.
- Verify exact `0.66.3` agent-schema proof; exact `0.67.0` error/no false agent proof; spanning-range warning/no false proof; no-schema `0.67.0` positive agent evidence; and unaffected tool schema proof. Confirm no additional unbounded repository reads, parsing, output, or model calls were introduced.
- Review package, website, compatibility, and isolated platform diffs; fix material findings and repeat focused and affected regression checks before signed pushes. Run exact-commit release selection after the packages push and correct any version-selection failure before Milestone 11.

**Acceptance criteria:** The same adapter truthfully handles older, newer, and spanning Eve declarations; its docs, matrix, public website example, real SDK checks, and platform specification agree; both repositories' changes are reviewed and pushed; and no material regression remains in affected surfaces.

**Review checkpoint:** Inspect the placement of the boundary before positive evidence, error/warning cascades and details, retained older and tool behavior, exact SDK provenance, website source/output, release selection, and platform contract alignment.

## Milestone 11: Final fifteen-package launch gates and verdict

**Objective:** Establish the final production-readiness verdict for all fifteen public packages from packed consumers, complete local checks, and the operating-system matrix on the pushed current commit, without publishing or deploying.

**Dependencies:** Completed, reviewed, and pushed Milestones 9 and 10. The current-commit GitHub Actions matrix and packed-consumer infrastructure must be available; missing material evidence prevents an unconditional ready verdict.

### Scope and implementation

- Recheck pinned and latest upstream versions against exact final inputs and report any newly relevant behavior without silently expanding scope or changing minimum-only eligibility. Confirm Core 5, CLI 9/schema 5, ten adapter versions, independent Repository/Repository FS/Website UI versions, compatible-major declarations, lockfile, CLI composition, compatibility ranges, and installation examples.
- Verify all fifteen packed tarballs, exports/declarations, runtime dependencies, private-workspace and test/source exclusion, checksums, installed CLI composition, supported Node.js 22.11.0/latest 22, 24.11.0/latest 24, and 26.8.1 targets where advertised, and the Repository/CLI Vitest peer versions. Preserve Website UI's separate Node/Astro/Tailwind and browser evidence.
- Finish `docs/launch-readiness.md` with package-by-package checks, exact resource and cumulative-output limits, pinned/latest results, release selection, artifact and consumer results, platform specification state, CI evidence available at the time of writing, remaining limitations, and an evidence-supported verdict. Synchronize any directly affected root README, package docs, generated references, catalog, compatibility, and release guides. Include the next-skill handoff for schema 5, severity, withheld proof, output costs, schema-4 consumers, and qualification evidence. Inspect protected instructions and provide only the prescribed separate-model handoff if a durable gap remains.
- Review the complete final packages diff and relevant isolated platform documentation state. Push cohesive final report/corrections with the authorized signed workflow. Dispatch the existing Linux/macOS/Windows workflow for the exact pushed current packages commit; if it reveals a defect, fix, review, push, and rerun. Record the final run and commit in the completion report. Do not edit live platform agents' unrelated work, publish npm packages, tag, merge, deploy, or implement the next skill.

### Verification and acceptance

- Run the applicable final workspace commands: `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`, `pnpm compatibility:check`, `pnpm docs:check`, `pnpm website:check`, `pnpm --filter @moldea.ai/packages-website test:e2e`, `pnpm upstream:check`, `pnpm upstream:check:latest`, and `pnpm resource:measure`. Reuse prior passes only when inputs are identical, and rerun exact-commit `pnpm release:check-changes` after any final push.
- Confirm all fifteen packages' artifact/installed-consumer checks; the advertised Node and Vitest peer matrix; Linux, macOS, and Windows jobs on the final pushed commit; website accessibility, 320px responsiveness, both themes, and reduced motion where affected; no stale state-bearing documentation; and no material unresolved finding. Attribute any failed check before changing code or expectations.
- Preserve the separation between local, prior-commit, and final-commit evidence in the launch report. The final completion response may record a CI result obtained after the last documentation push; do not make the tracked report claim a future run has already passed. An unavailable or failed required job is a launch blocker, not a passing result.

**Acceptance criteria:** Exact final commit and required operating-system matrix pass; all fifteen applicable package tests, artifacts, types, installed consumers, versions, documentation, website gates, and resource checks are supported by recorded evidence; the launch verdict is truthful and has no material unresolved finding; and the next skill can consume the final package contracts without a hidden compatibility assumption.

**Review checkpoint:** Inspect final release/version coherence, all tarball and consumer results, upstream qualification limits, resource and token-cost reporting, package/platform documentation agreement, current-commit CI evidence, exact verdict, and the next-skill handoff. Publication and deployment remain separate work.

## Approval required

Approve this regenerated sequence: Milestones 1–8 stay complete, Milestone 9 finishes release propagation and the independent Repository FS version, Milestone 10 corrects Eve 0.67.0 with package/website/platform evidence, and Milestone 11 owns the complete pushed-current-commit launch verdict. The prior signed-push authorization remains subject to each milestone's review and verification. This approval does not authorize npm publication, website deployment, platform application changes, or next-skill implementation.

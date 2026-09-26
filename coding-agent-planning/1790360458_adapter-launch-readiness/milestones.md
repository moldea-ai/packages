# Package launch-readiness milestones

This breakdown follows the revised [plan](plan.md). Milestones 1–7 remain completed and pushed through packages commit `85ce54cb2ac0a1321ad5dcd59dc3b7b1557227f4`. Milestone 8 is partly implemented but uncommitted. The revised remaining execution units are Milestones 8 and 9; no earlier milestone is reopened merely to repeat its checks.

## Completed milestones 1–7

1. **Native diagnostics across the complete inspection path:** Core-owned severity and closed warning details, adapter catalogs, CLI schema 5, counts and exit behavior, coordinated versions, platform contracts, and the resource baseline were implemented and reviewed.
2. **Effective request analysis and upstream verification:** shared request-method and options handling, Anthropic/OpenAI effective request and structured-output support, Google streaming, and reproducible upstream checks were implemented and reviewed.
3. **Claude query and prompt capabilities:** `/core` imports, query-local relationships, and prompt controls were implemented and reviewed.
4. **Cloudflare version semantics and shared AI SDK tools:** the Think boundary and Cloudflare/Vercel deferred-tool recognition were implemented and reviewed without runtime version ceilings.
5. **Eve discovery and registration correctness:** nested/workspace ownership, exposure, defaults, exclusions, and bounded indexing were implemented and reviewed.
6. **LangGraph updates and remaining adapter verification:** resume schemas and the LangChain/OpenAI Agents SDK advertised-surface audits were completed and reviewed.
7. **Website examples and Website UI verification:** executable schema-5 examples, user-facing warning/error presentation, browser/accessibility gates, and the packed Website UI consumer were completed and reviewed.

The completed files, tests, documentation, and evidence are recorded in `docs/launch-readiness.md` and the pushed history. Final regression and artifact gates in Milestone 9 still apply to the combined result.

## Milestone 8: Remaining package audits and complete-workflow resources

**Objective:** Finish the Repository, Repository FS, Core, and CLI audit; close the demonstrated stable-root and cache-growth defects; establish the measured fifteen-package launch envelope; and synchronize the Repository FS specification with the trusted-tree contract.

**Dependencies:** Completed Milestones 1–7 and the developer's approved trusted-tree decision. This milestone does not require a current-change macOS/Windows CI result before its reviewed commit is pushed; Milestone 9 owns that final gate.

### Scope and implementation

- Finish the in-progress reader correction in `projects/repository-fs/src/reader/filesystem-repository-reader.ts` and `page-cache.ts`. Recheck the pinned root and ancestors, reject detected stable replacement with `SNAPSHOT_CHANGED`, reobserve listed directories, and cap nonempty cached pages at 4,096 alongside `maxCachedBytes`. Keep the trusted-tree limitation explicit and add no public option, persistent cache, new error, or hostile-race guarantee.
- Complete colocated real-filesystem and cache regressions in `filesystem-repository-reader.test-integration.ts` and `page-cache.test-unit.ts`. Exercise stable root and ancestor replacement, exact selection, no-follow behavior, drift, limits, queue overflow, cancellation, slot recovery, and cleanup through the public reader. Keep test files out of production artifacts.
- Complete the Repository path/memory-reader/conformance and Core validation/resource/isolation audits using their existing public surfaces and full package correctness suites. Add a local correction only for a demonstrated gap. Complete the packed CLI six-command audit and warning-only/mixed/error behavior in `projects/cli/src/bin/index.test-e2e.ts`, retaining source and Git-state immutability.
- Finish `scripts/resource-calibration/calibration.ts` and its colocated integration test with separate V8 heap and Core logical-retention measurements. Run the fixed ordinary, many-agent/shared-source, broad-tool, deep/broad-Eve, dense-diagnostic, large-source, and multi-page workloads; assess cumulative CPU, memory, I/O, parser calls, records, pages, output bytes, and snapshot attempts. Verify large/nested-source failure and bounded session/adapter work without raising limits.
- Synchronize `projects/repository-fs/README.md`, its selection/security/cache guides, `projects/cli/README.md`, root `README.md` where affected, and `docs/launch-readiness.md`. The report must account for all fifteen public packages, the measured envelope, stateless CLI continuation cost, substantial cumulative output, and verification limits without claiming exact token counts or unlimited scalability.
- Update only `platform/moldea/context/repository-fs-package.md` for the accepted trusted-tree requirement, detected stable replacement, supported final-component no-follow behavior, cache entry cap, and verification limits. Work in an isolated platform worktree or equivalent clean checkout so other agents' unrelated changes are untouched and cannot be staged by `repo push`. Preserve the existing version-2 public contract and other platform specifications.

### Verification and acceptance

- Run the full Repository, Repository FS, Core, and CLI package correctness suites, focused real-filesystem and packed CLI checks, root integration, `pnpm resource:measure`, affected typecheck/lint/build, `pnpm compatibility:check`, `pnpm docs:check`, touched-file Prettier, and `git diff --check`. Review generated output and verify no test file enters the Repository FS production artifact. Reuse passing checks only if their applicable inputs remain unchanged.
- Confirm the root-replacement probe no longer returns outside bytes, detected drift uses the existing error, cache entries remain bounded for tiny and empty ranges, and queued cancellation releases capacity. Record tests that this Linux host cannot establish for macOS/Windows.
- Review the complete scoped packages diff and isolated platform-specification diff. Resolve all material local findings; preserve unrelated concurrent platform changes. The package report and specification must describe the same trusted-tree boundary. Publish each cohesive repository change through the previously authorized signed `repo push` workflow after review.

**Acceptance criteria:** Every public package has a documented audit entry; Repository, Repository FS, Core, and CLI have passing applicable local checks; the measured resource envelope is explicit and bounded; no material local correctness gap remains; the platform Repository FS specification agrees with the implementation; and the macOS/Windows final gate is clearly pending Milestone 9 rather than claimed as passed.

**Review checkpoint:** Inspect stable filesystem containment and its hostile-race limitation, real public-boundary regressions, cache byte/entry bounds, CLI mixed outcomes and cumulative command cost, calibration methodology, the fifteen-package report, and both repositories' scoped diffs before the signed pushes.

## Milestone 9: Release propagation and final launch evidence

**Objective:** Ensure private bundled changes select the correct public releases and establish a coherent fifteen-package launch verdict from final packed consumers, upstream checks, and the current-commit operating-system matrix without publishing packages or deploying the website.

**Dependencies:** Reviewed and pushed Milestone 8 changes in both repositories. The CI consumer/OS matrix must be available for a final readiness verdict.

### Scope and implementation

- Update `scripts/npm-release/project-changes.ts`, `git.ts`, `types.ts`, and colocated unit/integration coverage. Build private dependency graphs from both base and current committed manifests, including private `dependencies` and `devDependencies`; propagate through private nodes and stop at external public-package boundaries. Detect removed, renamed, and replaced private dependencies and fail on invalid graphs. Preserve test-only, excluded-directory, and nonshipped-documentation exclusions. Map release-relevant `configs/vite/` and `configs/typescript/` inputs to their public library-build consumers.
- Prove private static-analysis changes select affected adapters and require version increases without forcing an unchanged CLI release for compatible adapter patches. Compare actual packed artifacts as well as release-selection decisions. Preserve publishing order, trusted publishing, checksums, and recovery behavior.
- Verify coordinated Core 5, CLI 9/schema 5, ten adapter versions, compatible-major declarations, lockfile, composition expectations, compatibility ranges, and installation examples. Apply the existing release policy to Repository, Repository FS, and Website UI for shipped Milestone 8 changes while keeping versions independent. Add no legacy schema reader or optional-severity shim.
- Recheck latest upstream versions and run pinned checks against exact final inputs. Report additional relevant upstream changes without silently expanding scope or narrowing minimum-only eligibility. Verify all fifteen tarballs, exports/types, runtime dependencies, no private-workspace imports or test/source leaks, checksums, and installed composition across advertised Node and Vitest peer targets.
- Run the existing Linux/macOS/Windows CI matrix on the pushed current change. The initial local review and signed push make that exact commit available to CI; if CI reveals a defect, fix, review, push, and repeat before the final verdict. Do not infer current portability from an older workflow run. Website UI retains its separate Node/Astro/Tailwind and browser gates.
- Finish `docs/launch-readiness.md`, affected release/package documentation including `docs/npm-releases.md`, generated references, catalogs, and compatibility presentations. Verify all previously synchronized platform contract documents plus the Repository FS update against code without modifying unrelated platform work. Record exact checks, limits, repository states, and a next-skill handoff for schema 5, severity, withheld proof, output cost, schema-4 consumers, and qualification evidence. Review protected instructions for a durable guidance gap; provide only the prescribed separate-model handoff if one remains.

### Verification and acceptance

- Run focused release-selection unit/integration checks first, including private graph, removed/replaced input, config mapping, test-only exclusion, version selection, and packed-artifact cases. Run `pnpm release:check-changes` against exact relevant commits after they exist.
- Run the applicable final workspace gates: `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm build`, `pnpm compatibility:check`, `pnpm docs:check`, `pnpm website:check`, `pnpm --filter @moldea.ai/packages-website test:e2e`, `pnpm upstream:check`, `pnpm upstream:check:latest`, and `pnpm resource:measure`. Reuse results only for unchanged inputs.
- Verify the fifteen packed consumers and advertised Node.js 22.11.0/latest 22, 24.11.0/latest 24, and 26.8.1 targets where applicable; documented Vitest peers; Linux/macOS/Windows CI; and Website UI's own runtime contract. Record unavailable required infrastructure as unverified. A material correctness or verification gap prevents an unconditional production-readiness claim.
- Review each scoped diff, fix findings, and use the authorized signed push workflow for cohesive changes. After the pushed-current-commit CI results, repeat correction and verification as needed. Do not publish npm packages, create tags, merge, deploy, or implement the next skill.

**Acceptance criteria:** Private bundled changes cannot escape release selection; all fifteen applicable package regression, type, tarball, and installed-consumer checks pass; required CI and website gates pass on the exact relevant commits; package and platform documentation matches the final code; the measured resource envelope and limitations are truthful; and the launch report states an evidence-supported verdict with no material unresolved finding.

**Review checkpoint:** Inspect the release graph and packed comparison, coherent versions without lockstep, complete consumer and OS results, documentation agreement across both repositories, resource limits and cumulative output, exact verdict, and next-skill handoff. Publication and deployment remain separate work.

## Approval required

Approve this regenerated sequence with Milestones 1–7 preserved as complete, Milestone 8 finishing the local audit and trusted-tree specification, and Milestone 9 owning release propagation and the pushed-current-commit final matrix. The previously granted signed-push authorization remains subject to each milestone's review and verification. This approval does not authorize npm publication, website deployment, platform application changes, or next-skill implementation.

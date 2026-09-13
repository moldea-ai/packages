# Publish adapter documentation with installed packages

## Objective and cause

Make all ten official adapter packages locally self-documenting without changing adapter behavior or running paid evaluations. The Eve test session successfully used moldea, but explored compiled package source after encountering missing documentation. All ten adapters have repository-owned docs but omit them from npm artifacts; six installed READMEs contain broken documentation links. Existing package tests check runtime artifacts but do not require these documents. The release selector unconditionally excludes docs, which would silently omit future published-documentation fixes.

## Evidence and scope

Base: packages origin/main f1d1054e77bf50400e46e24ede77dbc07af3e7b8. Work on branch adapter_package_docs in an isolated worktree; preserve the user's development branch and unrelated agents' changes. Relevant owners are projects/adapter-_/package.json, README.md, docs/_.md and src/index.test-integration.ts; scripts/npm-release/git.ts and project-changes.ts; their tests; README.md and docs/npm-releases.md. Each adapter currently has four small Markdown documents, totaling about 84 KB across all ten. Some documents link to website-only API and compatibility routes.

## Final contract

- Ship each adapter's existing four documentation pages under docs and provide direct README navigation to overview, verified target, diagnostics and limitations.
- Preserve existing technical claims. Replace website-relative links with the corresponding canonical HTTPS URLs; keep package-local document links local and resolvable.
- Include a compact local navigation section in each documentation index. No requirement to read every page or inspect compiled source before ordinary use.
- Require documentation completeness and local-link resolution against actual package packing output. Reject missing targets and links escaping the package boundary. Reuse existing packing checks rather than adding another installation per case.
- Treat documentation as release-relevant when either compared manifest publishes it; preserve website-only exclusions for other packages. Cover additions, modifications, deletions, and the version-bump gate with real Git integration tests.
- Patch-bump only the ten changed adapters from current main versions. Preserve compatible-major consumer dependency ranges and runtime compatibility claims. Refresh affected lockfile resolutions and version assertions.

## Implementation and ownership

First strengthen the existing adapter artifact checks, using shared test-only verification under configs/package-documentation if needed, with colocated negative integration coverage. Then publish docs in each manifest, correct navigation and website-only links, and synchronize adapter README version declarations. Update release selection using committed manifest information rather than an adapter-name allowlist. Keep validation and errors in the existing release-tooling conventions and avoid a new dependency or a general Markdown rendering system. Update root packaging/release guidance and the directly affected platform package specification if it contradicts the final distribution contract; do not touch unrelated platform work or protected instructions.

## Verification and resource controls

Use existing Node 24.15.0 and pnpm 11.9.0 tooling. Run focused regression tests first, then pnpm test:root and the complete existing correctness suites for all ten adapters, serializing artifact-heavy work. Run root and adapter typechecking/linting, targeted Prettier, compatibility:check, and docs:check. Inspect real tarballs and their Markdown/link closure; verify published npm artifacts after release. Assert no test files, source-only helpers, private imports, or unintended assets enter artifacts. Retain existing build exclusions. Do not add caches or arbitrary output limits: documents are small static assets and tests reuse existing pack results. CI owns the full supported-runtime and operating-system matrix; report its actual result separately from local checks.

## Review and publication

Keep packaging, release selection, tests, and documentation synchronization together as one complete implementation checkpoint. Challenge this plan before implementation, revise material gaps, and evaluate breakdown. Review the complete scoped diff, fix confirmed defects, and review again. Create a signed and signed-off cohesive commit, push the isolated branch, merge only reviewed work into main using the available authorized publication mechanism, and monitor the existing trusted npm workflow. Verify all ten new versions contain usable local docs. Do not claim publication until registry artifacts are confirmed. Failed publication preserves commits and existing released versions; recovery follows docs/npm-releases.md, never retags or overwrites releases.

## Exclusions and risks

Clean slate within the affected path: no legacy documentation fallback, compatibility switch, parallel release-selection path, or migration shim. Remove superseded assumptions rather than preserving them. No skill release, SKILL.md changes, runtime logic changes, SDK-range changes, new adapter capabilities, paid semantic evaluations or adapter qualifications, changes in skill-mock, evidence replacement, broad documentation rewrites, or unrelated cleanup. Missing GitHub publication capability or a material unrelated CI failure must be reported honestly rather than bypassed. Shipping docs means future edits to those shipped files properly need adapter patches; it does not force unchanged CLI or skill releases.

## Approval required

The complete scope is the ten adapters' documentation packaging and navigation, artifact regression coverage, shipped-document release selection, directly affected documentation/version synchronization, review and publication. The user has explicitly authorized autonomous completion of this task and its workflow; no additional approval checkpoint is requested.

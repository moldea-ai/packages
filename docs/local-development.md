# Local development

The root [README](../README.md#getting-started) owns repository purpose, requirements, and installation. The [project blueprint](project-blueprint.md) owns architecture and package ownership. This guide owns the detailed development commands, package build conventions, test categories, and packed-consumer verification boundary.

## Commands

Run commands from the repository root.

| Command                 | Purpose                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `pnpm format:check`     | Check formatting across repository-maintained files.                               |
| `pnpm lint`             | Lint root configuration and every workspace lint task.                             |
| `pnpm typecheck`        | Type-check root configuration and every workspace typecheck task.                  |
| `pnpm build`            | Build the complete workspace in dependency order.                                  |
| `pnpm test`             | Run essential unit, integration, and installed CLI coverage in order.              |
| `pnpm test:full`        | Run every deterministic category, including website browsers.                      |
| `pnpm test:root`        | Run root unit and integration tests.                                               |
| `pnpm test:unit`        | Run root and workspace unit tests.                                                 |
| `pnpm test:integration` | Run root and workspace integration tests serially.                                 |
| `pnpm test:e2e`         | Build and run installed-package end-to-end tests serially.                         |
| `pnpm format`           | Format repository-maintained files.                                                |
| `pnpm docs:generate`    | Build required packages and generate the ignored website content model.            |
| `pnpm docs:check`       | Build required packages and validate package discovery, docs, exports, and routes. |
| `pnpm website:prepare`  | Build CLI and its dependency closure plus Website UI for direct website tasks.     |
| `pnpm website:dev`      | Prepare the website, generate content, and run Astro locally.                      |
| `pnpm website:build`    | Build, index, and validate the complete static website through Turbo.              |
| `pnpm website:check`    | Prepare and run website docs, tests, types, lint, build, and artifact checks.      |

Direct website-package commands are lower-level tasks and require `pnpm website:prepare` first. Root `docs:check`, `docs:generate`, `website:dev`, and `website:check` perform that preparation automatically; `website:build` retains Turbo dependency ordering. See the [packages website README](../apps/website/README.md#commands) for application-specific inputs, cache behavior, focused browser checks, and alternate-origin verification.

The packed CLI corpus exercises universal bindings, shared and distinct sources, bounded syntax inspection, and large diagnostic collections without installing runtime SDKs.

## Affected CI

`pnpm ci:plan` compares `CI_BASE_COMMIT` with the actual checkout and writes its validated plan to `GITHUB_OUTPUT` when supplied. `CI_TESTED_COMMIT` must match the checkout. `CI_TEST_SUITE` accepts only `essential` (the default) or `full`. `CI_RELEASE_BUILD=true` forces full priority and all workspaces. Explicit full dispatch also selects every workspace without publishing. Pull requests compare the target SHA with the tested merge commit; package-version checks separately compare target and head SHAs. Main pushes pass their exact `before` SHA through the release orchestrator.

`pnpm ci:run checks` consumes `MOLDEA_CI_PLAN`, rejects stale commits, unknown workspaces, and Turbo filter expressions, and forces child selection from `testSuite`. It prepares the CLI closure for essential or website prerequisites for full, and always runs root unit/lint/type checks and formatting. Selected workspaces build with dependencies and run their own lint/types. Essential omits packages-website tests and Website UI's installed integration before setup; full retains existing granular correctness. Turbo `--only` prevents prerequisite test/quality tasks from expanding selection. Integration and E2E stay serial. Selected website builds retain source-model and production-artifact validation.

Scope follows downstream dependency and devDependency consumers in both committed graphs, including moved/deleted owners and removed edges. Website/UI-only changes skip root integration and unrelated runtime consumers. Global/unknown paths and missing comparisons select every workspace while preserving suite priority. Archive/backup paths never select work or have their contents read. All-workspace `mode: full` does not imply `testSuite: full`.

`pnpm ci:run test` retains selected macOS/Windows correctness coverage for both priorities. Essential packed CLI/Repository FS consumers use Ubuntu with Node 22.17.0 and 24.15.0; full retains broad Node/OS, package-manager and existing-Vitest qualification. A separate pack job builds the complete public inventory, checksums and exact source identity in the Linux checks image. Compact local CLI cases also verify safe error output, POSIX signal shutdown, and Git administrative metadata non-mutation, beyond the packed runtime lane's Git-status check.

Shared CI excludes packages-website browsers. Publication gates only Website UI releases with its existing parallel browser job. Pages retains source/types/lint/build/artifact, exact-source, availability and deployment safety without full-only test permutations. The stable **Verify Repository** gate requires planning, Linux checks, applicable packing, native OS and selected consumer jobs; missing, failed, cancelled or unexpectedly skipped results fail closed. Release caching restrictions and five transient registry retries remain unchanged.

Daily Registry Canary runs essential live-registry consumers and reports upstream breakage. Request full live qualification explicitly before snapshot promotion. Routine PR/non-release main runs use essential; actual releases and registry recovery force the existing full CI boundary, without adding local browser, semantic evidence or operator steps.

## Build conventions

Public JavaScript artifacts are ESM-only unless a focused specification establishes another format. Vite builds libraries with explicit entry points, stable output names, source maps by default, and deliberate dependency externalization. A package may omit JavaScript source maps when bundling a private workspace implementation would expose private import paths in the published artifact.

TypeScript performs strict source checking and emits declarations separately so public types remain first-class package artifacts. Package build scripts clean their output once, run Vite, and then emit declarations; the shared Vite configuration does not delete output owned by another build step. Website UI also publishes source Astro components and CSS because its consuming Astro application owns compilation and Tailwind source scanning.

Environment-neutral packages extend `configs/typescript/environment-neutral.json` and must not import Node.js modules or inherit Node globals; Node.js packages extend `configs/typescript/node.json`. Declaration builds use the corresponding `environment-neutral-library.json` or `node-library.json` configuration and set package-local `rootDir` and `outDir` values.

Turborepo derives execution order from declared workspace dependencies. Package dependencies must remain explicit and acyclic, and no task may depend on workspace enumeration order or undeclared cross-project state. A package whose typechecked tests import its own package name, such as Repository, Repository FS, Core and Website UI, reads its own `dist`, so its `typecheck` task in `turbo.json` also depends on its own `build`.

## Test conventions

[Testing](testing.md) owns essential/full membership, focused completion checks, and the explicit 1–4 week full cadence. Unset granular commands still run complete categories. Routine CI also selects essential; release qualification retains its documented full boundary.

Vitest runs without global test APIs. Tests are colocated with their owning source modules. Node.js and non-React TypeScript tests use `*.test-unit.ts`, `*.test-integration.ts`, and `*.test-e2e.ts` for the categories they own; other source extensions retain the same category markers and match their implementation extension. Each package exposes a granular script for every category it contains, and its `test` command runs unit, integration, then end-to-end correctness suites when present. Repository-level conformance fixtures represent contracts implemented by multiple packages.

Unit tests retain Vitest's short default timeout and may read static fixtures, but correctness must not depend on real filesystem, compiler-program, package-manager, or child-process boundaries. Tests that depend on real workspace packages, temporary filesystems, compiler programs, package installation, or child processes belong to the integration suite even when the production API is synchronous. Integration tests share a 120-second cross-platform test and hook budget through `configs/vitest/test.config.ts`; use an individual override only for an operation with a measured requirement beyond that budget.

Tests must remain excluded from production artifacts while still participating in typechecking and test-runner compilation. Follow the repository's source-derived test naming and granular script conventions when adding or removing a category.

## Packed-consumer verification

Real tarball installation and execution are the release boundary for every package version. Repository FS and CLI composition have packed-consumer coverage. CI builds public tarballs on the pinned development runtime, then installs and executes them with package scripts disabled and strict engine validation on Node.js `22.17.0`, the latest Node.js 22, Node.js `24.11.0`, the latest Node.js 24, and Node.js `26.8.1`.

In CI, every packed-consumer install resolves third-party dependencies only from versions published before the reviewed instant in [`configs/registry-snapshot`](../configs/registry-snapshot/index.mjs), so a new upstream release cannot change a pull-request or release verdict. A step before each consumer check exports `npm_config_before` and an equivalent `pnpm_config_minimum_release_age`; the consumer scripts themselves stay unchanged. The scheduled [Registry Canary](../.github/workflows/registry-canary.yml) repeats complete verification daily with `live_registry: true` and opens or updates one issue on failure without blocking releases. Advance the snapshot in a reviewed change once the canary passes, and keep it at least one minute after the publish time of every `@moldea.ai` release that downstream candidate workflows install from the registry, because npm's `--before` cannot exempt our own scope and pnpm rounds the release age up to whole minutes. CI passes the same instant to the Skill consumer lanes, which pin their npm, pnpm and Yarn consumer installs the same way; during the canary it passes none, so they resolve live.

The CLI harness verifies installed package identities and real `version`, `composition`, `validate`, `inspect`, `scope`, and `content` commands through the packed composition. A separate pnpm `11.21.0` consumer verifies that installing the complete CLI closure preserves an existing root Vitest `3.2.4`. These consumer guarantees remain independent from the newer runtime required by repository development tooling.

Package integration and end-to-end tasks run serially because they create real tarballs and isolated consumer installations whose package-manager and filesystem work is unreliable under shared-runner concurrency. The [npm release guide](npm-releases.md) owns release selection, publication ordering, trusted publishing, and recovery.

# Local development

The root [README](../README.md#getting-started) owns repository purpose, requirements, and installation. The [project blueprint](project-blueprint.md) owns architecture and package ownership. This guide owns the detailed development commands, package build conventions, test categories, and packed-consumer verification boundary.

## Commands

Run commands from the repository root.

| Command                       | Purpose                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------- |
| `pnpm format:check`           | Check formatting across repository-maintained files.                                              |
| `pnpm lint`                   | Lint root configuration and every workspace lint task.                                            |
| `pnpm typecheck`              | Type-check root configuration and every workspace typecheck task.                                 |
| `pnpm build`                  | Build the complete workspace in dependency order.                                                 |
| `pnpm test`                   | Run unit, integration, and end-to-end correctness suites in that order.                           |
| `pnpm test:root`              | Run root unit and integration tests.                                                              |
| `pnpm test:unit`              | Run root and workspace unit tests.                                                                |
| `pnpm test:integration`       | Run root and workspace integration tests serially.                                                |
| `pnpm test:e2e`               | Build and run installed-package end-to-end tests serially.                                        |
| `pnpm format`                 | Format repository-maintained files.                                                               |
| `pnpm compatibility:generate` | Regenerate technical compatibility documentation from the canonical matrix.                       |
| `pnpm compatibility:check`    | Verify matrix, package, and generated-artifact synchronization.                                   |
| `pnpm upstream:check`         | Type-check exact pinned minimum/current SDK consumers and check controlled request preparation.   |
| `pnpm upstream:check:latest`  | Resolve stable npm latest SDK releases and test them without changing the pinned targets.         |
| `pnpm docs:generate`          | Build required packages and generate the ignored website content model.                           |
| `pnpm docs:check`             | Build required packages and validate package discovery, docs, exports, routes, and compatibility. |
| `pnpm website:prepare`        | Build CLI and its dependency closure plus Website UI for direct website tasks.                    |
| `pnpm website:dev`            | Prepare the website, generate content, and run Astro locally.                                     |
| `pnpm website:build`          | Build, index, and validate the complete static website through Turbo.                             |
| `pnpm website:check`          | Prepare and run website docs, tests, types, lint, build, and artifact checks.                     |

Direct website-package commands are lower-level tasks and require `pnpm website:prepare` first. Root `docs:check`, `docs:generate`, `website:dev`, and `website:check` perform that preparation automatically; `website:build` retains Turbo dependency ordering. See the [packages website README](../apps/website/README.md#commands) for application-specific inputs, cache behavior, focused browser checks, and alternate-origin verification.

The upstream check installs exact SDK versions in disposable consumers with lifecycle scripts disabled, verifies package integrity, type-checks source fixtures against their real exports, and checks Anthropic/OpenAI request-body precedence through controlled transport. It runs serially and removes each consumer after use. A latest check is a maintenance signal: inspect source-owned release notes and changed declarations, reproduce any changed contract in its owning adapter and fixture, run focused and broader regressions, then release only affected packages. The latest command never rewrites compatibility ranges or asserts that every future version has today's behavior. Provider requests, credentials, process agents, and cloud execution are outside this check.

## Build conventions

Public JavaScript artifacts are ESM-only unless a focused specification establishes another format. Vite builds libraries with explicit entry points, stable output names, source maps by default, and deliberate dependency externalization. A package may omit JavaScript source maps when bundling a private workspace implementation would expose private import paths in the published artifact.

TypeScript performs strict source checking and emits declarations separately so public types remain first-class package artifacts. Package build scripts clean their output once, run Vite, and then emit declarations; the shared Vite configuration does not delete output owned by another build step. Website UI also publishes source Astro components and CSS because its consuming Astro application owns compilation and Tailwind source scanning.

Environment-neutral packages extend `configs/typescript/environment-neutral.json` and must not import Node.js modules or inherit Node globals; Node.js packages extend `configs/typescript/node.json`. Declaration builds use the corresponding `environment-neutral-library.json` or `node-library.json` configuration and set package-local `rootDir` and `outDir` values.

Turborepo derives execution order from declared workspace dependencies. Package dependencies must remain explicit and acyclic, and no task may depend on workspace enumeration order or undeclared cross-project state.

## Test conventions

Vitest runs without global test APIs. Tests are colocated with their owning source modules. Node.js and non-React TypeScript tests use `*.test-unit.ts`, `*.test-integration.ts`, and `*.test-e2e.ts` for the categories they own; other source extensions retain the same category markers and match their implementation extension. Each package exposes a granular script for every category it contains, and its `test` command runs unit, integration, then end-to-end correctness suites when present. Repository-level conformance fixtures represent contracts implemented by multiple packages.

Unit tests retain Vitest's short default timeout and may read static fixtures, but correctness must not depend on real filesystem, compiler-program, package-manager, or child-process boundaries. Tests that depend on real workspace packages, temporary filesystems, compiler programs, package installation, or child processes belong to the integration suite even when the production API is synchronous. Integration tests share a 120-second cross-platform test and hook budget through `configs/vitest/test.config.ts`; use an individual override only for an operation with a measured requirement beyond that budget.

Tests must remain excluded from production artifacts while still participating in typechecking and test-runner compilation. Follow the repository's source-derived test naming and granular script conventions when adding or removing a category.

## Packed-consumer verification

Real tarball installation and execution are the release boundary for every package version. Repository FS, every official runtime adapter, and CLI runtime composition have packed-consumer coverage. CI builds public tarballs on the pinned development runtime, then installs and executes them with package scripts disabled and strict engine validation on Node.js `22.11.0`, the latest Node.js 22, Node.js `24.11.0`, the latest Node.js 24, and Node.js `26.8.1`.

Adapter harnesses exercise each installed public export and inspection boundary. The CLI harness verifies installed package identities and real `version`, `composition`, `validate`, `inspect`, `scope`, and `content` commands through the packed composition. Repository's optional testing subpath is exercised with strict peers on Vitest `1.0.0`, `2.0.0`, `3.2.4`, and `4.1.10`; a separate pnpm `11.21.0` consumer verifies that installing the complete CLI closure preserves an existing root Vitest `3.2.4`. These consumer guarantees remain independent from the newer runtime required by repository development tooling.

Package integration and end-to-end tasks run serially because they create real tarballs and isolated consumer installations whose package-manager and filesystem work is unreliable under shared-runner concurrency. The [npm release guide](npm-releases.md) owns release selection, publication ordering, trusted publishing, and recovery.

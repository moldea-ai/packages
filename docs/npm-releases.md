# npm releases

Public packages release automatically after their changes reach `main`. Pull requests invoke reusable `CI` directly; every `main` push invokes `Publish npm Packages` as its sole verification and release orchestrator, without a parallel branch-push CI run and including successful no-op releases. Manual `CI` dispatch remains available for branch checks. Selected projects must declare valid stable versions. Actual release and registry-recovery candidates force complete verification with dependency caching disabled, then publish exact checksummed tarballs in dependency order. No-release main pushes use the affected CI policy described in [local development](local-development.md#affected-ci).

The trusted build compares its complete CLI closure with the reviewed downstream-consumer checksums in `consumers/SHA256SUMS`. A missing package, changed identity, or different tarball fails verification. Update that selection only after qualifying the changed artifacts and recording the consumer/source/profile evidence in the accompanying README. CI passes its own immutable public-package artifact, exact source commit and registry snapshot to the skill repository's pinned reusable release-candidate workflow. The existing manager matrix and generated launcher exercise those exact bytes without another pack step. These broad read-only consumer jobs run when CLI is selected under full priority and on every actual release verification. Essential uses compact packed runtime consumers; all lanes retain exact-artifact/source checks. Their failure blocks the final CI gate and the existing OIDC publisher.

Because npm releases are permanent, a Website UI release also requires the packages website's browser suite to pass against the candidate; the job runs in parallel with release verification, in the same Playwright image, and pull requests skip the suite.

Packages Pages runs after each successful `Publish npm Packages` run on `main` and builds that run's exact commit, so the versions it advertises are already published. It still checks every advertised exact package version through the release owner's bounded registry propagation checks before deployment. Each registry request has a 30-second timeout, which covers its retries of a transient registry failure, and the availability job has a ten-minute ceiling. A failed or cancelled publication deploys nothing; if npm remains unavailable, the existing site stays deployed until Pages is rerun for the same run. A newer deployment queues behind one in progress instead of cancelling it. This check uses fresh registry state rather than a build cache.

The reusable Linux job runs in the official Playwright image pinned to the `@playwright/test` version installed by the packages website. The image supplies Chromium and its operating-system dependencies instead of performing an unbounded browser or system-package installation, and the job explicitly binds `/ms-playwright` through Turbo's strict environment allowlist. Package integration and end-to-end tasks run serially because real tarball creation and isolated consumer installations are unreliable under shared-runner package-manager and filesystem concurrency, especially on Windows. CI trusts the container-mounted `GITHUB_WORKSPACE` Git path after checkout because it differs from the host path configured by the checkout action; macOS and Windows install only their matching Chromium binary.

## Release identity

| Project         | Package                    | Tag format                 |
| --------------- | -------------------------- | -------------------------- |
| `repository`    | `@moldea.ai/repository`    | `repository-v<version>`    |
| `repository-fs` | `@moldea.ai/repository-fs` | `repository-fs-v<version>` |
| `core`          | `@moldea.ai/core`          | `core-v<version>`          |
| `cli`           | `@moldea.ai/cli`           | `cli-v<version>`           |
| `website-ui`    | `@moldea.ai/website-ui`    | `website-ui-v<version>`    |

Packages follow their focused semantic-versioning contracts independently. A coordinated release may place multiple package tags on one commit without creating lockstep versioning. Workflow-created tags are annotated but not cryptographically signed; the repository stores no long-lived tag-signing key.

Daily Registry Canary checks essential live-registry consumers with reduced compatibility assurance. Request full live qualification explicitly before promoting the reviewed registry snapshot; daily success alone is insufficient.

## Repository setup

Create a GitHub environment named `npm-release`, restrict deployment to `main`, and configure each existing npm package with this trusted publisher:

- provider: GitHub Actions
- organization: `moldea-ai`
- repository: `packages`
- workflow filename: `publish.yml`
- environment: `npm-release`
- allowed action: `npm publish`

Publication uses npm OIDC without an npm token. Although publication jobs run through reusable `publish-package.yml`, npm validates the calling `publish.yml` identity. Both workflow boundaries grant OIDC permission while tag-writing and package-publishing permissions remain separate. After trusted publication succeeds, restrict traditional token publication and revoke any temporary automation token.

## Preparing a release

The [testing guide](testing.md) distinguishes local essential/full commands from existing CI release qualification. `pnpm test` now selects essential; `pnpm test:full` remains the complete explicit local suite. Actual releases force full priority within the existing granular CI boundary; non-release main verification uses essential. This adds no local-full attestation, semantic evidence or publication step and preserves the conditional parallel Website UI browser gate.

1. Audit the complete diff against its base commit using the release-relevance rules below. When both commits are available, run:

   ```bash
   pnpm release:check-changes <base-commit> <current-commit>
   ```

2. Give every selected existing public project a canonical stable manifest version greater than its base version. A newly introduced project with no base manifest may start at any canonical stable version.
3. Update directly affected compatible-major first-class dependency ranges and the lockfile. A compatible patch or minor does not force an otherwise unchanged downstream release; a breaking major requires downstream selection and verification.
4. Qualify changed CLI consumer artifacts and update the checksum selection with its evidence.
5. Synchronize directly affected package documentation, consumer verification evidence, release documentation, and version assertions.
6. Complete review and merge the release commit into `main`.

Release selection compares committed project inventories: pull requests use the target commit, and `main` uses the exact pushed commits. Production source, `README.md`, `LICENSE`, `package.json`, public exports, and declared package files are release-relevant. Documentation under `projects/<project>/docs/**` selects a package when either compared manifest includes it in the npm file inventory; documentation omitted by both manifests remains website-only. The selector follows each committed manifest's file inventory, including default npm inclusion and root-level patterns, from both compared manifests. Standardized `*.test-unit.*`, `*.test-integration.*`, `*.test-e2e.*`, `*.test-bench.*`, and colocated `*.test-fixtures.*` files do not select a package and must not enter production builds. A change containing excluded documentation or tests plus release-relevant files still selects the project.

The selector also compares private workspace package graphs from both commits. A release-relevant private package change selects each public package that directly or transitively consumes it through private `dependencies` or `devDependencies`. Propagation stops at the first public package, so a compatible Core change does not automatically select CLI. Reading both graphs catches moved, removed, or replaced private inputs. Public consumers removed from the current workspace are excluded; a current public consumer must still belong to the release inventory. Missing dependencies, duplicate package names, and private dependency cycles fail the check. Test-only files and nonshipped private documentation remain excluded. Shared implementation changes under `configs/vite/` or `configs/typescript/` select the public library-build consumers; config tests and prose do not. Every current public package uses those shared build inputs.

Pull-request CI rejects a selected existing project with an unchanged, lower, prerelease, or noncanonical version. A new project has no predecessor but still requires a canonical stable version. On `main`, the orchestrator also reads every public package's registry versions and selects any current repository version still absent from npm. An unchanged stable version missing after a failed or interrupted publication is a recovery candidate. Its latest published registry version becomes its predecessor, so safely skipped versions can recover while downgrades remain prohibited. A changed version already on npm retains its base-commit predecessor so release preparation still validates its tag identity.

Selected projects pass one repository, supported-Node, cross-platform, packed-artifact, checksum, and runtime verification boundary before tagging or publication. Publication order is Repository, Repository FS, Core, then CLI. Website UI is independent and may publish after shared verification without waiting for that chain. An unselected package is skipped without blocking later selected packages; a failed package blocks dependent downstream releases. Matching tags let a rerun or manual trusted dispatch resume without republishing completed versions.

Only stable semantic versions are supported. Prereleases and alternate npm distribution tags require a separately designed release path.

## First publication bootstrap

npm requires a package to exist before it can accept a trusted-publisher connection. For a new package name:

1. Manually dispatch `Publish npm Packages` from `main` for the selected project in `bootstrap` mode. It verifies the complete candidate, creates the annotated tag, and retains `public-package-tarballs` without publishing.
2. Download the artifact and verify `SHA256SUMS` from the repository root:

   ```bash
   pnpm release:checksums verify ./public-package-tarballs
   ```

3. Publish the selected tarball through an npm account protected by two-factor authentication:

   ```bash
   npm publish ./public-package-tarballs/moldea.ai-repository-1.0.0.tgz \
     --access public \
     --registry https://registry.npmjs.org/
   ```

4. Configure the npm trusted publisher using [Repository setup](#repository-setup), explicitly selecting `npm publish` as the allowed action. The npm CLI bundled with the pinned Node.js version cannot select that action, so setup uses npmjs.com.
5. Repeat in dependency order:
   1. `@moldea.ai/repository`
   2. `@moldea.ai/repository-fs`
   3. `@moldea.ai/core`
   4. `@moldea.ai/cli`
   5. `@moldea.ai/website-ui`

Repository FS and Core require a compatible Repository release. CLI requires Repository, Repository FS and Core versions satisfying its compatible-major ranges; composition reports exact resolved versions and rejects missing, additional, prerelease or breaking-major substitutions. Website UI may bootstrap independently after shared verification.

## Trusted publication

After trusted publishers are configured, merging a valid version-bumped package change into `main` verifies the candidate, creates or confirms its tag, and publishes only the selected tarball through OIDC with npm provenance. A later `main` push automatically retries any safe current version still missing from npm. Manual `trusted` mode remains available from `main` for explicit recovery of an unpublished version.

## Recovery

The workflow never deletes, overwrites, or moves a release tag.

| npm version | Tag state        | Workflow behavior                                      |
| ----------- | ---------------- | ------------------------------------------------------ |
| Absent      | Absent           | Create the tag, then bootstrap or publish.             |
| Absent      | Same commit      | Resume trusted publication without recreating the tag. |
| Present     | Same commit      | Report the release as complete without republishing.   |
| Present     | Absent           | Stop for manual reconciliation.                        |
| Either      | Different commit | Stop without changing the tag or registry.             |

Repository-wide release concurrency serializes automatic and manual workflows and uses GitHub's maximum pending queue. Cancellation is disabled, so newer pushes and dispatches neither interrupt an active sequence nor replace an earlier pending release.

Queue order is not an integrity assumption. Before publishing an unpublished automatic candidate, the workflow requires it to be greater than every version already in the registry, using the latest published version as its predecessor. A version already present still reaches preparation, where its tag must resolve to the candidate commit. An unexpectedly reordered run stops before tagging or publishing; rerun it after the earlier release completes, or let the next `main` push select the unpublished version again.

Dependency-ordered publication accounts for npm registry propagation. Preparation reads each internal dependency's metadata immediately and, when a newly published requirement is not visible, again every five seconds within a bounded two-minute window. It continues as soon as the dependency range is satisfied. If the registry still lacks the dependency, the dependent package stops without tagging or publication and resumes through the same idempotent next-push or manual recovery path.

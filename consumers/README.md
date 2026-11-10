# Consumer conformance artifacts

The `consumer-conformance` CI lane gives the skill manager and closed launcher the exact checksummed CLI closure built by packages CI. `SHA256SUMS` is the reviewed selection; changed bytes require fresh consumer verification before updating it.

## Recorded verification

The selected closure contains CLI `13.0.3`, Core `9.1.1`, Repository `4.0.1`, and Repository FS `4.0.1`. Core tolerates cosmetic managed-block formatting while preserving instruction and marker integrity checks. CLI requires Core `^9.1.1`; the other two tarballs retain their qualified bytes.

Local qualification used Node `24.15.0` and pnpm `11.9.0`, starting from the reconciled main/development commit `2dd89160904396555c1995421d13ad20a1f871ba` with the formatting-tolerance patch. `pnpm test` passed essential root/package unit, integration, and installed-CLI coverage (1,987 passed, 47 intentionally omitted by suite/platform selections), including reused valid Turbo results. Complete Core integration coverage passed 303 tests, including all eight artifact/public-API cases. Focused parser and CLI composition/execution coverage passed 39 and 34 tests respectively; CLI integration passed all 75 cases. All 11 complete installed CLI cases passed without retries, including ignored AGENTS EOF and combined cosmetic formatting with unchanged file bytes and Git state. Core/CLI typechecking, lint, public-package builds, documentation checks and touched-file formatting passed. No semantic evaluation, provider journey or complete website browser suite ran.

`SHA256SUMS` records the freshly packed CLI/Core candidates from this combined source. The five-package artifact inventory and four-package consumer selection are verified through the release checksum tooling. Trusted CI must reproduce these bytes and qualify its selected native/packed-consumer lanes before publication; local Linux checks do not establish those results. The trusted artifact records its exact candidate commit in `packages-commit.txt`.

## Prior Core 9.1.0 qualification

The selected closure contains CLI `13.0.2`, Core `9.1.0`, Repository `4.0.1`, and Repository FS `4.0.1`; CLI and Repository FS require Node.js `>=22.17.0`. Core's minor release adds the optional per-call `maxConcurrentInspections` admission ceiling over a shared process counter, retaining the default of one inspection. The other three consumer tarballs retain their previously qualified bytes. Runtime dependencies remain jg-utilities `1.7.2` and jg-exception `1.7.1` in all four, with jg-process `1.6.2` and jg-git-commands `0.4.0` in CLI.

Local qualification used Node `24.15.0` and pnpm `11.9.0`, starting from `7827e0e12efb671a236df25f6b17a0c660253389` with the Core `9.1.0` task changes. `pnpm test` passed essential unit, integration, and installed-CLI coverage (1,957 passed, 47 intentionally omitted by the suite/platform selections), including reused valid Turbo results. Complete focused client coverage passed 20 unit and 31 integration tests; the 13 new admission scenarios also passed three consecutive retry-free runs. The packed Core artifact/public-API tests and CLI installed-version tests passed. A fixed-snapshot comparison against Core `9.0.1` preserved the exact serialized default inspection metadata and pages. Core typechecking, affected lint and formatting checks, the public-package build, and `pnpm docs:check` passed. This run did not execute the full local browser suite.

The CI pack commands produced `moldea.ai-core-9.1.0.tgz`; its generated digest is recorded in `SHA256SUMS`. Local checksum and consumer-selection verification passed. Fresh trusted CI qualification for this selection remains required; local Linux results do not establish the consumer matrix or publication. The pull request's pack job compares CI's own tarballs with this selection before any consumer lane runs, and the trusted artifact records the exact final candidate commit.

Consumer tooling uses released Skill `10.0.0`, pinned to commit `950b89eb4c41564953fa1582fdd588992e152d37`. Fresh-client consumer conformance for these exact bytes runs in the trusted packages CI consumer lane; local Linux checks do not replace it.

The trusted workflow records its exact candidate commit in `public-package-tarballs/packages-commit.txt`. Publication requires fresh qualification through all 15 package-manager consumer profiles, 15 CLI runtime cases across Linux/macOS/Windows, five Repository FS runtime cases, the existing-Vitest consumer check, both cross-platform correctness suites, and the final repository gate. Local Linux checks do not establish the other matrix results.

Trusted packages CI must reproduce every selected tarball byte before publication. It supplies its immutable public-package artifact and exact source commit to the skill workflow without repacking. The skill workflow verifies repository-local installation, lifecycle suppression, closed-launcher composition/validation/inspection, broken-installation recovery, interrupted installation, and preservation of project files and the locked dependency graph during same-target recovery. These checks establish deterministic tooling mechanics, not runtime wiring or model-based repair effectiveness. Website UI is checked in the public artifact and has its own website verification; it remains outside the CLI consumer closure.

## Refreshing the selection

Any changed consumer artifact invalidates this selection. Verify the new exact bytes through the candidate workflow, update the checksums and their source evidence together, and let trusted CI compare them again. Never replace an already published version or move its release tag.

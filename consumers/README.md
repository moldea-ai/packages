# Consumer conformance artifacts

The `consumer-conformance` CI lane gives the skill manager and closed launcher the exact checksummed CLI closure built by packages CI. `SHA256SUMS` is the reviewed selection; changed bytes require fresh consumer verification before updating it.

## Recorded verification

The selected closure contains CLI `11.1.0`, Core `7.1.0`, Repository `2.1.0`, and Repository FS `2.1.0`; CLI and Repository FS require Node.js `>=22.17.0`. Qualification started from `338d13ddf598a87984e7bc227b036811bc95b9d8` using Node `24.15.0` and pnpm `11.9.0`. Tarballs packed locally and by the skill `8.2.8` candidate workflow from that commit match byte for byte. Local checksum verification, Repository FS runtime checks, CLI runtime checks, and the existing-Vitest `3.2.4` check passed on Linux with Node `24.15.0` under the reviewed registry snapshot. The installed CLI regressions also verify linked and Git-ignored coding-agent instruction files, including the isolation of ignored files from the project inventory.

The local correctness run passed its unit, integration and installed-CLI suites, together with the lint, typecheck, build, documentation and website checks.

Consumer tooling uses released Skill `8.3.0`, pinned to commit `3707f1bb3c7b6d43c7a7825c5c9c87fd8da97078`. Fresh-client consumer conformance for these exact bytes runs in the trusted packages CI consumer lane; local Linux checks do not replace it.

The trusted workflow records its exact candidate commit in `public-package-tarballs/packages-commit.txt`. Publication requires fresh qualification through all 15 package-manager consumer profiles, 15 CLI runtime cases across Linux/macOS/Windows, five Repository FS runtime cases, four Repository testing-peer profiles, the existing-Vitest consumer check, both cross-platform correctness suites, and the final repository gate. Local Linux checks do not establish the other matrix results.

Trusted packages CI must reproduce every selected tarball byte before publication. It supplies its immutable public-package artifact and exact source commit to the skill workflow without repacking. The skill workflow verifies repository-local installation, lifecycle suppression, closed-launcher composition/validation/inspection, broken-installation recovery, interrupted installation, and preservation of project files and the locked dependency graph during same-target recovery. These checks establish deterministic tooling mechanics, not runtime wiring or model-based repair effectiveness. Website UI is checked in the public artifact and has its own website verification; it remains outside the CLI consumer closure.

## Refreshing the selection

Any changed consumer artifact invalidates this selection. Verify the new exact bytes through the candidate workflow, update the checksums and their source evidence together, and let trusted CI compare them again. Never replace an already published version or move its release tag.

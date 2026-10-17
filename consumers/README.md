# Consumer conformance artifacts

The `consumer-conformance` CI lane gives the skill manager and closed launcher the exact checksummed CLI closure built by packages CI. `SHA256SUMS` is the reviewed selection; changed bytes require fresh consumer verification before updating it.

## Recorded verification

The selected closure contains CLI `11.0.6`, Core `7.0.4`, Repository `2.0.2`, and Repository FS `2.0.7`; CLI and Repository FS require Node.js `>=22.17.0`. Qualification started from `e9ba5c974a11e1116963af0792091a8cfac85e17` using Node `24.15.0` and pnpm `11.9.0`. The built Core and Repository tarballs match the retained selection byte for byte. Local checksum verification, Repository FS runtime checks, and CLI runtime checks passed on Linux with Node `24.15.0` under the reviewed registry snapshot. The installed CLI regressions also verify that invalid external paths are omitted while invalid canonical paths still fail.

The local correctness run passed its unit, integration and installed-CLI suites. Six existing runtimes-page browser variants timed out during the concurrent run; all six passed unchanged in isolation with one worker. These were recorded as environmental timeouts, not product regressions.

Consumer tooling uses released Skill `8.2.2`, pinned to commit `eef10915257084bf3477cc232c5aa4ecfca76e04`. Fresh-client consumer conformance for these exact bytes runs in the trusted packages CI consumer lane; local Linux checks do not replace it.

The trusted workflow records its exact candidate commit in `public-package-tarballs/packages-commit.txt`. Publication requires fresh qualification through all 14 package-manager consumer profiles, 15 CLI runtime cases across Linux/macOS/Windows, five Repository FS runtime cases, four Repository testing-peer profiles, the existing-Vitest consumer check, both cross-platform correctness suites, and the final repository gate. Local Linux checks do not establish the other matrix results.

Trusted packages CI must reproduce every selected tarball byte before publication. It supplies its immutable public-package artifact and exact source commit to the skill workflow without repacking. The skill workflow verifies repository-local installation, lifecycle suppression, closed-launcher composition/validation/inspection, broken-installation recovery, interrupted installation, and preservation of project files and the locked dependency graph during same-target recovery. These checks establish deterministic tooling mechanics, not runtime wiring or model-based repair effectiveness. Website UI is checked in the public artifact and has its own website verification; it remains outside the CLI consumer closure.

## Refreshing the selection

Any changed consumer artifact invalidates this selection. Verify the new exact bytes through the candidate workflow, update the checksums and their source evidence together, and let trusted CI compare them again. Never replace an already published version or move its release tag.

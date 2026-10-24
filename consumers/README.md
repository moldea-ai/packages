# Consumer conformance artifacts

The `consumer-conformance` CI lane gives the skill manager and closed launcher the exact checksummed CLI closure built by packages CI. `SHA256SUMS` is the reviewed selection; changed bytes require fresh consumer verification before updating it.

## Recorded verification

The selected closure contains CLI `13.0.2`, Core `9.0.1`, Repository `4.0.1`, and Repository FS `4.0.1`; CLI and Repository FS require Node.js `>=22.17.0`. These patch releases move the packages to the latest JG packages, jg-utilities `1.7.2` and jg-exception `1.7.1` in all four and jg-process `1.6.2` and jg-git-commands `0.4.0` in CLI, without changing package source. Qualification started from `ac50f89d00977841170337d77501dc25d5870db1` using Node `24.15.0` and pnpm `11.9.0`. Tarballs packed locally with the CI pack commands are byte-identical across a forced clean rebuild, and local checksum and consumer-selection verification passed. The pull request's pack job compares CI's own tarballs with this selection before any consumer lane runs. The installed CLI regressions also verify that every Git read runs through jg-git-commands, with Git `2.32` as the minimum.

The local correctness run passed its unit, integration and end-to-end suites, including the installed-CLI suite and the packages website browser suite, together with the lint, typecheck, build, documentation and website checks.

Consumer tooling uses released Skill `10.0.0`, pinned to commit `950b89eb4c41564953fa1582fdd588992e152d37`. Fresh-client consumer conformance for these exact bytes runs in the trusted packages CI consumer lane; local Linux checks do not replace it.

The trusted workflow records its exact candidate commit in `public-package-tarballs/packages-commit.txt`. Publication requires fresh qualification through all 15 package-manager consumer profiles, 15 CLI runtime cases across Linux/macOS/Windows, five Repository FS runtime cases, the existing-Vitest consumer check, both cross-platform correctness suites, and the final repository gate. Local Linux checks do not establish the other matrix results.

Trusted packages CI must reproduce every selected tarball byte before publication. It supplies its immutable public-package artifact and exact source commit to the skill workflow without repacking. The skill workflow verifies repository-local installation, lifecycle suppression, closed-launcher composition/validation/inspection, broken-installation recovery, interrupted installation, and preservation of project files and the locked dependency graph during same-target recovery. These checks establish deterministic tooling mechanics, not runtime wiring or model-based repair effectiveness. Website UI is checked in the public artifact and has its own website verification; it remains outside the CLI consumer closure.

## Refreshing the selection

Any changed consumer artifact invalidates this selection. Verify the new exact bytes through the candidate workflow, update the checksums and their source evidence together, and let trusted CI compare them again. Never replace an already published version or move its release tag.

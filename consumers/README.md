# Consumer conformance artifacts

The `consumer-conformance` CI lane gives the skill manager and closed launcher the exact checksummed CLI closure built by packages CI. `SHA256SUMS` is the reviewed selection; changed bytes require fresh consumer verification before updating it.

## Recorded verification

The selected closure contains CLI `11.0.4`, Core `7.0.4`, Repository `2.0.2`, and Repository FS `2.0.5`. Packages commit `8f6cf4e0d4773461a36866ac7585102f18635e35` reproduced all five qualified tarballs and their complete checksum manifest byte for byte using Node `24.15.0` and pnpm `11.9.0`. Local checksum verification, Repository FS runtime checks, CLI runtime checks, and fresh-client consumer conformance passed on Linux with Node `24.15.0`. The consumer profiles used npm `11.12.1` and pnpm `12.4.0`, including an existing root Vitest `3.2.4` for pnpm.

Local consumer tooling was pinned to skill commit `b62013c8797247cbde21dccf517f722d0e412b0d`. Skill candidate `8.1.0` was also prepared and installed with CLI `11.0.4` and Website UI `3.2.0` from the complete five-package public artifact. The ordinary updater preserves compatible transitive versions; the fresh-client conformance and packed runtime checks separately exercised the exact selected four-package closure.

The trusted workflow records its exact candidate commit in `public-package-tarballs/packages-commit.txt`. Publication requires fresh qualification through all 14 package-manager consumer profiles, 15 CLI runtime cases across Linux/macOS/Windows, five Repository FS runtime cases, four Repository testing-peer profiles, the existing-Vitest consumer check, both cross-platform correctness suites, and the final repository gate. Local Linux checks do not establish the other matrix results.

Trusted packages CI must reproduce every selected tarball byte before publication. It supplies its immutable public-package artifact and exact source commit to the skill workflow without repacking. The skill workflow verifies repository-local installation, lifecycle suppression, closed-launcher composition/validation/inspection, broken-installation recovery, interrupted installation, and preservation of project files and the locked dependency graph during same-target recovery. These checks establish deterministic tooling mechanics, not runtime wiring or model-based repair effectiveness. Website UI is checked in the public artifact and has its own website verification; it remains outside the CLI consumer closure.

## Refreshing the selection

Any changed consumer artifact invalidates this selection. Verify the new exact bytes through the candidate workflow, update the checksums and their source evidence together, and let trusted CI compare them again. Never replace an already published version or move its release tag.

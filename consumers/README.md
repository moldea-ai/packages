# Consumer conformance artifacts

The `consumer-conformance` CI lane gives the skill manager and closed launcher the exact checksummed CLI closure built by packages CI. `SHA256SUMS` is the reviewed selection; changed bytes require fresh consumer verification before updating it.

## Recorded verification

The selected closure contains CLI `11.0.3`, Core `7.0.3`, Repository `2.0.2`, and Repository FS `2.0.5`. The tarballs were packed from packages commit `f71955169e64871f5073ac03b1b3503f407f15a2` using Node `24.15.0` and pnpm `11.9.0`. Local checksum verification, Repository FS runtime checks, CLI runtime checks, and fresh-client consumer conformance passed on Linux with Node `24.15.0`. The consumer profiles used npm `11.12.1` and pnpm `12.4.0`, including an existing root Vitest `3.2.4` for pnpm.

Local consumer tooling was pinned to skill commit `68816e34c96939280983b2fcb1b9a37da3ed7649`. Skill candidate `8.1.0` was also prepared and installed with CLI `11.0.3` and Website UI `3.1.1` from the complete five-package public artifact. Its ordinary updater preserved older compatible transitive versions in the candidate's root lockfile; the fresh-client conformance and packed runtime checks separately exercised the exact selected four-package closure.

Read-only development [Packages CI run `38332159062`](https://github.com/moldea-ai/packages/actions/runs/38332159062) passed for commit `fbaf4f9a595c9b89f5631b2fd517ce4207388e19`, using Node `24.15.0`, pnpm `11.9.0`, and the skill reusable workflow pinned to `b62013c8797247cbde21dccf517f722d0e412b0d`. Its `public-package-tarballs` artifact (`11784050100`) reproduced all five locally packed tarballs and the complete checksum manifest byte for byte. All 14 package-manager consumer profiles, 15 CLI runtime cases across Linux/macOS/Windows, five Repository FS runtime cases, four Repository testing-peer profiles, the existing-Vitest consumer check, both cross-platform correctness suites, and the final repository gate passed. This CI source adds only consumer selection and evidence to the packed-input commit. Publication still requires the existing workflow's fresh release verification.

Trusted packages CI must reproduce every selected tarball byte before publication. It supplies its immutable public-package artifact and exact source commit to the skill workflow without repacking. The skill workflow verifies repository-local installation, lifecycle suppression, closed-launcher composition/validation/inspection, broken-installation recovery, interrupted installation, and preservation of project files and the locked dependency graph during same-target recovery. These checks establish deterministic tooling mechanics, not runtime wiring or model-based repair effectiveness. Website UI is checked in the public artifact and has its own website verification; it remains outside the CLI consumer closure.

## Refreshing the selection

Any changed consumer artifact invalidates this selection. Verify the new exact bytes through the candidate workflow, update the checksums and their source evidence together, and let trusted CI compare them again. Never replace an already published version or move its release tag.

# Consumer conformance artifacts

The `consumer-conformance` CI lane gives the skill manager and closed launcher the exact checksummed CLI closure built by packages CI. `SHA256SUMS` is the reviewed selection; changed bytes require fresh consumer verification before updating it.

## Recorded verification

The selected closure contains CLI `11.0.1`, Core `7.0.1`, Repository `2.0.1`, and Repository FS `2.0.4`. The tarballs came from packages commit `44fe81ac3e84356185c0ac477668d30cab1d3966` and the [release-candidate workflow run 38199585200](https://github.com/moldea-ai/skill/actions/runs/38199585200). The workflow used skill tooling commit `17f80e780c05d18ad6726235e33e87d6a2436acd`, prepared skill `8.0.1` with CLI 11/Core 7, and passed all fourteen manager selections. Its producer used Node `24.15.0` and pnpm `11.9.0`.

| Manager | Verified selections                                                                        |
| ------- | ------------------------------------------------------------------------------------------ |
| npm     | `7.0.0`, `8.0.0`, `9.0.0`, `10.0.0`, `11.0.0`, `12.0.2`                                    |
| pnpm    | `8.3.1`, `9.0.0`, `10.0.0`, `11.0.0`, `12.3.1`, and `11.21.0` with existing Vitest `3.2.4` |
| Yarn    | `4.14.1`, `4.18.0`                                                                         |

These checks exercise repository-local installation, lifecycle suppression, closed-launcher composition/validation/inspection, broken-installation recovery, interrupted installation, and preservation of project files and the locked dependency graph during same-target recovery. They establish deterministic tooling mechanics, not runtime wiring or model-based repair effectiveness.

Trusted packages CI must reproduce every selected tarball byte before publication. It supplies its immutable public-package artifact and exact source commit to the skill workflow pinned above, without repacking. Website UI is checked in that public artifact and has its own website verification; it remains outside the CLI consumer closure.

## Refreshing the selection

Any changed consumer artifact invalidates this selection. Verify the new exact bytes through the candidate workflow, update the checksums and their source evidence together, and let trusted CI compare them again. Never replace an already published version or move its release tag.

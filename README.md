# packages

This repository develops the open-source `moldea` packages, private shared implementations, conformance fixtures, compatibility data, and packages website. The separate [`platform`](https://github.com/moldea-ai/platform) repository owns hosted applications, APIs, and infrastructure.

## Getting started

Development requires Node.js `24.15.0` or newer within Node.js 24 and pnpm `11.9.0`.

```bash
pnpm install
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```

See [local development](docs/local-development.md) for focused commands, build and test conventions, and consumer-runtime verification.

## Project blueprint

| Path                                                                   | Responsibility                                                                                |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [`projects/`](projects/)                                               | Public package projects and their own documentation                                           |
| [`packages/`](packages/)                                               | Private shared implementation packages                                                        |
| [`apps/`](apps/)                                                       | Private applications, including the packages website                                          |
| [`specifications/`](specifications/)                                   | Public cross-package contracts                                                                |
| [`compatibility/`](compatibility/)                                     | Canonical technical runtime compatibility data and qualified downstream-consumer checksums    |
| [`fixtures/`](fixtures/)                                               | Shared conformance fixtures                                                                   |
| [`configs/`](configs/), [`scripts/`](scripts/), [`.github/`](.github/) | Workspace configuration and automation                                                        |
| [`docs/`](docs/)                                                       | Concise, quickly scannable documentation of essential, durable project concepts and processes |
| [`project-specification/`](project-specification/project.md)           | Read-only development reference to canonical specifications in `../platform/moldea`           |

API and HTTP endpoint documentation belongs in the owning project's established location outside `/docs`. The [detailed blueprint](docs/project-blueprint.md) explains package ownership, dependency direction, the catalog, and documentation sources of truth.

## Authoritative project specifications

The sibling `platform` repository owns the canonical `moldea` product and package specifications. The root `project-specification` symlink targets `../platform/moldea`. Before work that requires those specifications, read the [project foundation](project-specification/project.md), then only the relevant focused context. Start with the [packages specification](project-specification/context/packages.md) and the affected package's focused specification; the [detailed blueprint](docs/project-blueprint.md) routes package contracts and ownership.

Specifications define intended product requirements and design constraints. This repository owns the [public Repository Format](specifications/repository-format.md), package implementations, tests, public documentation, compatibility sources, and releases. The platform's Repository Format copy is a synchronized integration reference. Specifications alone do not establish shipped behavior or availability. Report conflicts or version drift and establish the affected authority before changing a contract; do not silently regress supported behavior to match an older specification.

This reference is read-only by workflow, not filesystem permissions. Never create, modify, move, or delete files through `project-specification/`. Changes to its authority require separate authorization in the owning platform checkout. A working native symlink and adjacent platform checkout are required to use the reference. If required specifications are missing, inaccessible, or the checkout contains a link-text file instead of a symlink, report the problem and stop the specification-dependent work. Do not copy specifications here or change host settings as a fallback.

The reference is for repository development only. Builds, tests, CI, and package consumers remain independent of the sibling checkout. The link and its target must not be bundled into npm artifacts or published as package documentation.

## Documentation

- [Repository Format version `1` specification](specifications/repository-format.md): the public format contract; `@moldea.ai/core` is its executable reference implementation.
- [Local development](docs/local-development.md): commands, builds, tests, and packed-consumer checks.
- [npm releases](docs/npm-releases.md): version selection, preparation, publication, and recovery.
- [Launch readiness](docs/launch-readiness.md): milestone verification, resource calibration, package audits, and final release gates.
- [Runtime compatibility](docs/runtime-compatibility.md): generated presentation of [`compatibility/runtimes.yaml`](compatibility/runtimes.yaml).
- [Packages website](apps/website/README.md): website source model, verification, and deployment.
- `projects/<project>/README.md` and `projects/<project>/docs/**`: public package behavior and API documentation.

When changing a package or compatibility claim, synchronize affected contracts and presentations, then apply the [release relevance rules](docs/npm-releases.md#preparing-a-release) to affected public package versions.

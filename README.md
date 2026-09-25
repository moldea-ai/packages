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
| [`compatibility/`](compatibility/)                                     | Canonical technical runtime compatibility data                                                |
| [`fixtures/`](fixtures/)                                               | Shared conformance fixtures                                                                   |
| [`configs/`](configs/), [`scripts/`](scripts/), [`.github/`](.github/) | Workspace configuration and automation                                                        |
| [`docs/`](docs/)                                                       | Concise, quickly scannable documentation of essential, durable project concepts and processes |

API and HTTP endpoint documentation belongs in the owning project's established location outside `/docs`. The [detailed blueprint](docs/project-blueprint.md) explains package ownership, dependency direction, the catalog, and documentation sources of truth.

## Documentation

- [Repository Format version `1` specification](specifications/repository-format.md): the public format contract; `@moldea.ai/core` is its executable reference implementation.
- [Local development](docs/local-development.md): commands, builds, tests, and packed-consumer checks.
- [npm releases](docs/npm-releases.md): version selection, preparation, publication, and recovery.
- [Runtime compatibility](docs/runtime-compatibility.md): generated presentation of [`compatibility/runtimes.yaml`](compatibility/runtimes.yaml).
- [Packages website](apps/website/README.md): website source model, verification, and deployment.
- `projects/<project>/README.md` and `projects/<project>/docs/**`: public package behavior and API documentation.

When changing a package or compatibility claim, synchronize affected contracts and presentations, then apply the [release relevance rules](docs/npm-releases.md#preparing-a-release) to affected public package versions.

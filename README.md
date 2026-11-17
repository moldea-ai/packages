# packages

This repository develops the open-source `moldea` packages, private shared implementations, conformance fixtures, consumer checksums, and packages website. The separate [`platform`](https://github.com/moldea-ai/platform) repository owns hosted applications, APIs, and infrastructure.

## Project blueprint

| Task                                                                                       | Documentation                                                                                                                         |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Understand implemented ownership, dependency direction and intended product specifications | [Detailed blueprint](docs/project-blueprint.md), including the read-only sibling specification boundary and public package catalogue. |
| Set up, build or run focused commands                                                      | [Local development](docs/local-development.md), covering setup, workspace tasks and packed-consumer verification.                     |
| Choose verification                                                                        | [Testing](docs/testing.md), with essential/full classification, affected-consumer coverage and full-run cadence.                      |
| Read the public format contract                                                            | [Repository Format](specifications/repository-format.md); Core supplies its executable reference implementation.                      |
| Inspect a package's public behavior or API                                                 | Its README and docs under [projects/](projects/), with public contracts kept outside workspace docs.                                  |
| Prepare, publish or recover a package release                                              | [npm releases](docs/npm-releases.md), including version relevance and exact-source qualification.                                     |
| Work on the documentation website                                                          | [Packages website](apps/website/README.md), with source discovery, verification and deployment.                                       |
| Integrate reviewed changes                                                                 | [Delivery](docs/delivery.md), defining ordered stops, operators and evidence.                                                         |

| Path                                 | Responsibility                                                          |
| ------------------------------------ | ----------------------------------------------------------------------- |
| [`projects/`](projects/)             | Public package projects and their own documentation                     |
| [`packages/`](packages/)             | Private shared implementation packages                                  |
| [`apps/`](apps/)                     | Private applications, including the packages website                    |
| [`specifications/`](specifications/) | Public cross-package contracts                                          |
| [`consumers/`](consumers/)           | Qualified downstream-consumer checksums and their verification evidence |

`docs/` holds concise durable workspace guidance. API and HTTP endpoint references remain with their owning projects. Intended product requirements, implemented contracts and published availability have distinct owners, described in the detailed blueprint.

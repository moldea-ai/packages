# Project blueprint

This blueprint records implemented repository state. The [Repository Format specification](../specifications/repository-format.md) defines the public format. The sibling platform repository owns the product and focused package design specifications; package implementations and tests establish shipped behavior.

`/docs` is reserved for concise, quickly scannable documentation of essential, durable project concepts and processes. API and HTTP endpoint documentation stays in the owning project's established location outside `/docs`.

## Ownership and dependencies

Every immediate child of [`projects/`](../projects/) is a first-class package with a stable responsibility and identity. Children of [`packages/`](../packages/) are private shared implementations; children of [`apps/`](../apps/) are private applications. Applications may consume projects and internal packages, while projects and internal packages never depend on applications.

An arrow means that the package on the left depends on the package on the right:

```text
repository-fs       → repository
core                → repository
cli                 → repository + repository-fs + core
packages-website    → website-ui + core + repository + repository-fs + cli
                     (deterministic packages are build-time dependencies)
```

Shared internal packages may support first-class projects but never depend on them. Dependencies remain explicit and acyclic. Published packages bundle private implementations or otherwise prevent private imports and declarations from leaking into consumer artifacts.

## Package catalog

| Project         | Package                    | Distribution | Specification                                                                                                    |
| --------------- | -------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------- |
| `repository`    | `@moldea.ai/repository`    | Public       | [Repository package](https://github.com/moldea-ai/platform/blob/main/moldea/context/repository-package.md)       |
| `repository-fs` | `@moldea.ai/repository-fs` | Public       | [Repository FS package](https://github.com/moldea-ai/platform/blob/main/moldea/context/repository-fs-package.md) |
| `core`          | `@moldea.ai/core`          | Public       | [Core package](https://github.com/moldea-ai/platform/blob/main/moldea/context/core-package.md)                   |
| `cli`           | `@moldea.ai/cli`           | Public       | [CLI package](https://github.com/moldea-ai/platform/blob/main/moldea/context/cli-package.md)                     |
| `website-ui`    | `@moldea.ai/website-ui`    | Public       | [Central package architecture](https://github.com/moldea-ai/platform/blob/main/moldea/context/packages.md)       |

The catalog records the five public packages. Core checks the repository format, declared files, and supported export syntax. Website UI owns the SDK catalog.

`scripts/workspace-graph/` owns exact-commit manifest discovery and shared dependency facts. `scripts/npm-release/` retains release relevance and private-input propagation policy. `scripts/ci/` owns conservative affected selection independently of essential/full priority, validated execution plans and compact/full consumer matrices, task isolation, and the final job gate. CI follows all downstream consumers; npm release selection stops private-input propagation at public package boundaries. See [affected CI](local-development.md#affected-ci).

## Boundaries and sources of truth

- **Repository reading:** `@moldea.ai/repository` defines source-neutral logical paths, bounded pages and ranges, deterministic comparisons, snapshot identities, and the reader contract. Its memory reader backs shared conformance tests. `@moldea.ai/repository-fs` supplies lazy, resource-limited local access without an eager repository-wide content inventory.
- **Public website presentation** owns shared tokens, Astro components, and the SDK catalog with its static logo assets.
- **Format interpretation:** Core validates canonical structure, declared file references and supported runtime exports. It owns paged binding coverage, diagnostics with severity and group, accepted warnings, coding-agent integration checks, and manifest-only changed-path matching. Errors invalidate a project; warnings and accepted warnings remain visible without changing validity.

## Documentation ownership

| Concern           | Editable authority                                                              | Derived presentation                                             |
| ----------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Repository Format | [`specifications/repository-format.md`](../specifications/repository-format.md) | Public specification page and schema-derived website artifacts   |
| Package behavior  | Project implementation, specification, README, and `docs/**`                    | Generated API reference, routes, search, sitemap, and `llms.txt` |

Each implemented public project owns its documentation under `projects/<project>/docs/**`; its README is the GitHub and npm entry point. Website UI retains repository documentation but is absent from the visitor-facing packages website. Generated files must be changed through their canonical source and documented generator.

For build and test conventions, see [local development](local-development.md). [Testing](testing.md) owns essential/full classification and cadence; `scripts/test-suite/` implements private local suite selection and execution. For packages website ownership and deployment, see its [application README](../apps/website/README.md). For version selection and publication, see [npm releases](npm-releases.md).

When a package contract changes, reconsider every affected representation and synchronize only those that changed: implementation, exports, manifest, specification, README, package docs, examples, tests, generated presentations, website routes, and version assertions. Apply the [release relevance rules](npm-releases.md#preparing-a-release) to the complete diff, including affected public package versions and compatible-major workspace dependencies; run `pnpm release:check-changes <base-commit> <current-commit>` when both commits are available.

## Authoritative project specifications

The sibling `platform` repository owns the canonical `moldea` product and package specifications. The root `project-specification` symlink targets `../platform/moldea`. Before work that requires those specifications, read the [project foundation](../project-specification/project.md), then only the relevant focused context. Start with the [packages specification](../project-specification/context/packages.md) and the affected package's focused specification; the package catalogue above routes package contracts and ownership.

Specifications define intended product requirements and design constraints. This repository owns the [public Repository Format](../specifications/repository-format.md), package implementations, tests, public documentation, consumer verification, and releases. The platform's Repository Format copy is a synchronized integration reference. Specifications alone do not establish shipped behavior or availability. Report conflicts or version drift and establish the affected authority before changing a contract; do not silently regress supported behavior to match an older specification.

This reference is read-only by workflow, not filesystem permissions. Never create, modify, move, or delete files through `project-specification/`. Changes to its authority require separate authorization in the owning platform checkout. A working native symlink and adjacent platform checkout are required to use the reference. If required specifications are missing, inaccessible, or the checkout contains a link-text file instead of a symlink, report the problem and stop the specification-dependent work. Do not copy specifications here or change host settings as a fallback.

The reference is for repository development only. Builds, tests, CI, and package consumers remain independent of the sibling checkout. The link and its target must not be bundled into npm artifacts or published as package documentation.

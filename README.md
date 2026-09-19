# packages

The `packages` repository develops the open-source package products, shared internal packages, private applications, compatibility data, conformance fixtures, documentation, and generation tooling for the deterministic `moldea` repository-reading and repository-format ecosystem.

It is intentionally separate from the hosted [`platform`](https://github.com/moldea-ai/platform) monorepo. This repository owns reusable packages and their development infrastructure, not Cloud applications, hosted APIs, runtime infrastructure, or deployment configuration.

## Documentation

### Specifications

The official [Repository Format version `1` specification](specifications/repository-format.md) is maintained here and published at [`https://packages.moldea.ai/repository-format/`](https://packages.moldea.ai/repository-format/). It defines canonical files, manifest properties, deterministic validation, semantic evaluation boundaries, and conformance; `@moldea.ai/core` is its executable reference implementation.

The sibling `platform` repository owns the central [`moldea` packages specification](https://github.com/moldea-ai/platform/blob/main/moldea/context/packages.md), focused package specifications, the [Runtime Adapter Contract](https://github.com/moldea-ai/platform/blob/main/moldea/context/runtime-adapter-contract.md), and the [Runtime Compatibility Matrix](https://github.com/moldea-ai/platform/blob/main/moldea/context/runtime-compatibility-matrix.md). The [package catalog](#package-catalog) links each focused specification directly.

Specifications remain the design authority; this blueprint records implemented repository state. Published compatibility presentations derive from the canonical technical matrix and website maturity source and remain subject to their package and conformance requirements.

| Need                                                  | Authority                                                                                                                               |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Local setup, commands, builds, and tests              | [Local development](docs/local-development.md)                                                                                          |
| npm selection, preparation, publication, and recovery | [npm releases](docs/npm-releases.md)                                                                                                    |
| Public package behavior                               | `projects/<project>/README.md` and `projects/<project>/docs/**`                                                                         |
| Technical runtime compatibility                       | [`compatibility/runtimes.yaml`](compatibility/runtimes.yaml) and generated [compatibility documentation](docs/runtime-compatibility.md) |
| Packages website source model and deployment          | [Packages website](apps/website/README.md)                                                                                              |

## Getting started

### Requirements

- Node.js `24.15.0` or newer within Node.js 24
- pnpm `11.9.0`

Development-tool requirements are separate from consumer runtime guarantees, which remain package-specific. Environment-neutral packages must not import Node.js modules or inherit Node globals.

Install the pinned workspace dependencies:

```bash
pnpm install
```

Run the complete repository verification workflow:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```

Use `pnpm compatibility:check` for runtime-matrix synchronization and `pnpm website:check` for the complete packages-website boundary. [Local development](docs/local-development.md) lists focused commands and owns the detailed build and test conventions.

| Workflow                                | Command                                                      |
| --------------------------------------- | ------------------------------------------------------------ |
| Complete correctness suite              | `pnpm test`                                                  |
| Root configuration tests                | `pnpm test:root`                                             |
| Compatibility generation and validation | `pnpm compatibility:generate` and `pnpm compatibility:check` |
| Package-documentation validation        | `pnpm docs:check`                                            |
| Local packages website                  | `pnpm website:dev`                                           |

## Project blueprint

### Project structure

```text
.github/       verification, npm publication, and GitHub Pages workflows
apps/          private applications built from or around the package ecosystem
compatibility/ canonical technical runtime compatibility data
configs/       shared TypeScript, Vite, Vitest, and documentation configuration
docs/          concise durable project concepts, processes, and generated presentations
fixtures/      repository-wide conformance fixtures
packages/      private shared implementation packages
projects/      independently meaningful first-class package projects
scripts/       compatibility, documentation, and release automation
specifications/ public cross-package contracts owned by this repository
```

Every immediate child of [`projects/`](projects/) is a first-class package with a stable responsibility and package identity. Every immediate child of [`packages/`](packages/) is a private shared implementation package. Every immediate child of [`apps/`](apps/) is a private application: applications may consume projects and internal packages, but projects and internal packages never depend on applications.

`/docs` is reserved for concise, quickly scannable documentation of essential, durable project concepts and processes. API and HTTP endpoint documentation belongs outside `/docs`, in the owning project's established documentation location.

### Dependency architecture

An arrow means that the package on the left depends on the package on the right.

```text
repository-fs       → repository
core                → repository
adapter-*           → core
cli                 → repository + repository-fs + core + active adapter packages
packages-website    → website-ui + core + repository + repository-fs + cli + adapter-*
                     (deterministic packages are build-time dependencies)
```

Shared internal packages may support first-class projects but never depend on them. The dependency graph must remain explicit and acyclic. Published packages must bundle private implementation or otherwise ensure that private imports and declarations do not leak into consumer artifacts.

### Package catalog

| Project                     | Package                                | Distribution | Specification                                                                                                                    |
| --------------------------- | -------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `repository`                | `@moldea.ai/repository`                | Public       | [Repository package](https://github.com/moldea-ai/platform/blob/main/moldea/context/repository-package.md)                       |
| `repository-fs`             | `@moldea.ai/repository-fs`             | Public       | [Repository FS package](https://github.com/moldea-ai/platform/blob/main/moldea/context/repository-fs-package.md)                 |
| `core`                      | `@moldea.ai/core`                      | Public       | [Core package](https://github.com/moldea-ai/platform/blob/main/moldea/context/core-package.md)                                   |
| `cli`                       | `@moldea.ai/cli`                       | Public       | [CLI package](https://github.com/moldea-ai/platform/blob/main/moldea/context/cli-package.md)                                     |
| `adapter-anthropic`         | `@moldea.ai/adapter-anthropic`         | Public       | [Anthropic adapter](https://github.com/moldea-ai/platform/blob/main/moldea/context/adapter-anthropic-package.md)                 |
| `adapter-claude-agent-sdk`  | `@moldea.ai/adapter-claude-agent-sdk`  | Public       | [Claude Agent SDK adapter](https://github.com/moldea-ai/platform/blob/main/moldea/context/adapter-claude-agent-sdk-package.md)   |
| `adapter-cloudflare-agents` | `@moldea.ai/adapter-cloudflare-agents` | Public       | [Cloudflare Agents adapter](https://github.com/moldea-ai/platform/blob/main/moldea/context/adapter-cloudflare-agents-package.md) |
| `adapter-eve`               | `@moldea.ai/adapter-eve`               | Public       | [Eve adapter](https://github.com/moldea-ai/platform/blob/main/moldea/context/adapter-eve-package.md)                             |
| `adapter-google-genai`      | `@moldea.ai/adapter-google-genai`      | Public       | [Google Gen AI adapter](https://github.com/moldea-ai/platform/blob/main/moldea/context/adapter-google-genai-package.md)          |
| `adapter-langchain`         | `@moldea.ai/adapter-langchain`         | Public       | [LangChain adapter](https://github.com/moldea-ai/platform/blob/main/moldea/context/adapter-langchain-package.md)                 |
| `adapter-langgraph`         | `@moldea.ai/adapter-langgraph`         | Public       | [LangGraph adapter](https://github.com/moldea-ai/platform/blob/main/moldea/context/adapter-langgraph-package.md)                 |
| `adapter-openai`            | `@moldea.ai/adapter-openai`            | Public       | [OpenAI adapter](https://github.com/moldea-ai/platform/blob/main/moldea/context/adapter-openai-package.md)                       |
| `adapter-openai-agents-sdk` | `@moldea.ai/adapter-openai-agents-sdk` | Public       | [OpenAI Agents SDK adapter](https://github.com/moldea-ai/platform/blob/main/moldea/context/adapter-openai-agents-sdk-package.md) |
| `adapter-vercel-ai-sdk`     | `@moldea.ai/adapter-vercel-ai-sdk`     | Public       | [Vercel AI SDK adapter](https://github.com/moldea-ai/platform/blob/main/moldea/context/adapter-vercel-ai-sdk-package.md)         |
| `website-ui`                | `@moldea.ai/website-ui`                | Public       | [Central package architecture](https://github.com/moldea-ai/platform/blob/main/moldea/context/packages.md)                       |

The catalog records approved architecture, not implementation or release status. The built-in `custom` runtime remains part of Core rather than a separate project. Public tooling, instruction consumption, and package-backed adapters currently target the Node.js ecosystem; compatibility uses npm packages and node-semver semantics.

### Key concepts

- **Repository reading is source-neutral and bounded.** `@moldea.ai/repository` defines logical paths, bounded pages and ranges, deterministic comparisons, snapshot identities, and the reader contract. Its memory reader is the reference implementation used by shared conformance tests. `@moldea.ai/repository-fs` provides lazy, resource-limited local access through that contract without requiring an eager repository-wide content inventory.
- **Core owns Repository Format interpretation.** `@moldea.ai/core` validates canonical structure and relationships without returning repository bodies, prepares deterministic inspection state, exposes paged agent assignments and diagnostics, matches changed paths cheaply, and gives each runtime adapter a bounded per-agent context. The public Repository Format specification remains the design authority.
- **Adapters contribute static evidence.** Official adapters inspect supported TypeScript source patterns through Core contexts; they do not execute provider SDKs or user code. Provider-neutral text, binding, relationship, immutable-value, and inspection-session primitives live in the private `@moldea.ai/adapter-static-analysis` package and are bundled into public adapter artifacts. Each public adapter retains ownership of registration, evidence, diagnostics, supported patterns, and provider-specific limits.
- **CLI is the installed read-only composition.** `@moldea.ai/cli` combines Repository, Repository FS, Core, and active adapters for deterministic working-tree validation, inspection, changed-path scope, explicit canonical content retrieval, and installed composition reporting. It uses bounded snapshot-aware output and performs no repository writes or model/runtime SDK execution. The built-in `custom` adapter comes from Core.
- **Package and application truth remain separate.** Specifications, implementation, tests, exports, manifests, compatibility sources, and package-owned documentation define package behavior. The packages website validates and presents those authorities; it does not create an independent package contract. Private applications may compose public packages without becoming package sources of truth.
- **Compatibility has distinct technical and presentation owners.** The runtime matrix records technical eligibility, source-pattern support, and optional qualification links. The website owns maturity presentation. Qualification execution, fixtures, caches, and results remain in the separate skill repository, and a link is valid only for that target's canonical skill profile.
- **Consumer artifacts are the release boundary.** Public packages version independently, must not expose private workspace dependencies, and are verified through real packed installations. Development may use newer tooling than a package's supported consumer runtime; the focused package contract and installed artifact determine the public guarantee.

### Build and test conventions

Public JavaScript packages are ESM-only unless a focused specification says otherwise. Vite owns bundled JavaScript, TypeScript owns strict checking and declarations, and packages expose granular unit, integration, and end-to-end scripts for the categories they contain. Tests remain colocated with their implementation and excluded from production artifacts.

[Local development](docs/local-development.md) owns the complete command matrix, environment-specific TypeScript configurations, build sequencing, test-category boundaries, integration budget, packed-consumer matrix, and Turborepo rules.

### Package documentation and generated artifacts

| Concern                         | Editable authority                                                                                       | Derived presentation                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Repository Format               | [`specifications/repository-format.md`](specifications/repository-format.md)                             | Public specification page and schema-derived website artifacts                                 |
| Technical runtime compatibility | [`compatibility/runtimes.yaml`](compatibility/runtimes.yaml)                                             | [`docs/runtime-compatibility.md`](docs/runtime-compatibility.md) and public compatibility JSON |
| Runtime target maturity         | [`apps/website/content/runtime-target-maturity.yaml`](apps/website/content/runtime-target-maturity.yaml) | Packages website adapter presentation                                                          |
| Package behavior                | Project implementation, specification, README, and `docs/**`                                             | Generated API reference, routes, search, sitemap, and `llms.txt`                               |

Every implemented public project owns its documentation under `projects/<project>/docs/**`; concise project READMEs remain the GitHub and npm entry points. Runtime adapters publish their package-owned docs for offline use. Website UI retains repository documentation but is intentionally absent from the visitor-facing packages website.

Generated files are never edited directly. Update the canonical source and run its documented generator. The website validates package discovery, exports, documentation, links, runtime compatibility, target maturity, and deterministic generated artifacts. Runtime qualification execution and evidence remain owned by the separate skill repository.

### Coding-agent maintenance rule

The agent changing a package or compatibility claim must reconsider every affected representation and synchronize only those that changed: implementation, exports, manifest, specification, README, package docs, examples, tests, compatibility sources, generated presentations, maturity, website routes, and version assertions as applicable.

Before completion, audit the complete diff against its base commit using the [npm release relevance rules](docs/npm-releases.md). Give every selected existing public project a greater canonical stable version, give a new public project a canonical stable version, synchronize directly affected compatible-major workspace dependencies and the lockfile, and run `pnpm release:check-changes <base-commit> <current-commit>` when both commits are available.

> **Reconsider and synchronize when affected. Do not edit unrelated surfaces merely because they exist.**

### Packages website and deployment

[`apps/website`](apps/website/) is the private Astro application for `https://packages.moldea.ai`. It discovers and validates public projects, renders package-owned documentation and compatibility data, and owns navigation, presentation metadata, synthetic executable examples, search, SEO artifacts, target maturity, and Pages deployment. It consumes `@moldea.ai/website-ui` for shared foundations without becoming a package-catalog entry.

Use `pnpm website:dev`, `pnpm website:build`, and `pnpm website:check` from the root. The [application README](apps/website/README.md) owns preparation, focused checks, design/rendering contracts, deployment triggers, base-path behavior, Search Console submission, and one-time repository setup. npm publication remains a separate workflow.

### Package releases

Public packages version independently. A `main` push selects release-relevant changed projects and safe current versions still missing from npm, verifies the commit once, and publishes exact checksummed tarballs in dependency order through trusted publishing. New-package bootstrap and interrupted-publication recovery remain explicit, resumable workflows. See [npm releases](docs/npm-releases.md) for authoritative selection, preparation, identity, ordering, security, and recovery contracts.

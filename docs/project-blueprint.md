# Project blueprint

This blueprint records implemented repository state. The [Repository Format specification](../specifications/repository-format.md), published on the [packages website](https://packages.moldea.ai/repository-format/), and the sibling `platform` repository's [central package specification](https://github.com/moldea-ai/platform/blob/main/moldea/context/packages.md), focused package specifications, [Runtime Adapter Contract](https://github.com/moldea-ai/platform/blob/main/moldea/context/runtime-adapter-contract.md), and [Runtime Compatibility Matrix](https://github.com/moldea-ai/platform/blob/main/moldea/context/runtime-compatibility-matrix.md) remain design authorities.

`/docs` is reserved for concise, quickly scannable documentation of essential, durable project concepts and processes. API and HTTP endpoint documentation stays in the owning project's established location outside `/docs`.

## Ownership and dependencies

Every immediate child of [`projects/`](../projects/) is a first-class package with a stable responsibility and identity. Children of [`packages/`](../packages/) are private shared implementations; children of [`apps/`](../apps/) are private applications. Applications may consume projects and internal packages, while projects and internal packages never depend on applications.

An arrow means that the package on the left depends on the package on the right:

```text
repository-fs       → repository
core                → repository
adapter-*           → core
cli                 → repository + repository-fs + core + active adapter packages
packages-website    → website-ui + core + repository + repository-fs + cli + adapter-*
                     (deterministic packages are build-time dependencies)
```

Shared internal packages may support first-class projects but never depend on them. Dependencies remain explicit and acyclic. Published packages bundle private implementations or otherwise prevent private imports and declarations from leaking into consumer artifacts.

## Package catalog

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

The catalog records approved architecture, not implementation or release status. The built-in `custom` runtime belongs to Core. Public tooling, instruction consumption, and package-backed adapters currently target the Node.js ecosystem; compatibility uses npm packages and node-semver semantics.

## Boundaries and sources of truth

- **Repository reading:** `@moldea.ai/repository` defines source-neutral logical paths, bounded pages and ranges, deterministic comparisons, snapshot identities, and the reader contract. Its memory reader backs shared conformance tests. `@moldea.ai/repository-fs` supplies lazy, resource-limited local access without an eager repository-wide content inventory.
- **Format interpretation:** `@moldea.ai/core` validates canonical structure and relationships without returning repository bodies. It prepares deterministic inspection state, paged assignments and severity-aware diagnostics, changed-path matching, and bounded per-agent adapter context. Confirmed errors invalidate a project; scoped unverified-relationship warnings retain validity without claiming proof. The public Repository Format specification remains its design authority.
- **Runtime evidence:** Official adapters inspect supported TypeScript source patterns through Core contexts; they do not execute provider SDKs or user code. Private `@moldea.ai/adapter-static-analysis` owns shared provider-neutral inspection primitives. Each public adapter owns its registration, evidence, diagnostics, supported patterns, and provider limits.
- **Installed composition:** `@moldea.ai/cli` combines Repository, Repository FS, Core, and active adapters for deterministic, read-only validation, inspection, changed-path scope, canonical content retrieval, and composition reporting. It uses bounded snapshot-aware output and does not execute model or runtime SDKs. Core provides the built-in `custom` adapter.
- **Package and application truth:** Specifications, implementation, tests, exports, manifests, compatibility sources, and package-owned documentation define package behavior. The packages website validates and presents those authorities; it does not define a parallel contract.
- **Compatibility:** [`compatibility/runtimes.yaml`](../compatibility/runtimes.yaml) records technical eligibility, source-pattern support, and optional qualification links; the website owns maturity presentation. Qualification execution and evidence belong to the separate skill repository. A qualification link is valid only for its target's canonical skill profile.
- **Consumer artifacts:** Public packages version independently, cannot expose private workspace dependencies, and are verified through packed installations. Development tooling may require a newer runtime than a package supports for consumers.

## Documentation ownership

| Concern                         | Editable authority                                                                                          | Derived presentation                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Repository Format               | [`specifications/repository-format.md`](../specifications/repository-format.md)                             | Public specification page and schema-derived website artifacts                       |
| Technical runtime compatibility | [`compatibility/runtimes.yaml`](../compatibility/runtimes.yaml)                                             | [`runtime-compatibility.md`](runtime-compatibility.md) and public compatibility JSON |
| Runtime target maturity         | [`apps/website/content/runtime-target-maturity.yaml`](../apps/website/content/runtime-target-maturity.yaml) | Packages website adapter presentation                                                |
| Package behavior                | Project implementation, specification, README, and `docs/**`                                                | Generated API reference, routes, search, sitemap, and `llms.txt`                     |

Each implemented public project owns its documentation under `projects/<project>/docs/**`; its README is the GitHub and npm entry point. Runtime adapters publish package-owned docs for offline use. Website UI retains repository documentation but is absent from the visitor-facing packages website. Generated files must be changed through their canonical source and documented generator.

For build and test conventions, see [local development](local-development.md). For packages website ownership and deployment, see its [application README](../apps/website/README.md). For version selection and publication, see [npm releases](npm-releases.md).

When a package or compatibility claim changes, reconsider every affected representation and synchronize only those that changed: implementation, exports, manifest, specification, README, package docs, examples, tests, compatibility sources, generated presentations, maturity, website routes, and version assertions. Apply the [release relevance rules](npm-releases.md#preparing-a-release) to the complete diff, including affected public package versions and compatible-major workspace dependencies; run `pnpm release:check-changes <base-commit> <current-commit>` when both commits are available.

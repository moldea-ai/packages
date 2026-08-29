---
title: Repository Format specification
description: The official version 1 contract for deterministic moldea repository context, agents, capabilities, and relationships.
formatVersion: 1
---

# Repository format specification

This document defines the version `1` repository format for a `moldea` project. It is the authoritative contract for the client-owned files under `/moldea/**` and the repository relationships declared in `/moldea/moldea.yaml`.

The format is consumed by humans, coding agents, the open-source `moldea` skill, `@moldea.ai/core`, `moldea` Cloud indexing, runtime adapters, and PR Assurance. A future Node.js instruction-consumption SDK will also conform to this format after its focused specification and release.

The repository format follows one central rule:

**Derive what can be derived from the repository. Declare only the project semantics and relationships that cannot be determined reliably.**

The format does not define Cloud environment mappings, billing, GitHub permissions, REST routes, Assurance model prompts, runtime-version compatibility, or other hosted-platform configuration. Those are governed by the main project specification and their dedicated companion specifications.

## Core principles

A conforming `moldea` repository follows these principles:

- Git owns canonical `moldea` content and history.
- Every canonical `moldea` asset lives under one root-level `/moldea/` directory.
- `/moldea/project.md` establishes the project foundation before agents are required.
- Canonical locations are convention-based whenever they can be determined reliably.
- `/moldea/moldea.yaml` records semantic relationships rather than duplicating discoverable repository facts.
- Every registered agent has a concise mandatory description, and complete agent instructions remain directly readable Markdown files.
- Registered tools and skills are independently optional, but every registered capability has explicit concise metadata and model-facing instruction guidance.
- Project context, runtime guidance, decisions, instructions, capability descriptions, code bindings, mirrors, and unresolved requirements remain explicit and inspectable.
- The format describes the project as it is implemented. It does not judge whether runtime usage follows recommended practices.
- Local tooling may inspect the current Git working-tree view defined by the active local source composition, while `moldea` Cloud considers committed Git content authoritative.
- Structural validation is deterministic. Semantic ambiguity is handled by the `moldea` skill, `evaluate`, `reconcile`, or PR Assurance rather than being hidden behind guesses.

## Terminology

### Repository root

The **repository root** is the top-level directory of the Git repository containing `/moldea/`. Logical paths in the manifest are resolved from this root.

### Repository-root-absolute logical path

A **repository-root-absolute logical path** is a portable path beginning with `/` whose `/` refers to the Git repository root, not the host operating system filesystem root.

For example:

```text
/moldea/agents/customer-support/instruction.md
/packages/contracts/src/customer-support.ts
```

### Canonical asset

A **canonical asset** is an authoritative client-owned file under `/moldea/**` whose content is versioned in Git.

### Discovered asset

A **discovered asset** is a canonical asset whose identity or location is determined by repository convention rather than repeated in the manifest.

### Repository reference

A **repository reference** identifies an existing regular repository file that is relevant to another manifest entry. It contains a repository-root-absolute file `path` and may contain a `symbol` when additional precision is applicable.

A repository reference provides traceability to an existing canonical asset or implementation artifact. It does not, by itself, declare that the referenced file informs an agent, governs behavior, or represents an implementation relationship.

### Binding

A **binding** is a repository reference that explicitly connects `moldea` semantics to a specific implementation artifact in the repository. Bindings carry implementation-relationship meaning in addition to identifying the file and optional symbol.

### Impact path

An **impact path** is an exact path or simple glob under `affectedBy` indicating code or repository content whose modification may affect a context item, decision, agent, tool, or skill.

An impact-path match means the affected asset should enter relevance analysis. It does not mean the asset must necessarily be changed.

### Runtime guidance

**Runtime guidance** is optional project-local Markdown under `/moldea/runtimes/**` that explains how the `moldea` project's agent runtime integration is implemented, wrapped, extended, or otherwise structured. In colocated mode that implementation is normally in the same repository; in dedicated-repository mode the guidance may describe the developer-identified related application implementation without creating a cross-repository manifest relationship.

### Agent description

An **agent description** is the mandatory concise, vendor-independent, model-facing summary in `/moldea/agents/{agent-id}/description.md` explaining what the agent is and what it does.

### Handoff description

A **handoff description** is the optional concise, vendor-independent routing hint in `/moldea/agents/{agent-id}/handoff-description.md` explaining when another model, agent, workflow, or router should transfer work to the agent.

### Effective routing description

The **effective routing description** is the deterministic target-owned model-facing value used for runtime metadata whose semantic purpose is to help a model, agent, router, or workflow decide whether work should be routed, delegated, or handed off to the target agent.

For one registered agent, the effective routing description is:

1. the effective value of `/moldea/agents/{agent-id}/handoff-description.md` when that file is present
2. otherwise, the effective value of the mandatory `/moldea/agents/{agent-id}/description.md`

The fallback applies only when `handoff-description.md` is absent. A present but structurally invalid handoff description does not fall back to `description.md`; the repository remains invalid under the applicable structural rule.

The semantic purpose of runtime metadata determines this mapping, not the runtime property's name. A runtime property named `description` is routing-facing when the runtime exposes it to help select, route to, delegate to, or hand off to the agent. When one runtime property serves both general agent description and routing selection, it is routing-facing for this rule.

### Capability description

A **capability description** is the required concise, vendor-independent, model-facing `description` of a registered tool or skill. It explains what the capability does and when the owning agent should use it.

### Mirror

A **mirror** is a Git-tracked derived copy of one canonical agent instruction at another repository path required by a runtime or integration. Its equality is defined by the version `1` normalized-text comparison rules below.

### Unresolved requirement

An **unresolved requirement** is explicit project state describing missing or uncertain information or functionality that materially affects current project truth or declared agent behavior.

## Repository structure

A valid project always contains:

```text
moldea/
  moldea.yaml
  project.md
```

The project grows progressively as needed:

```text
moldea/
  moldea.yaml
  project.md

  context/
    product.md
    terminology.md
    architecture.md
    security-and-privacy.md

  decisions/
    1786050123456-use-postgresql.md

  runtimes/
    openai-agents-sdk-api.md
    internal-agent-runtime.md

  agents/
    customer-support/
      description.md
      instruction.md
      handoff-description.md
```

The recognized version `1` canonical locations are:

- `/moldea/moldea.yaml`
- `/moldea/project.md`
- `/moldea/context/**/*.md`
- `/moldea/decisions/*.md`
- `/moldea/runtimes/**/*.md`
- `/moldea/agents/{agent-id}/description.md`
- `/moldea/agents/{agent-id}/instruction.md`
- `/moldea/agents/{agent-id}/handoff-description.md`

`context/`, `decisions/`, `runtimes/`, and `agents/` are optional and should not be created until needed.

Files under `/moldea/**` that do not match a recognized canonical location are invalid in version `1`. This keeps Cloud indexing, validation, portability, and agent discovery deterministic.

The root repository `README.md` may contain synchronization guidance maintained by the open-source skill, but it is outside `/moldea/**` and is not canonical `moldea` content.

## Git and local authoring state

A committed Git tree is authoritative for Cloud indexing, REST distribution, history, and PR Assurance.

During local development, the skill and `@moldea.ai/core` may inspect modified, staged, unstaged, renamed, deleted, or untracked working-tree files. Such files may represent valid work in progress before they are committed.

A local working tree therefore may temporarily contain new canonical assets or mirrors that are not yet Git-tracked. They become part of the authoritative `moldea` project only when committed.

## Text encoding and normalization

Canonical text assets and the manifest use UTF-8.

Version `1` applies these rules:

- Binary canonical assets are not supported.
- Invalid UTF-8 is a structural validation error.
- A leading UTF-8 byte-order mark may be read, but it is removed from the normalized text representation and `moldea` writers remove it when rewriting the file.
- CRLF and CR line endings are normalized to LF for textual equality, mirror comparison, and content digests.
- No Unicode normalization is applied; Unicode scalar values other than the removed leading byte-order mark are preserved exactly.
- Other textual content, including spaces, tabs, trailing whitespace, and trailing newlines, remains significant.
- NUL characters are invalid in canonical text assets.
- Local tooling preserves repository content when no edit is required rather than rewriting files merely to normalize formatting.

Content digests use SHA-256 over the normalized UTF-8 byte sequence. The canonical serialized form is `sha256:` followed by the 64 lowercase hexadecimal digest characters, such as `sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef`, unless a later format version explicitly changes the algorithm or representation.

### Deterministic whitespace and line-break predicates

Where version `1` uses the terms **Unicode `White_Space`**, **Unicode whitespace**, **whitespace**, **non-whitespace**, or **surrounding whitespace** as a deterministic validation predicate, the whitespace set is exactly:

```text
U+0009..U+000D
U+0020
U+0085
U+00A0
U+1680
U+2000..U+200A
U+2028
U+2029
U+202F
U+205F
U+3000
```

No host-language `trim`, regular-expression shorthand, locale rule, or newer Unicode-property interpretation may silently add or remove code points from this version `1` set. `U+FEFF` is handled only by the explicit leading UTF-8 BOM rule above and is not part of the version `1` whitespace set.

Where version `1` requires a value to be **single-line** or prohibits a **line-break character**, the prohibited line-break set is exactly `U+000A` (LF), `U+000D` (CR), `U+0085` (NEL), `U+2028` (LINE SEPARATOR), and `U+2029` (PARAGRAPH SEPARATOR).

Where a canonical Markdown parsing rule refers to a **line** after text normalization, lines are delimited by normalized LF (`U+000A`) only. A **blank line** is a line containing zero scalar values or only scalar values from the version `1` `White_Space` set other than LF. Unicode line-break scalars that are preserved rather than normalized, such as NEL, LINE SEPARATOR, and PARAGRAPH SEPARATOR, remain ordinary scalar content for canonical Markdown line splitting even though they are prohibited in fields whose contract is `single-line`.

## Path rules

All manifest paths and path patterns use repository-root-absolute logical paths.

A valid logical path:

- begins with exactly one leading `/`
- contains at least one non-empty path segment after the leading `/`; `/` by itself is not a valid manifest path
- uses `/` as the separator on every operating system
- is interpreted relative to the Git repository root
- is case-sensitive according to the Git path stored in the repository
- contains no empty path segment after the leading root marker
- contains no `.` or `..` segment
- contains no backslash
- contains no ASCII control character from `U+0000` through `U+001F`, including NUL
- contains no `U+007F`
- contains only Unicode scalar values and therefore no unpaired UTF-16 surrogate
- contains no Windows drive-letter prefix
- cannot resolve outside the repository root
- cannot be a URL

Host-machine absolute paths such as `/home/user/project/...` or `C:\project\...` must never appear in `moldea.yaml`.

Paths that represent exact bindings or repository references resolve to regular repository files. Directories and broad relationships are represented through `affectedBy` patterns instead of exact bindings.

### Symlinks

Version `1` does not use symlinks for `moldea` relationships.

The following must not be symlinks:

- canonical assets under `/moldea/**`
- manifest-bound files
- runtime-guidance files referenced by agents
- mirror files

A path resolution that encounters a symlink is invalid rather than being followed implicitly.

## Simple glob rules

`affectedBy` accepts exact repository-root paths and simple glob patterns.

Version `1` supports only:

- exact paths
- `*` to match zero or more non-`/` characters within one path segment
- `**` to match zero or more complete path segments

Patterns are matched segment by segment against repository-root-absolute logical file paths. `**` is valid only as an entire path segment and matches zero or more complete path segments. Every other pattern segment may contain `*`, which matches zero or more characters other than `/` within exactly one path segment.

A segment that combines `**` with other characters, contains three or more consecutive `*` characters, or contains any unsupported metacharacter is invalid. Because `**` may match zero segments, `/packages/orders/**/*.ts` matches both `/packages/orders/index.ts` and `/packages/orders/archive/index.ts`.

Examples:

```yaml
affectedBy:
  - /apps/api/src/refunds/**
  - /packages/orders/**/*.ts
  - /package.json
```

Version `1` does not support:

- negation such as `!`
- character classes such as `[]`
- brace expansion such as `{ts,tsx}`
- `?`
- regular expressions

Patterns are case-sensitive and use `/` separators. A directory relationship should normally use `/**` rather than relying on directory-prefix interpretation.

An `affectedBy` entry without `*` is an exact path and must resolve to an existing regular repository file in authoritative committed state. A syntactically valid glob may match zero files and remain valid so that it can cover future additions within the declared repository area. `evaluate` may surface an unexpectedly unmatched glob as a maintenance concern, but zero matches are not a structural error.

## Stable IDs

`moldea` IDs are short, portable, machine-readable slugs.

Agent IDs, tool IDs, skill IDs, and unresolved-requirement IDs must:

- contain 1 to 64 ASCII characters
- use lowercase letters, digits, and single hyphens only
- begin and end with a lowercase letter or digit
- not contain consecutive hyphens
- match:

```text
^[a-z0-9]+(?:-[a-z0-9]+)*$
```

Version `1` reserves exactly these stable IDs because they are unsafe as case-insensitive Windows device names: `con`, `prn`, `aux`, `nul`, `com1` through `com9`, and `lpt1` through `lpt9`. No other stable ID is reserved by this version `1` filesystem-name rule. Because stable IDs are lowercase ASCII, the comparison is exact after the stable-ID grammar has been validated.

Agent IDs are unique within the project.

Tool, skill, and agent-level unresolved-requirement IDs are unique within their owning agent. The same capability ID may be used by different agents.

Project-level unresolved-requirement IDs are unique within the project-level unresolved-requirement scope.

Changing an agent ID is a breaking change because the ID participates in paths, SDK and REST lookup, history, bindings, handoffs, findings, and other integrations.

## Manifest format

The manifest is always:

```text
/moldea/moldea.yaml
```

It is a strict YAML document whose top-level value is a mapping.

Version `1` is parsed using YAML `1.2` Core Schema scalar semantics. Readers must not apply YAML `1.1` implicit boolean, timestamp, or other legacy scalar resolution. The same scalar text must produce the same type in every conforming implementation.

The manifest contains exactly one YAML document. YAML directives, additional documents, anchors, aliases, merge keys, and custom tags are invalid.

Version `1` uses this strict subset:

- duplicate mapping keys are invalid
- unknown properties are invalid
- optional properties are omitted rather than represented as `null`
- a required non-empty string must contain at least one non-whitespace Unicode character
- comments are allowed and have no semantic meaning
- mapping order has no semantic meaning
- array order has no semantic meaning unless this specification states otherwise
- duplicate array entries are invalid when the entries represent IDs, paths, bindings, repository references, mirrors, or patterns
- every parsed scalar, sequence, and mapping must match the type required by the repository-format schema

The only version `1` top-level properties are:

```yaml
version: 1
context: {}
decisions: {}
unresolved: {}
agents: {}
```

Only `version` is required. Empty optional mappings should normally be omitted.

A minimal project therefore uses:

```yaml
version: 1
```

### Manifest property reference

The paths below are the complete version `1` property surface. Braced segments identify mapping keys owned by the repository. `[]` identifies one array entry. Container properties are listed alongside their nested properties so readers can distinguish a mapping, sequence, or object from its contents.

| Property path                                                         | Required         | Type     | Purpose and constraints                                                                                    |
| --------------------------------------------------------------------- | ---------------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| `version`                                                             | yes              | integer  | Selects the repository-format major version. The only version `1` value is `1`.                            |
| `context`                                                             | no               | mapping  | Declares relationships for discovered focused-context files. Keys are canonical context paths.             |
| `context.{context-path}.bindings`                                     | no               | sequence | Connects the context asset to existing implementation artifacts. Entries are unique repository references. |
| `context.{context-path}.bindings[].path`                              | yes per entry    | string   | Repository-root-absolute path to an existing regular file.                                                 |
| `context.{context-path}.bindings[].symbol`                            | no               | string   | Single-line non-empty symbol within the referenced file.                                                   |
| `context.{context-path}.affectedBy`                                   | no               | sequence | Unique exact paths or simple globs that can affect the context asset.                                      |
| `context.{context-path}.affectedBy[]`                                 | yes per entry    | string   | One valid impact path.                                                                                     |
| `decisions`                                                           | no               | mapping  | Declares relationships for discovered decision records. Keys are canonical decision paths.                 |
| `decisions.{decision-path}.bindings`                                  | no               | sequence | Connects the decision to existing implementation artifacts. Entries are unique repository references.      |
| `decisions.{decision-path}.bindings[].path`                           | yes per entry    | string   | Repository-root-absolute path to an existing regular file.                                                 |
| `decisions.{decision-path}.bindings[].symbol`                         | no               | string   | Single-line non-empty symbol within the referenced file.                                                   |
| `decisions.{decision-path}.affectedBy`                                | no               | sequence | Unique exact paths or simple globs that can affect the decision.                                           |
| `decisions.{decision-path}.affectedBy[]`                              | yes per entry    | string   | One valid impact path.                                                                                     |
| `unresolved`                                                          | no               | mapping  | Declares project-level unresolved requirements keyed by stable requirement ID.                             |
| `unresolved.{requirement-id}.category`                                | yes              | string   | Stable, single-line non-empty category.                                                                    |
| `unresolved.{requirement-id}.effect`                                  | yes              | string   | One of `blocking`, `warning`, or `informational`.                                                          |
| `unresolved.{requirement-id}.description`                             | yes              | string   | Concise current-state description of the unresolved requirement.                                           |
| `unresolved.{requirement-id}.resolution`                              | yes              | string   | Concrete condition or work needed to resolve the requirement.                                              |
| `unresolved.{requirement-id}.related`                                 | no               | sequence | Unique repository references that add traceability.                                                        |
| `unresolved.{requirement-id}.related[].path`                          | yes per entry    | string   | Repository-root-absolute path to an existing regular file.                                                 |
| `unresolved.{requirement-id}.related[].symbol`                        | no               | string   | Single-line non-empty symbol within the referenced file.                                                   |
| `unresolved.{requirement-id}.reference`                               | no               | string   | Single-line non-empty external or project-local tracking reference.                                        |
| `agents`                                                              | no               | mapping  | Registers agents keyed by stable agent ID.                                                                 |
| `agents.{agent-id}.runtime`                                           | yes              | mapping  | Declares the agent's runtime integration.                                                                  |
| `agents.{agent-id}.runtime.id`                                        | yes              | string   | Stable supported adapter ID or `custom`.                                                                   |
| `agents.{agent-id}.runtime.guidance`                                  | conditionally    | string   | Canonical runtime-guidance path; required for `custom`, optional otherwise.                                |
| `agents.{agent-id}.context`                                           | no               | sequence | Unique canonical context paths relevant to the agent.                                                      |
| `agents.{agent-id}.context[]`                                         | yes per entry    | string   | One discovered canonical context path.                                                                     |
| `agents.{agent-id}.decisions`                                         | no               | sequence | Unique canonical decision paths relevant to the agent.                                                     |
| `agents.{agent-id}.decisions[]`                                       | yes per entry    | string   | One discovered canonical decision path.                                                                    |
| `agents.{agent-id}.variables`                                         | no               | mapping  | Declares runtime variables keyed by their exact placeholder name.                                          |
| `agents.{agent-id}.variables.{variable-name}.description`             | yes              | string   | Concise single-line explanation of the runtime value.                                                      |
| `agents.{agent-id}.bindings`                                          | no               | mapping  | Connects agent semantics to executable runtime artifacts.                                                  |
| `agents.{agent-id}.bindings.runtimeAgent`                             | no               | mapping  | References the executable runtime-agent definition.                                                        |
| `agents.{agent-id}.bindings.runtimeAgent.path`                        | yes when present | string   | Repository-root-absolute path to an existing regular file.                                                 |
| `agents.{agent-id}.bindings.runtimeAgent.symbol`                      | no               | string   | Single-line non-empty symbol within the referenced file.                                                   |
| `agents.{agent-id}.bindings.inputSchema`                              | no               | mapping  | References the executable input schema.                                                                    |
| `agents.{agent-id}.bindings.inputSchema.path`                         | yes when present | string   | Repository-root-absolute path to an existing regular file.                                                 |
| `agents.{agent-id}.bindings.inputSchema.symbol`                       | no               | string   | Single-line non-empty symbol within the referenced file.                                                   |
| `agents.{agent-id}.bindings.outputSchema`                             | no               | mapping  | References the executable output schema.                                                                   |
| `agents.{agent-id}.bindings.outputSchema.path`                        | yes when present | string   | Repository-root-absolute path to an existing regular file.                                                 |
| `agents.{agent-id}.bindings.outputSchema.symbol`                      | no               | string   | Single-line non-empty symbol within the referenced file.                                                   |
| `agents.{agent-id}.bindings.instructionLoader`                        | no               | mapping  | References the implementation that loads the canonical instruction.                                        |
| `agents.{agent-id}.bindings.instructionLoader.path`                   | yes when present | string   | Repository-root-absolute path to an existing regular file.                                                 |
| `agents.{agent-id}.bindings.instructionLoader.symbol`                 | no               | string   | Single-line non-empty symbol within the referenced file.                                                   |
| `agents.{agent-id}.bindings.variableProviders`                        | no               | mapping  | References runtime-value providers keyed by declared variable name.                                        |
| `agents.{agent-id}.bindings.variableProviders.{variable-name}.path`   | yes per entry    | string   | Repository-root-absolute path to an existing regular file.                                                 |
| `agents.{agent-id}.bindings.variableProviders.{variable-name}.symbol` | no               | string   | Single-line non-empty symbol within the referenced file.                                                   |
| `agents.{agent-id}.tools`                                             | no               | mapping  | Registers tools keyed by stable capability ID.                                                             |
| `agents.{agent-id}.tools.{tool-id}.name`                              | yes              | string   | Exact runtime-facing tool name.                                                                            |
| `agents.{agent-id}.tools.{tool-id}.description`                       | yes              | string   | Concise model-facing description of what the tool does and when to use it.                                 |
| `agents.{agent-id}.tools.{tool-id}.implementation`                    | yes              | mapping  | References the tool implementation.                                                                        |
| `agents.{agent-id}.tools.{tool-id}.implementation.path`               | yes              | string   | Repository-root-absolute path to an existing regular file.                                                 |
| `agents.{agent-id}.tools.{tool-id}.implementation.symbol`             | no               | string   | Single-line non-empty symbol within the referenced file.                                                   |
| `agents.{agent-id}.tools.{tool-id}.registration`                      | no               | mapping  | References runtime registration or wiring.                                                                 |
| `agents.{agent-id}.tools.{tool-id}.registration.path`                 | yes when present | string   | Repository-root-absolute path to an existing regular file.                                                 |
| `agents.{agent-id}.tools.{tool-id}.registration.symbol`               | no               | string   | Single-line non-empty symbol within the referenced file.                                                   |
| `agents.{agent-id}.tools.{tool-id}.inputSchema`                       | no               | mapping  | References the executable tool-input schema.                                                               |
| `agents.{agent-id}.tools.{tool-id}.inputSchema.path`                  | yes when present | string   | Repository-root-absolute path to an existing regular file.                                                 |
| `agents.{agent-id}.tools.{tool-id}.inputSchema.symbol`                | no               | string   | Single-line non-empty symbol within the referenced file.                                                   |
| `agents.{agent-id}.tools.{tool-id}.outputSchema`                      | no               | mapping  | References the executable tool-output schema.                                                              |
| `agents.{agent-id}.tools.{tool-id}.outputSchema.path`                 | yes when present | string   | Repository-root-absolute path to an existing regular file.                                                 |
| `agents.{agent-id}.tools.{tool-id}.outputSchema.symbol`               | no               | string   | Single-line non-empty symbol within the referenced file.                                                   |
| `agents.{agent-id}.tools.{tool-id}.affectedBy`                        | no               | sequence | Unique exact paths or simple globs that can affect the tool.                                               |
| `agents.{agent-id}.tools.{tool-id}.affectedBy[]`                      | yes per entry    | string   | One valid impact path.                                                                                     |
| `agents.{agent-id}.skills`                                            | no               | mapping  | Registers skills keyed by stable capability ID.                                                            |
| `agents.{agent-id}.skills.{skill-id}.name`                            | yes              | string   | Exact runtime-facing skill name.                                                                           |
| `agents.{agent-id}.skills.{skill-id}.description`                     | yes              | string   | Concise model-facing description of what the skill does and when to use it.                                |
| `agents.{agent-id}.skills.{skill-id}.implementation`                  | yes              | mapping  | References the skill's canonical implementation entry.                                                     |
| `agents.{agent-id}.skills.{skill-id}.implementation.path`             | yes              | string   | Repository-root-absolute path to an existing regular file.                                                 |
| `agents.{agent-id}.skills.{skill-id}.implementation.symbol`           | no               | string   | Single-line non-empty symbol within the referenced file when applicable.                                   |
| `agents.{agent-id}.skills.{skill-id}.registration`                    | no               | mapping  | References runtime registration or wiring.                                                                 |
| `agents.{agent-id}.skills.{skill-id}.registration.path`               | yes when present | string   | Repository-root-absolute path to an existing regular file.                                                 |
| `agents.{agent-id}.skills.{skill-id}.registration.symbol`             | no               | string   | Single-line non-empty symbol within the referenced file.                                                   |
| `agents.{agent-id}.skills.{skill-id}.affectedBy`                      | no               | sequence | Unique exact paths or simple globs that can affect the skill.                                              |
| `agents.{agent-id}.skills.{skill-id}.affectedBy[]`                    | yes per entry    | string   | One valid impact path.                                                                                     |
| `agents.{agent-id}.affectedBy`                                        | no               | sequence | Unique exact paths or simple globs that can affect the agent.                                              |
| `agents.{agent-id}.affectedBy[]`                                      | yes per entry    | string   | One valid impact path.                                                                                     |
| `agents.{agent-id}.mirrors`                                           | no               | sequence | Unique repository-root-absolute paths to Git-tracked instruction mirrors.                                  |
| `agents.{agent-id}.mirrors[]`                                         | yes per entry    | string   | One declared mirror path.                                                                                  |
| `agents.{agent-id}.unresolved`                                        | no               | mapping  | Declares agent-level unresolved requirements keyed by stable requirement ID.                               |
| `agents.{agent-id}.unresolved.{requirement-id}.category`              | yes              | string   | Stable, single-line non-empty category.                                                                    |
| `agents.{agent-id}.unresolved.{requirement-id}.effect`                | yes              | string   | One of `blocking`, `warning`, or `informational`.                                                          |
| `agents.{agent-id}.unresolved.{requirement-id}.description`           | yes              | string   | Concise current-state description of the unresolved requirement.                                           |
| `agents.{agent-id}.unresolved.{requirement-id}.resolution`            | yes              | string   | Concrete condition or work needed to resolve the requirement.                                              |
| `agents.{agent-id}.unresolved.{requirement-id}.related`               | no               | sequence | Unique repository references that add traceability.                                                        |
| `agents.{agent-id}.unresolved.{requirement-id}.related[].path`        | yes per entry    | string   | Repository-root-absolute path to an existing regular file.                                                 |
| `agents.{agent-id}.unresolved.{requirement-id}.related[].symbol`      | no               | string   | Single-line non-empty symbol within the referenced file.                                                   |
| `agents.{agent-id}.unresolved.{requirement-id}.reference`             | no               | string   | Single-line non-empty external or project-local tracking reference.                                        |

## Manifest version

`version` is a required integer major format version.

Version `1` manifests use:

```yaml
version: 1
```

Version `1` is closed with respect to manifest property names, canonical locations, and the meanings of existing fields. Adding a manifest property, canonical location, or incompatible interpretation requires a new major format version.

Clarifications, conformance fixtures, compatibility-matrix changes, and additional official adapter IDs may remain within version `1` when they do not change repository syntax or the semantics of existing fields.

A conforming validator that does not support the declared version returns an explicit unsupported-version diagnostic and must not attempt best-effort interpretation.

Automatic format migration is outside the version `1` repository contract.

## Project foundation

### `/moldea/project.md`

`/moldea/project.md` is required and contains the concise authoritative foundation of the project.

It describes current project identity and foundational truth such as:

- what the project is
- its purpose and mission
- who or what it serves
- principal goals
- important values and boundaries
- foundational terminology or facts future agents and collaborators need to understand

The file must be non-empty UTF-8 Markdown.

The repository format does not impose a fixed heading template because project structure varies. YAML frontmatter has no `moldea` semantics in `project.md` in version `1` and should not be used for machine-readable project metadata.

`project.md` is implicitly foundational context for every registered agent. It is not repeated in each agent's manifest `context` list.

A change to `project.md` is always considered potentially relevant to registered agents and to project-level alignment analysis.

## Focused context

Focused current truth lives under:

```text
/moldea/context/**/*.md
```

Every focused context file must contain at least one non-whitespace Unicode character.

Context files are discovered automatically and need no manifest entry merely to exist or appear in Cloud.

The `context` manifest property is used only when a context asset has explicit implementation relationships that `moldea` should not infer silently.

`/moldea/project.md` may also appear as a key under `context` when explicit project-level implementation relationships need to be declared.

Example:

```yaml
version: 1

context:
  /moldea/context/security-and-privacy.md:
    bindings:
      - path: /packages/security/src/encryption.ts
        symbol: encryptPrivateValue
    affectedBy:
      - /apps/api/src/security/**
      - /packages/security/**
```

A `context` entry supports:

- `bindings`: optional non-empty list of exact bindings
- `affectedBy`: optional non-empty list of exact paths or simple glob patterns

At least one of `bindings` or `affectedBy` must be present when a context entry is declared.

The key must resolve to `/moldea/project.md` or an existing Markdown file under `/moldea/context/**`.

An explicit relationship is semantic project knowledge. The skill should ask follow-up questions rather than invent one when the relationship is unclear.

## Decision records

Decision records live directly under:

```text
/moldea/decisions/
```

Nested decision directories are not supported in version `1`.

A decision filename has this exact shape:

```text
{unix-milliseconds}-{slug}.md
```

Example:

```text
1786050123456-use-postgresql.md
```

The timestamp is a 13-digit Unix timestamp in milliseconds and acts as the decision's stable machine identity. The slug is descriptive and uses the stable-ID slug syntax. Decision filenames are immutable after creation.

If a timestamp collision exists, the creator must choose another unused millisecond value rather than introducing a second filename syntax.

### Decision frontmatter

Every decision begins, after an optional UTF-8 byte-order mark, with an opening `---` line and ends its frontmatter with a closing `---` line. No content may appear before the opening delimiter.

The content between the delimiters is a strict YAML `1.2` Core Schema mapping and follows the manifest's prohibitions on duplicate keys, anchors, aliases, merge keys, custom tags, and legacy YAML `1.1` scalar resolution. The only allowed properties are `status`, `createdAt`, and `supersedes`; unknown properties are invalid.

Example:

```yaml
---
status: accepted
createdAt: '2026-08-07T19:42:03.456Z'
supersedes:
  - '1784000000000'
---
```

`status` is required and is one of:

- `proposed`
- `accepted`
- `rejected`
- `superseded`

`createdAt` is a required string using ISO 8601 UTC with exactly three fractional-second digits and `Z`. It must represent the same millisecond encoded in the filename.

`supersedes` is optional. When present, it is a non-empty list of unique 13-digit decision IDs represented as strings. Every referenced decision must exist. A decision cannot supersede itself, and supersession cycles are invalid.

The Markdown body after frontmatter must contain at least one non-whitespace character and preserve the decision's rationale. It may describe context, alternatives, the decision, reasoning, tradeoffs, consequences, and other durable information.

Accepted decisions represent active rationale. Proposed, rejected, and superseded decisions remain historical context and do not govern current alignment.

Decision IDs are unique across the project. A proposed or rejected decision may record decisions it is intended to supersede, but it does not change their active status. When a decision with status `accepted` or `superseded` lists another decision in `supersedes`, every referenced decision must have status `superseded`. A decision retains its own `supersedes` history if it is later superseded by another decision.

When a new decision supersedes an accepted decision, the new decision lists the old decision in `supersedes` and the old decision's status is changed to `superseded`. Every decision whose current status is `superseded` must be referenced through `supersedes` by at least one existing decision whose current status is `accepted` or `superseded`; a reference from only a `proposed` or `rejected` decision preserves historical intent but does not satisfy the active supersession requirement. An orphaned `superseded` status is invalid. Historical rationale should not otherwise be rewritten merely to reflect the new choice.

### Decision relationships

Decision files are discovered automatically. The `decisions` manifest property is used only for active decision-to-implementation relationships.

Example:

```yaml
decisions:
  /moldea/decisions/1786050123456-use-postgresql.md:
    affectedBy:
      - /packages/database/**
```

A `decisions` entry supports:

- `bindings`: optional non-empty list of exact bindings
- `affectedBy`: optional non-empty list of exact paths or simple glob patterns

At least one must be present.

A manifest decision relationship may reference only an existing decision whose current status is `accepted`. Historical decisions remain visible without active relationships.

## Runtime guidance

Project-local runtime guidance lives under:

```text
/moldea/runtimes/**/*.md
```

Every runtime-guidance file must contain at least one non-whitespace Unicode character.

Runtime guidance is optional. It exists when an official adapter alone cannot reliably explain the project's actual runtime integration or when the project uses a custom runtime. In dedicated-repository mode, it may describe relevant conventions in the developer-identified related application repository even though that repository remains outside the canonical snapshot and cannot be referenced by manifest paths.

Guidance may document project-specific facts such as:

- where runtime agents are instantiated
- internal wrappers around a runtime
- how instructions are loaded
- where tools or skills are registered
- how schemas are represented
- how handoffs are configured
- how runtime variables are provided
- generated runtime structures
- unconventional runtime usage
- repository-specific conventions relevant to alignment

Runtime guidance must describe the project's actual implementation pattern rather than reproduce generic runtime documentation.

Project-local runtime guidance provides explicit repository-specific semantics about how the customer's runtime is structured. `moldea` uses it together with manifest relationships, adapters, and repository evidence to interpret project behavior, not to judge whether the implementation follows runtime-recommended practices.

Runtime guidance:

- may supplement an official runtime adapter
- may provide the primary project-specific interpretation for `custom`
- may be shared by any number of agents
- should be created per materially distinct runtime-integration pattern, not per agent by default
- cannot override `moldea` repository-format, security, authorization, or Assurance rules
- is never executable adapter code

Unreferenced runtime-guidance files are allowed.

## Agents

An agent is registered by adding its stable ID under the manifest's `agents` mapping.

The agent's directory is derived from its ID:

```text
/moldea/agents/{agent-id}/
```

For example, the agent ID:

```text
customer-support
```

always maps to:

```text
/moldea/agents/customer-support/
```

Every registered agent must have:

```text
/moldea/agents/{agent-id}/description.md
/moldea/agents/{agent-id}/instruction.md
```

It may also have:

```text
/moldea/agents/{agent-id}/handoff-description.md
```

The mandatory description, instruction, and optional handoff description are discovered by convention and are not redundantly declared in the manifest.

Every immediate directory under `/moldea/agents/` must correspond to exactly one registered agent ID, and every registered agent must have the matching directory. Unregistered agent directories are invalid in version `1`.

### Agent description

`description.md` is mandatory for every registered agent.

It contains a concise, vendor-independent, model-facing description of what the agent is and what it does. It should identify the agent's primary responsibility and practical scope clearly enough to serve as generic agent metadata even when no handoff use case exists.

The description is not the complete instruction and is not a routing rule. It must not contain step-by-step behavior, detailed schemas, implementation details, provider-specific configuration, runtime variables, or other content that belongs in `instruction.md` or `handoff-description.md`.

### Description-value normalization and limits

The effective value of `description.md` and, when present, `handoff-description.md` is determined independently for each file:

1. decode the file as valid UTF-8
2. remove one leading UTF-8 byte-order mark when present
3. normalize CRLF and CR line endings to LF
4. remove leading and trailing Unicode `White_Space` code points
5. preserve all remaining Unicode scalar values exactly without Unicode normalization

The effective value must contain between 1 and 1,000 Unicode scalar values, inclusive. Each normalized LF counts as one scalar value. The limit counts Markdown syntax and all other remaining content.

Additional rules:

- `moldea` writers should persist the effective value without leading or trailing Unicode whitespace.
- Runtime-variable delimiters `{{` and `}}` are prohibited in both files.
- Validation never silently truncates either value.
- A runtime adapter may enforce a stricter provider-specific size or formatting limit, but it must not weaken the repository-format maximum.
- Exceeding the format or adapter limit is an explicit deterministic validation failure.

### Agent instruction

`instruction.md` is the complete model-facing instruction used to supply the registered agent's behavior to the runtime model.

It must be non-empty Markdown and identify the owning agent at the beginning using the exact canonical agent ID wrapped in backticks. Identification is validated deterministically after UTF-8 BOM removal and LF normalization:

1. leading blank lines are ignored
2. one optional opening ATX heading is allowed; it must use one to six `#` characters followed by a space
3. blank lines immediately after that heading are ignored
4. the next non-empty line must contain the exact inline-code token `` `{agent-id}` ``

No other content may appear before the identifying line. The surrounding natural-language phrasing may vary with the instruction language.

For example:

```markdown
# Purpose

You are the `customer-support` agent for Acme.

Your purpose is to resolve customer-support requests within the rules and boundaries defined by this instruction.
```

The instruction may contain purpose, project context, responsibilities, rules, input, output, schemas, tools, skills, handoff behavior, runtime variables, failure behavior, and other model-facing requirements.

The instruction is complete and directly readable. It is not assembled from reusable `moldea` instruction fragments.

### Handoff description

`handoff-description.md` is optional.

When present, it contains a concise, vendor-independent, model-facing routing hint describing when another model, agent, workflow, or router should transfer work to this agent. It describes routing conditions rather than generally summarizing what the agent does, and it does not duplicate the complete instruction.

The file follows the common description-value normalization, 1,000-scalar-value maximum, no-truncation, and no-runtime-variable rules above.

When the file is present and structurally valid, its effective value is the agent's effective routing description. When the file is absent, the effective value of the mandatory `description.md` is used as the effective routing description.

This fallback does not make `description.md` a routing rule. The agent description remains general metadata explaining what the agent does and is used for routing-facing metadata only when no dedicated handoff description exists.

## Agent manifest shape

The following partial manifest illustrates the properties available to a registered agent. Referenced files, decisions, context, and target agents are assumed to exist elsewhere in the repository or manifest.

```yaml
agents:
  customer-support:
    runtime:
      id: openai-agents-sdk
      guidance: /moldea/runtimes/openai-agents-sdk-api.md

    context:
      - /moldea/context/customer-support.md

    decisions:
      - /moldea/decisions/1786050123456-support-boundaries.md

    variables:
      CURRENT_DATETIME:
        description: Current UTC date and time.

    bindings:
      runtimeAgent:
        path: /apps/api/src/agents/customer-support.ts
        symbol: customerSupportAgent
      inputSchema:
        path: /packages/contracts/src/customer-support.ts
        symbol: CustomerSupportInputSchema
      outputSchema:
        path: /packages/contracts/src/customer-support.ts
        symbol: CustomerSupportOutputSchema
      instructionLoader:
        path: /packages/agents/src/instructions.ts
        symbol: loadInstruction
      variableProviders:
        CURRENT_DATETIME:
          path: /packages/agents/src/runtime-context.ts
          symbol: getCurrentDatetime

    tools:
      find-order:
        name: find_order
        description: Retrieves verified order details when the agent needs to inspect status, ownership, items, or fulfillment.
        implementation:
          path: /packages/tools/src/find-order.ts
          symbol: findOrder
        registration:
          path: /apps/api/src/agents/customer-support.ts
          symbol: findOrderTool

    skills:
      investigate-order:
        name: investigate-order
        description: Applies the order-investigation process when support work requires evidence from order, payment, and fulfillment records.
        implementation:
          path: /.agents/skills/investigate-order/SKILL.md

    affectedBy:
      - /apps/api/src/support/**
      - /packages/orders/**

    mirrors:
      - /apps/eve/instructions/customer-support.md

    unresolved:
      final-refund-policy:
        category: policy
        effect: blocking
        description: The final refund-eligibility policy has not been defined.
        resolution: Define the active refund policy in project context and update the instruction and implementation to match it.
```

All agent properties except `runtime` are optional when they are not applicable. `runtime` is required for every registered agent. The `tools` and `skills` mappings are independently optional: an agent may define neither, either one, or both.

When a tool or skill is registered, every field identified as required by its capability contract—including `name`, `description`, and `implementation`—must be present.

When a material implementation relationship exists but cannot yet be registered because the implementation is unfinished, the gap is represented through an unresolved requirement rather than an invented binding.

## Runtime declaration

Every registered agent declares exactly one runtime adapter. The adapter identifies the deterministic interpretation model for that agent's AI runtime integration; it may represent a direct provider SDK, an agent SDK, an orchestration framework, another supported runtime, or `custom`:

```yaml
runtime:
  id: openai-agents-sdk
```

Runtime IDs satisfy the stable-ID lexical and length rules. `custom` has repository-format-defined semantics. Every other ID identifies an official adapter whose availability and supported runtime package versions are determined by the active Runtime Compatibility Matrix. Direct provider integrations use their available official provider adapter when repository evidence matches a verified target; they do not use `custom` merely because no separate agent framework is present.

Adapter selection represents the agent's **primary runtime integration boundary**, not every AI package present in the repository or dependency graph. When supported runtime layers are nested, select the highest-level available official adapter whose verified target actually governs the registered agent's model invocation and, when applicable, instruction loading, capabilities, schemas, routing, or variable provision. Lower-level provider SDKs and other packages used only beneath that boundary are subordinate implementation dependencies rather than competing runtime declarations. A direct-provider adapter such as `openai`, `anthropic`, or `google-genai` is selected only when that provider SDK is itself the primary runtime integration boundary for the registered agent. When two or more runtime layers materially and independently govern the same agent and no single verified official target covers the composition, use `custom` rather than choosing one arbitrarily.

If an existing agent's adapter later becomes `deprecated`, the declaration remains valid while a published deprecated target still matches. Whether the active inspection composition currently includes that adapter affects deterministic inspection availability, not the canonical meaning of `runtime.id`. Deprecation alone does not require changing `runtime.id` to `custom`. New or materially migrated runtime relationships should use an available replacement when the matrix publishes one whose verified target matches the resulting integration.

A syntactically valid runtime ID that is neither `custom` nor a recognized official adapter ID is invalid repository state. A conforming manifest parser returns the runtime-ID diagnostic for such an ID. Recognition of an official runtime ID is a document-level format rule and does not require the corresponding adapter package merely to parse the manifest. During complete adapter-aware repository inspection, a recognized official runtime whose adapter is not configured in the active Core composition produces the explicit unavailable-adapter diagnostic and prevents that inspection from being considered valid. Validation must not guess, reinterpret an unsupported declaration as `custom`, or silently select another adapter.

The manifest does not duplicate:

- runtime package version
- programming language
- package-manager metadata
- dependency-lock information

Those facts are inferred from the repository itself.

When project-specific runtime guidance is needed:

```yaml
runtime:
  id: openai-agents-sdk
  guidance: /moldea/runtimes/openai-agents-sdk-api.md
```

For a proprietary, unsupported, multi-runtime, or otherwise project-specific integration that cannot reliably use an official adapter:

```yaml
runtime:
  id: custom
  guidance: /moldea/runtimes/internal-agent-runtime.md
```

`guidance` is optional for both official adapters and `custom`. When it is omitted, the skill and adapter rely on explicit bindings and repository evidence. If the runtime cannot be understood reliably, the skill asks for clarification rather than guessing.

A referenced guidance path must point to an existing regular Markdown file under `/moldea/runtimes/**`.

In dedicated-repository mode, the implementation that establishes the agent's runtime may live in a separate application repository. For a new or materially changed runtime relationship, the canonical `moldea` repository still declares the agent's actual primary runtime adapter when an available official adapter has a verified target covering that integration; it does not use `custom` merely because the runtime package or implementation is external to the canonical repository. An existing agent may retain a still-supported deprecated adapter under the lifecycle rule above. When no available verified official target covers a new or migrated relationship and no matching deprecated declaration is being legitimately retained, the ordinary `custom` fallback rules apply. Core and runtime adapters inspect only the repository snapshot supplied to them, so deterministic runtime evidence may be absent or partial when the relevant implementation is outside that snapshot. Absence of an external runtime package, runtime agent, registration, or other implementation artifact from the canonical repository is not by itself a structural runtime mismatch. The skill may use a developer-identified related application repository as semantic evidence to select and maintain `runtime.id`, but version `1` still creates no cross-repository binding, reference, impact path, or mirror.

An agent cannot be structurally registered without a runtime ID. If the runtime choice is genuinely unknown, the skill must resolve that foundational ambiguity before registering the agent rather than inventing a runtime declaration.

## Agent context relationships

`project.md` is implicitly relevant to every registered agent.

Additional focused context is declared with:

```yaml
context:
  - /moldea/context/customer-support.md
  - /moldea/context/security-and-privacy.md
```

Each entry must point to an existing Markdown file under `/moldea/context/**`.

The list records context that materially informs the agent's instruction or behavior. It is not a runtime composition list and does not cause `moldea` to concatenate context into the instruction.

A context relationship should be added only when the relationship is meaningful. The skill asks when it cannot establish that meaning reliably.

## Agent decision relationships

Relevant active decisions are declared with:

```yaml
decisions:
  - /moldea/decisions/1786050123456-support-boundaries.md
```

Each path must point to an existing decision whose status is `accepted`.

The relationship identifies active rationale that materially affects the agent. Superseded, proposed, and rejected decisions cannot be active agent decision relationships.

## Repository references and bindings

Repository references and bindings use the same strict shape:

```yaml
path: /repository/path/to/file.ts
symbol: SomeSymbol
```

Repository-reference rules:

- `path` is required.
- `path` must resolve to an existing regular repository file.
- `symbol` is optional.
- When `symbol` is absent, the reference identifies the entire file.
- When present, `symbol` is an opaque, non-empty, single-line string with no NUL character. `@moldea.ai/core` validates only this common shape; the selected adapter may validate runtime- or language-specific syntax and existence.
- A reference to a canonical asset under `/moldea/**` must omit `symbol`.
- Repository references do not use globs.
- Version `1` has no generic `selector` property.

A binding uses this shape where the manifest declares an implementation relationship, including agent bindings and capability implementation, registration, or schema fields. When a binding omits `symbol`, the entire file is the bound implementation artifact. Broad implementation relationships belong under `affectedBy` rather than in a binding.

Unlike a general repository reference, a binding always identifies implementation outside the canonical `/moldea/**` tree. A binding path must therefore resolve to an existing regular repository file outside `/moldea/**`. Canonical `moldea` assets may still be used by repository-reference fields whose semantics explicitly permit them, such as an unresolved requirement's `related` references, but they cannot serve as implementation bindings.

A binding whose path is inside `/moldea/**` is structurally invalid.

`@moldea.ai/core` always validates the path and the allowed reference shape. An official runtime adapter may additionally resolve and validate a binding's `symbol` deterministically when supported. When symbol resolution cannot be established deterministically, `evaluate` or Assurance handles the relationship semantically rather than inventing a selector syntax.

### Agent bindings

The supported agent-level `bindings` properties are:

- `runtimeAgent`
- `inputSchema`
- `outputSchema`
- `instructionLoader`
- `variableProviders`

`runtimeAgent` identifies the implementation file or exported symbol that constitutes, constructs, or performs the registered `moldea` agent's runtime execution boundary. The property name does not require the underlying SDK to expose an `Agent` class or another first-class agent object. For a direct-provider integration, the binding may therefore identify the function, factory, module, or other implementation artifact that performs the model invocation for that registered agent.

Example:

```yaml
bindings:
  runtimeAgent:
    path: /apps/api/src/agents/customer-support.ts
    symbol: customerSupportAgent

  inputSchema:
    path: /packages/contracts/src/customer-support.ts
    symbol: CustomerSupportInputSchema

  outputSchema:
    path: /packages/contracts/src/customer-support.ts
    symbol: CustomerSupportOutputSchema

  instructionLoader:
    path: /packages/agents/src/instructions.ts
    symbol: loadInstruction

  variableProviders:
    CURRENT_DATETIME:
      path: /packages/agents/src/runtime-context.ts
      symbol: getCurrentDatetime
```

Each `variableProviders` key must be a declared runtime variable for that agent.

A binding is required when the corresponding relationship is material, exists as a qualifying implementation artifact in the same repository, and cannot be derived reliably enough from the selected runtime adapter. The open-source skill prefers explicit bindings for important runtime agents and executable input/output schemas because they materially improve deterministic indexing and Assurance precision. In dedicated-repository mode, an implementation relationship that is sufficiently established but exists only in a related application repository is not eligible for a version `1` binding and is not made unresolved merely because cross-repository bindings are prohibited; the skill may preserve the project-specific interpretation in runtime guidance and model-facing content while treating the missing deterministic cross-repository traceability as an intentional version `1` limitation.

Missing or genuinely uncertain implementation must not be represented by a fake path or fake symbol. An unfinished material relationship is represented as an unresolved requirement.

## Impact paths

Agent-level `affectedBy` identifies broader implementation areas capable of changing the behavior supported by the agent:

```yaml
affectedBy:
  - /apps/api/src/support/**
  - /packages/refunds/**
```

Exact bindings are automatically relevant and do not need to be duplicated under `affectedBy`.

Impact paths are intentionally conservative. A matching change enters relevance analysis, but `moldea` does not assume the instruction or context must change merely because a pattern matched.

The skill should be conversational when creating or changing impact relationships. If it is unclear whether an implementation area can materially affect behavior, the skill asks rather than silently binding it.

## Tool and skill descriptions

Every registered tool and skill has a required `description`.

The description is the canonical concise metadata for that capability within the owning agent. It explains:

- what the capability does
- when the owning agent should use it
- its principal scope or limitation when needed to distinguish it from nearby capabilities

A capability description must:

- be a string containing 1 to 1,000 Unicode scalar values
- contain no leading or trailing Unicode `White_Space` code point
- contain no line-break character, including CR, LF, NEL, LINE SEPARATOR, or PARAGRAPH SEPARATOR
- contain no NUL character
- contain neither runtime-variable delimiter `{{` nor `}}`
- remain vendor-independent and model-facing
- never be silently truncated

The parsed YAML string is the value validated and counted. No Unicode normalization is applied. A runtime adapter may impose a stricter provider-specific size or formatting limit, but it must not weaken the repository-format maximum.

The owning agent's `instruction.md` must materially identify every registered tool and skill by its runtime-facing `name` and communicate its description, intended use conditions, and important agent-specific constraints. The repository format does not require fixed `Tools` or `Skills` headings, exact wording, or byte-for-byte duplication of the manifest description.

`@moldea.ai/core` validates the manifest description shape deterministically. Whether the instruction accurately and sufficiently communicates the capability is semantic alignment handled by the skill, `evaluate`, and PR Assurance.

The same underlying implementation may be registered by multiple agents with different capability descriptions when its intended use differs by agent.

## Tools

Tools are agent-scoped capability relationships. They are not project-global `moldea` assets.

A tool ID is unique only within its owning agent. Multiple agents may independently register the same underlying implementation and may use the same tool ID when appropriate.

Version `1` registers only tools whose actual implementation is represented by an existing repository-local regular file. Provider-hosted, remotely implemented, or otherwise external capabilities without a repository-local implementation artifact are not represented as manifest `tools` entries in version `1`. In dedicated-repository mode, a tool implemented only in the related application repository is external to the canonical repository for this rule and therefore is not registered as a manifest tool there. Its model-facing use may still be described in the agent instruction and project-local runtime guidance, and relevant local registration or configuration code may be covered through agent bindings or `affectedBy` paths when such artifacts actually exist in the canonical repository.

Example:

```yaml
tools:
  find-order:
    name: find_order
    description: Retrieves verified order details when the agent needs to inspect status, ownership, items, or fulfillment.
    implementation:
      path: /packages/tools/src/find-order.ts
      symbol: findOrder
    registration:
      path: /apps/api/src/agents/customer-support.ts
      symbol: findOrderTool
    inputSchema:
      path: /packages/contracts/src/find-order.ts
      symbol: FindOrderInputSchema
    outputSchema:
      path: /packages/contracts/src/find-order.ts
      symbol: FindOrderOutputSchema
    affectedBy:
      - /packages/orders/**
```

A tool supports:

- `name`: required non-empty single-line runtime-facing tool name
- `description`: required capability description satisfying the shared tool-and-skill description contract
- `implementation`: required exact binding to the repository-local implementation artifact
- `registration`: optional exact binding when registration is distinct from implementation
- `inputSchema`: optional exact binding
- `outputSchema`: optional exact binding
- `affectedBy`: optional non-empty list of impact paths

The stable `moldea` tool ID and runtime-facing `name` are intentionally separate.

For example:

- `moldea` ID: `find-order`
- Runtime name: `find_order`
- Code symbol: `lookupCustomerOrder`

The stable ID preserves `moldea` history even when a code symbol or runtime-visible name changes.

The manifest description is authoritative for concise tool metadata. The implementation is authoritative for executable behavior, and the instruction is authoritative for what the model is told. These surfaces must remain semantically aligned.

Different tools within the same agent may have the same runtime-facing `name` when that reflects the actual implementation. The repository format does not reject runtime usage merely because it is unconventional. If duplicate runtime names make instruction-to-code alignment ambiguous, `evaluate` or Assurance reports the ambiguity.

When multiple agents use the same underlying tool implementation, each agent registers its own tool relationship. The implementation code itself does not need to be duplicated.

A planned tool that does not exist yet must not use a fabricated `implementation` binding. The missing capability is represented as an unresolved requirement until the implementation exists.

## Skills

Skills are also agent-scoped capability relationships. Like tools, a version `1` manifest skill requires its implementation binding to identify a qualifying repository-local file. In dedicated-repository mode, a skill implemented only in the related application repository is therefore represented semantically through the instruction and runtime guidance rather than as a cross-repository manifest skill.

A skill ID is unique only within its owning agent. Multiple agents may independently register the same underlying skill implementation.

Example:

```yaml
skills:
  investigate-order:
    name: investigate-order
    description: Applies the order-investigation process when support work requires evidence from order, payment, and fulfillment records.
    implementation:
      path: /.agents/skills/investigate-order/SKILL.md
    registration:
      path: /apps/api/src/agents/customer-support.ts
      symbol: orderInvestigationSkill
    affectedBy:
      - /.agents/skills/investigate-order/**
```

A skill supports:

- `name`: required non-empty single-line runtime-facing skill name
- `description`: required capability description satisfying the shared tool-and-skill description contract
- `implementation`: required exact binding
- `registration`: optional exact binding when registration is distinct
- `affectedBy`: optional non-empty list of impact paths

The exact runtime meaning of a skill is runtime-specific. `moldea` records the capability relationship and relies on the selected adapter, runtime guidance, explicit bindings, and repository evidence rather than imposing one universal skill runtime.

The manifest description is authoritative for concise skill metadata. The implementation is authoritative for the skill content or executable behavior, and the instruction is authoritative for what the model is told. These surfaces must remain semantically aligned.

Different skills within the same agent may have the same runtime-facing `name` when that reflects the actual implementation. If duplicate runtime names make instruction-to-code alignment ambiguous, `evaluate` or Assurance reports the ambiguity.

A planned skill that does not yet exist is represented as an unresolved requirement rather than a fake binding.

## Runtime-native routing and handoffs

Version `1` does not define a `handoffs` manifest property, stable handoff IDs, runtime handoff names, `targetAgent` references, or a canonical routing graph.

Routing and delegation remain native to the selected runtime and application implementation. The optional target-owned `handoff-description.md` provides portable model-facing routing guidance, but it does not declare which source agents may route to the target or how the runtime performs that routing.

The effective routing description is the canonical derived value for runtime metadata whose semantic purpose is target selection, routing, delegation, or handoff. Runtime integrations, runtime adapters, the skill, `evaluate`, `reconcile`, and PR Assurance classify runtime metadata according to its actual semantic role rather than its property name.

When runtime metadata helps a model, agent, router, or workflow decide whether to select, route to, delegate to, or hand off to a target agent:

- it uses the effective value of `handoff-description.md` when that file is present
- it uses the effective value of `description.md` when `handoff-description.md` is absent
- it does not fall back to `description.md` when a present handoff description is structurally invalid

A runtime property named `description` follows this rule when the runtime uses that property for routing-facing target selection. A separate runtime property used only as general descriptive metadata continues to use `description.md`. When one runtime property serves both general description and routing selection, it uses the effective routing description.

The absence of `handoff-description.md` is therefore not, by itself, missing routing metadata or routing misalignment. The mandatory `description.md` supplies the defined fallback.

Runtime adapters may deterministically inspect runtime-native routing registrations, wrappers, target references, and routing-facing target metadata. They may return routing evidence and diagnostics through the Runtime Adapter Contract, including evidence that an agent is exposed as a target or that supported routing-facing metadata is absent, stale, oversized, or not wired to the effective routing description.

An adapter emits a routing-description diagnostic only when a supported deterministic pattern mechanically proves the incorrect relationship. Dynamic or unsupported routing-description wiring remains unestablished rather than being reported as incorrect.

The skill and coding agent combine adapter evidence, project-local runtime guidance, implementation code, agent instructions, canonical descriptions, and developer direction to create or maintain routing behavior. The repository format does not infer or persist routing relationships on their behalf.

Because routing is not manifest-owned:

- `handoffs` is an unknown agent property and is invalid in a version `1` manifest
- Core performs no universal target-agent relationship validation
- Core defines no handoff implementation binding or handoff capability ID
- runtime-native routing changes may still enter semantic relevance analysis through adapter evidence, implementation bindings, or `affectedBy` paths
- `handoff-description.md` remains optional at the universal format level
- an adapter may enforce a stricter provider-specific size or formatting limit on the effective routing description
- an adapter may require supported routing-facing runtime metadata to exist and be wired correctly
- an adapter must not treat the absence of `handoff-description.md` alone as a failure when the `description.md` fallback is valid and correctly used

## Runtime variables

Runtime variables are declared per agent.

Example:

```yaml
variables:
  CURRENT_DATETIME:
    description: Current UTC date and time.

  CUSTOMER_NAME:
    description: Name of the current customer.
```

Variable IDs must:

- match `^[A-Z][A-Z0-9_]*$`
- contain at most 64 ASCII characters
- use uppercase letters, digits, and underscores only

Each variable value contains exactly one property:

- `description`: required non-empty string describing what the runtime value represents

Version `1` has no variable `required`, `optional`, `default`, `type`, or `sensitive` property.

All declared runtime variables are required when resolving an instruction.

### Placeholder grammar

A valid runtime-variable placeholder is exactly `{{VARIABLE_ID}}`, where `VARIABLE_ID` satisfies the variable-ID rules above. Placeholder scanning applies to the complete normalized contents of `instruction.md`, including headings, inline code, fenced code blocks, examples, and other Markdown content.

Version `1` has no placeholder escaping mechanism. Validation scans from left to right and applies these rules:

- every occurrence of `{{` must begin a placeholder containing exactly one valid variable ID followed immediately by `}}`
- an opening `{{` must not be immediately preceded by another `{`, and its closing `}}` must not be immediately followed by another `}`; triple-or-greater brace forms are invalid
- every occurrence of `}}` must close the currently parsed valid placeholder; an unmatched closing delimiter is invalid
- adjacent valid placeholders such as `{{FIRST}}{{SECOND}}` are allowed
- whitespace, lowercase letters, hyphens, nested braces, missing delimiters, unmatched delimiters, or any other malformed placeholder-shaped text are structural validation errors
- every valid placeholder must reference a variable declared by the owning agent
- every declared variable must appear at least once as a valid placeholder in the canonical instruction

Because placeholder-shaped text is always interpreted as syntax, an instruction cannot include a literal `{{...}}` example unless it is also a valid declared runtime variable.

Runtime-variable syntax is prohibited in `description.md` and `handoff-description.md`. Any occurrence of `{{` or `}}` in either file is invalid.

### Resolution rules

- The supplied value mapping must contain exactly the variables declared by the owning agent. Missing variables, undeclared additional variables, and non-string values are errors.
- Every supplied string must contain only valid Unicode scalar values and must not contain NUL. An unpaired UTF-16 surrogate, invalid decoded scalar representation, or NUL value is a runtime-resolution error rather than being replaced or normalized silently.
- Substitution is a single, non-recursive pass over the already validated canonical instruction. Every occurrence of each valid placeholder is replaced with the corresponding supplied string. After scalar/NUL validation, supplied values are inserted exactly as provided: they are not trimmed, Unicode-normalized, line-ending-normalized, scanned, or interpreted as additional placeholders.
- Empty strings are valid values.
- `null`, `undefined`, and strings such as `n/a` have no special `moldea` semantics.
- `moldea` supplies no defaults in version `1`.
- Runtime variables are not used to represent unfinished project work.
- Runtime substitution does not alter the canonical instruction's content digest. When a runtime-consumption SDK or REST response exposes `contentDigest`, that value identifies the Core-defined digest of the normalized canonical instruction before runtime-variable substitution. A digest of resolved variable-bearing output, if introduced later, uses a distinct field and contract.

All runtime variable values are treated as private transient data regardless of their apparent sensitivity. Variable values are not stored in `moldea.yaml`, canonical instruction history, behavioral history, logs, or other durable records merely because they were used for substitution.

Filesystem-based substitution keeps values inside the caller's process. REST handling follows the privacy and transient-value requirements of the main project specification.

## Unresolved requirements

Unresolved requirements may exist at project level or agent level.

Project-level example:

```yaml
unresolved:
  define-refund-policy:
    category: policy
    effect: warning
    description: The final refund-eligibility policy has not been approved.
    resolution: Record the accepted policy in project context and update any affected implementation bindings.
```

Agent-level example:

```yaml
agents:
  customer-support:
    unresolved:
      final-refund-output-schema:
        category: output-schema
        effect: blocking
        description: The final refund result schema has not been defined.
        resolution: Define and bind the executable output schema and update the instruction's model-facing schema to match it.
        related:
          - path: /packages/contracts/src/customer-support.ts
        reference: SUPPORT-1842
```

An unresolved requirement supports:

- `category`: required slug satisfying the stable-ID lexical and length rules; it identifies the kind of gap and need not be unique
- `effect`: required enum of `blocking`, `warning`, or `informational`
- `description`: required non-empty text describing the unresolved state
- `resolution`: required non-empty human-readable resolution criteria
- `related`: optional non-empty list of unique existing repository references related to the requirement
- `reference`: optional non-empty single-line external issue, ticket, URL, or project-specific reference string

The unresolved-requirement key is its stable ID.

`related` provides requirement-specific traceability to existing repository artifacts that help locate, understand, or verify the unresolved state. A related repository reference may identify a canonical `moldea` asset, such as a focused context file, or an implementation artifact, optionally with a symbol.

`related` is the unresolved-requirement counterpart to `affectedBy`, but it is intentionally narrower. `affectedBy` uses exact paths or globs to identify repository areas whose changes may affect an asset's behavior, while `related` uses exact repository references, optionally including a symbol, to identify artifacts relevant to evaluating one unresolved requirement. A change to a related artifact causes the requirement to be re-evaluated but does not by itself resolve it.

`related` is distinct from an agent's `context` list. `context` declares an enduring semantic relationship showing that a focused context asset materially informs the agent's instruction or behavior. `related` applies only to one unresolved requirement and does not make the referenced artifact agent context, an instruction dependency, a runtime composition input, or an implementation binding. A change to a related artifact makes that requirement relevant for re-evaluation, but does not by itself create a finding or establish that the requirement has been resolved.

`related` does not point to fabricated files or future paths. A missing future artifact is described in `description` and `resolution` until it exists.

Resolution criteria may be semantic. Version `1` does not attempt to define a general machine-executable requirement language. Deterministic checks verify the portions they can prove; the skill, `evaluate`, `reconcile`, and Assurance handle semantic resolution.

Removing an unresolved requirement is semantically valid only when its resolution criteria have actually been satisfied. A related file changing does not by itself resolve the requirement. The absence of a previously declared requirement is not, by itself, a structural error in current-state validation. When prior Git state is available, `evaluate` and PR Assurance compare the prior and proposed states and report removal that is not supported by the requirement's resolution criteria.

Unresolved requirements are not a roadmap, backlog, or issue tracker. They exist only when the unresolved state materially affects current project truth or declared agent behavior.

## Mirrors

Mirrors are declared per agent:

```yaml
mirrors:
  - /apps/eve/instructions/customer-support.md
```

A mirror is always a derived copy whose normalized textual value is equal to:

```text
/moldea/agents/{agent-id}/instruction.md
```

Rules:

- Mirrors are Git-tracked repository files in authoritative committed state.
- A mirror destination uses a repository-root-absolute logical path.
- A mirror must live outside `/moldea/**`.
- A mirror is a regular file, not a symlink.
- One mirror path may belong to only one agent.
- A mirror is not an independent source and must not be edited independently.
- The skill keeps the mirror synchronized in the same developer change as the canonical instruction.
- Version `1` mirrors perform no transformation, templating, wrapping, filtering, or runtime conversion.
- Runtimes that can read the canonical instruction directly should not create unnecessary mirrors.

Mirror equality is determined after UTF-8 BOM removal and line-ending normalization to LF. All other textual content remains significant.

A missing or stale required mirror is a deterministic validation failure when validating the committed state.

Build-generated or transformed instruction outputs are not mirrors in version `1` and are outside the repository-format contract.

## Project-local runtime deviations

`moldea` does not enforce runtime orthodoxy.

Repository-format rules govern what constitutes structurally valid `moldea` repository state. Official adapters provide runtime-aware discovery and conventional interpretation. Referenced project-local runtime guidance and explicit manifest relationships provide repository-specific semantics that supplement that baseline. Actual repository implementation and evidence are used to verify those interpretations.

For example, a repository may use a runtime covered by an official adapter through several internal wrappers, a central tool registry, generated agent definitions, direct provider call wrappers, or a custom instruction loader. `moldea`'s responsibility is to understand those conventions well enough to maintain instruction-code alignment, not to force the repository into the adapter's conventional shape.

Adapters, runtime guidance, manifest relationships, and repository evidence do not form a fixed precedence hierarchy. When they disagree about how the project works, the skill or evaluator investigates and reports the inconsistency rather than silently selecting one source. None may override `moldea` repository-format, security, authorization, or Assurance rules.

## Convention-based discovery versus manifest declaration

The repository format deliberately separates discoverable files from semantic relationships.

`moldea` discovers these by convention:

- project foundation
- context files
- decision files
- runtime-guidance files
- agent directories
- mandatory agent descriptions
- canonical instructions
- optional handoff descriptions

The manifest declares information that cannot be inferred safely:

- registered agent identities
- selected runtime adapter
- project-local runtime guidance relationships
- context-to-agent relationships
- decision-to-agent relationships
- exact code bindings
- broader impact paths
- agent-scoped tool and skill identities
- runtime-facing capability names
- concise tool and skill descriptions
- runtime variables
- mirrors
- unresolved requirements

Capability descriptions are declared in the manifest because their concise agent-specific meaning cannot be inferred reliably from implementation names alone. Their model-facing representation and detailed use conditions remain in `instruction.md`.

The manifest does not duplicate repository facts that are reliably authoritative elsewhere, including:

- runtime package versions
- programming language
- package-manager or lockfile data
- agent description path
- agent instruction path
- handoff-description path
- Git branches used by Cloud environments
- runtime variable values
- credentials or secrets

## Strict validation

`moldea.yaml` and the canonical repository layout are strict. Silent recovery from malformed structure is prohibited.

Structural validation errors include, at minimum:

- missing `/moldea/moldea.yaml`
- missing `/moldea/project.md`
- malformed YAML
- multiple YAML documents or disallowed YAML directives, anchors, aliases, merge keys, or custom tags
- YAML scalar interpretation that does not conform to YAML `1.2` Core Schema
- duplicate YAML keys
- unsupported format version
- unknown manifest properties
- invalid types
- invalid IDs
- reserved IDs
- invalid paths or globs
- exact `affectedBy` paths that do not resolve to existing regular files in authoritative committed state
- path traversal
- symlinked canonical or bound assets
- invalid runtime adapter ID syntax or a syntactically valid runtime ID that is neither `custom` nor a recognized official adapter ID
- missing or empty focused context or runtime-guidance files
- referenced runtime guidance that does not exist
- unregistered agent directories
- registered agents without matching directories
- missing mandatory agent descriptions
- empty agent descriptions after description-value normalization
- agent descriptions exceeding 1,000 Unicode scalar values
- handoff descriptions that are empty after description-value normalization
- handoff descriptions exceeding 1,000 Unicode scalar values
- missing canonical agent instructions
- missing or incorrectly placed canonical agent identification
- invalid decision filenames, frontmatter delimiters, frontmatter properties, or metadata
- duplicate decision IDs
- decision timestamp and `createdAt` mismatch
- invalid or cyclic decision supersession references
- inconsistent or orphaned decision supersession statuses
- active decision relationships pointing to non-accepted decisions
- missing context or decision references
- duplicate paths or patterns where uniqueness is required
- binding or repository-reference paths that do not exist
- binding paths that point inside the canonical `/moldea/**` tree
- invalid variable names
- malformed or unmatched runtime-variable placeholder syntax
- undeclared runtime-variable placeholders in an instruction
- declared runtime variables unused by the instruction
- variable-provider entries for undeclared variables
- runtime-variable delimiter syntax in agent descriptions or handoff descriptions
- missing tool or skill descriptions
- empty tool or skill descriptions
- tool or skill descriptions exceeding 1,000 Unicode scalar values
- multiline tool or skill descriptions
- tool or skill descriptions with leading or trailing Unicode whitespace
- NUL characters or runtime-variable delimiters in tool or skill descriptions
- missing tool or skill implementations
- mirror paths that collide across agents
- missing or stale committed mirrors
- unrecognized canonical files under `/moldea/**`

A complete adapter-aware project inspection additionally reports an explicit inspection diagnostic when a recognized package-backed official runtime adapter is unavailable to the active Core composition or does not support the active repository-format version. Those composition diagnostics prevent the inspection from being valid, but they do not make the recognized `runtime.id` malformed manifest syntax. Any future Node.js instruction-consumption SDK will not be required to load runtime adapters merely to parse the manifest.

Runtime adapters may add deterministic structural or resolution validation for supported runtime constructs, such as proving that a declared symbol exists.

Validation returns explicit, actionable issues. It never silently falls back to another path, previous manifest state, previous instruction, or inferred substitute.

## Semantic evaluation

Not every important inconsistency is a structural format error.

The following are examples of semantic evaluation rather than pure schema validation:

- whether a context item still describes current implementation behavior
- whether a project description duplicated into an instruction has become stale
- whether a tool or skill description accurately reflects its implementation and intended use
- whether every registered tool and skill is materially represented in the owning instruction with the correct runtime-facing name and use conditions
- whether a removed capability remains advertised in the instruction
- whether two runtime capabilities with the same name or similar descriptions make invocation ambiguous
- whether an agent description accurately and concisely summarizes the instruction
- whether a handoff description still matches the agent's responsibilities and the routing behavior observed in runtime-native implementation
- whether routing-facing runtime metadata uses the target agent's effective routing description, including the agent-description fallback only when no handoff description exists
- whether runtime metadata is mapped according to its actual routing or general-metadata purpose rather than its property name
- whether a general-only runtime description incorrectly uses the handoff description
- whether an agent description and handoff description have become misleadingly interchangeable
- whether a broader implementation change materially affects an agent
- whether an unresolved requirement's semantic resolution criteria are satisfied, including whether its removal from a proposed state is justified
- whether runtime guidance accurately describes actual repository structure
- whether code and instruction schemas remain semantically equivalent after runtime transformation

The open-source skill's `evaluate` operation and paid PR Assurance build on deterministic validation but may use runtime-aware and semantic analysis for these questions.

The distinction is intentional:

> `@moldea.ai/core` proves what can be proved mechanically. Agents analyze what requires project understanding.

## Diagnostic principles

Every repository-format diagnostic must be specific enough for a developer or coding agent to act on it.

A diagnostic should identify, when applicable:

- stable machine-readable error code
- manifest property or canonical asset
- repository path
- agent or capability ID
- invalid value when it is safe and useful to expose
- expected rule
- related repository reference, binding, variable, mirror, or decision

Generic messages such as `Invalid project` are insufficient when the underlying failure can be identified more precisely. Diagnostics must still follow the privacy and safe-output rules of the active implementation and must not echo arbitrary confidential content merely to identify an invalid value.

The exact diagnostic-code catalog, result shape, ordering rules, and validation-mode behavior belong to the `@moldea.ai/core` package specification. A code assigned to a version `1` rule remains stable for as long as a Core release claims version `1` support. A changed rule is represented under a new repository-format major version, and a version `1` code may be removed only when the Core release drops version `1` support.

## Security and secret handling

The repository format never stores runtime variable values, API credentials, payment credentials, Git credentials, encryption keys, webhook secrets, or other runtime secrets in `moldea.yaml`.

Canonical `moldea` content may contain confidential project information because it is client-owned source-controlled context. The skill should nevertheless avoid placing credentials or ephemeral secrets in project context, runtime guidance, instructions, decisions, or unresolved requirements.

Runtime values supplied during instruction resolution are transient and do not become repository content.

Project-local runtime guidance is treated as untrusted repository content by Cloud analysis in the same way as other repository files. It explains repository structure but cannot redefine `moldea`'s evaluator authority.

## Complete example

### Minimal complete repository

These marked fences form one complete repository and are executed against the reference Core inspection path during website generation tests.

<!-- repository-example:minimal:/moldea/moldea.yaml -->

```yaml
version: 1
```

<!-- repository-example:minimal:/moldea/project.md -->

```markdown
# Example project

Example project demonstrates the minimum complete version 1 repository.
```

### Representative manifest

The following example illustrates the version `1` manifest shape. It is illustrative; projects include only relationships they actually need.

```yaml
version: 1

context:
  /moldea/context/security-and-privacy.md:
    bindings:
      - path: /packages/security/src/encryption.ts
        symbol: encryptPrivateValue
    affectedBy:
      - /apps/api/src/security/**
      - /packages/security/**

  /moldea/context/refunds.md:
    affectedBy:
      - /apps/api/src/refunds/**
      - /packages/refunds/**

decisions:
  /moldea/decisions/1786050123456-use-postgresql.md:
    affectedBy:
      - /packages/database/**

unresolved:
  finalize-refund-policy:
    category: policy
    effect: warning
    description: The final refund-eligibility policy has not been approved.
    resolution: Record the accepted refund policy and reconcile the bound refund implementation.
    related:
      - path: /moldea/context/refunds.md
    reference: BILLING-204

agents:
  customer-support:
    runtime:
      id: openai-agents-sdk
      guidance: /moldea/runtimes/openai-agents-sdk-api.md

    context:
      - /moldea/context/security-and-privacy.md
      - /moldea/context/refunds.md

    decisions:
      - /moldea/decisions/1786050123456-use-postgresql.md

    variables:
      CURRENT_DATETIME:
        description: Current UTC date and time.
      CUSTOMER_NAME:
        description: Name of the current customer.

    bindings:
      runtimeAgent:
        path: /apps/api/src/agents/customer-support.ts
        symbol: customerSupportAgent
      inputSchema:
        path: /packages/contracts/src/customer-support.ts
        symbol: CustomerSupportInputSchema
      outputSchema:
        path: /packages/contracts/src/customer-support.ts
        symbol: CustomerSupportOutputSchema
      instructionLoader:
        path: /packages/agents/src/instructions.ts
        symbol: loadInstruction
      variableProviders:
        CURRENT_DATETIME:
          path: /packages/agents/src/runtime-context.ts
          symbol: getCurrentDatetime
        CUSTOMER_NAME:
          path: /packages/agents/src/runtime-context.ts
          symbol: getCustomerName

    tools:
      find-order:
        name: find_order
        description: Retrieves verified order details when the agent needs to inspect status, ownership, items, or fulfillment.
        implementation:
          path: /packages/tools/src/find-order.ts
          symbol: findOrder
        registration:
          path: /apps/api/src/agents/customer-support.ts
          symbol: findOrderTool
        inputSchema:
          path: /packages/contracts/src/find-order.ts
          symbol: FindOrderInputSchema
        outputSchema:
          path: /packages/contracts/src/find-order.ts
          symbol: FindOrderOutputSchema
        affectedBy:
          - /packages/orders/**

    skills:
      investigate-order:
        name: investigate-order
        description: Applies the order-investigation process when support work requires evidence from order, payment, and fulfillment records.
        implementation:
          path: /.agents/skills/investigate-order/SKILL.md
        affectedBy:
          - /.agents/skills/investigate-order/**

    affectedBy:
      - /apps/api/src/support/**
      - /packages/orders/**
      - /packages/refunds/**

    mirrors:
      - /apps/eve/instructions/customer-support.md

    unresolved:
      final-refund-output-schema:
        category: output-schema
        effect: blocking
        description: The final refund-specific output contract is not yet complete.
        resolution: Finalize and bind the executable schema, then update the model-facing schema in the instruction to match it.
        related:
          - path: /packages/contracts/src/customer-support.ts
        reference: SUPPORT-1842

  billing-support:
    runtime:
      id: custom
      guidance: /moldea/runtimes/internal-billing-agent-runtime.md

    context:
      - /moldea/context/refunds.md

    bindings:
      runtimeAgent:
        path: /apps/billing/src/agent.ts
        symbol: billingSupportAgent
```

## Conformance and future evolution

A repository conforms to version `1` when its committed Git tree—including `/moldea/**`, every manifest-referenced file, and every declared mirror—satisfies all applicable structural rules in this specification. Conformance fixtures include invalid Unicode path representations, including unpaired surrogate input in implementations whose host language can represent it. Runtime-resolution conformance additionally covers invalid scalar runtime values, NUL rejection, exact non-recursive substitution, empty-string values, and canonical `contentDigest` stability before and after substitution.

Consumers that map canonical agent metadata into runtime routing metadata additionally cover the effective-routing-description rule. Conformance cases include a present handoff description, the agent-description fallback when the handoff description is absent, no fallback from a present invalid handoff description, a routing-facing property named `description`, separate general and routing-facing description properties, a single property serving both purposes, and unsupported dynamic wiring that must not produce a false deterministic diagnostic.

The skill and local tooling may work with temporarily non-conforming working-tree state while creating or reconciling files, but they should clearly report remaining violations before presenting the work as complete.

`@moldea.ai/core` is the reference deterministic implementation of version `1` parsing, path resolution, discovery, structural validation, static variable-declaration and placeholder validation, mirror comparison, content normalization, and repository indexing semantics. Runtime consumers conform separately to this specification's runtime-value validation, exact substitution, privacy, and canonical-digest provenance rules.

The open-source skill, `moldea` Cloud, PR Assurance, and any future Node.js instruction-consumption SDK must use the same repository interpretation rather than implementing competing format rules.

New runtime adapters, compatibility-matrix entries, and project-local runtime guidance do not require a repository-format version change when the manifest semantics remain unchanged.

The repository format should evolve conservatively. Version `1` intentionally excludes features that would add ambiguity before concrete need exists, including:

- multiple runtime adapter declarations for one agent
- generic selector languages
- build-generated mirrors
- transformed mirrors
- runtime-variable defaults
- optional runtime variables
- machine-executable unresolved-requirement languages
- symlinked canonical assets or bindings
- cross-repository bindings
- manifest-declared handoff relationships, stable handoff IDs, or routing graphs
- environment-to-branch mappings in the manifest

These capabilities require explicit future design rather than implicit interpretation.

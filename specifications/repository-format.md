---
title: Repository Format specification
description: The official version 1 contract for deterministic moldea repository context, agents, capabilities, and relationships.
formatVersion: 1
---

# Repository format specification

This document defines the version `1` repository format for a `moldea` project. It is the authoritative contract for the client-owned files under `/moldea/**` and the repository relationships declared in `/moldea/moldea.yaml`.

The format is consumed by humans, coding agents, the open-source `moldea` skill, `@moldea.ai/core`, `moldea Cloud` indexing, and PR Assurance. A future Node.js instruction-consumption SDK will also conform to this format after its focused specification and release.

The repository format follows one central rule:

**Derive what can be derived from the repository. Declare only the project semantics and relationships that cannot be determined reliably.**

The format does not define Cloud environment mappings, billing, GitHub permissions, REST routes, Assurance model prompts, SDK compatibility, or other hosted-platform configuration. Those are governed by the main project specification and their dedicated companion specifications.

## Core principles

A conforming `moldea` repository follows these principles:

- Git owns canonical `moldea` content and history.
- Every canonical `moldea` asset lives under one root-level `/moldea/` directory.
- `/moldea/project.md` establishes the project foundation before agents are required.
- Canonical locations are convention-based whenever they can be determined reliably.
- `/moldea/moldea.yaml` records semantic relationships rather than duplicating discoverable repository facts.
- Every registered agent has a concise mandatory description, and complete agent instructions remain directly readable Markdown files.
- Registered tools and skills are independently optional, but every registered capability has explicit concise metadata and model-facing instruction guidance.
- Project context, decisions, instructions, capability descriptions, code bindings, and mirrors remain explicit and inspectable.
- The format describes the project as it is implemented. It does not judge whether runtime usage follows recommended practices.
- Local tooling may inspect the current Git working-tree view defined by the active local source composition, while `moldea Cloud` considers committed Git content authoritative.
- Structural validation is deterministic. The `moldea` skill and PR Assurance assess semantic questions against project evidence.

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

An **impact path** is an exact path or simple glob under `affectedBy` naming repository content whose change warrants checking whether the owner's stated facts still hold or its stated rules are followed.

An impact-path match means the affected asset should enter relevance analysis. It does not mean the asset must necessarily be changed.

### Agent description

An **agent description** is the mandatory concise, vendor-independent, model-facing summary in `/moldea/agents/{agent-id}/description.md` explaining what the agent is and what it does.

### Capability description

A **capability description** is the required concise, vendor-independent, model-facing `description` of a registered tool or skill. It explains what the capability does and when the owning agent should use it.

### Mirror

A **mirror** is a Git-tracked derived copy of one canonical agent instruction at another repository path required by a runtime or integration. Its equality is defined by the version `1` normalized-text comparison rules below.

## Repository structure

A valid project always contains:

<!-- prettier-ignore -->
```yaml
moldea/
  moldea.yaml
  project.md
```

The project grows progressively as needed:

<!-- prettier-ignore -->
```yaml
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

  agents/
    customer-support/
      description.md
      instruction.md
```

The recognized version `1` canonical locations are:

- `/moldea/moldea.yaml`
- `/moldea/project.md`
- `/moldea/context/**/*.md`
- `/moldea/decisions/*.md`
- `/moldea/agents/{agent-id}/description.md`
- `/moldea/agents/{agent-id}/instruction.md`

`context/`, `decisions/`, and `agents/` are optional and should not be created until needed.

Files under `/moldea/**` that do not match a recognized canonical location are invalid in version `1`. This keeps Cloud indexing, validation, portability, and agent discovery deterministic.

The root repository `README.md` may contain synchronization guidance maintained by the open-source skill, but it is outside `/moldea/**` and is not canonical `moldea` content.

## Git and local authoring state

A committed Git tree is authoritative for Cloud indexing, REST distribution, history, and PR Assurance.

During local development, the skill and `@moldea.ai/core` may inspect modified, staged, unstaged, renamed, deleted, or untracked working-tree files. Such files may represent valid work in progress before they are committed.

A local working tree therefore may temporarily contain new canonical assets or mirrors that are not yet Git-tracked. They become part of the authoritative `moldea` project only when committed.

Git-ignored files are outside the local repository view. Only the coding-agent integration check may read the four instruction paths `/AGENTS.md`, `/CLAUDE.md`, `/.claude/CLAUDE.md`, and `/CLAUDE.local.md` when Git ignores them, through a separate instruction reader; they never enter the project inventory, impact patterns, or any other check.

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
- mirror files

A path resolution that encounters a symlink is invalid rather than being followed implicitly.

The coding-agent instruction files are the one exception. The integration check follows a symlinked `/AGENTS.md`, `/CLAUDE.md`, `/.claude/CLAUDE.md`, or `/CLAUDE.local.md` to a regular-file target inside the repository, as described under Coding-agent integration warnings. It never follows a link out of the repository.

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

An `affectedBy` entry without `*` is an exact path and must resolve to an existing regular repository file in authoritative committed state. A syntactically valid glob may match zero files and remain valid so that it can cover future additions within the declared repository area. A completed check may report an unmatched-pattern warning. Zero matches do not invalidate the format.

## Stable IDs

`moldea` IDs are short, portable, machine-readable slugs.

Agent, tool, and skill IDs must:

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

Tool and skill IDs are unique within their owning agent. The same capability ID may be used by different agents.

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
- optional properties are omitted rather than represented as `null`, except `acceptedWarnings[].qualifier`, which accepts `null` as the same warning identity as omission
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
agents: {}
acceptedWarnings: []
```

Only `version` is required. Empty optional mappings should normally be omitted.

A minimal project therefore uses:

```yaml
version: 1
```

### Manifest property reference

The paths below are the complete version `1` property surface. Braced segments identify mapping keys owned by the repository. `[]` identifies one array entry. Container properties are listed alongside their nested properties so readers can distinguish a mapping, sequence, or object from its contents.

| Property path                                               | Required         | Type           | Purpose and constraints                                                                                    |
| ----------------------------------------------------------- | ---------------- | -------------- | ---------------------------------------------------------------------------------------------------------- |
| `version`                                                   | yes              | integer        | Selects the repository-format major version. The only version `1` value is `1`.                            |
| `context`                                                   | no               | mapping        | Declares relationships for discovered focused-context files. Keys are canonical context paths.             |
| `context.{context-path}.bindings`                           | no               | sequence       | Connects the context asset to existing implementation artifacts. Entries are unique repository references. |
| `context.{context-path}.bindings[].path`                    | yes per entry    | string         | Repository-root-absolute path to an existing regular file.                                                 |
| `context.{context-path}.bindings[].symbol`                  | no               | string         | Single-line non-empty symbol within the referenced file.                                                   |
| `context.{context-path}.affectedBy`                         | no               | sequence       | Unique exact paths or simple globs that can affect the context asset.                                      |
| `context.{context-path}.affectedBy[]`                       | yes per entry    | string         | One valid impact path.                                                                                     |
| `decisions`                                                 | no               | mapping        | Declares relationships for discovered decision records. Keys are canonical decision paths.                 |
| `decisions.{decision-path}.bindings`                        | no               | sequence       | Connects the decision to existing implementation artifacts. Entries are unique repository references.      |
| `decisions.{decision-path}.bindings[].path`                 | yes per entry    | string         | Repository-root-absolute path to an existing regular file.                                                 |
| `decisions.{decision-path}.bindings[].symbol`               | no               | string         | Single-line non-empty symbol within the referenced file.                                                   |
| `decisions.{decision-path}.affectedBy`                      | no               | sequence       | Unique exact paths or simple globs that can affect the decision.                                           |
| `decisions.{decision-path}.affectedBy[]`                    | yes per entry    | string         | One valid impact path.                                                                                     |
| `agents`                                                    | no               | mapping        | Registers agents keyed by stable agent ID.                                                                 |
| `agents.{agent-id}.context`                                 | no               | sequence       | Unique canonical context paths relevant to the agent.                                                      |
| `agents.{agent-id}.context[]`                               | yes per entry    | string         | One discovered canonical context path.                                                                     |
| `agents.{agent-id}.decisions`                               | no               | sequence       | Unique canonical decision paths relevant to the agent.                                                     |
| `agents.{agent-id}.decisions[]`                             | yes per entry    | string         | One discovered canonical decision path.                                                                    |
| `agents.{agent-id}.bindings`                                | no               | mapping        | Connects agent semantics to executable runtime artifacts.                                                  |
| `agents.{agent-id}.bindings.runtimeAgent`                   | no               | mapping        | References the executable runtime-agent definition.                                                        |
| `agents.{agent-id}.bindings.runtimeAgent.path`              | yes when present | string         | Repository-root-absolute path to an existing regular file.                                                 |
| `agents.{agent-id}.bindings.runtimeAgent.symbol`            | no               | string         | Single-line non-empty symbol within the referenced file.                                                   |
| `agents.{agent-id}.bindings.inputSchema`                    | no               | mapping        | References the executable input schema.                                                                    |
| `agents.{agent-id}.bindings.inputSchema.path`               | yes when present | string         | Repository-root-absolute path to an existing regular file.                                                 |
| `agents.{agent-id}.bindings.inputSchema.symbol`             | no               | string         | Single-line non-empty symbol within the referenced file.                                                   |
| `agents.{agent-id}.bindings.outputSchema`                   | no               | mapping        | References the executable output schema.                                                                   |
| `agents.{agent-id}.bindings.outputSchema.path`              | yes when present | string         | Repository-root-absolute path to an existing regular file.                                                 |
| `agents.{agent-id}.bindings.outputSchema.symbol`            | no               | string         | Single-line non-empty symbol within the referenced file.                                                   |
| `agents.{agent-id}.bindings.instructionLoader`              | no               | mapping        | References the implementation that loads the canonical instruction.                                        |
| `agents.{agent-id}.bindings.instructionLoader.path`         | yes when present | string         | Repository-root-absolute path to an existing regular file.                                                 |
| `agents.{agent-id}.bindings.instructionLoader.symbol`       | no               | string         | Single-line non-empty symbol within the referenced file.                                                   |
| `agents.{agent-id}.tools`                                   | no               | mapping        | Registers tools keyed by stable capability ID.                                                             |
| `agents.{agent-id}.tools.{tool-id}.name`                    | yes              | string         | Exact runtime-facing tool name.                                                                            |
| `agents.{agent-id}.tools.{tool-id}.description`             | yes              | string         | Concise model-facing description of what the tool does and when to use it.                                 |
| `agents.{agent-id}.tools.{tool-id}.implementation`          | yes              | mapping        | References the tool implementation.                                                                        |
| `agents.{agent-id}.tools.{tool-id}.implementation.path`     | yes              | string         | Repository-root-absolute path to an existing regular file.                                                 |
| `agents.{agent-id}.tools.{tool-id}.implementation.symbol`   | no               | string         | Single-line non-empty symbol within the referenced file.                                                   |
| `agents.{agent-id}.tools.{tool-id}.registration`            | no               | mapping        | References runtime registration or wiring.                                                                 |
| `agents.{agent-id}.tools.{tool-id}.registration.path`       | yes when present | string         | Repository-root-absolute path to an existing regular file.                                                 |
| `agents.{agent-id}.tools.{tool-id}.registration.symbol`     | no               | string         | Single-line non-empty symbol within the referenced file.                                                   |
| `agents.{agent-id}.tools.{tool-id}.inputSchema`             | no               | mapping        | References the executable tool-input schema.                                                               |
| `agents.{agent-id}.tools.{tool-id}.inputSchema.path`        | yes when present | string         | Repository-root-absolute path to an existing regular file.                                                 |
| `agents.{agent-id}.tools.{tool-id}.inputSchema.symbol`      | no               | string         | Single-line non-empty symbol within the referenced file.                                                   |
| `agents.{agent-id}.tools.{tool-id}.outputSchema`            | no               | mapping        | References the executable tool-output schema.                                                              |
| `agents.{agent-id}.tools.{tool-id}.outputSchema.path`       | yes when present | string         | Repository-root-absolute path to an existing regular file.                                                 |
| `agents.{agent-id}.tools.{tool-id}.outputSchema.symbol`     | no               | string         | Single-line non-empty symbol within the referenced file.                                                   |
| `agents.{agent-id}.tools.{tool-id}.affectedBy`              | no               | sequence       | Unique exact paths or simple globs that can affect the tool.                                               |
| `agents.{agent-id}.tools.{tool-id}.affectedBy[]`            | yes per entry    | string         | One valid impact path.                                                                                     |
| `agents.{agent-id}.skills`                                  | no               | mapping        | Registers skills keyed by stable capability ID.                                                            |
| `agents.{agent-id}.skills.{skill-id}.name`                  | yes              | string         | Exact runtime-facing skill name.                                                                           |
| `agents.{agent-id}.skills.{skill-id}.description`           | yes              | string         | Concise model-facing description of what the skill does and when to use it.                                |
| `agents.{agent-id}.skills.{skill-id}.implementation`        | yes              | mapping        | References the skill's canonical implementation entry.                                                     |
| `agents.{agent-id}.skills.{skill-id}.implementation.path`   | yes              | string         | Repository-root-absolute path to an existing regular file.                                                 |
| `agents.{agent-id}.skills.{skill-id}.implementation.symbol` | no               | string         | Single-line non-empty symbol within the referenced file when applicable.                                   |
| `agents.{agent-id}.skills.{skill-id}.registration`          | no               | mapping        | References runtime registration or wiring.                                                                 |
| `agents.{agent-id}.skills.{skill-id}.registration.path`     | yes when present | string         | Repository-root-absolute path to an existing regular file.                                                 |
| `agents.{agent-id}.skills.{skill-id}.registration.symbol`   | no               | string         | Single-line non-empty symbol within the referenced file.                                                   |
| `agents.{agent-id}.skills.{skill-id}.affectedBy`            | no               | sequence       | Unique exact paths or simple globs that can affect the skill.                                              |
| `agents.{agent-id}.skills.{skill-id}.affectedBy[]`          | yes per entry    | string         | One valid impact path.                                                                                     |
| `agents.{agent-id}.affectedBy`                              | no               | sequence       | Unique exact paths or simple globs that can affect the agent.                                              |
| `agents.{agent-id}.affectedBy[]`                            | yes per entry    | string         | One valid impact path.                                                                                     |
| `agents.{agent-id}.mirrors`                                 | no               | sequence       | Unique repository-root-absolute paths to Git-tracked instruction mirrors.                                  |
| `agents.{agent-id}.mirrors[]`                               | yes per entry    | string         | One declared mirror path.                                                                                  |
| `acceptedWarnings`                                          | no               | sequence       | Explicit warning acceptances with code, subject, optional qualifier, and a required reason.                |
| `acceptedWarnings[]`                                        | yes per entry    | mapping        | One closed warning acceptance, unique by code, subject, and normalized qualifier.                          |
| `acceptedWarnings[].code`                                   | yes per entry    | string         | One code from Core's acceptable-warning list.                                                              |
| `acceptedWarnings[].subject`                                | yes per entry    | string         | Repository-root-absolute logical path identifying the warning subject.                                     |
| `acceptedWarnings[].qualifier`                              | no               | string or null | Non-empty single-line qualifier containing non-whitespace; omission and null identify the same warning.    |
| `acceptedWarnings[].reason`                                 | yes per entry    | string         | Non-whitespace reason containing at most 256 Unicode scalar values.                                        |

## Manifest version

`version` is a required integer major format version.

Version `1` manifests use:

```yaml
version: 1
```

Version `1` is closed with respect to manifest property names, canonical locations, and the meanings of existing fields. Adding a manifest property, canonical location, or incompatible interpretation requires a new major format version.

Clarifications and conformance fixtures may remain within version `1` when they preserve its syntax and semantics.

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

The `context` manifest property declares explicit bindings and impact paths for a context asset. An impact path may cover a directly governed authored deliverable without a binding.

`/moldea/project.md` may also appear as a key under `context` when it owns facts or rules with explicit bindings or impact paths.

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

```

The mandatory description and instruction are discovered by convention.

Every immediate directory under `/moldea/agents/` must correspond to exactly one registered agent ID, and every registered agent must have the matching directory. Unregistered agent directories are invalid in version `1`.

### Agent description

`description.md` is mandatory for every registered agent.

It contains a concise, vendor-independent, model-facing description of the agent’s primary responsibility, practical scope, and when to route work to it.

Put step-by-step behavior, detailed schemas, and other instructions in `instruction.md`.

### Description-value normalization and limits

The normalized value of `description.md` is determined as follows:

1. decode the file as valid UTF-8
2. remove one leading UTF-8 byte-order mark when present
3. normalize CRLF and CR line endings to LF
4. remove leading and trailing Unicode `White_Space` code points
5. preserve all remaining Unicode scalar values exactly without Unicode normalization

The effective value must contain between 1 and 1,000 Unicode scalar values, inclusive. Each normalized LF counts as one scalar value. The limit counts Markdown syntax and all other remaining content.

Additional rules:

- `moldea` writers should persist the effective value without leading or trailing Unicode whitespace.
- Validation never truncates the description.
- The application must respect provider-specific limits in addition to the repository-format maximum. Core does not validate provider limits.
- Exceeding the repository-format limit is an explicit deterministic validation failure.

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

The instruction may contain purpose, project context, responsibilities, rules, input, output, schemas, tools, skills, handoff behavior, failure behavior, and other model-facing requirements.

The instruction is complete and directly readable. It is not assembled from reusable `moldea` instruction fragments.

## Agent manifest shape

The following partial manifest illustrates the properties available to a registered agent. Referenced files, decisions, context, and target agents are assumed to exist elsewhere in the repository or manifest.

```yaml
agents:
  customer-support:
    context:
      - /moldea/context/customer-support.md

    decisions:
      - /moldea/decisions/1786050123456-support-boundaries.md

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
```

Every agent property is optional. A registered agent with no manifest relationships uses an empty mapping, for example `customer-support: {}`. The `tools` and `skills` mappings are independently optional.

When a tool or skill is registered, every field identified as required by its capability contract—including `name`, `description`, and `implementation`—must be present.

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
- When present, `symbol` is an opaque, non-empty, single-line string with no NUL character. Core validates this shape and checks runtime export names under the conservative syntax-only rules below.
- A reference to a canonical asset under `/moldea/**` must omit `symbol`.
- Repository references do not use globs.
- Version `1` has no generic `selector` property.

A binding uses this shape where the manifest declares an implementation relationship, including agent bindings and capability implementation, registration, or schema fields. When a binding omits `symbol`, the entire file is the bound implementation artifact. Broad implementation relationships belong under `affectedBy` rather than in a binding.

Unlike a general repository reference, a binding always identifies implementation outside the canonical `/moldea/**` tree. A binding path must therefore resolve to an existing regular repository file outside `/moldea/**`. Canonical `moldea` assets may still be used by repository-reference fields whose semantics explicitly permit them but they cannot serve as implementation bindings.

A binding whose path is inside `/moldea/**` is structurally invalid.

`@moldea.ai/core` validates the path and reference shape. For a binding naming a symbol, it checks a syntax-only runtime export inventory for TypeScript (`.ts`, `.tsx`, `.mts`, `.cts`) and JavaScript ESM (`.js`, `.mjs`, `.jsx`). Direct runtime exports, default exports, named re-exports, and namespace re-exports can establish an exported name. Type-only exports, interfaces, and ambient declarations never satisfy a runtime symbol. Imports are not resolved and no application code is executed.

Only a complete inventory can prove an export missing. CommonJS constructs and wildcard re-exports make the inventory inconclusive. `.cjs`, declaration files, and other extensions are unsupported. Unparseable source and a pre-parse capacity refusal remain inconclusive. Core reports a proven missing export as `MOLDEA_REFERENCE_EXPORT_MISSING` (error, `references`) and records the same binding's export check as `failed`.

### Binding coverage

Coverage records name checks performed, not runtime correctness. Each record contains `entity`, `relationship`, `path`, `symbol` (or `null`), `fileCheck: 'passed'`, and `exportCheck: 'passed' | 'failed' | 'not-checked'`. A `not-checked` record also contains `exportNotCheckedReason`: `no-symbol`, `unsupported-file-type`, `unresolved-exports`, `unparseable-source`, or `resource-limit`. Missing or non-regular files produce reference diagnostics without a successful-file coverage record.

The relationship identifies one declared binding: `runtime-agent`, `instruction-loader`, `agent-input-schema`, `agent-output-schema`, `tool-implementation`, `tool-registration`, `tool-input-schema`, `tool-output-schema`, `skill-implementation`, `skill-registration`, `context-binding`, or `decision-binding`. Every declared binding, including context and decision bindings, participates. Repeated paths share one parsed inventory per operation.

Validation and every inspection page expose `coverageCounts` containing `bindings`, `exportsPassed`, `exportsFailed`, and `exportsNotChecked`. Prepared inspection offers the bounded `coverage` view. `maxCoverage` defaults to 10,000 records. Coverage never claims that a runtime uses a loader, registers a capability, applies a schema, or behaves correctly. Those relationships require the coding agent's inspection and real application tests.

Before reading a bound source for export analysis, Core compares its declared size with `maxFileBytes`, checks read-buffer headroom, and reserves `65536 + sourceBytes * (8 + 512)` logical retained bytes for text and syntax nodes. An oversized source or reservation miss records `resource-limit` without reading or parsing it. A source whose read size differs from its entry size, a source that exceeds the limit during the read, cancellation, and source failures reject the complete operation; interrupted inspection never returns partial coverage. The source buffer and parsing reservation are released after analysis; only export names remain cached. Manifest-only operations and the standalone `@moldea.ai/core/scope` matcher do not load TypeScript or inspect source files.

### Agent bindings

The supported agent-level `bindings` properties are:

- `runtimeAgent`
- `inputSchema`
- `outputSchema`
- `instructionLoader`

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
```

A binding is required when a material implementation relationship has a qualifying artifact in the same repository and helps establish instruction-code alignment. In dedicated-repository mode, record relevant facts about the related application in focused context. Manifest bindings remain repository-local.

Use bindings only for existing implementation paths and symbols.

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
- remain vendor-independent and model-facing
- never be silently truncated

The parsed YAML string is the value validated and counted. No Unicode normalization is applied. Applications must respect provider-specific limits in addition to the repository-format maximum; Core does not validate those provider limits.

The owning agent's `instruction.md` must materially identify every registered tool and skill by its runtime-facing `name` and communicate its description, intended use conditions, and important agent-specific constraints. The repository format does not require fixed `Tools` or `Skills` headings, exact wording, or byte-for-byte duplication of the manifest description.

`@moldea.ai/core` validates the manifest description shape deterministically. Whether the instruction accurately and sufficiently communicates the capability is semantic alignment reviewed by a read-only Check or PR Assurance.

The same underlying implementation may be registered by multiple agents with different capability descriptions when its intended use differs by agent.

## Tools

Tools are agent-scoped capability relationships. They are not project-global `moldea` assets.

A tool ID is unique only within its owning agent. Multiple agents may independently register the same underlying implementation and may use the same tool ID when appropriate.

Version `1` registers only tools whose actual implementation is represented by an existing repository-local regular file. Provider-hosted, remotely implemented, or otherwise external capabilities without a repository-local implementation artifact are not represented as manifest `tools` entries in version `1`. In dedicated-repository mode, a tool implemented only in the related application repository is external to the canonical repository for this rule and therefore is not registered as a manifest tool there. Its model-facing use may still be described in the agent instruction and focused context, and relevant local registration or configuration code may be covered through agent bindings or `affectedBy` paths when such artifacts actually exist in the canonical repository.

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

Different tools within the same agent may have the same runtime-facing `name` when that reflects the actual implementation. The repository format does not reject runtime usage merely because it is unconventional. If duplicate runtime names make instruction-to-code alignment ambiguous, Check or PR Assurance can report the ambiguity.

When multiple agents use the same underlying tool implementation, each agent registers its own tool relationship. The implementation code itself does not need to be duplicated.

Register a tool once its implementation exists.

## Skills

Skills are also agent-scoped capability relationships. Like tools, a version `1` manifest skill requires its implementation binding to identify a qualifying repository-local file. In dedicated-repository mode, a skill implemented only in the related application repository is therefore represented semantically through the instruction and focused context rather than as a cross-repository manifest skill.

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

The exact runtime meaning of a skill is runtime-specific. `moldea` records the capability relationship and relies on explicit bindings, implementation code, and real tests rather than imposing one universal skill runtime.

The manifest description is authoritative for concise skill metadata. The implementation is authoritative for the skill content or executable behavior, and the instruction is authoritative for what the model is told. These surfaces must remain semantically aligned.

Different skills within the same agent may have the same runtime-facing `name` when that reflects the actual implementation. If duplicate runtime names make instruction-to-code alignment ambiguous, Check or PR Assurance can report the ambiguity.

Register a skill once its implementation exists.

## Agent routing

Use the normalized value of the target agent's `description.md` for general model-facing agent metadata and for metadata used to select, delegate to, or route work to that agent. This also applies when one field serves both purposes.

Application code defines the routing rules and implements delegation. Manifest bindings and `affectedBy` paths can associate relevant implementation files with an agent. Core checks structural validity and does not infer application routing behavior.

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

## Convention-based discovery versus manifest declaration

The repository format deliberately separates discoverable files from semantic relationships.

`moldea` discovers these by convention:

- project foundation
- context files
- decision files
- agent directories
- mandatory agent descriptions
- canonical instructions

The manifest declares information that cannot be inferred safely:

- registered agent identities
- context-to-agent relationships
- decision-to-agent relationships
- exact code bindings
- broader impact paths
- agent-scoped tool and skill identities
- runtime-facing capability names
- concise tool and skill descriptions
- mirrors

Capability descriptions are declared in the manifest because their concise agent-specific meaning cannot be inferred reliably from implementation names alone. Their model-facing representation and detailed use conditions remain in `instruction.md`.

The manifest does not duplicate repository facts that are reliably authoritative elsewhere, including:

- runtime package versions
- programming language
- package-manager or lockfile data
- agent description path
- agent instruction path
- Git branches used by Cloud environments
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
- missing or empty focused context files
- unregistered agent directories
- registered agents without matching directories
- missing mandatory agent descriptions
- empty agent descriptions after description-value normalization
- agent descriptions exceeding 1,000 Unicode scalar values
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
- missing tool or skill descriptions
- empty tool or skill descriptions
- tool or skill descriptions exceeding 1,000 Unicode scalar values
- multiline tool or skill descriptions
- tool or skill descriptions with leading or trailing Unicode whitespace
- NUL characters in tool or skill descriptions
- missing tool or skill implementations
- mirror paths that collide across agents
- missing or stale committed mirrors
- unrecognized canonical files under `/moldea/**`

Core also checks declared runtime export names under the conservative syntax-only rules above. Runtime execution, SDK compatibility, provider limits, instruction loading, capability registration, schemas, and handoffs require semantic inspection and real application tests.

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
- whether an agent description accurately summarizes the instruction and serves as the canonical text for general metadata and routing
- whether a broader implementation change materially affects an agent
- whether code and instruction schemas remain semantically equivalent after runtime transformation

The open-source skill’s Check and paid PR Assurance use project context and implementation evidence to assess these questions.

The distinction is intentional:

> `@moldea.ai/core` proves what can be proved mechanically. Agents analyze what requires project understanding.

## Diagnostic principles

Every repository-format diagnostic must be specific enough for a developer or coding agent to act on it.

A diagnostic should identify, when applicable:

- stable machine-readable diagnostic code, severity, and group
- manifest property or canonical asset
- repository path
- agent or capability ID
- invalid value when it is safe and useful to expose
- expected rule
- related repository reference, binding, mirror, or decision

Generic messages such as `Invalid project` are insufficient when the underlying failure can be identified more precisely. Diagnostics must still follow the privacy and safe-output rules of the active implementation and must not echo arbitrary confidential content merely to identify an invalid value.

Core diagnostics have `source: 'core'`, `severity: 'error' | 'warning'`, and a `group`: `discovery`, `manifest`, `references`, `agents`, `mirrors`, or `integration`. Errors invalidate a project; warnings do not. A JSON Pointer into `moldea.yaml` identifies the entry's authored array position, even when Core orders diagnostics separately. This includes agent context, decision, and mirror lists; parsed manifest lists preserve authored order while derived project indexes may sort those relationships independently. The exact diagnostic-code catalog, result shape, ordering rules, and validation-mode behavior belong to the `@moldea.ai/core` package specification. Core keeps diagnostic codes stable for retained rules. Its package version governs diagnostic contract changes.

### Coding-agent integration warnings

Project validation and inspection check the root `/AGENTS.md` managed region as untrusted text. A missing file, a directory, an absent or malformed marker region, or invalid UTF-8 produces `MOLDEA_INTEGRATION_BLOCK_MISSING`: The AGENTS.md moldea block is missing. Details identify the entry kind and, where relevant, the invalid region or encoding.

A symlinked `/AGENTS.md` is followed by reading each link's stored text, the same way for every source. Link text is a POSIX path relative to the link's directory: `.` segments and repeated `/` are ignored, a leading run of `..` may climb toward the root, and at most 32 links are followed. When the chain leads to a regular file in the repository, that file gets every check in this section, still reported against `/AGENTS.md`. Any other result produces `MOLDEA_INTEGRATION_LINK_UNRESOLVED`: This instruction file's link doesn't lead to a file in the repository. Its qualifier names the reason:

- `outside`: the text is absolute, starts with a drive prefix such as `C:`, or climbs above the root;
- `missing`: the path or a link's target does not exist in the repository;
- `loop`: the chain revisits a path or would follow a 33rd link;
- `not-file`: the path or a link's target is a directory or another entry that isn't a regular file;
- `unsupported`: the text is unreadable, longer than 4096 UTF-8 bytes, empty, ends in `/`, or uses `..` after a named segment.

Nothing outside the repository is read, and no diagnostic carries link text.

A conforming installation has exactly one managed region in `/AGENTS.md`, delimited by `<!-- moldea:start -->` and `<!-- moldea:end -->` markers on complete lines. Gate command lines begin with `node "<repo-root>/<skill-path>/scripts/relevance-gate.mjs"`. The path check takes `--repository "<repo-root>"` and one or more `--path "<file>"` arguments. The adoption check takes `--repository "<repo-root>" --adoption-only`. Each form occurs at most once, and both refer to the same installation when present. The relative `<skill-path>` matches `^[A-Za-z0-9._/-]+$` and has no empty, absolute, or traversal segments. The installation provides regular `SKILL.md`, `scripts/relevance-gate.mjs`, and `assets/managed-agents-block.md` files. Core renders the asset with `{{skill-path}}` replaced by that path and compares the managed region after normalizing LF/CRLF line endings, an optional final line break after the closing marker, empty lines immediately inside the markers, and trailing spaces or tabs on the marker lines. Instruction text and its internal whitespace remain exact. Markers must still appear exactly once, in order, on their own lines; leading indentation and other marker-line content remain invalid.

An unextractable gate path or missing or non-regular installation file produces `MOLDEA_INTEGRATION_SKILL_MISSING`: The skill installation referenced by the AGENTS.md moldea block was not found. Details identify the reason or referenced installation and missing file.

A difference from the rendered region or an invalid asset encoding produces `MOLDEA_INTEGRATION_BLOCK_STALE`: The AGENTS.md moldea block differs from its skill installation. A current block produces no warning.

The check also determines whether Claude Code loads AGENTS.md. When `/CLAUDE.md` or `/.claude/CLAUDE.md` exists, only those shared files count; `/CLAUDE.local.md` counts only when neither exists, and no Claude file means no Claude warning. A file loads AGENTS.md when one line outside fenced code blocks, trimmed of surrounding spaces and tabs, is exactly `@AGENTS.md` or `@./AGENTS.md`, or `@../AGENTS.md` in `/.claude/CLAUDE.md`; when it is a link whose final target path is AGENTS.md's final target path; or when AGENTS.md is a link resolving to it. A linked Claude file with a regular-file target is checked for an import line as if it were at the link's own location. When no counted file loads AGENTS.md, a counted file whose link doesn't lead to a file in the repository produces `MOLDEA_INTEGRATION_LINK_UNRESOLVED` for it, with its reason as qualifier; otherwise `MOLDEA_INTEGRATION_CLAUDE_IMPORT_MISSING`: Claude Code instructions do not load AGENTS.md, with subject `/CLAUDE.md` when it exists, else `/.claude/CLAUDE.md`, or `/CLAUDE.local.md` when only it counts. Validation reports at most one Claude warning.

All five codes belong to `integration`, use the checked instruction file as subject and `entity.integrationPath`, and use qualifier `null`, except `MOLDEA_INTEGRATION_LINK_UNRESOLVED`, whose qualifier is its reason.

The instruction reader supplies only the direct coding-agent instruction entries and the text of a starting link. Every link target, including an instruction-named target, is looked up and read from the repository. A target absent from the repository view resolves as `missing`. The repository also supplies the referenced skill files and managed asset. The check reads at most four instruction files, follows at most 32 links for each with one lookup and one link-text read per link, and makes at most five bounded reads, each limited by `maxFileBytes` and reserved through the shared resource ledger; only its comparison findings are retained. Access failures, snapshot drift, cancellation, and resource exhaustion reject the operation. Manifest-only operations, the relevance gate, and `scope` do not run this check. Core's main entry exports `parseIntegrationBlock(text)`, returning the installation path or the reason none was found.

### Warning identity and manifest acceptance

`MOLDEA_IMPACT_PATTERN_UNMATCHED` is a warning in `references`: The impact pattern matches no files. It is not a format error because impact patterns may cover future files. The check runs after required validation, uses only remaining resource budgets, shares one bounded traversal for patterns with the same fixed directory prefix, and stops checking each pattern at its first regular-file match. If the optional pass reaches a Core or reader resource limit, it returns no pattern warnings and is marked incomplete. Cancellation and source failures propagate. Manifest-only operations and `scope` do not run it.

Every warning carries `subject`, `qualifier`, and `acceptable`. Impact-pattern subjects identify the owner's canonical context or decision path; agent, tool, and skill patterns use the owning agent's instruction path. Integration warnings use the checked instruction file as subject and qualifier `null`, except `MOLDEA_INTEGRATION_LINK_UNRESOLVED`, whose qualifier is its reason, so its acceptance names that reason. Pattern qualifiers contain the exact pattern. `ACCEPTABLE_WARNING_CODES`, exported from Core's main entry, contains `MOLDEA_IMPACT_PATTERN_UNMATCHED`, `MOLDEA_INTEGRATION_BLOCK_MISSING`, `MOLDEA_INTEGRATION_SKILL_MISSING`, `MOLDEA_INTEGRATION_BLOCK_STALE`, `MOLDEA_INTEGRATION_LINK_UNRESOLVED`, and `MOLDEA_INTEGRATION_CLAUDE_IMPORT_MISSING`. Every warning's `acceptable` flag is true exactly when its code appears in that list.

The optional top-level `acceptedWarnings` list is the sole acceptance mechanism:

```yaml
acceptedWarnings:
  - code: MOLDEA_IMPACT_PATTERN_UNMATCHED
    subject: /moldea/project.md
    qualifier: /future/**
    reason: This directory is reserved for the next release.
```

Each closed entry contains an acceptable `code`, a repository-path `subject`, an optional string or `null` `qualifier`, and a reason containing non-whitespace text and at most 256 Unicode scalar values. Omitted and `null` qualifiers represent the same identity. Codes outside the acceptable list, malformed entries, unsupported fields, missing or empty reasons, and duplicate identities produce `MOLDEA_MANIFEST_VALUE_INVALID`, with details naming the entry and field. `maxAcceptedWarnings` defaults to 256; exceeding it rejects the operation with `RESOURCE_LIMIT_EXCEEDED`.

After all checks, Core matches entries on `code`, `subject`, and `qualifier`. A matched warning remains visible with `accepted: true` and its reason. `warningCount` counts only unaccepted warnings; `acceptedWarningCount` counts accepted warnings; `diagnosticCount` is their sum with `errorCount`. Inspection counts expose the same totals as `warnings`, `acceptedWarnings`, `diagnostics`, and `errors`. Acceptance never changes validity or errors.

An acceptance that matches nothing produces `MOLDEA_ACCEPTANCE_UNMATCHED` (warning, `manifest`): The warning acceptance matches no reported warning. Its subject is `/moldea/moldea.yaml`, qualifier is the entry's JSON pointer, and `acceptable` is false. Core tracks completion per warning-producing check. An incomplete check neither matches its acceptances nor reports them as unmatched. The scope matcher parses the list without applying it.

## Security and secret handling

The repository format never stores API credentials, payment credentials, Git credentials, encryption keys, webhook secrets, or other runtime secrets in `moldea.yaml`.

Canonical `moldea` content may contain confidential project information because it is client-owned source-controlled context. The skill should nevertheless avoid placing credentials or ephemeral secrets in project context, instructions, or decisions.

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

agents:
  customer-support:
    context:
      - /moldea/context/security-and-privacy.md
      - /moldea/context/refunds.md

    decisions:
      - /moldea/decisions/1786050123456-use-postgresql.md

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

  billing-support:
    context:
      - /moldea/context/refunds.md

    bindings:
      runtimeAgent:
        path: /apps/billing/src/agent.ts
        symbol: billingSupportAgent
```

## Conformance and future evolution

A repository conforms to version `1` when its committed Git tree satisfies every applicable structural rule in this specification, including rules for canonical assets, manifest-referenced files, and declared mirrors. Conformance includes invalid Unicode paths and bindings or canonical files that violate these rules.

Consumers that supply model-facing agent metadata verify that general and routing metadata use the normalized value of the target agent’s `description.md`, including when a single field serves both purposes.

The skill and local tooling may work with temporarily non-conforming working-tree state while creating or reconciling files, but they should clearly report remaining violations before presenting the work as complete.

`@moldea.ai/core` is the reference deterministic implementation of version `1` parsing, path resolution, discovery, structural validation, mirror comparison, content normalization, and repository indexing.

The open-source skill, `moldea Cloud`, PR Assurance, and any future Node.js instruction-consumption SDK must use the same repository interpretation rather than implementing competing format rules.

The repository format should evolve conservatively. Version `1` intentionally excludes features that would add ambiguity before concrete need exists, including:

- generic selector languages
- build-generated mirrors
- transformed mirrors
- symlinked canonical assets or bindings
- cross-repository bindings
- manifest-declared handoff relationships, stable handoff IDs, or routing graphs
- environment-to-branch mappings in the manifest

These capabilities require explicit future design rather than implicit interpretation.

![moldea](cover.png)

# `@moldea.ai/cli`

The canonical read-only local command-line composition for deterministic inspection of `moldea` repositories.

The version 13 executable exposes one schema-7-only JSON contract. `validate` and `inspect` are content-free, `scope` matches changed paths by reading only the project manifest, and `content` retrieves one explicitly selected canonical text asset in bounded Unicode-safe chunks. Collection and content responses use deterministic snapshot-bound cursors, exact final UTF-8 byte accounting, a 65,536-byte default page budget, and a 1,048,576-byte hard page ceiling.

Install and invoke the CLI from each adopted repository. Global or user-home installation is outside the supported trust boundary because it can make unrelated repositories share ambient skill and executable behavior.

Tarball, installed-bin, runtime, and testing-peer checks remain the package release boundary.

## Commands

The command names are:

```bash
moldea validate
moldea inspect
moldea scope --path /src/example.ts
moldea scope --paths-stdin
moldea content --path /moldea/project.md
moldea composition
```

The executable supports top-level and command-specific help, `moldea --version`, strict option validation, and deterministic usage failures. Repository-backed commands discover and pin a Git working tree, use a no-follow exact-path reader, and retry complete provisional operations when the selected source changes. `validate` and `inspect` run the full Core inspection in a supervised analysis worker. The CLI owns repository reads and closes the worker before source post-checks or successful output. `scope` and `content` limit Git inventory to the manifest or requested canonical path. `composition` reports installed executable state without discovering a repository.

## Package boundary

The package exposes the `moldea` executable and no supported JavaScript or TypeScript import API. Its compatible-major first-class dependencies are:

- `@moldea.ai/repository`
- `@moldea.ai/repository-fs`
- `@moldea.ai/core`

The package declares `preferUnplugged: true` so Yarn Plug'n'Play materializes the executable on the physical filesystem instead of leaving the bundled ESM entry point inside ZipFS. This package-owned hint preserves repository-local Yarn execution without requiring client configuration or a `node_modules` linker.

The executable derives composition from its installed manifest, resolved foundational package versions, Core format constants, minimum Git constant and JSON schema constant.

The executable performs no network requests, telemetry, repository writes, configured Git content transformations, temporary-index operations or object-writing Git commands. Repository commands use read-only Git and no-follow filesystem observations within at most three complete snapshot attempts. Help, version and usage failures skip the installation preflight. The preflight compares installed package metadata; `composition` does not create an inspection worker.

## Runtime support

The consumer runtime range is:

```text
>=22.17.0
```

The package is Node.js-specific. `validate`, `inspect`, `scope`, and `content` require Git `2.32.0` or later; commands compare the numeric Git version and accept standard platform or vendor suffixes.

## Git working-tree discovery and normalized inventory

The starting directory is the invocation directory unless `--repository <path>` selects another path. Relative selections resolve against the invocation directory. Git determines the absolute top-level working-tree root, so ordinary repositories, unborn repositories, nested starting directories, and linked worktrees share the same discovery path.

Git runs through jg-git-commands without a platform shell, with fixed non-interactive arguments, without inherited Git environment variables, and within a 300-second timeout per command. Version output is limited to 4096 bytes and each discovery command's output to 262144 bytes, stdout and stderr together. Discovery requires Git `2.32.0` or later and rejects missing or inaccessible paths, nonrepositories, bare repositories, Git-directory paths without a usable work tree, malformed Git output, and sparse checkouts before inventory probing begins.

After discovery, `validate` and `inspect` stream NUL-delimited tracked-index and non-ignored untracked records from fixed `git ls-files` commands. `scope` applies a top-level literal pathspec for `/moldea/moldea.yaml`; `content` applies one for its validated canonical path. These selected commands do not probe the rest of a large repository. `validate` and `inspect` also run one separate instruction probe over literal pathspecs for `/AGENTS.md`, `/CLAUDE.md`, `/.claude/CLAUDE.md`, and `/CLAUDE.local.md` that adds Git-ignored files at those paths through `git ls-files --others --ignored --exclude-standard`, with the inventory budgets applied separately. Its records feed only the instruction source passed to Core's coding-agent integration check and never the general inventory. Tracked records accept only full SHA-1 or SHA-256 object IDs, index stages `0` through `3`, and Git modes `100644`, `100755`, `120000`, or `160000`. Paths are decoded as fatal UTF-8 and preserve exact Unicode scalars, case, tabs, newlines, and an initial BOM without normalization.

Raw tracked and untracked records share `maxEntries` before ownership filtering, stage collapse, or deduplication. Their combined stdout, nested-root validation stdout, any required effective `core.symlinks` stdout, and effective Git attribute stdout share `maxTotalBytes`; tracked records are charged with the longest object name, SHA-256's. Each of these Git commands may use the remaining budget for its stdout and stderr together. Stderr is never emitted: more than 4096 bytes of it is refused after the read, and any stderr from a command that otherwise succeeded, such as a warning about a directory Git could not open, fails it with `GIT_OUTPUT_INVALID`. Exceeding an inventory ceiling discards all candidates and returns the non-retryable `cli:RESOURCE_LIMIT_EXCEEDED` contract with message `A resource limit was exceeded.` Malformed output returns `git:GIT_OUTPUT_INVALID` without a partial inventory or partial attribute classification.

Every tracked `160000` gitlink establishes an excluded submodule root. The root and every candidate below it are removed without initializing, updating, or recursing into the submodule. Candidate paths containing an exact `.git` segment are also excluded; similarly named ordinary paths such as `.gitignore`, `.gitattributes`, and `.github` remain eligible.

Before ownership filtering, the CLI observes each distinct ancestor directory of every candidate once, without following it. A symlink or junction in the working tree shadows every Git candidate beneath it, whatever Git lists there, such as the files Git for Windows reads through a junction, and one untracked candidate remains at the link's own path. An unrelated link therefore produces no diagnostic, while a bound or canonical path beneath it is reported by Core as missing.

For untracked candidates, the CLI traverses only the required directory prefixes, compares native names by exact bytes, and uses no-follow filesystem observations. An exact `.git` marker is validated through bounded sanitized Git root discovery so both ordinary nested repositories and linked worktrees are recognized without reimplementing Git's control-file format. Nested-root identity follows host path semantics and falls back to stable filesystem identity for aliases such as Windows short and long path spellings, without altering exact Git logical-path spelling. Untracked candidates owned by those nested working trees are excluded. A selected-repository tracked candidate remains included even when a nested repository was created above it later. Ambiguous ownership, a symlinked boundary, unsafe raw path structure, or contradictory root output fails the complete probe with `GIT_OUTPUT_INVALID`; access failures remain `GIT_ACCESS_DENIED`.

After ownership filtering, the CLI groups exact paths in first-appearance order, retains one immutable mode-and-stage record for every unmerged index stage, and rejects duplicate stages, tracked/untracked collisions, stage-zero/conflict mixtures, or a surviving gitlink. Every remaining candidate is classified with a no-follow leaf stat. Missing paths are omitted; regular files and native symlinks retain their current type; directories, special entries, and unexplained contradictions fail atomically with `GIT_OUTPUT_INVALID`.

The effective `core.symlinks` value is queried at most once and only when a tracked Git symlink is currently a regular host file. With `core.symlinks=false`, a path whose retained stages are all mode `120000` remains a logical symlink and is marked for the immutable reader overlay. With symlink support enabled, the current host file represents an intentional file-type change. Mixed regular-file and symlink stages over a host file are accepted only when symlink support is enabled; the disabled case is ambiguous and fails with `GIT_OUTPUT_INVALID`. Native symlinks never require the overlay.

Every decoded Git candidate path is validated through `@moldea.ai/repository` before ownership filtering or missing-path omission, without case folding or Unicode normalization. Validation prepends exactly one `/`; for an untracked directory-boundary record, it first removes Git's one trailing directory terminator. A path outside the portable logical-path grammar, including a path containing ASCII control characters, invalid segments, backslashes, or a Windows drive prefix, is omitted when it is outside the canonical `/moldea` namespace. An invalid canonical path still fails the complete probe with `GIT_OUTPUT_INVALID`. Omitted paths produce no diagnostic and still count against the raw inventory limits. Surviving entries are then converted to branded repository logical paths, and the resulting immutable inventory is sorted by exact Unicode code-point order.

For every effective inventory entry, the CLI sends the exact Git-relative path through NUL-delimited stdin to one fixed `git check-attr --stdin -z` operation and strictly associates the resulting `filter`, `working-tree-encoding`, and `ident` triples. Exact effective values are retained in the immutable inventory so later snapshot comparison can detect any classification change. `unset` and `unspecified` are unguarded; `set` and every other effective value are guarded. Ordinary `text` and `eol` attributes alone remain supported. Invalid UTF-8, missing or duplicate triples, unknown paths or attributes, successful stderr, and output that cannot be associated exactly fail atomically with `GIT_OUTPUT_INVALID`.

Git attribute inspection never invokes configured filters, Git LFS, clean or smudge commands, or encoding helpers. A guarded path remains visible in lookup and listing and does not fail merely by existing. The outer content-transformation wrapper inspects the already-overlaid logical entry only when its bytes are requested. A guarded logical regular file then raises a CLI-owned non-retryable `RepositorySourceException` on the common `SOURCE_UNAVAILABLE` boundary before `readFilePage` reaches Repository FS. Native and materialized logical symlinks retain the common `ENTRY_NOT_FILE` behavior even when their host paths are guarded. When Core requests guarded regular-file bytes, the CLI translates its private marker to `git:GIT_CONTENT_TRANSFORM_UNSUPPORTED` and includes only the safe repository logical path.

The CLI passes the complete normalized logical path set to `@moldea.ai/repository-fs` exact-path selection, so the filesystem reader exposes required parent directories without admitting unrelated files. The CLI derives reader concurrency, queue, page, range, observation, and cache limits from its operation budgets. The private immutable overlay maps materialized Git symlink host files to `type: 'symlink'` in exact lookup and listing and rejects their reads with the common non-retryable `ENTRY_NOT_FILE` contract. Its `readLinkText` returns those host files' bounded bytes, which are exactly the text Git stored, so a materialized link resolves like a native one. The content-transformation guard wraps that logical view so symlink semantics take precedence, and passes `readLinkText` through. Missing or contradictory wrapper entries fail with `INVALID_SOURCE_DATA`.

The instruction reader composes the same layers over the instruction entries. Core follows instruction links inside the repository by reading each link's stored text, so a native link, a materialized link, and the same link in a hosted checkout resolve the same way, and nothing outside the repository is read.

Before attempting a snapshot, the CLI pins the selected root directory, its worktree-specific Git directory, and its shared Git common directory by absolute host path plus nonzero device and inode identity. Linked worktrees therefore retain distinct worktree identity while sharing the expected common repository identity. Each attempt verifies the complete pin, derives normalized full or path-selected inventories before and after exact-path reader creation, and runs its provisional operation only when both inventories match exactly, including entry type, retained index stages, symlink-overlay state, and content-transformation classification. The instruction inventory is probed and compared the same way, before and after reader creation.

The CLI retries the complete provisional attempt for differing inventories, Repository FS `SNAPSHOT_CHANGED` failures, and reader-creation missing-entry or parent-type failures when a fresh inventory proves the source changed. It recreates the inventory, reader, wrappers, operation state, and filesystem resource budget for every retry and never reuses provisional bytes or results. Three total attempts are allowed. Exhaustion or a changed pinned identity returns `cli:WORKING_TREE_UNSTABLE` with message `The working tree did not remain stable.` and `retryable: true`.

The CLI does not expose selected paths, candidate paths, resolved repository roots, raw process errors, or Git diagnostics in failures. Every accepted snapshot operation creates a fresh Core instance with the exact effective limits: `maxEntries`, `maxFileBytes`, `maxManifestBytes`, `maxDiagnostics`, and `maxCoverage` retain their names, while `maxTotalBytes` becomes Core's `maxTotalBytesRead`. Core's logical `maxRetainedBytes` ceiling is four times that total-read limit, capped at JavaScript's maximum safe integer, so validation and prepared inspection state remain bounded without adding another CLI option. Each `inspect` attempt prepares one content-free Core inspection and reads its requested page without a second validation pass.

Core resource refusals are mapped without loss into safe CLI error details: the limit name, configured maximum, observed or projected usage, and stable next action remain available, while repository bodies and private host diagnostics remain absent.

Known `RepositorySourceException`, `CoreConfigurationException`, and `CoreOperationException` contracts become safe `repository` or `core` errors with their owning code, documented retryability, logical repository path when applicable, and non-confidential metadata. The private content-transformation marker is translated before the common repository-source case. Unexpected failures, including an internal `RepositoryPathException`, become the generic non-retryable `cli:INTERNAL_ERROR` contract without causes or rejected values.

## Cancellation and process signals

The executable owns one operation-scoped `AbortController`. Repository-backed commands pass its signal through every Git child process, working-tree snapshot step, Repository FS creation, repository read, Core operation. `SIGINT` and `SIGTERM` abort the active operation, prevent another snapshot retry, discard an unwritten result, and exit with code `130` and `143`, respectively. The first received signal determines the exit code. A signal received after output has been completely written does not alter the completed result.

Git process cancellation uses the safe retryable `git:GIT_OPERATION_ABORTED` contract with message `The Git operation was aborted.` at internal command boundaries. When cancellation originates from a process signal before output completion, the executable may emit no human or JSON document rather than expose a successful or partial result. Active Git child processes are terminated through the same operation signal; no raw abort reason or process diagnostic is printed.

A completed Core inspection produces content-free `validate` output. Zero errors return `valid` and exit `0`; errors return `invalid` and exit `1`. Every diagnostic has severity and group. Warnings have a stable subject and qualifier, acceptance eligibility, an accepted flag and its reason when accepted. Complete errors, unaccepted warnings and accepted warnings are counted separately on every JSON page.

Binding coverage reports the checks performed on each declared reference: `fileCheck`, `exportCheck`, and a reason when an export could not be checked. TypeScript and JavaScript ESM use conservative syntax-only export inventories; CommonJS, unsupported extensions and inconclusive syntax remain not checked. A passed export check does not establish runtime wiring or SDK compatibility. Interrupted operations return an error without a partial coverage result.

`inspect` uses the same completion status and exit codes. Its allowlisted pages contain agent/runtime assignments, asset metadata, diagnostics and binding coverage. Both commands expose coverage counts and the specific file and export checks performed; a successful export check does not prove runtime wiring. Unbounded collections use independent record keys. Canonical bodies are available only through `content`.

`scope` accepts either one leading-slash repository-logical path through `--path` or NUL-delimited UTF-8 paths with the same grammar through `--paths-stdin`. Invalid paths return `PATH_INPUT_INVALID` before repository discovery; relative paths are not normalized. It reads only `/moldea/moldea.yaml`, invokes Core's deterministic manifest-only relationship matcher, and returns relevance, complete counts and digests, and paged match or diagnostic records. `content` accepts exactly one canonical `moldea` text path and returns metadata plus the largest complete Unicode-scalar chunk that fits its output page.

For JSON collection and content output, `--max-output-bytes` accepts 4,096 through 1,048,576 bytes and defaults to 65,536. The measurement covers the final newline-terminated UTF-8 envelope after JSON escaping. `--cursor` continues a prior JSON page. Cursors are opaque canonical base64url documents bound to their format version, command, normalized filters, source snapshot, last key, and checksum. Invalid, tampered, cross-command, filter-mismatched, unsupported, or stale cursors fail with a safe structured error. An envelope or atomic record that cannot fit returns `OUTPUT_BUDGET_TOO_SMALL`; output is never truncated into invalid JSON.

The default output budget remains 65,536 bytes. Large traversals use additional bounded pages without raising the page peak. The 1 MiB hard maximum is a single-response safety boundary, not a total repository-size limit.

The `inspect` unresolved count includes project-owned and agent-owned requirements across all effects. IDs are scoped to their owners, so identical IDs under different owners count separately. These readiness gaps do not themselves invalidate structurally valid project state.

Each CLI invocation is stateless. An `inspect --cursor` call repeats Git inventory and Core preparation before returning its page; a prepared Core inspection used within one process can read further pages without repeating that work. Use `scope` for changed-path relevance and `content` for one canonical file when a full inspection is unnecessary, and request only the pages needed for the task.

## Installed composition and integrity

Before `validate`, `inspect` or `composition` returns a result, installation checks compare package identities and resolved versions, compatible-major dependency declarations, Core format support, minimum Git and JSON schema constants. Source dependencies use `workspace:^<minimum>` and packed dependencies use `^<minimum>`. Missing, additional, prerelease or breaking-major substitutions fail closed. Compatible patches and minor releases are reported exactly by `composition`.

`composition` reports the installed CLI and schema versions, supported Node.js range, minimum Git, sorted foundational package versions and Core repository-format versions. It reads installed metadata without creating a worker or accessing a client repository.

Successful human and JSON reports use exit code `0`; JSON uses status `valid` and the schema 7 deterministic envelope. The command never uses status `invalid`. A contradictory installation returns the non-retryable `cli:COMPOSITION_STATE_INVALID` error with message `The installed composition state is invalid.` and exit code `3`, without a partial result. The command accesses no Git executable, repository filesystem, client manifest, network, or Cloud service.

## Development

From the monorepo root:

```bash
pnpm --filter @moldea.ai/cli typecheck
pnpm --filter @moldea.ai/cli build
pnpm --filter @moldea.ai/cli test:unit
pnpm --filter @moldea.ai/cli test:integration
pnpm --filter @moldea.ai/cli test:e2e
pnpm --filter @moldea.ai/cli test
```

Unit, integration, and end-to-end tests are colocated with their owning modules. The end-to-end suite installs real package tarballs and executes the resulting package bin without requiring any `@moldea.ai/*` package to be published. It verifies command, output, exit, security, package-content, process-signal, and repository-immutability behavior at the consumer boundary.

CI packs Repository, Repository FS, Core and CLI and tests installed commands across the supported Node versions on Linux, macOS and Windows. The packed Node harness checks bounded paging, handled worker exhaustion, timeout, readmission and parent-loss cleanup. Its failure fixtures inject only the worker workload while retaining the real packed supervisor and IPC. The fifteen repository-neutral corpus workloads run three cold samples each and check expected errors and warnings. SDK calls and runtime wiring are outside this guarantee.

The consumer checksum selection and qualification evidence live in [`consumers/`](../../consumers/). Historical evidence applies only to its recorded versions and sources.

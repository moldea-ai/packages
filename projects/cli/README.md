![moldea](cover.png)

# `@moldea.ai/cli`

The canonical read-only local command-line composition for deterministic inspection of `moldea` repositories.

The version 7 executable exposes one schema-4-only JSON contract. `validate` and `inspect` are content-free, `scope` matches changed paths by reading only the project manifest, and `content` retrieves one explicitly selected canonical text asset in bounded Unicode-safe chunks. Collection and content responses use deterministic snapshot-bound cursors, exact final UTF-8 byte accounting, a 65,536-byte default page budget, and a 1,048,576-byte hard page ceiling.

Install and invoke the CLI from each adopted repository. Global or user-home installation is outside the supported trust boundary because it can make unrelated repositories share ambient skill and executable behavior.

Tarball, installed-bin, runtime, and testing-peer checks remain the package release boundary.

## Commands

The command names are:

```text
moldea validate
moldea inspect
moldea scope --path /src/example.ts
moldea scope --paths-stdin
moldea content --path /moldea/project.md
moldea composition
```

The executable supports top-level and command-specific help, `moldea --version`, strict option validation, and deterministic usage failures. Repository-backed commands discover and pin a Git working tree, use a no-follow exact-path reader, and retry complete provisional operations when the selected source changes. `validate` and `inspect` run the full Core and adapter composition. `scope` and `content` do not load or verify adapters and limit Git inventory to the manifest or requested canonical path. `composition` reports installed executable state without discovering a repository.

## Package boundary

The package exposes the `moldea` executable and no supported JavaScript or TypeScript import API. Its exact first-class dependencies are:

- `@moldea.ai/repository`
- `@moldea.ai/repository-fs`
- `@moldea.ai/core`
- `@moldea.ai/adapter-anthropic`
- `@moldea.ai/adapter-claude-agent-sdk`
- `@moldea.ai/adapter-cloudflare-agents`
- `@moldea.ai/adapter-eve`
- `@moldea.ai/adapter-google-genai`
- `@moldea.ai/adapter-langchain`
- `@moldea.ai/adapter-langgraph`
- `@moldea.ai/adapter-openai`
- `@moldea.ai/adapter-openai-agents-sdk`
- `@moldea.ai/adapter-vercel-ai-sdk`

The package-backed `anthropic`, `claude-agent-sdk`, `cloudflare-agents`, `eve`, `google-genai`, `langchain`, `langgraph`, `openai`, `openai-agents-sdk`, and `vercel-ai-sdk` runtime adapters are active. The `custom` adapter remains built into Core and requires no separate package. Target maturity is not part of the CLI contract.

The package declares `preferUnplugged: true` so Yarn Plug'n'Play materializes the executable on the physical filesystem instead of leaving the bundled ESM entry point inside ZipFS. This package-owned hint preserves repository-local Yarn execution without requiring client configuration or a `node_modules` linker.

The executable derives its composition state from its installed manifest, actually resolved first-class package versions, active adapter singletons, Core repository-format constants, minimum Git constant, and JSON output schema constant. It carries no Runtime Compatibility Matrix or target-maturity snapshot.

The executable performs no network requests, telemetry, repository writes, configured Git content transformations, temporary-index operations, or object-writing Git commands. Repository-backed commands use read-only Git and no-follow filesystem observations within at most three complete snapshot attempts. Help, version, and usage failures do not run the installation-integrity preflight. `composition` and that preflight do not invoke Git, a filesystem repository reader, a client manifest, or Core inspection; the preflight reads installed package manifests and compares them with the actual adapter and Core composition.

## Runtime support

The consumer runtime range is:

```text
>=22.11.0
```

The package is Node.js-specific. `validate`, `inspect`, `scope`, and `content` require Git `2.30.0` or later; commands compare the numeric Git version and accept standard platform or vendor suffixes.

## Git working-tree discovery and normalized inventory

The starting directory is the invocation directory unless `--repository <path>` selects another path. Relative selections resolve against the invocation directory. Git determines the absolute top-level working-tree root, so ordinary repositories, unborn repositories, nested starting directories, and linked worktrees share the same discovery path.

Git runs directly without a platform shell, with fixed non-interactive arguments and a sanitized deterministic environment. Version output is limited to 4096 bytes per stream, and each discovery output stream is limited to 262144 bytes. Discovery requires Git `2.30.0` or later and rejects missing or inaccessible paths, nonrepositories, bare repositories, Git-directory paths without a usable work tree, malformed Git output, and sparse checkouts before inventory probing begins.

After discovery, `validate` and `inspect` stream NUL-delimited tracked-index and non-ignored untracked records from fixed `git ls-files` commands. `scope` applies a top-level literal pathspec for `/moldea/moldea.yaml`; `content` applies one for its validated canonical path. These selected commands do not probe the rest of a large repository. Tracked records accept only full SHA-1 or SHA-256 object IDs, index stages `0` through `3`, and Git modes `100644`, `100755`, `120000`, or `160000`. Paths are decoded as fatal UTF-8 and preserve exact Unicode scalars, case, tabs, newlines, and an initial BOM without normalization.

Raw tracked and untracked records share `maxEntries` before ownership filtering, stage collapse, or deduplication. Their combined stdout, nested-root validation stdout, any required effective `core.symlinks` stdout, and effective Git attribute stdout share `maxTotalBytes`, while stderr has a separate fixed 4096-byte diagnostic ceiling per Git command and is never emitted. Exceeding an inventory ceiling discards all candidates and returns the non-retryable `cli:RESOURCE_LIMIT_EXCEEDED` contract with message `A resource limit was exceeded.` Malformed output returns `git:GIT_OUTPUT_INVALID` without a partial inventory or partial attribute classification.

Every tracked `160000` gitlink establishes an excluded submodule root. The root and every candidate below it are removed without initializing, updating, or recursing into the submodule. Candidate paths containing an exact `.git` segment are also excluded; similarly named ordinary paths such as `.gitignore`, `.gitattributes`, and `.github` remain eligible.

For untracked candidates, the CLI traverses only the required directory prefixes, compares native names by exact bytes, and uses no-follow filesystem observations. An exact `.git` marker is validated through bounded sanitized Git root discovery so both ordinary nested repositories and linked worktrees are recognized without reimplementing Git's control-file format. Nested-root identity follows host path semantics and falls back to stable filesystem identity for aliases such as Windows short and long path spellings, without altering exact Git logical-path spelling. Untracked candidates owned by those nested working trees are excluded. A selected-repository tracked candidate remains included even when a nested repository was created above it later. Ambiguous ownership, a symlinked boundary, unsafe raw path structure, or contradictory root output fails the complete probe with `GIT_OUTPUT_INVALID`; access failures remain `GIT_ACCESS_DENIED`.

After ownership filtering, the CLI groups exact paths in first-appearance order, retains one immutable mode-and-stage record for every unmerged index stage, and rejects duplicate stages, tracked/untracked collisions, stage-zero/conflict mixtures, or a surviving gitlink. Every remaining candidate is classified with a no-follow leaf stat. Missing paths are omitted; regular files and native symlinks retain their current type; directories, special entries, and unexplained contradictions fail atomically with `GIT_OUTPUT_INVALID`.

The effective `core.symlinks` value is queried at most once and only when a tracked Git symlink is currently a regular host file. With `core.symlinks=false`, a path whose retained stages are all mode `120000` remains a logical symlink and is marked for the immutable reader overlay. With symlink support enabled, the current host file represents an intentional file-type change. Mixed regular-file and symlink stages over a host file are accepted only when symlink support is enabled; the disabled case is ambiguous and fails with `GIT_OUTPUT_INVALID`. Native symlinks never require the overlay.

Every decoded Git candidate path is validated through `@moldea.ai/repository` before ownership filtering or missing-path omission, without case folding or Unicode normalization. Validation prepends exactly one `/`; for an untracked directory-boundary record, it first removes Git's one trailing directory terminator. A path outside the portable logical-path grammar, including a path containing ASCII control characters, invalid segments, backslashes, or a Windows drive prefix, fails the complete probe with `GIT_OUTPUT_INVALID`. Surviving entries are then converted to branded repository logical paths, and the resulting immutable inventory is sorted by exact Unicode code-point order.

For every effective inventory entry, the CLI sends the exact Git-relative path through NUL-delimited stdin to one fixed `git check-attr --stdin -z` operation and strictly associates the resulting `filter`, `working-tree-encoding`, and `ident` triples. Exact effective values are retained in the immutable inventory so later snapshot comparison can detect any classification change. `unset` and `unspecified` are unguarded; `set` and every other effective value are guarded. Ordinary `text` and `eol` attributes alone remain supported. Invalid UTF-8, missing or duplicate triples, unknown paths or attributes, successful stderr, and output that cannot be associated exactly fail atomically with `GIT_OUTPUT_INVALID`.

Git attribute inspection never invokes configured filters, Git LFS, clean or smudge commands, or encoding helpers. A guarded path remains visible in lookup and listing and does not fail merely by existing. The outer content-transformation wrapper inspects the already-overlaid logical entry only when its bytes are requested. A guarded logical regular file then raises a CLI-owned non-retryable `RepositorySourceException` on the common `SOURCE_UNAVAILABLE` boundary before `readFilePage` reaches Repository FS. Native and materialized logical symlinks retain the common `ENTRY_NOT_FILE` behavior even when their host paths are guarded. When Core requests guarded regular-file bytes, the CLI translates its private marker to `git:GIT_CONTENT_TRANSFORM_UNSUPPORTED` and includes only the safe repository logical path.

The CLI passes the complete normalized logical path set to `@moldea.ai/repository-fs` exact-path selection, so the filesystem reader exposes required parent directories without admitting unrelated files. The CLI derives reader concurrency, queue, page, range, observation, and cache limits from its operation budgets. The private immutable overlay maps materialized Git symlink host files to `type: 'symlink'` in exact lookup and listing, rejects their reads with the common non-retryable `ENTRY_NOT_FILE` contract, and never calls the underlying `readFilePage` for those paths. The content-transformation guard wraps that logical view so symlink semantics take precedence. Missing or contradictory wrapper entries fail with `INVALID_SOURCE_DATA`.

Before attempting a snapshot, the CLI pins the selected root directory, its worktree-specific Git directory, and its shared Git common directory by absolute host path plus nonzero device and inode identity. Linked worktrees therefore retain distinct worktree identity while sharing the expected common repository identity. Each attempt verifies the complete pin, derives normalized full or path-selected inventories before and after exact-path reader creation, and runs its provisional operation only when both inventories match exactly, including entry type, retained index stages, symlink-overlay state, and content-transformation classification.

The CLI retries the complete provisional attempt for differing inventories, Repository FS `SNAPSHOT_CHANGED` failures, and reader-creation missing-entry or parent-type failures when a fresh inventory proves the source changed. It recreates the inventory, reader, wrappers, operation state, and filesystem resource budget for every retry and never reuses provisional bytes or results. Three total attempts are allowed. Exhaustion or a changed pinned identity returns `cli:WORKING_TREE_UNSTABLE` with message `The working tree did not remain stable.` and `retryable: true`.

The CLI does not expose selected paths, candidate paths, resolved repository roots, raw process errors, or Git diagnostics in failures. Every accepted snapshot operation creates a fresh Core instance with the exact effective limits: `maxEntries`, `maxFileBytes`, `maxManifestBytes`, `maxDiagnostics`, and `maxEvidence` retain their names, while `maxTotalBytes` becomes Core's `maxTotalBytesRead`. The active package-backed adapter set contains the immutable `anthropic`, `claude-agent-sdk`, `cloudflare-agents`, `eve`, `google-genai`, `langchain`, `langgraph`, `openai`, `openai-agents-sdk`, and `vercel-ai-sdk` adapter singletons; Core's built-in `custom` behavior remains available without registration.

Known `RepositorySourceException`, `CoreConfigurationException`, and `CoreOperationException` contracts become safe `repository` or `core` errors with their owning code, documented retryability, logical repository path when applicable, and non-confidential metadata. The private content-transformation marker is translated before the common repository-source case. Unexpected failures, including an internal `RepositoryPathException`, become the generic non-retryable `cli:INTERNAL_ERROR` contract without causes or rejected values.

## Cancellation and process signals

The executable owns one operation-scoped `AbortController`. Repository-backed commands pass its signal through every Git child process, working-tree snapshot step, Repository FS creation, repository read, Core operation, and any applicable adapter invocation. `SIGINT` and `SIGTERM` abort the active operation, prevent another snapshot retry, discard an unwritten result, and exit with code `130` and `143`, respectively. The first received signal determines the exit code. A signal received after output has been completely written does not alter the completed result.

Git process cancellation uses the safe retryable `git:GIT_OPERATION_ABORTED` contract with message `The Git operation was aborted.` at internal command boundaries. When cancellation originates from a process signal before output completion, the executable may emit no human or JSON document rather than expose a successful or partial result. Active Git child processes are terminated through the same operation signal; no raw abort reason or process diagnostic is printed.

A successfully completed Core inspection produces `validate` human or JSON output without exposing the project index, canonical content, or adapter evidence details. Zero diagnostics return status `valid` and exit code `0`; one or more diagnostics return status `invalid` and exit with code `1`. Diagnostics use bounded pages in JSON mode.

`inspect` uses the same completion status and exit codes. Human output reports the repository format and complete collection counts. JSON output contains only allowlisted metadata records: identifiers, logical paths, digests, scalar and UTF-8 lengths, references, relationships, requirements, diagnostics without arbitrary details, and evidence summaries without adapter detail payloads. Unbounded child collections are emitted as independently keyed records, so no parent record grows with the repository. A recursive guard rejects any non-`content` result containing a `content` property or an exact canonical body.

`scope` accepts either one repository-logical path through `--path` or NUL-delimited UTF-8 paths through `--paths-stdin`. It reads only `/moldea/moldea.yaml`, invokes Core's deterministic relationship matcher without adapters, and returns relevance, complete counts and digests, and paged match or diagnostic records. `content` accepts exactly one canonical moldea text path and returns metadata plus the largest complete Unicode-scalar chunk that fits its output page.

For JSON collection and content output, `--max-output-bytes` accepts 4,096 through 1,048,576 bytes and defaults to 65,536. The measurement covers the final newline-terminated UTF-8 envelope after JSON escaping. `--cursor` continues a prior JSON page. Cursors are opaque canonical base64url documents bound to their format version, command, normalized filters, source snapshot, last key, and checksum. Invalid, tampered, cross-command, filter-mismatched, unsupported, or stale cursors fail with a safe structured error. An envelope or atomic record that cannot fit returns `OUTPUT_BUDGET_TOO_SMALL`; output is never truncated into invalid JSON.

The 65,536-byte default is retained by a reproducible three-sample resource corpus covering ordinary and 1,024-path repositories, large Unicode content, broad relationship output, dense diagnostics, and invalid binary content. Large traversals use additional bounded pages without raising the page peak. The 1 MiB hard maximum is a single-response safety boundary, not a total repository-size limit.

## Installed composition and integrity

Before `validate`, `inspect`, or `composition` produces a result, the executable compares its installed package metadata, actually resolved first-class package identities and versions, exact first-class dependency declarations, active package-backed adapter registration, Core repository-format support, minimum Git constant, and JSON output schema constant. Source-workspace dependencies must use exact `workspace:<version>` declarations; packed dependencies must use the same exact published version. Loose ranges, package-manager overrides, missing or additional first-class dependencies, mismatched package identities or versions, duplicate or invalid adapter IDs, package-backed registration of `custom`, unsupported adapter formats, and invalid constants fail before Git discovery or repository inspection.

`composition` reports the installed CLI version and JSON schema version in the envelope, plus the supported Node.js range, minimum Git version, sorted exact package versions, Core repository-format versions, and every sorted executable adapter with its accepted repository formats. Core's built-in `custom` adapter is included using Core's format support. The CLI does not report matrix entries, maturity, implementation status, target profiles, evidence links, or compatibility claims owned by the packages website. Current published technical compatibility and target maturity are available from [`https://packages.moldea.ai/compatibility/runtimes.json`](https://packages.moldea.ai/compatibility/runtimes.json).

Successful human and JSON reports use exit code `0`; JSON uses status `valid` and the schema 4 deterministic envelope. The command never uses status `invalid`. A contradictory installation returns the non-retryable `cli:COMPOSITION_STATE_INVALID` error with message `The installed composition state is invalid.` and exit code `3`, without a partial result. The command accesses no Git executable, repository filesystem, client manifest, network, or Cloud service.

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

CI separately packs Repository, Repository FS, Core, every active package-backed adapter, and CLI and installs them with npm scripts disabled and strict engine validation on Node.js `22.11.0`, latest Node.js 22, Node.js `24.11.0`, latest Node.js 24, and Node.js `26.8.1`. Dedicated runtime harnesses verify each adapter's installed inspection boundary and the CLI's installed identities plus real `version`, `composition`, `validate`, `inspect`, `scope`, and `content` execution. Linux owns this consumer-runtime matrix, while the complete repository tests continue to run on Linux, macOS, and Windows.

Every active package-backed adapter has its own repository fixtures, package tests, packed-runtime consumer check, and verified compatibility claim. Qualification execution remains outside this repository; targets with a committed skill profile may publish its canonical evidence URL through the compatibility matrix.

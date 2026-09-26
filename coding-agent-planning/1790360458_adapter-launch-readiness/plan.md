# Package launch readiness and adapter evolution

## Objective and task contract

Prepare all fifteen public packages and the packages website for launch, so the next skill version can consume accurate, stable, resource-bounded package contracts.

This plan incorporates the reviewed agent conversation, repository investigation, upstream research, plan challenge, specification reinspection, and the developer's subsequent decisions. Milestones 1–8 have been implemented, reviewed, and pushed. This revision adds the developer-approved correction for Eve 0.67.0, which removed `defineAgent.outputSchema`. Milestone 9 release work is partly implemented but uncommitted. The remaining implementation includes package work and the explicitly listed documentation-only changes in the sibling `platform` repository. The developer separately authorized signed repository pushes after each completed and reviewed milestone. Npm publication, deployment, platform application changes, and the next skill implementation remain outside that authorization.

### Agreed requirements

- Update the existing ten adapter families for the concrete capabilities and corrections below. Preserve support for their existing eligible older SDK implementations.
- Preserve independent package versioning, compatible-major Moldea dependencies, and the current minimum-only upstream SDK eligibility ranges. A new upstream release, by itself, must not invalidate an installation or produce a warning.
- Interpret the confirmed Eve 0.67.0 removal of agent-definition output schemas by declared-version range. Retain older supported Eve forms; never claim an agent schema is wired when the eligible SDK has removed that field.
- Introduce native diagnostic severity: errors fail completed validation; warnings communicate a specific unverified relationship without failing validation. Operational failures remain failures.
- Use one authoritative implementation. Remove superseded Moldea paths as they are replaced; retain older SDK source patterns because they remain supported product behavior.
- Keep the architecture simple. Extend existing owners and shared primitives; avoid a runtime compatibility engine, repository execution, global agent enumeration, or a new Core orchestration model.
- Measure complete workflows, cumulative output, and repeated work. Keep content, memory, I/O, diagnostics, evidence, and execution bounded.
- Update the website, technical documentation, executable capability catalog, and selected public examples alongside the packages.
- Synchronize the affected platform-owned specifications with their implementation. Preserve the recent specification-ownership clarification and unrelated edits.
- Website UI does not require a new focused specification. Its existing README, package documentation, declarations, tests, and packed artifact remain sufficient for this launch audit.
- Finish with evidence for every public package. Passing isolated tests or changing a dependency declaration does not establish production readiness.
- State the Repository FS path-based containment boundary accurately: the selected tree must be trusted against hostile concurrent directory replacement during inspection. Detect stable root and ancestor replacement, but do not claim a guarantee against races between filesystem calls.

### Exclusions

- Hosted OpenAI Agents API integration, additional adapter families, and implementation of the next skill.
- Provider execution, model calls, SDK-managed storage migrations, remote credentials, or tests against paid provider accounts.
- Platform application changes, skill qualification execution, npm publication, tags, merges, and website deployment.
- Arbitrary import-graph interpretation, executing client repositories, dynamic runtime discovery, or claims that every future SDK release has been verified.
- Persistent inspection caches, background services, and broad unrelated modernization.
- A native filesystem binding or platform-specific handle-relative implementation for containment against hostile concurrent mutation.
- Editing protected coding-instruction files.
- Creating `platform/moldea/context/website-ui-package.md` or making unrelated platform documentation changes.

## Inspected baseline and evidence

The initial inspection used packages commit `dca170b4a21f21df5cdcbbdb25ae0971ed3c0bd8` before implementation. The root README, blueprint, development and release guides, affected contracts, adapter implementations, CLI projections, website generators, package manifests, test configuration, and release-selection code grounded the original plan. The current packages `HEAD` is `9e7ec9ae011acbedf471f9fb7c2c36d437c90cbf` after Milestone 8. Milestone 9 package changes are uncommitted. The sibling platform live worktree contains concurrent unrelated agent changes; documentation work uses an isolated platform worktree instead.

The original specification reinspection used the then-clean sibling `platform` worktree at commit `554f2d27cebab0b24809fb4fd723b28a2165a3e0`. Its ownership edits established platform ownership of specifications. Current packages implement Core 5, CLI schema 5, and severity-aware diagnostics. The platform Repository FS specification was synchronized with its trusted-tree boundary and pushed as `113f5f74b9170e90880bed3de7df6c3c760affc5`. The isolated platform worktree is now based on `b19e2d6740e9b82aff0e621dffe21977b7fb50ae` and has an uncommitted Repository FS version update to match the package's pending `2.0.2` release. The earlier plan challenge is superseded by this revision.

### Implementation state at this revision

- Milestones 1–8 are completed and pushed through packages commit `9e7ec9ae011acbedf471f9fb7c2c36d437c90cbf`. Milestone 8 closed the stable Repository FS root/ancestor replacement and page-cache growth defects, completed the fifteen-package audit and resource calibration, exercised the packed CLI, and synchronized the platform trusted-tree specification. These changes remain completed work, not a request to reimplement them.
- Milestone 9 currently has uncommitted release-selector graph/config changes and focused integration tests; `docs/npm-releases.md` synchronization; a Repository FS `2.0.2` bump and affected test fixtures; and an isolated platform specification version edit. The root release tests, root typecheck/lint, and targeted formatting have passed for those inputs. Final artifact/consumer gates, current-commit CI, release check, documentation verdict, and pushes remain pending.
- The exact Eve 0.67.0 npm tarball changelog says `outputSchema` was removed from `defineAgent`, `defineRemoteAgent`, `defineWorkspaceAgent`, and related definitions. Its shipped TypeScript declaration omits `PublicAgentDefinitionBase.outputSchema`, while Eve 0.66.3 includes it. The current Eve adapter still accepts the key and emits `agent-output` schema evidence when bound, so a 0.67.0 project can receive false positive proof. This is a confirmed launch defect, not a reason to raise the minimum or cap the upstream range.
- `pnpm upstream:check` and `pnpm upstream:check:latest` passed for the September 26 pinned and latest inputs, including Eve 0.67.0 in the latest check. Their compiler scenarios do not exercise this agent-definition property. Current-change macOS and Windows evidence is still required.

Development uses Node.js 24.15.0, pnpm 11.9.0, TypeScript 6.0.3, Vitest 4.1.10, Vite 8.2.1, and semver 7.8.5. The website uses Astro 7.2.2, Tailwind CSS 4.3.3, Zod 4.3.6, and Playwright 1.62.1. These tooling versions are not upgrade targets.

### Current architecture

- `projects/repository` owns source-neutral paths, snapshots, bounded reader contracts, and the memory reader.
- `projects/repository-fs` owns bounded, path-based filesystem access under a tree trusted against hostile concurrent mutation.
- `projects/core` owns canonical validation, resource accounting, per-agent adapter invocation, exact same-runtime agent resolution, and prepared inspection pages.
- `packages/adapter-static-analysis` owns private parsing and inspection primitives bundled into public adapters.
- Each `projects/adapter-*` package owns SDK semantics, supported source forms, evidence, and diagnostic definitions.
- `projects/cli` owns installed composition, Git snapshots, commands, bounded serialization, exit status, and JSON schema 5.
- `projects/website-ui` owns shared Astro components and presentation primitives.
- `apps/website` generates documentation and executable examples from package contracts; it is not a sixteenth public package.

## Completed contract and adapter work

Milestones 1–7 implemented the approved diagnostic contract without a parallel notices collection. Core owns a required `error` or `warning` severity and a closed unverified-relationship payload. Confirmed errors fail completed validation; warnings-only results remain valid with CLI exit 0. Core, CLI, and website expose complete error and warning counts, preserve source-safe details, and reject malformed adapter output. The warning does not assert the relationship as verified or create persisted unresolved requirements. The ten adapter catalogs own their stable codes, messages, and SDK-specific decisions. The exact public fields, codes, tests, and examples are recorded in the current source and [launch report](../../docs/launch-readiness.md).

The ten existing adapters gained the reviewed Anthropic/OpenAI request-method and effective-option support, Google streaming, Claude Agent SDK `/core` and prompt controls, Cloudflare Think and deferred-tool boundaries, Eve nested/workspace discovery and exclusion fixes, Vercel deferred tools, LangGraph resume-schema interrupt handling, and scoped LangChain/OpenAI Agents SDK warnings. Older eligible source forms remain supported. Minimum-only upstream ranges remain eligibility declarations, not proof of every future runtime behavior. Pinned minimum/current/boundary checks and an explicitly invoked latest maintenance check provide exact-version evidence without introducing runtime version ceilings or a new adapter target.

The packages website and Website UI now consume JSON schema 5 and show executable warning, error, and representative new-capability examples. Generated content and browser checks are recorded in the launch report. No separate `website-ui-package.md` is required. The next skill and hosted platform applications have not migrated. Do not redo these completed changes absent a demonstrated final-gate regression.

### Eve 0.67.0 output-schema correction

The shipped Eve 0.66.3 TypeScript declaration accepts `defineAgent({ outputSchema })`; 0.67.0 removes that field, and its changelog directs callers to request structured output per turn through the session API or `ctx.agent()`. The adapter inspects definitions rather than running them, so the smallest correction is one known boundary at `0.67.0` in its existing version classifier. Applying that known behavior to later eligible releases is an operational interpretation, not verification of every future release; a future contrary SDK change requires a new review. This correction does not add a general runtime compatibility engine, a new diagnostic code, or a new eligibility ceiling. Tool `defineTool.outputSchema` is a separate supported relationship and must remain intact.

Update `projects/adapter-eve/src/constants/index.ts`, `contracts/index.ts`, `inspection/package-inspection.ts`, and `inspection/agent-inspection.ts` to classify the agent-definition field from the owning package's declared Eve ranges before emitting `agent-definition` or `agent-output` evidence. For a declaration confined below 0.67.0, keep current supported source and binding behavior. For a declaration wholly at or above 0.67.0, an authored closed `defineAgent.outputSchema` property or declared agent `outputSchema` binding is a confirmed unavailable feature: emit the existing `EVE_SDK_FEATURE_UNAVAILABLE` error with a precise feature identifier, and emit neither agent-definition nor agent-output evidence derived from that invalid definition. For a declaration spanning the boundary, emit the existing nonblocking `EVE_RUNTIME_RELATIONSHIP_UNVERIFIED` warning only when that property or binding is relevant; withhold the affected agent-definition, agent-output, and dependent conclusions. A version declaration alone produces no warning. A supported 0.67.0 definition without that property or binding retains ordinary positive evidence. Unknown source shapes remain present-unsupported rather than guessed. Preserve the existing source-local error/warning cascade behavior and safe details.

Use the colocated `projects/adapter-eve/src/inspection/inspection.test-integration.ts` public Core boundary to cover exact 0.66.3, 0.67.0, a spanning range, minimum-only range, authored property with and without manifest binding, binding without the source property, no-schema 0.67.0 definitions, dependent handoff/routing evidence, and unaffected tool output schemas. Update diagnostic-catalog fixtures only if an existing code/message contract changes; none is planned. Add an integrity-pinned 0.67.0 boundary in `scripts/upstream-compatibility/targets.ts` and update `eve-scenarios.ts` or its existing fixture owner to prove the real new SDK accepts the current form and rejects the old field, while the pinned 0.66.3 case continues to accept the older form. Run these checks without a provider call.

Synchronize `projects/adapter-eve/README.md`, `docs/verified-target.md`, `docs/evidence-and-diagnostics.md`, and `docs/binding-example.md`; keep the latter's `^0.39.1` older-version example explicit. Update the Eve technical entry in `compatibility/runtimes.yaml`, regenerate `docs/runtime-compatibility.md` and affected website compatibility presentation, and update `../platform/moldea/context/adapter-eve-package.md` in the isolated platform worktree. The public website Eve example in `apps/website/src/lib/capabilities/runtime-examples/eve.ts` should demonstrate current 0.67.0 agent syntax without the removed agent schema field while retaining tool output-schema evidence; update its exact executed witness and presentation text. Preserve an older pinned example in package docs so both behaviors remain discoverable. Do not change the global Repository Format's optional schema binding contract, other adapters, or the next skill for this runtime-specific correction.

### Upstream reference snapshot

The npm latest versions were rechecked on 2026-09-26. They are test baselines, not runtime ceilings.

| Adapter family    | Retained minimum eligibility                                 | Reviewed current baseline                              |
| ----------------- | ------------------------------------------------------------ | ------------------------------------------------------ |
| Anthropic         | `@anthropic-ai/sdk >=0.117.1`                                | 0.128.0                                                |
| Claude Agent SDK  | `>=0.3.234`                                                  | 0.3.283                                                |
| Cloudflare Agents | Think >=0.16.0; AIChat >=0.10.2; agents >=0.21.0; ai >=7.0.0 | Think 0.19.0; AIChat 0.12.0; agents 0.24.0; ai 7.0.116 |
| Eve               | `>=0.39.1`                                                   | 0.67.0                                                 |
| Google Gen AI     | `>=2.17.1`                                                   | 2.24.0                                                 |
| LangChain         | langchain >=1.5.9; core >=1.2.8                              | 1.5.12; core 1.2.12                                    |
| LangGraph         | langgraph >=1.4.12; core >=1.2.9                             | 1.4.18; core 1.2.12                                    |
| OpenAI            | `openai >=7.4.0`                                             | 7.23.0                                                 |
| OpenAI Agents SDK | `>=0.16.1`                                                   | 0.18.0                                                 |
| Vercel AI SDK     | `ai >=7.0.66`                                                | 7.0.116                                                |

Relevant primary references include [Anthropic Messages source](https://raw.githubusercontent.com/anthropics/anthropic-sdk-typescript/sdk-v0.128.0/src/resources/messages/messages.ts), [OpenAI Responses source](https://raw.githubusercontent.com/openai/openai-node/v7.23.0/src/resources/responses/responses.ts), [Google Models reference](https://googleapis.github.io/js-genai/release_docs/classes/models.Models.html), and the [exact Eve 0.67.0 npm archive](https://registry.npmjs.org/eve/-/eve-0.67.0.tgz) containing the shipped changelog and declarations. Capture immutable package versions and source references in test provenance; moving upstream documentation is not a reproducible test input.

## Completed production verification for the other public packages

The following Milestone 8 audits and corrections are complete. Their package-level evidence is recorded in `docs/launch-readiness.md`; the combined packed-consumer and operating-system gates remain in the final milestone.

### Repository

Audit and verify existing path validation, memory-reader snapshots, ordering, cursor continuation, byte ranges, UTF-8 boundaries, malformed input, and conformance behavior. Reuse `projects/repository/src` tests and packed testing-peer consumers. Preserve environment neutrality and public subpaths. Add coverage only for a demonstrated contract gap.

### Repository FS

Audit and verify exact-path selection, traversal rejection, source drift, bounded listing and ranges, cancellation, concurrency, cache bounds, and cleanup through the existing reader and integration tests. The reader resolves one root and checks logical path containment; it rejects stable descendant symlinks and junctions, rechecks the pinned root and path ancestors during access, and opens the final file without following a symlink where Node supports that flag. The selected tree must be trusted against hostile concurrent mutation because path checks and opens are separate operating-system calls. Do not describe this as unconditional native containment or a race-resistant security boundary. Preserve `SNAPSHOT_CHANGED` for detected replacement and do not add a misleading success or weaker error path. Exercise real filesystem behavior locally in Milestone 8 and on the established operating-system matrix after its reviewed commit is pushed, as a Milestone 9 final gate. Do not claim Windows safety from Linux-only execution.

The demonstrated stable-root escape must have a built-package or real-filesystem regression. Cover replaced ancestors, queue/cancellation recovery, and the independent cache entry-count limit. Keep the cache bounded by `maxCachedBytes` and at most 4,096 nonempty pages without a new public option. Synchronize the package README and its selection, security, and cache guides with the same threat model and cache policy. The stronger hostile-race guarantee would require a separately designed, supported cross-platform handle-relative implementation; it is excluded from this launch plan by the developer's decision.

### Core and CLI

In addition to diagnostic work, verify malformed adapter output, agent-scope isolation, raw-result resource limits, retained-memory accounting, snapshot consistency, canonical-content boundaries, safe error translation, cancellation, and installed composition.

Packed CLI scenarios must cover `version`, `composition`, `validate`, `inspect`, `scope`, and `content`, including warnings-only and mixed outcomes. Preserve source immutability and the current no-network/no-provider-execution contract.

### Website UI

Retain the existing public component and utility surface unless verification exposes a concrete defect. Run the real tarball installation and Astro consumer build in `projects/website-ui/src/index.test-integration.ts`, plus utility tests and website browser coverage.

Use existing `ResultSummary`, `StatusBadge`, `CodeBlock`, `FilePreview`, `Dialog`, `Accordion`, and theme/site utilities. Existing warning tones already satisfy the proposed diagnostic presentation. Do not introduce equivalent local primitives or change Astro/Tailwind peer versions for this task.

The developer explicitly waived a separate `website-ui-package.md`. Audit Website UI against its existing README, package documentation, public declarations, tests, and packed consumer. The absence of that additional file is not a readiness blocker.

Record a package-by-package result for all fifteen packages in `docs/launch-readiness.md`: reviewed surface, executed checks, artifact verification, discovered defects and resolutions, and remaining limitations. A materially unverified or failing package prevents the final readiness verdict.

## Specification and documentation synchronization

Synchronize the following existing files in `../platform/moldea/context/` as documentation-only implementation deliverables:

| File                                   | Required synchronization                                                                                                                                                                            |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `runtime-adapter-contract.md`          | Core 5 composition, severity, the exact shared warning payload, validation, counts, safe output, and coordinated adapter majors                                                                     |
| `core-package.md`                      | Error-based completed validity, warning/error counts, diagnostic contracts, inspection behavior, and Core 5                                                                                         |
| `cli-package.md`                       | CLI 9, schema 5, discriminated diagnostic records, complete counts, human warnings, and exit semantics                                                                                              |
| `repository-format.md`                 | Clarify that proof of incorrect routing is required for an error; scoped unverified warnings do not change structural validity or persisted unresolved requirements                                 |
| `packages.md`                          | Synchronize affected current CLI/schema references and explicitly allow Website UI's existing package documentation to satisfy its documentation requirement without a new focused specification    |
| `adapter-anthropic-package.md`         | Common warning contract and version, effective request options, create/parse/stream methods, and output-schema support                                                                              |
| `adapter-openai-package.md`            | Common warning contract and version, named imports, request options, create/parse/stream methods, and output-schema support                                                                         |
| `adapter-google-genai-package.md`      | Common warning contract and version, streaming generation, and corresponding supported/excluded patterns                                                                                            |
| `adapter-claude-agent-sdk-package.md`  | Common warning contract and version, `/core` imports, prompt controls, and retained query-local relationships                                                                                       |
| `adapter-cloudflare-agents-package.md` | Common warning contract and version, known cached-prompt boundary, `configureContext`, precedence, and deferred tools                                                                               |
| `adapter-eve-package.md`               | Common warning contract and version, nested/workspace discovery, registration/exposure, defaults, version-sensitive exclusions, and the Eve 0.67.0 agent output-schema removal                      |
| `adapter-vercel-ai-sdk-package.md`     | Common warning contract and version, deferred tools, and limits on availability claims                                                                                                              |
| `adapter-langgraph-package.md`         | Common warning contract and version, two-argument interrupts, resume schemas, and additive node options                                                                                             |
| `adapter-langchain-package.md`         | Common warning contract and version; further behavioral text only for verified in-scope corrections                                                                                                 |
| `adapter-openai-agents-sdk-package.md` | Common warning contract and version; further behavioral text only for verified in-scope corrections                                                                                                 |
| `repository-fs-package.md`             | Replace unconditional containment/no-follow claims with the trusted-tree requirement and detected stable-replacement behavior; record the 4,096 nonempty-page cache cap and its verification limits |

Update affected diagnostic catalogs, examples, conformance requirements, and exclusion lists within those files. Replace superseded descriptions of the released package contract; preserve older upstream source forms that remain intentionally supported. Do not change statements about a hosted application's actually installed Core 4 merely because the packages advance to Core 5.

Apply the corresponding narrow routing-diagnostic clarification to `packages/specifications/repository-format.md`, preserving unrelated differences between the documents. Repository Format remains version 1. Synchronize package-owned READMEs/docs, generated references, compatibility YAML, and website consumers with these same contracts.

The platform `runtime-compatibility-matrix.md` already expresses the agreed minimum-only eligibility policy and requires no planned policy or schema change. Update technical entries in `packages/compatibility/runtimes.yaml` and regenerate their presentations. The Repository FS correction is already reflected in `repository-fs-package.md`; only its pending 2.0.2 version reference remains to be committed. The Repository specification still needs a change only if another in-scope correction changes its documented contract. Do not create `website-ui-package.md`.

Keep `agent-skill.md`, `context-gathering.md`, and skill implementation changes in the subsequent skill work. The final handoff must identify schema-4 consumption, severity-aware interpretation, and stale package-version references that the next skill revision must address. Do not imply that the existing skill or hosted platform has migrated.

Read current applicable platform instructions and worktree changes before implementation edits. Preserve concurrent author changes and the recent platform ownership clarification. Format only the named changed specification files with that repository's existing formatter. Review both repositories' exact diffs and verify that examples, warning contracts, versions, and boundaries agree; no platform application tests or build are needed for prose-only specification changes. The packages build continues to use local documentation and must not depend on the sibling repository at runtime or in CI.

Specification synchronization is part of completion, not an outstanding handoff or optional follow-up. Record the reviewed platform commit/worktree state and synchronized paths in the launch-readiness report. If the named specifications cannot be updated or concurrent changes create a contract conflict, report the blocker before claiming launch readiness.

## Resource efficiency and scalability

### Preserve the existing safety envelope

Keep independent input, file, entry, retained-memory, output, evidence, and diagnostic limits; do not raise them simply to make tests pass. Preserve the CLI's 65,536-byte default and 1 MiB maximum unless measurements justify a separately reviewed change.

Byte budgets are not token guarantees. Report cumulative serialized bytes and command/page counts; do not present an arbitrary byte-to-token ratio as exact model consumption.

### Measurements and corrections

The implemented `scripts/resource-calibration/calibration.ts`, colocated integration coverage, reusable synthetic fixture construction, and `pnpm resource:measure` establish the baseline. The completed audit recorded measured V8 heap separately from Core logical retention and compared cumulative CLI continuation work.

Measure complete workflows on ordinary, many-agent/shared-source, broad-tool, deeply nested Eve, dense-warning/error, large-source, and multi-page repositories. Record elapsed time, peak process memory, reader calls/bytes, parser invocations, emitted records, cumulative output bytes, and snapshot attempts. Use repeated samples and fixed inputs; timing results are evidence, not brittle correctness assertions. Obtain detailed counts through fixture-local instrumentation at existing reader and parser boundaries; do not add a public instrumentation API solely for these tests.

Required checks:

- Repeated access inside one inspection session reuses its existing promise caches.
- Eve discovery builds lookup indexes once per scoped root and does not repeatedly scan all descendants for every child.
- New request-method support does not repeat whole-source analysis per method.
- Every new collection is bounded by existing operation limits, with explicit failure rather than partial success.
- Large source and nested syntax fail predictably at supported resource boundaries; AST overhead is measured separately from Core's logical byte accounting.
- Filesystem page-cache metadata cannot grow without a count bound when callers request many tiny or empty ranges; the 4,096-entry ceiling complements the byte budget.
- Warnings do not cause repeated full inspections or unbounded output accumulation.
- Unstable working trees retain the existing bounded complete-attempt retry behavior.

Retain the stateless CLI and operation-local caches. A fresh CLI continuation currently rebuilds inspection; document and measure that cumulative cost explicitly. Favor targeted `scope` and `content` workflows in package guidance. Prepared Core inspection already supports repeated pages without revalidation within one process.

Do not add persistent or cross-operation caching without evidence and a separately approved design covering snapshot identity, ownership, capacity, invalidation, and failure behavior. If representative launch workloads cannot complete within the documented envelope, readiness is blocked; present the measurements and revise the affected design instead of masking the problem with larger limits.

Milestone 8 recorded results, supported workload assumptions, and material remaining costs in `docs/launch-readiness.md`. The final report must retain these limits and must not claim unlimited scalability.

## Release propagation and package versions

### Bundled private inputs

Extend `scripts/npm-release/{project-changes,git,types}.ts` and colocated tests to account for committed private workspace inputs.

- Build the relevant private workspace dependency graph from the base and current committed manifests. Treat private workspace dependencies declared in `dependencies` or `devDependencies` as build inputs, including the currently bundled static-analysis package. Do not traverse public development tools as bundled private packages. This conservative rule may select an extra release for a future private development dependency, but cannot silently omit the current bundled implementation.
- Propagate release-relevant private implementation changes through private dependencies to consuming public artifacts. Stop propagation at external public-package boundaries.
- Inspect both graph states so removal, renaming, or replacement of a bundled dependency cannot hide a change.
- Preserve test-only, excluded-directory, and nonshipped-documentation exclusions.
- Treat implementation changes under `configs/vite/` and `configs/typescript/` as release-relevant for their public library-build consumers, with test-only changes excluded. Keep this mapping explicit and covered by the release-selection tests.
- Fail clearly on an invalid dependency graph; do not silently skip a bundled dependency.
- Verify source-only private changes select affected adapters and require version increases. They must not force an unchanged CLI release for a compatible adapter patch.
- Compare real packed artifacts in integration coverage to establish that the selection rule follows shipped behavior.
- Preserve publication ordering, trusted publishing, checksum verification, and recovery semantics.

### Coordinated prelaunch contract release

The required diagnostic field and changed result semantics are breaking package contracts under the existing release policy.

| Package                               | Coordinated version                                                                                |
| ------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Core                                  | 5.0.0                                                                                              |
| CLI                                   | 9.0.0, implementing JSON schema 5 only                                                             |
| Anthropic and OpenAI adapters         | 5.0.0                                                                                              |
| Other eight adapters                  | 4.0.0                                                                                              |
| Repository, Repository FS, Website UI | Keep independent versions; Repository FS now requires 2.0.2 for its shipped Milestone 8 correction |

Update adapters to `workspace:^5.0.0` for Core. Update CLI and website dependency declarations to the new compatible majors. Preserve compatible-major updates within the new contract; this is not lockstep versioning or an exact-patch installation policy.

Update `pnpm-lock.yaml`, CLI composition expectations, package integration/version assertions, compatibility implementation ranges, and package installation examples together.

Implement JSON schema 5 without a schema 4 reader or optional-severity shim. Remove superseded code, tests, and documentation describing the replaced contract. Repository Format version 1, compatibility matrix version 2, and public compatibility JSON schema 1 remain unchanged unless an actual shape change requires reconsideration.

Existing cursors are opaque and must fail when their format or result digest no longer matches. They require no persisted-data migration. No database migration is part of this work.

Publication and deployment remain outside implementation approval. Before publication, registry/tag checks must confirm the proposed versions remain available; never overwrite an existing release. A pre-publication rollback restores the coherent prior source/dependency state. After publication, corrections use new versions through the existing release workflow.

## Ordered implementation strategy

These are strategic steps, not independently authorized milestones.

1. **Completed: establish regression and upstream fixtures.** The confirmed source probes became colocated regression tests, minimum/current/boundary provenance was captured, and complete-workflow resource baselines were established.
2. **Completed: implement diagnostic severity end to end.** Core, adapters, CLI, immediate website consumers, package documentation, affected platform specifications, both format documents, counts, and schema/version expectations were updated together. Warnings-only and malformed-warning behavior was checked through real adapter, Core, and CLI boundaries.
3. **Completed: extend shared parsing and version interpretation.** The method family, call/options preservation, and known-boundary classifier were implemented; consumers migrated and the superseded private configuration removed.
4. **Completed: correct and extend adapters.** The adapter scope above has focused tests, current/minimum SDK evidence, package docs, matching platform adapter specifications, and runtime-pattern witnesses.
5. **Completed: website examples and presentation.** Authoritative content and selected public examples were regenerated and verified with browser/accessibility and artifact checks.
6. **Completed: close resource and package-readiness gaps.** Milestone 8 finished the representative aggregate measurements and fifteen package audits, corrected Repository FS stable replacement and cache growth, and synchronized its platform trusted-tree specification. Current-change macOS/Windows evidence remains the final step 9 gate.
7. **In progress: complete release propagation and coordinated versions.** Finish the private bundled-input graph, shared build-config selection, manifest/version updates, packed-artifact comparison, and release-selection checks already started in Milestone 9.
8. **Correct the Eve 0.67.0 boundary.** Implement the version-sensitive agent output-schema interpretation with focused Core and exact SDK tests. Synchronize the Eve package docs, technical matrix/generated presentation, latest-facing website witness, and isolated platform specification before final release gates. Keep tool schema support and older Eve examples.
9. **Run the complete launch gates and report readiness.** Run the pushed-current-commit macOS/Windows CI matrix and the final combined consumer checks, record exact results and limitations, confirm completed specification synchronization, inspect both repositories' scoped diffs, and produce the next-skill handoff. Stop with a reviewable implementation; do not publish or deploy.

Keep required tests, exports, error documentation, examples, and documentation with their implementation step. A step is not complete while its public contract is inconsistently represented.

## Verification commands and acceptance gates

Use the existing scripts and established serial integration/e2e boundaries. New tests remain colocated, use the existing Node/browser environments, and are excluded from production artifacts. Any new category requires only its minimal discovery/script changes. Ensure the affected shared Vitest configuration, Playwright discovery, and fixture/build traversal explicitly exclude `_archive`, `_archives`, `_backup`, and `_backups` with all descendants; apply the same exclusions to inspection and release-input traversal.

During implementation, run the narrowest relevant package or root suite first, including:

```text
pnpm test:root:unit
pnpm test:root:integration
pnpm --filter @moldea.ai/adapter-static-analysis test
pnpm --filter @moldea.ai/core test
pnpm --filter @moldea.ai/cli test
pnpm --filter @moldea.ai/adapter-eve test
pnpm --filter @moldea.ai/website-ui test
pnpm upstream:check
pnpm upstream:check:latest
pnpm resource:measure
```

Run each changed adapter's existing `test:unit` and `test:integration` scripts through its exact package filter. The final workspace gates are:

```text
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
pnpm compatibility:check
pnpm docs:check
pnpm website:check
pnpm --filter @moldea.ai/packages-website test:e2e
```

Reuse successful results for identical inputs rather than rerunning expensive suites mechanically. Root correctness coverage must still include all existing unit, integration, and e2e categories. Format only changed files during development; the final check may inspect the repository.

Use the existing CI consumer matrix: Node.js 22.11.0, latest 22, 24.11.0, latest 24, and 26.8.1 where the packages advertise them; the documented Vitest testing-peer matrix; and Linux, macOS, and Windows jobs. Website UI retains its own Node/Astro/Tailwind contract. Missing required infrastructure is reported as unverified, not passed.

Validate the complete fifteen-tarball inventory, exports/types, runtime dependencies, absence of private workspace imports, absence of tests/source leaks, checksums, and installed composition. Run `release:check-changes` against exact implementation commits once those commits exist; implementation does not create commits merely to run that gate. Its integration tests must exercise the selection rules before then.

### Completion criteria

- All ten adapters satisfy their retained advertised behavior and the explicitly added capabilities.
- Every confirmed defect has a regression test through the meaningful boundary.
- Older/newer support and known semantic differences are distinguished without new runtime version ceilings.
- Eve 0.66.3 can still prove directly wired agent output schemas; Eve 0.67.0 cannot emit that proof, and mixed declarations remain explicitly unverified only when the removed relationship matters. Eve tool output schemas and no-schema agent definitions retain their valid evidence.
- Warnings are actionable, nonblocking, bounded, and visible through Core, CLI, and website examples; errors and operational failures remain effective.
- No uncertain relationship is simultaneously presented as verified.
- All fifteen packages have passing applicable regression, type, artifact, and consumer checks, with no unresolved material correctness or verification finding.
- The packages website accurately presents the new contracts and examples and passes required visual, accessibility, responsive, theme, and artifact checks.
- Private bundled changes cannot silently escape release selection.
- Resource measurements establish the documented launch envelope and expose cumulative costs.
- Documentation, exception contracts, diagnostic catalogs, JSDoc, compatibility data, and generated presentations agree with implementation.
- The listed platform specifications, including the Repository FS trusted-tree boundary, and local format wording are synchronized; recent unrelated edits are preserved. Website UI readiness does not depend on creating a separate specification.
- No obsolete Moldea contract implementation or unjustified compatibility layer remains.

## Risks, handoffs, and limits of the result

- Upstream releases may occur during implementation. Recheck latest versions at final verification; report additional relevant changes explicitly instead of silently expanding scope or narrowing eligibility. The documented Eve 0.67.0 boundary is the one additional developer-approved correction in this revision.
- Static analysis establishes bounded source relationships. It does not prove model behavior, runtime execution, provider acceptance, or compatibility with every future release.
- Warnings intentionally allow work to continue with a named unverified conclusion. The next skill must preserve that distinction and seek targeted evidence when its task depends on it.
- Core logical retained-byte limits are not a process-RSS guarantee. Resource calibration must examine parser and object overhead as well as repository bytes.
- Repository FS's path-based checks detect stable symlink or junction replacement but cannot guarantee containment against a hostile process racing checks and opens. Callers must trust the selected tree against adversarial concurrent mutation; do not claim a stronger guarantee from Linux-only tests or from Node's final-component `O_NOFOLLOW` flag.
- Stateless CLI continuation retains repeated preparation cost. A passing single-page test is not evidence for an acceptable complete traversal.
- The named platform specification updates are documentation-only deliverables within this plan. They do not migrate hosted consumers or the skill, change their installed dependencies, or authorize broader platform edits. Cross-repository commits and publication remain separate actions.
- Skill qualification and its published evidence remain separate work. Preserve truthful links and identify any evidence that needs renewal.
- Protected coding instructions already cover the general engineering workflow. Reassess their durable guidance after implementation and provide a separate-model handoff only if an actual gap remains.
- No production-readiness claim is made by creating this plan. The verdict depends on completed implementation and verification evidence.

## Approval required

Approve this revised remaining scope: preserve completed Milestones 1–8; finish Milestone 9 release-selection propagation; correct the confirmed Eve 0.67.0 agent output-schema boundary with focused tests and synchronized package, website, compatibility, and platform documentation; then complete the pushed-current-commit operating-system evidence, final artifact and consumer matrix, upstream recheck, and truthful launch verdict. The earlier milestone breakdown is invalidated and must be regenerated from this revision before milestone-scoped implementation resumes.

The developer's prior signed repository-push authorization remains subject to completion and review of each approved milestone. This revision does not authorize npm publication, website deployment, platform application changes, unrelated cross-repository changes, a new Website UI specification, or the next skill implementation.

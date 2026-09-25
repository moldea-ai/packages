# Package launch readiness milestones

## Basis and execution rules

This sequence implements `coding-agent-planning/1790360458_adapter-launch-readiness/plan.md`, SHA-256 `0d3258767b4615b18a50fe406747a9dddbd6061d0bbba8589afcf6f678ba3eae`. The plan remains authoritative for the exact contracts and exclusions. All nine milestones are pending; no implementation has begun.

The inspected baseline remains packages commit `dca170b4a21f21df5cdcbbdb25ae0971ed3c0bd8` and platform commit `554f2d27cebab0b24809fb4fd723b28a2165a3e0`. Both have clean tracked worktrees; the packages planning directory is untracked. This breakdown changes only `milestones.md`.

Execute milestones in the numbered order. Each requires explicit authorization identifying that milestone. Finish its production changes, tests, documentation, and verification; present its review checkpoint and stop. A later milestone does not excuse an incomplete earlier contract or missing correctness evidence.

The first milestone is necessarily broad: required severity changes every adapter result and its consumers. It also establishes the resource baseline before those changes. Shared analyzer changes are subsequently delivered with their real adapter consumers. Fixture preparation belongs to the milestone that fixes the relevant behavior; do not leave deliberately failing regression suites, unused abstractions, compatibility shims, or speculative scaffolding between milestones.

### Requirements shared by every milestone

- Preserve minimum-only SDK eligibility, existing prerelease handling, independent Moldea versioning, compatible-major dependencies, and intentionally supported older SDK source forms. A new upstream release alone causes neither a warning nor a failure.
- Confirm worktree state before editing and preserve concurrent changes. Read applicable platform instructions before editing its named specifications. Those edits remain documentation-only; package builds must not depend on the sibling checkout.
- Keep tests colocated and source-derived, preserve category isolation and production-build exclusions, and exclude `_archive`, `_archives`, `_backup`, and `_backups` with all descendants from affected discovery and traversal. Update only necessary scripts/configuration for categories that actually exist.
- Run focused checks first and broader affected-package regressions afterward. Check types, lint, formatting, builds, and packed consumers wherever the changed contract requires them. Reuse passing results only while their exact inputs remain unchanged.
- Synchronize affected package READMEs/docs, diagnostic catalogs, exports, exception contracts, reachable JSDoc `@throws`, compatibility entries, generated references, and website consumers within the same milestone. Use existing generators; never hand-edit generated artifacts.
- Every newly advertised full/partial runtime pattern receives an executable catalog witness in its owning adapter milestone. Public example selection and broader presentation are completed in Milestone 7; required behavioral evidence is not deferred there.
- Preserve bounded reads, cancellation, source immutability, content safety, snapshot behavior, and operation-local caches. No provider calls, execution of inspected repositories, production SDK dependencies, persistent caches, or global agent enumeration are added.
- Update `docs/launch-readiness.md` with actual checks, defects/resolutions, artifact evidence, and limitations as work proceeds. Pending work must remain explicitly unverified. A material blocker or architectural deviation requires reporting and plan revision before expanding scope.
- Do not edit protected coding instructions. Publication, deployment, commits, tags, merges, platform application changes, skill qualification execution, new runtime families, a separate Website UI specification, and next-skill implementation remain excluded.

## Milestone 1: Native diagnostics across the complete inspection path

**Objective:** Deliver one coherent severity-aware contract through real adapters, Core, CLI, and existing website consumers, with coordinated versions, synchronized specifications, and a measured resource baseline.

**Dependencies:** Approval and explicit authorization for this milestone. Both repository checkouts must be available for the specified documentation synchronization.

### Scope and implementation

- Core: `projects/core/src/{diagnostics,diagnostic-utilities,adapter-validation,adapter-execution,contracts,project-validation,project-inspection}/index.ts`, structural diagnostic construction and scope results, `src/index.ts`, `src/adapter/index.ts`, and colocated tests.
- All ten adapters: `src/diagnostics/index.ts`, `src/contracts/index.ts`, affected inspection branches, result constructors, and public-result tests. Introduce each exact unverified-relationship code and stable message from the plan; retain all confirmed-failure codes as errors.
- Add required `severity`, the Core-owned `IUnverifiedRelationship`, `IUnverifiedRelationshipDetails`, `IAdapterErrorDiagnostic`, and `IAdapterWarningDiagnostic`, and the discriminated `IAdapterDiagnostic`. Keep `{ evidence, diagnostics }` and existing scalar-only error details.
- Implement the plan's exact closed warning union: unsupported/dynamic source reasons carry `relationship`; version-dependent reasons additionally carry safe `packageName`, normalized-or-null `declaredRange`, and canonical `boundaryVersion`. Preserve the exact relationship/subject rules for agents, instructions, schemas, tools, skills, handoffs, routing, and variable providers. Reuse existing entity identities and require an allowed repository-logical source location.
- Core validates reason-specific keys, code/message/severity combinations, subjects, safe wire syntax, descriptors, and existing resource limits. Invalid output retains `ADAPTER_EXECUTION_FAILED`. SDK interpretation and SemVer normalization stay adapter-owned; add no Core release table or range solver.
- Derive validity and complete error/warning counts once in Core. Preserve deterministic ordering, deduplication, identity, digests, and raw diagnostic accounting before deduplication. An uncertain relationship yields neither positive proof nor a false wiring error; independent observations remain available.
- CLI: `projects/cli/src/presentation/{types,transformers,formatters}.ts`, `src/cli-execution/results.ts`, `src/json-output-contract/`, paging/composition contracts, installed consumer fixtures, and documentation. Expose warning details through the exact allowlist, keep arbitrary error details private, and render actionable human warnings. Warnings-only validation is valid/exit 0; confirmed errors remain invalid/exit 1; operational failures keep their existing semantics. Every page carries complete counts.
- Update immediate website schemas, capability validators, existing reviewed results, inspection/instruction examples, and summary components so the current site consumes the new contract correctly. Add executable warning-only, equivalent confirmed-error, and mixed/paginated cases now; use existing warning/danger presentation primitives.
- Coordinate required versions now: Core `5.0.0`, CLI `9.0.0` with JSON schema `5`, Anthropic/OpenAI adapters `5.0.0`, and the other eight adapters `4.0.0`. Update manifests, `workspace:^5.0.0` adapter dependencies, CLI/website compatible-major dependencies, lockfile, composition/version assertions, compatibility implementation ranges, and installation examples. Keep the other package versions unless release-relevant changes require adjustment. Milestone 9 verifies these changes rather than postponing this contract alignment.
- Remove replaced failure-only assumptions, old result/schema implementations, optional-severity fallbacks, and superseded tests/docs. Preserve Repository Format 1, compatibility matrix 2, and public compatibility JSON schema 1. Keep existing cursor mismatch rejection; no persisted-data migration is introduced.
- Add `scripts/resource-calibration/calibration.ts`, its source-derived integration coverage and reusable synthetic fixtures, and `pnpm resource:measure`. Capture pre-change complete-workflow measurements and rerun after the diagnostic migration. Include ordinary, shared-source/many-agent, broad-tool, deep-Eve, dense-diagnostic, large-source, and multi-page inputs. Record elapsed time, peak process memory, reads/bytes, parser invocations, records, cumulative output bytes, and snapshot attempts using fixture-local instrumentation. Do not add a public instrumentation API or brittle timing assertions.
- Start `docs/launch-readiness.md` with the measured baseline, actual milestone results, and explicitly pending results for the fifteen-package audit.

### Documentation ownership

Synchronize affected package documentation, `compatibility/runtimes.yaml` and generated presentations, local `specifications/repository-format.md`, and these existing files under `../platform/moldea/context/`:

- `runtime-adapter-contract.md`, `core-package.md`, `cli-package.md`, `repository-format.md`, and `packages.md`.
- `adapter-anthropic-package.md`, `adapter-openai-package.md`, `adapter-google-genai-package.md`, `adapter-claude-agent-sdk-package.md`, `adapter-cloudflare-agents-package.md`, `adapter-eve-package.md`, `adapter-vercel-ai-sdk-package.md`, `adapter-langgraph-package.md`, `adapter-langchain-package.md`, and `adapter-openai-agents-sdk-package.md`, for their common diagnostic and version changes only at this stage.

Clarify routing errors versus unverified warnings without changing persisted unresolved requirements. Preserve specification ownership and unrelated edits. Add the narrow Website UI documentation exception to `packages.md`; do not create `website-ui-package.md`. Do not rewrite factual hosted-consumer Core 4 installations as migrated. Leave platform compatibility policy and skill documents unchanged.

### Verification and acceptance

- Test clean, warnings-only, errors-only, mixed, and structural-error results; complete counts on all pages; later-page warnings; unchanged operational failures; stable ordering/digests; distinct locations/boundaries; and raw duplicate-budget exhaustion.
- Reject missing/invalid severity, incorrect reserved codes/messages, extra/missing/unsafe details, invalid subject/relationship combinations, getters, malformed package/range/boundary metadata, and arbitrary CLI detail leakage. Exercise safe normalized payloads and non-SemVer redaction without moving semantic classification into Core.
- Exercise a real adapter's supported unverified-source case through Core and a packed CLI. Assert both absence of affirmative evidence and absence of an invented wiring error. Keep unsupported-feature inventories and newer-version-only warnings absent.
- Run root unit/integration suites, Core and CLI correctness suites, all adapters' affected unit/integration suites, resource calibration coverage, and website schema/example checks. Verify packed composition, public exports, generated docs, and compatibility checks for the coordinated contract. Check changed UI at 320px/desktop, in both themes, with keyboard/focus and accessible status text.
- The milestone is complete only when existing consumers work with the single new contract, current documentation agrees, calibration produces repeatable reports, and no old-shape compatibility path remains. Later adapter features remain explicitly pending.

**Review checkpoint:** Inspect error versus warning decisions, exact payload validation and redaction, proof suppression, full-result counts, CLI exit behavior, version alignment, initial resource costs, and the scoped cross-repository documentation diff.

## Milestone 2: Effective request analysis and upstream verification

**Objective:** Fix request-body interpretation and deliver Anthropic, OpenAI, and Google request-family capabilities with reproducible checks against real upstream packages.

**Dependencies:** Milestone 1.

### Scope and implementation

- Extend `packages/adapter-static-analysis/src/types.ts`, `typescript-analysis/requests.ts`, related module-array analysis, `typescript-analysis/index.ts`, private-package exports, and colocated tests. Replace the singular method setting with explicit resource method families; retain recognized call/method, first argument, and optional options argument. Migrate every consumer and remove the superseded configuration.
- Analyze mixed supported methods in one traversal. Preserve lexical ownership, shadowing, optional/computed access, mutation/escape checks, cancellation, spread ordering, and relationship-local ambiguity. Leave provider precedence and helper semantics in their adapters.
- Anthropic: `projects/adapter-anthropic/src/source-analysis/{source-analysis,messages}.ts`, request contracts, and instruction/tool/schema inspection. Fix second-argument body precedence for both positive and negative conclusions; support stable `messages.create`, `parse`, and `stream`; establish exact output-schema bindings through `output_config.format` and supported direct helpers. Handle pinned helper transformations; keep beta resources and tool-runner/provider execution excluded.
- OpenAI: corresponding `source-analysis/{source-analysis,responses}.ts`, request contracts, and relationship inspection. Add named constructor imports, `responses.create`/`parse`/`stream`, effective request options, `text.format`, direct JSON Schema, and direct `zodTextFormat` relationships. Keep input/output schemas distinct and unsupported transforms unverified.
- Google: `projects/adapter-google-genai/src/source-analysis/`, request contracts, and inspection. Support `generateContentStream` and `generateContent` in the same family without losing established instruction/tool/schema relationships or claiming streaming lifecycle behavior.
- Treat proven transport-only options as irrelevant to wiring. Apply actual SDK body precedence for static overrides; dynamic override-capable options warn only about dependent relationships.
- Add `scripts/upstream-compatibility/{index,types,targets,runner}.ts`, source-derived integration coverage and fixtures, and `pnpm upstream:check` / `pnpm upstream:check:latest`. Establish exact reviewed minimum/current and selected boundary targets from the plan, with peer-compatible companions and immutable provenance. Later adapter milestones extend their behavioral cases within this same runner.
- Use real SDK exports for type checks and real SDK request preparation with only external transport controlled. Disable installation lifecycle scripts; keep disposable consumers portable and serial, SDKs outside production artifacts, and paid/provider/process/cloud execution absent. The latest command resolves stable versions for an explicit maintenance report without rewriting source, eligibility, or expectations.
- Add the pinned check to the existing `.github/workflows/ci.yml` verification flow and document the maintenance sequence: check latest, inspect release notes, reproduce the changed contract, update owner/fixtures, regress, and release affected packages.
- Synchronize these three adapters' package docs, runtime-pattern contracts, compatibility claims, executable catalog witnesses, guides, and matching platform adapter specifications. Include effective options, structured-output helpers, and mixed Google streaming examples; preserve truthful maturity/qualification claims.

### Verification and acceptance

- Cover mixed methods, body replacement, harmless options, dynamic overrides, spreads, shadowed clients, mutation, helper imports/transforms, direct schema identity, wrappers, and independent relationships. Confirm one traversal rather than repeated whole-source parsing per method.
- Verify actual Anthropic/OpenAI request preparation through controlled transport and Google source typing against real minimum/current exports. Do not use authored SDK declaration stubs as upstream evidence.
- Run the private analyzer suite, each of the three adapters' unit/integration suites, runner/root integration coverage, `pnpm upstream:check`, affected packed CLI and website example checks, and applicable type/lint/build/documentation checks.
- Completion requires passing focused and affected-package regressions, real upstream evidence for the added behavior, no false positive/negative conclusions for overrides, executable witnesses for every advertised pattern, and no singular-method path or SDK production dependency.

**Review checkpoint:** Inspect effective request precedence, helper/schema identity, uncertainty boundaries, mixed-method behavior, controlled transport fidelity, reproducible upstream targets, and maintenance cost.

## Milestone 3: Claude query and prompt capabilities

**Objective:** Support current Claude imports and prompt controls while preserving exact query-local delegation and tool availability.

**Dependencies:** Milestones 1–2.

### Scope and implementation

- Update `projects/adapter-claude-agent-sdk/src/source-analysis/{source-analysis,query-wrappers,agent-definitions,instruction-loaders,tool-availability}.ts`, `inspection/{inspection,handoffs,tools}.ts`, related contracts, and tests.
- Recognize root and `/core` imports without arbitrary package-export traversal. Interpret `omitClaudeMd`, `verbatimPrompts`, and prompt snapshot controls only for the relationships they actually affect. Preserve direct canonical prompt wiring when independent of those controls.
- Keep query-local delegation and MCP availability context through existing exact agent resolution. Do not infer canonical instruction identity from ambient-file omission, prompt delivery, or snapshot timing.
- Extend the shared upstream runner's Claude scenarios, package documentation, runtime-pattern witnesses, adapter guide, compatibility presentation, and `../platform/moldea/context/adapter-claude-agent-sdk-package.md`.
- Keep filesystem agents, runtime-interpreted aliases, prewarming, and process/session execution outside the supported target.

### Verification and acceptance

- Cover inherited/explicit tools, query restrictions, multiple parents, unavailable delegation, import aliases, and prompt-control combinations, including unaffected positive relationships and scoped uncertainty.
- Run Claude unit/integration and packed-consumer checks, relevant Core resolution regressions, pinned upstream checks without launching Claude processes, and executable website witnesses. Complete affected type/lint/build/docs checks.
- Completion requires retained older forms, current source-pattern evidence, no cross-query scope leakage, accurate availability claims, and synchronized documentation.

**Review checkpoint:** Inspect query-context ownership, exact target resolution, prompt-control interpretations, and the distinction between canonical wiring and runtime prompt behavior.

## Milestone 4: Cloudflare version semantics and shared AI SDK tools

**Objective:** Handle the known Think behavior change without version ceilings and support deferred AI SDK tools consistently in Cloudflare and Vercel.

**Dependencies:** Milestones 1–3.

### Scope and implementation

- Add `packages/adapter-static-analysis/src/version-behavior/{index,types,classification}.ts`, explicit exports, and colocated unit tests. Consume it immediately in Cloudflare. Use existing nearest-manifest observations; require all observed declarations to establish before/after behavior. Missing, unparseable, conflicting, or spanning declarations remain unknown. Return the safe normalized union or `null`; keep eligibility and prerelease policy separate.
- Add `src/ai-sdk-tool-shape/{index,types,classification}.ts` in the same private package for genuinely shared AI SDK function-tool shape recognition. Consume it in both adapters, remove replaced duplicate classification, and retain adapter ownership of registration/availability.
- Cloudflare: update `source-analysis/{think-instructions,session-builders,class-definitions,function-tools,think-tools,ai-chat-agents}.ts`, `inspection/package-inspection.ts`, relationship inspection, and contracts. Carry package observations, support bounded `configureContext`, apply the documented merge order with `withContext`, and distinguish `withCachedPrompt` before/after 0.18.0. A known newer no-op cannot prove instruction wiring; a spanning declaration warns only when that conclusion depends on it. Preserve independent `getSystemPrompt` and builder relationships.
- Vercel: update `source-analysis/{function-tools,tool-maps,tool-loop-agents,generation-wrappers}.ts` and corresponding Cloudflare consumers. Recognize `deferLoading` while preserving exact implementation/schema evidence. Distinguish declared registration from turn-time availability, including static true/false, dynamic values, and tool-search declarations.
- Extend pinned upstream fixtures with realistic companion-package pairs and boundary cases; avoid a Cartesian product or runtime release table. Add old/new/ambiguous Think and deferred-tool executable witnesses.
- Synchronize both adapters' docs, guides, compatibility entries, generated presentations, and platform `adapter-cloudflare-agents-package.md` / `adapter-vercel-ai-sdk-package.md`.

### Verification and acceptance

- Test exact/bounded older declarations, newer declarations, open ranges crossing the known boundary, conflicting/missing/non-SemVer declarations, normalization equivalence, redaction, and retained prerelease eligibility behavior. Verify that additive source forms and newer versions alone do not cause uncertainty.
- Cover multiple instruction sources and precedence, independent valid relationships, AIChat tool/output behavior, ordinary tools, deferred values, and registration versus availability. Test the real adapter→Core→CLI version-warning path and exact safe payload.
- Run shared analyzer unit tests, both adapters' unit/integration suites, pinned upstream checks, affected packed CLI/capability checks, and type/lint/build/docs checks. Confirm shared work remains invocation-bounded.
- Completion requires a single used classifier, no false cached-prompt proof, support for eligible older implementations, and accurate deferred-tool claims in both adapters.

**Review checkpoint:** Inspect declaration-based behavior classification, warning precision, maintenance burden, shared AI SDK ownership, and examples showing why broad declarations sometimes leave one conclusion unverified.

## Milestone 5: Eve discovery and registration correctness

**Objective:** Deliver bounded, version-aware nested/workspace discovery and accurate tool/subagent exposure.

**Dependencies:** Milestones 1–4, including the shared known-boundary classifier.

### Scope and implementation

- Update `projects/adapter-eve/src/repository-discovery/{agent-roots,candidate-index}.ts`, `source-analysis/{helper-imports,object-definitions,source-analysis}.ts`, `inspection/{session,inspection,agent-inspection,tool-inspection,subagent-inspection,package-inspection}.ts`, constants, contracts, and colocated tests.
- Preserve flat/nested roots and add `agents/<name>/agent/agent.ts`. Resolve direct `defineWorkspaceAgent` references only to exact manifest-registered targets; keep discovery scoped and avoid a global agent registry.
- Discover immediate children for each inspected parent, including both edges of root-child-grandchild relationships. Build indexes once per scoped root rather than repeatedly filtering all descendants.
- Interpret `tool: false`, same-name suppression, and `availableInSubagents` where proven. Keep callable declarations distinct from model-visible registrations. Add direct `defineWorkflowTool` recognition without claiming durable workflow execution.
- Apply known boundaries for 0.65 defaults and 0.66.2 test-file exclusions. Preserve supported older semantics, current reserved-name rules and explicit collisions; removed defaults must not remain permanently reserved. Retain namespace, symlink, collision, and malformed-layout safeguards.
- Extend real upstream/compiler verification, executable nested/workspace and exclusion witnesses, package docs, guide, compatibility presentation, and `../platform/moldea/context/adapter-eve-package.md`.

### Verification and acceptance

- Cover removed/default tool collisions, disabled targets, multiple nested parents, exact workspace references, unregistered targets, duplicate slots, test/spec paths, `__tests__`, broad/unknown ranges, extension namespaces, symlinks, and malformed layouts.
- Use scoped-root/broad-tree fixtures to verify both direct edges and bounded indexed discovery without brittle wall-clock assertions. Exercise real relevant compiler/discovery behavior in disposable verification without durable cloud workflows.
- Run Eve unit/integration and packed-consumer checks, shared classifier regressions, pinned upstream checks, website witnesses, resource measurements for affected fixtures, and type/lint/build/docs checks.
- Completion requires correct direct-edge evidence, no spurious test-file tools under applicable semantics, no unregistered/global target resolution, retained older support, and bounded discovery work.

**Review checkpoint:** Inspect nesting and workspace ownership, exposure versus callability, default/exclusion boundaries, source-scope containment, and broad-tree resource results.

## Milestone 6: LangGraph updates and remaining adapter verification

**Objective:** Complete the planned LangGraph capabilities and verify the full advertised LangChain and OpenAI Agents SDK surfaces.

**Dependencies:** Milestones 1–5.

### Scope and implementation

- LangGraph: update `projects/adapter-langgraph/src/source-analysis/{functional-api,graph-operations,state-graph-builders}.ts`, runtime-pattern contracts, inspection, and tests. Support `interrupt(value, { responseSchema })` alongside the existing form; treat its schema as resume-value validation, never agent input/output. Classify additive node tracing options without suppressing independent graph relationships.
- LangChain: audit existing `source-analysis/`, `inspection/`, contracts, and tests for `createAgent`, instruction/tool bindings, middleware ambiguity, structured-output strategies, and companion core compatibility against minimum/current versions.
- OpenAI Agents SDK: audit Agent declarations, tools, handoffs, routing descriptions, instructions, output types, and ambiguity preservation against minimum/current versions.
- For the latter two adapters, make only demonstrated in-scope corrections with regressions; do not introduce speculative capabilities or structural rewrites. Verify their scoped warning behavior from Milestone 1.
- Extend pinned upstream scenarios, executable LangGraph witnesses and any changed-pattern witnesses, package docs/guides/compatibility presentations, and the matching three platform adapter specifications. Preserve unrelated qualification claims.

### Verification and acceptance

- LangGraph cases include aliases, shadowing, malformed/dynamic options, StateGraph and functional targets, unchanged graph/schema bindings, and absence of false agent I/O evidence from resume schemas.
- LangChain/OpenAI Agents checks must cover their complete advertised surfaces and relevant negative/ambiguous cases, including real same-runtime resolution boundaries and routing conclusions.
- Run all three adapters' unit/integration suites, relevant Core/CLI integration, pinned upstream checks, packed exports, executable catalog coverage, and type/lint/build/docs checks. At this checkpoint every adapter family has its planned capability and upstream verification work assigned and completed.
- Completion requires all ten adapters' planned behavior to be implemented and individually verified, with any material upstream uncertainty reported as a blocker rather than treated as passing evidence.

**Review checkpoint:** Inspect resume-schema meaning, retained graph relationships, completeness of the two verification-only audits, and the consolidated adapter support/limitation inventory.

## Milestone 7: Complete website examples and Website UI verification

**Objective:** Present the completed package contracts accurately and accessibly, with executable examples and a verified Website UI artifact.

**Dependencies:** Milestones 1–6. Earlier milestones already own their necessary consumer updates and runtime-pattern witnesses.

### Scope and implementation

- Complete `apps/website/src/lib/capabilities/{types,validations,transformers,presentation,catalog}.ts`, CLI/Core/runtime examples, expected results, proofs, `src/lib/inspection-example/`, `instruction-example/`, and affected summary/result components.
- Finish package discovery/dependency expectations, generated API references, schema-version consumers, capability coverage, affected package guides, compatibility presentations, and the website README's actual catalog counts. Keep `content/runtime-target-maturity.yaml` and qualification links truthful.
- Select a concise public subset from executable cases: warning-only with no proof, the same conclusively broken relationship, mixed paginated counts, older/newer/ambiguous Think behavior, Anthropic/OpenAI effective options and output helpers, mixed Google streaming, Eve nesting/workspaces/ignored tests, and deferred tools/LangGraph resume schemas. Reuse genuine multi-pattern witnesses; displayed output must come from package execution.
- Reuse Website UI's existing `ResultSummary`, `StatusBadge`, `CodeBlock`, `FilePreview`, `Dialog`, `Accordion`, and theme/site utilities. Retain its public surface and peer versions unless a concrete in-scope defect requires correction; do not build equivalent local primitives.
- Audit `projects/website-ui` against its README/docs, public declarations, utility tests, `src/index.test-integration.ts` tarball/Astro consumer build, and real website usage. No separate specification is required.
- Regenerate through existing commands. Preserve server rendering and readable no-JavaScript examples; keep provider SDK/analyzer code out of browser bundles. Execute each finite catalog case once per generated model and reuse that model.

### Verification and acceptance

- Run Website UI correctness and real packed Astro consumer checks, website capability/generation suites, `pnpm docs:check`, `pnpm compatibility:check`, `pnpm website:check`, and `pnpm --filter @moldea.ai/packages-website test:e2e`, plus affected type/lint/build checks.
- Check rendered pages at 320px through desktop, light/dark themes, keyboard operation, focus visibility/restoration, accessible status names, non-color status information, long filenames/messages, and reduced motion. Use existing Playwright/accessibility coverage and inspect representative pages visually.
- Verify links/fragments, search, sitemap, `llms.txt`, adapter anchors, `BASE_PATH`, generated artifact integrity, and bounded generation. Record actual browser and artifact results in the readiness report.
- Completion requires a witness for every newly advertised pattern, accurate public examples, no false maturity promotion, no stale counts/schema consumers, and passing Website UI/website quality gates.

**Review checkpoint:** Review the user-facing warning/error distinction, representative examples, mobile/theme/accessibility behavior, component reuse, generated output fidelity, and Website UI consumer evidence.

## Milestone 8: Remaining package audits and complete-workflow resource limits

**Objective:** Close demonstrated local readiness gaps in Repository, Repository FS, Core, and CLI, and establish the measured launch envelope across all fifteen packages.

**Dependencies:** Milestones 1–7 and the working calibration/reporting infrastructure from Milestone 1.

### Scope and implementation

- Repository: audit `projects/repository/src` and existing testing-peer/packed consumers for paths, memory-reader snapshots, deterministic ordering, cursors, byte ranges, UTF-8 boundaries, malformed input, and conformance. Preserve environment neutrality and public subpaths.
- Repository FS: audit `projects/repository-fs/src` and reader integrations for no-follow access, exact selection, traversal rejection, source drift, bounded listing/ranges, cancellation, concurrency, cache bounds, and cleanup. Use real filesystems and the established OS matrix.
- Core/CLI: finish audits of malformed adapter output, agent isolation, raw-result limits, retained-memory accounting, snapshot consistency, canonical-content boundaries, safe errors, cancellation, and installed composition. Packed CLI scenarios cover `version`, `composition`, `validate`, `inspect`, `scope`, and `content`, including warning-only/mixed outcomes and source immutability.
- Add meaningful coverage and local corrections only for demonstrated gaps. Synchronize directly affected package docs/error contracts/tests. A required change to platform Repository/Repository FS specifications or another material departure requires plan revision before proceeding.
- Extend and rerun `scripts/resource-calibration/` against the final adapter/site behavior. Compare the initial baseline across ordinary, shared-source/many-agent, broad-tool, deep-Eve, dense-diagnostic, large-source, and multi-page workloads. Assess growth, concurrent work where applicable, and aggregate CPU/memory/I/O/output rather than isolated helper cost.
- Verify inspection-session promise reuse, once-per-root Eve indexes, once-per-family request analysis, bounded collections, predictable large/nested-source failure, warning/output bounds, and existing bounded snapshot retries. Measure AST/object overhead separately from logical retained-byte accounting.
- Preserve independent safety limits, including CLI 65,536-byte default and 1 MiB maximum. Keep stateless CLI continuation and operation-local caches; document repeated preparation across invocations and cheaper repeated pages within one prepared Core process. Give targeted `scope`/`content` guidance. Report cumulative bytes and command/page counts without claiming exact token consumption.
- Complete the fifteen-package audit entries in `docs/launch-readiness.md`, incorporating earlier adapter and Website UI evidence, current measurements, workload assumptions, defects/resolutions, and verification limits. Material envelope failures block readiness; do not raise limits or add persistent caching to hide them.

### Verification and acceptance

- Run the affected packages' full correctness suites, applicable root integrations, real filesystem/packed CLI consumers, `pnpm resource:measure`, calibration integration tests, and relevant type/lint/build/docs checks. Exercise malformed, boundary, cancellation, drift, isolation, large/pathological, and cleanup cases through real owned interactions.
- Use the established Linux/macOS/Windows coverage for filesystem guarantees; Linux-only execution cannot substantiate Windows readiness. Record unavailable required infrastructure explicitly.
- Completion requires evidence for every public package, a documented supported resource envelope, no unresolved material local correctness gap, and honest accounting of cumulative CLI costs. Milestone 9 still owns the final combined artifact and consumer matrix verdict.

**Review checkpoint:** Inspect filesystem containment, complete-command correctness, measurement methodology and results, output/resource cost, accepted stateless continuation tradeoff, and any remaining verification limitations.

## Milestone 9: Release propagation and final launch-readiness evidence

**Objective:** Ensure private bundled changes produce the correct public releases and establish the final coherent launch verdict without publishing or deploying.

**Dependencies:** Milestones 1–8. Required consumer/OS infrastructure must be available to substantiate the final verdict.

### Scope and implementation

- Update `scripts/npm-release/{project-changes,git,types}.ts` and colocated tests. Build private workspace dependency graphs from both base/current committed manifests; include private `dependencies` and `devDependencies` as build inputs, propagate through private dependencies, and stop at external public-package boundaries.
- Handle removed, renamed, and replaced private dependencies; fail explicitly on invalid graphs. Preserve test-only, excluded-directory, and nonshipped-documentation exclusions. Map release-relevant `configs/vite/` and `configs/typescript/` changes to their public library-build consumers with focused tests.
- Verify that private implementation changes select affected adapters and require version increases without forcing an unchanged CLI release for compatible adapter patches. Use real packed-artifact comparisons as well as selection assertions. Preserve publication ordering, trusted publishing, checksums, and recovery behavior.
- Finish release documentation and verify the coordinated versions/manifests/lockfile, compatible-major dependencies, composition expectations, installation examples, and compatibility ranges introduced in Milestone 1. Adjust Repository/Repository FS/Website UI versions only for actual release-relevant changes under existing policy.
- Recheck latest upstream versions at final verification; report additional relevant changes rather than silently expanding scope or narrowing eligibility. Run pinned evidence against the exact final inputs. Do not update skill qualification links/dates as a substitute.
- Verify all fifteen tarballs, public exports/types, runtime dependencies, absence of private workspace imports, absence of test/source leaks, checksums, and installed composition. Check the existing Node.js 22.11.0/latest 22, 24.11.0/latest 24, and 26.8.1 consumer targets where advertised, documented Vitest peers, and Linux/macOS/Windows jobs; Website UI retains its own Node/Astro/Tailwind contract.
- Review both repositories' scoped diffs and complete synchronization of all fifteen named platform documents, local format wording, package docs, generated references, catalogs, and compatibility presentations. Record platform commit/worktree state and synchronized paths. Do not require platform application builds for prose-only edits or introduce a sibling-repository CI dependency.
- Finish `docs/launch-readiness.md` with exact final results and limitations. Provide the next-skill handoff covering JSON schema 5, severity-aware decisions, scoped warnings and withheld proof, output/resource guidance, schema-4 consumers, stale package references, and any qualification evidence needing renewal. Leave `agent-skill.md`, `context-gathering.md`, skill implementation, and hosted installed dependencies for that subsequent work.
- Review protected instructions for a genuine durable guidance gap; if needed, provide the prescribed separate-model handoff without editing those files. Make no production-readiness claim while a material correctness or required verification gap remains.

### Final verification and acceptance

Run release-selection unit/integration coverage first, then the final applicable workspace gates:

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
pnpm upstream:check
pnpm upstream:check:latest
pnpm resource:measure
```

Reuse successful evidence for identical inputs; do not omit a correctness category or affected consumer boundary. Root scripts include `pnpm test:root:unit` and `pnpm test:root:integration`; relevant earlier package boundaries include `pnpm --filter @moldea.ai/adapter-static-analysis test`, Core, CLI, Website UI, and each adapter's exact `test:unit` / `test:integration` filters. Preserve category isolation and verify tests do not enter production artifacts.

Run `release:check-changes` against exact implementation commits once those commits exist. Do not create commits solely for this check; before then, require its integration scenarios and disclose the pending exact-commit check. Registry/tag availability checks belong before subsequent publication; this milestone does not publish, reserve versions, or create tags.

Completion requires the plan's full acceptance set: all ten adapters retain advertised older behavior and implement their specified capabilities; confirmed defects have meaningful regressions; warnings are safe, bounded, visible and nonblocking without false proof; all fifteen packages and the website pass applicable contract/artifact/consumer gates; bundled changes propagate correctly; resource costs fit the documented envelope; specifications and generated presentations agree; and no superseded Moldea implementation remains. Required missing evidence prevents an unconditional readiness verdict.

There is no database migration. Pre-publication rollback restores the coherent source/dependency state; a correction after eventual publication must use a new version through the existing workflow.

**Review checkpoint:** Review release-selection evidence, the complete tarball/consumer matrix, final resource results, documentation agreement across both repositories, the exact readiness verdict and limitations, and the next-skill handoff. Stop with the reviewable implementation; publication and deployment require separate authorization.

## Plan-to-milestone coverage

| Plan deliverable                                                                     | Owning milestone(s)                                              |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Shared warning types, validation, evidence rules, counts, CLI schema/exits, removals | 1                                                                |
| Coordinated major versions and immediate consumers                                   | 1; final verification in 9                                       |
| Request families and Anthropic/OpenAI/Google capabilities                            | 2                                                                |
| Reproducible upstream runner, explicit latest maintenance, pinned CI                 | 2; adapter scenarios in 3–6; final refresh in 9                  |
| Claude imports, prompt controls, query-local availability                            | 3                                                                |
| Known version boundaries and safe normalized declarations                            | 4; Eve consumer in 5                                             |
| Cloudflare instructions and shared Vercel/Cloudflare deferred tools                  | 4                                                                |
| Eve nesting, workspaces, exposure, defaults, exclusions, bounded indexes             | 5                                                                |
| LangGraph changes and full LangChain/OpenAI Agents audits                            | 6                                                                |
| Required runtime witnesses and adapter guides                                        | 1–6, alongside their behavior                                    |
| Website presentation, public examples, generated artifacts, Website UI audit         | 7; immediate contract changes in 1                               |
| Resource infrastructure and pre-change baseline                                      | 1                                                                |
| Repository/FS/Core/CLI audits, aggregate resource envelope, fifteen-package report   | 8, incorporating 1–7                                             |
| Private-input release propagation and complete final consumer/artifact gates         | 9                                                                |
| Platform specifications and local format synchronization                             | Common contracts in 1; adapter behavior in 2–6; final audit in 9 |
| Error/JSDoc documentation, tests, exports, build exclusion and portability           | Every owning milestone                                           |
| Final readiness limits, protected-instruction assessment, next-skill handoff         | 9                                                                |

## Approval required

Approve this complete nine-milestone sequence and the referenced plan: native diagnostics and baseline measurements; request analysis and upstream verification; Claude updates; Cloudflare/Vercel semantics; Eve correctness; LangGraph and remaining adapter verification; website/Website UI completion; package/resource audits; and release propagation/final readiness evidence, including the specified documentation-only platform synchronization.

Approval alone does not authorize implementing a milestone. Explicitly identify the milestone to implement; approval and authorization for Milestone 1 may be combined in one instruction. After each authorized milestone, implementation stops at its review checkpoint until another milestone is explicitly authorized.

Publication, deployment, commits, platform application changes, new runtime families, a separate Website UI specification, and next-skill implementation remain outside this approval.

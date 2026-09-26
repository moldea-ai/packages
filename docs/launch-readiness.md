# Package launch readiness

This report records implementation and verification for the [approved launch plan](../coding-agent-planning/1790360458_adapter-launch-readiness/plan.md). A package is not declared production ready merely because its version or compatibility range has been updated. Milestones 6–9 and the final combined consumer matrix remain pending.

## Milestone 1: diagnostic contract and resource baseline

Core 5 makes diagnostic severity required. Confirmed structural and adapter failures are errors; a recognized source candidate that leaves one declared runtime relationship unverified may produce a scoped warning. Core owns the closed warning shape and validates code, message, reason-specific fields, source location, and entity pairing. Warnings do not create positive evidence and do not make a project invalid. The CLI 9/schema 5 projection preserves complete error and warning counts on every page, exposes only the warning's safe context, and exits successfully for a warnings-only result. Anthropic and OpenAI exercise real source ambiguity through this path. Other adapters reserve their own exact warning codes for later behavior-specific work.

The coordinated package versions are Core 5, CLI 9, Anthropic/OpenAI adapters 5, and the other eight adapters 4. Repository Format 1, compatibility matrix 2, and the public compatibility JSON schema 1 remain unchanged. Compatible-major Moldea dependencies and minimum-only provider SDK eligibility remain the versioning model. This milestone does not claim verification of the later adapter capabilities.

### Complete-workflow calibration

`pnpm resource:measure` builds the Repository, Core, Anthropic, and Eve artifacts, then runs seven synthetic complete inspections through a measured in-memory reader and all inspection pages. The pre-change packages commit was `dca170b4a21f21df5cdcbbdb25ae0971ed3c0bd8`; it was built in a detached temporary worktree with the same calibration script. Each number below is the median of three sequential runs unless it is a deterministic count. The comparison is an initial resource signal, not a fixed performance budget.

| Workload                   | Elapsed ms before → after | CPU ms before → after | Process RSS MiB before → after | Read bytes | Parser calls | Records before → after | Output bytes before → after | Pages before → after |
| -------------------------- | ------------------------: | --------------------: | -----------------------------: | ---------: | -----------: | ---------------------: | --------------------------: | -------------------: |
| Ordinary                   |               10.8 → 10.6 |           23.1 → 24.3 |                  140.8 → 139.9 |      1,815 |            4 |                11 → 11 |               6,938 → 6,962 |                1 → 1 |
| Shared source, many agents |             190.1 → 176.6 |         273.5 → 264.4 |                  197.7 → 198.2 |     61,911 |          132 |              459 → 459 |           291,789 → 292,485 |              29 → 29 |
| Broad tool declarations    |               31.6 → 27.9 |           53.7 → 54.1 |                  219.0 → 221.2 |     12,247 |            3 |                11 → 11 |               6,942 → 6,966 |                1 → 1 |
| Deep Eve layout            |               19.2 → 15.7 |           33.9 → 30.0 |                  220.2 → 221.7 |      3,059 |            9 |                22 → 22 |             14,640 → 14,688 |                2 → 2 |
| Dense diagnostics          |             175.1 → 166.6 |         226.3 → 239.4 |                  246.9 → 255.7 |     61,651 |          132 |              394 → 459 |           246,439 → 299,429 |              25 → 29 |
| Large source               |               40.6 → 33.6 |           58.0 → 48.0 |                  293.5 → 296.0 |    247,582 |            4 |                11 → 11 |               6,938 → 6,962 |                1 → 1 |
| Multi-page                 |             176.5 → 160.6 |         258.6 → 236.1 |                  308.1 → 301.3 |     61,911 |          132 |              459 → 459 |           291,789 → 292,485 |              29 → 29 |

The dense-diagnostic increase is expected from warning records added for recognized ambiguous candidates; the output rose by 52,990 bytes across four additional 16-record pages. It is a cumulative output cost, so a caller should page deliberately and request `scope` or targeted `content` when those commands answer the task. The shared-source fixture still parses source 132 times with 64 additional agents beyond its base agent, a pre-existing scaling concern to reassess in Milestone 8. The broad-tool fixture tests many declarations but produces few runtime records; it does not establish the cost of a large proved tool registry. The deep-Eve fixture measures discovery and parsing across nested files without asserting a large registered-edge set.

A second current-tree run after adding explicit snapshot-attempt counting retained the same deterministic read, parse, record, output-byte, and page counts; timing and process RSS varied. Each sample reported one snapshot attempt.

RSS is sampled from one long-lived process every 5 ms and therefore includes prior fixture allocations; these values are not independent per-workload peaks or precise AST memory. Parser calls are measured through Node inspector coverage of TypeScript `createSourceFile`, not a public instrumentation API. Repository read/page/snapshot-access counters are scoped to the measured reader. Each sample makes one Core inspection attempt against one immutable snapshot; no snapshot-retry behavior is exercised. No token-count claim follows from byte counts, and this calibration does not cover Git inventory, the packed CLI, browser generation, concurrent invocations, or all adapters. Milestone 8 owns the final complete-workflow envelope and repeats these measurements after the adapter changes.

### Verification recorded for Milestone 1

- `pnpm test:unit`: 33 tasks passed. The CLI suite passed 545 tests; the website suite passed 82 tests.
- `pnpm test:integration`: 34 tasks passed across the root, adapters, Core, CLI, and website. After the final calibration-fixture path assertion was corrected, its focused integration file passed both tests.
- `pnpm test:e2e`: 20 tasks passed. The installed CLI suite passed all three tests and the website Chromium suite passed 211 browser tests, including narrow viewports, light/dark themes, keyboard operation, and reduced motion.
- `pnpm typecheck`: 33 tasks passed; `pnpm typecheck:root` passed after the final calibration script change.
- `pnpm lint`: 33 tasks passed; `pnpm lint:root` passed after the final calibration script change.
- `pnpm compatibility:check`, `pnpm docs:generate`, `pnpm docs:check`, and `pnpm resource:measure` passed. The changed package files passed targeted Prettier checking. All platform changes in this milestone are specification prose; no platform application test is claimed.

These checks establish the coordinated diagnostic migration and its current consumers. They do not establish the later upstream capability, full package audit, final release artifact, or cross-platform launch verdict.

## Milestone 2: direct SDK method families and upstream checks

The shared static analyzer recognizes configured resource method families in one traversal and retains each call's first request object and optional options expression. Anthropic and OpenAI inspect the effective body when static second-argument options replace it; transport-only options leave the first body in force, and dynamic override-capable options leave only dependent relationships unverified. Anthropic recognizes direct `messages.create`, `parse`, and `stream` calls plus agent output-schema wiring through `output_config.format`. OpenAI recognizes direct `responses.create`, `parse`, and `stream`, default or named constructors, and agent output-schema wiring through `text.format`. Direct JSON Schema and the respective direct Zod helpers retain exact bound-schema identity. Google Gen AI recognizes both `models.generateContent` and `generateContentStream`; these source observations do not prove streaming lifecycle behavior.

The serial `pnpm upstream:check` installs six exact minimum/current SDK targets in disposable consumers with lifecycle scripts disabled and pinned SHA-512 tarball integrity. It type-checks source forms against real SDK exports, including the methods and helpers at each declared minimum. Anthropic and OpenAI request preparation is exercised through a controlled fetch with a loopback fallback origin; the check neither sends a provider request nor imports provider SDKs into adapter production artifacts. `pnpm upstream:check:latest` resolves stable npm latest versions for an explicit maintenance signal and ran against the same three current releases on September 25, 2026. A future release remains eligible under each minimum-only range, but its behavior must be rechecked; the latest command never rewrites ranges or fixtures.

The website catalog contains 136 executed cases and witnesses all 95 currently advertised full or partial patterns. Three new cases demonstrate Anthropic parse with an output schema, OpenAI parse with a direct Zod helper and effective options body, and mixed Google generation methods. Those cases run Core's static inspection on synthetic source; provider execution and output validation remain outside their claim. Source-specific guides, the canonical compatibility matrix and generated page, and the matching platform adapter specifications were synchronized. The three adapter packages now carry minor versions `5.1.0`, `5.1.0`, and `4.1.0` respectively without adding SDK production dependencies or changing minimum-only eligibility.

### Verification recorded for Milestone 2

- `pnpm upstream:check`: six exact minimum/current SDK consumers passed type checks; Anthropic and OpenAI also passed controlled request-preparation checks.
- `pnpm upstream:check:latest`: the three stable latest targets passed without changing the pinned target list.
- `pnpm test`: complete workspace unit, integration, and end-to-end phases passed, including installed CLI tarball execution and 211 website Chromium tests across responsive widths and both themes.
- `pnpm website:check`: documentation, 82 website unit tests, Astro typecheck, lint, production build, and 132 integration tests passed.
- `pnpm typecheck`: 33 root/workspace tasks passed after correcting two test-only indexed-property accesses. `pnpm lint`: 33 tasks passed. `pnpm format:check` and `pnpm compatibility:check` passed.

The new method family incurs no repeated whole-source parse per method, and source analysis remains bounded by Core's existing reader and output limits. The upstream maintenance check performs six serial disposable installations and is a CI/release cost rather than an inspection-time cost. The website's extra examples are generated at build time; unselected examples are not rendered in the public showcase. Milestone 8 still owns representative full-workflow resource measurements and the final package audit.

## Milestone 3: Claude query and prompt controls

The Claude Agent SDK adapter accepts named imports from the SDK root and `/core`. It retains canonical instruction-loader evidence for direct calls, typed custom prompt objects, and the `claude_code` preset's direct `append` binding when snapshot controls are present. `omitClaudeMd` and `verbatimPrompts` do not by themselves establish or remove canonical instruction identity. Existing query-local agent resolution and tool availability remain the ownership boundaries; the new source forms do not execute Claude processes or infer runtime prompt delivery.

Pinned type-only consumers passed against Claude Agent SDK 0.3.234 and 0.3.282 with exact package integrity and fixed companion dependencies. The separate stable-latest probe also passed 0.3.283 on September 25, 2026. This checks SDK exports and accepted source shapes without starting a Claude session or sending a provider request. Minimum-only version eligibility remains unchanged. The adapter package is version `4.1.0`.

The website catalog now has 137 executed cases. Its Claude example covers `/core`, typed custom and preset prompts, `snapshot`, `omitClaudeMd`, and `verbatimPrompts`, with exact evidence for separate query, prompt, and agent-definition relationships. The source fixture also uses the SDK's tool input and MCP result shapes. Package guidance, the compatibility matrix and generated presentation, and the matching platform specification were synchronized.

### Verification recorded for Milestone 3

- Claude adapter unit and integration suites passed: 34 and 31 tests respectively. `pnpm upstream:check` passed eight pinned SDK consumers; `pnpm upstream:check:latest` passed four stable-latest consumers.
- `pnpm test` passed the complete workspace suite, including the installed CLI path and 211 Chromium website tests. `pnpm website:check` passed website documentation, 82 unit tests, Astro typecheck, lint, production build, and 132 integration tests.
- `pnpm compatibility:check` passed the 15-package build and matrix/documentation synchronization. `pnpm typecheck` passed 33 root/workspace tasks.

The extra source recognition uses the existing single source parse and bounded inspection. The two Claude upstream consumers add two serial disposable installations to the maintenance check and no inspection-time dependency. Milestone 8 still owns the representative full-workflow resource measurement and the complete package audit.

## Milestone 4: Think behavior and deferred AI SDK tools

The shared static analyzer now owns one AI SDK function-tool shape classifier and one known-version-boundary classifier. Cloudflare and Vercel consume the same closed `tool({ ... })` shape. Their tool-registration evidence records the declared `deferLoading` option as `absent`, `enabled`, `disabled`, or `unknown`; it does not assert tool availability or search results on a model turn. `toolSearch()` can coexist in a supported tools map without becoming a manifest-bound function-tool registration. The older eligible AI SDK 7 floor does not accept `deferLoading`, while the current pinned release does, so source evidence is deliberately separate from installed-runtime capability.

Cloudflare interprets supported `configureContext()` blocks from Think 0.18.0 and merges them before supported `configureSession().withContext(...)` blocks. The later Session block wins for a repeated static label. A direct `getSystemPrompt()` binding remains independent configured-source evidence even when runtime context selection may suppress that fallback on a turn. A custom `withCachedPrompt(provider)` getter counts only with a closed inert setter; no-argument `withCachedPrompt()` gives no loader proof. When all observed Think declarations establish one side of the 0.18.0 boundary, that behavior is used. A declaration spanning the boundary leaves only a conclusion that differs between the two interpretations unverified and emits a scoped warning. Confirmed wiring defects remain errors. Eligible version ranges and coordinated Moldea package versions are unchanged.

The upstream compatibility check now covers 13 exact consumers, including Think 0.17.0, 0.18.0, and 0.19.0 with companion `agents` releases, plus AI SDK 7.0.66 and 7.0.116. Each disposable consumer uses an integrity-pinned package and type-checks against the real SDK declarations. The stable-latest probe covered six current targets on September 25, 2026. These are source and type compatibility checks, not live Cloudflare or model execution. The website catalog contains 141 executed cases, with older, newer, and spanning Think declarations and a deferred Vercel function tool. Its displayed outcomes come from Core and the adapters.

### Verification recorded for Milestone 4

- Shared analyzer unit tests passed: 107 tests. Cloudflare unit and integration tests passed: 31 and 42 tests. Vercel unit and integration tests passed: 25 and 33 tests.
- The packed CLI suite passed three tests, including the Core-to-CLI version-warning path. Website integration passed 132 tests. `pnpm upstream:check` passed all 13 pinned consumers; `pnpm upstream:check:latest` passed six stable-latest consumers.
- `pnpm test` passed the complete workspace unit, integration, and end-to-end phases, including 211 Chromium website tests at narrow widths and in both themes. `pnpm website:check` passed its documentation, unit, Astro type, lint, production build, and 132 integration checks. `pnpm typecheck` and `pnpm lint` each passed 33 root/workspace tasks. The changed package files passed targeted Prettier checking; `pnpm compatibility:check` passed the 15-package build and matrix synchronization. Both affected platform specifications passed targeted formatting after synchronization.

The classifier and context merge work inside an existing bounded inspection and add no model calls, provider requests, or token use. The expanded upstream check performs 13 serial disposable installations as maintenance work, not per inspection. Website examples are generated during the site build; selecting one example does not execute the entire catalog in a visitor's browser. Milestone 8 will repeat the complete-workflow resource measurements after the remaining adapters change.

## Milestone 5: Eve discovery and registration

The Eve adapter now inspects flat, nested, and workspace agent roots and proves immediate directory-backed child handoffs at each level. A direct workspace `defineWorkspaceAgent(...)` reference resolves only to the exact peer agent registered by the manifest, including aliases; an unrelated workspace agent does not become a target merely because its files exist. Scoped root indexes retain malformed and competing sources for collision analysis without creating a global agent registry. The adapter distinguishes a callable child from one exposed as a model tool, recognizes direct workflow-tool registrations without claiming durable execution, and applies the proven `defaultTools`, `task_cancel`, `tool`, `availableInSubagents`, removed-default, and test-source boundaries. A declared version range spanning one of those boundaries leaves the affected relationship unverified with a warning; a confirmed mismatch remains an error. The minimum-only Eve eligibility remains `>=0.39.1`.

The real Eve compiler established the narrower workflow directive rule: a top-level async function declaration or a direct async `execute` method can carry `use workflow`; an arrow or function expression in that position cannot. The adapter and tests were corrected after an imported arrow failed the compiler probe. Pinned consumers now cover Eve 0.39.1, 0.52.2, 0.59.1, 0.60.1, 0.61.0, 0.65.0, 0.66.2, and 0.66.3, exercising older support and the changed compiler/discovery behaviors. The stable-latest probe passed 0.66.3 on September 25, 2026. These checks compile and inspect local disposable projects; they do not launch a model request or a durable workflow. Package guidance, the compatibility matrix and generated page, the website witnesses, and the matching platform specification were synchronized. The website catalog has 145 executed cases, including the new Eve cases, and 101 full or partial runtime patterns with executable witnesses.

### Verification recorded for Milestone 5

- Eve unit and integration suites passed: 18 and 66 tests. `pnpm compatibility:check` passed the 15-package build and generated matrix synchronization. `pnpm upstream:check` passed all 21 pinned consumers, including eight Eve compiler checks; `pnpm upstream:check:latest` passed all seven current consumers, including Eve 0.66.3.
- `pnpm test` passed the complete workspace unit, integration, and end-to-end phases after the final per-parent tool-name indexing correction, including three installed CLI tests and 211 Chromium website tests. `pnpm website:check` passed its docs, 82 unit tests, Astro typecheck, lint, production build, and 132 integration tests. `pnpm typecheck`, `pnpm lint`, and `pnpm format:check` passed, with 33 root/workspace tasks for each of the first two. Eve's 18 unit and 66 integration tests, package typecheck, and package lint also passed after the indexing correction and the final visibility assertions.
- The broad Eve calibration fixture contains 82 agents and proves 81 direct handoffs across 16 branches of four leaves. Three uncontended sequential samples after per-parent tool-name indexing had median 200.3 ms elapsed time and 291.4 ms CPU time, with 49,779 repository bytes read, 169 parser calls, 1,579 entry lookups, 164 listing pages, 499 read pages, 582 output records, 37 inspection pages, and 404,115 cumulative JSON bytes. The process RSS sample was 282.5 MiB, including prior fixture allocations in the same long-lived process.

The broad fixture demonstrates bounded output paging and correct direct edges, but its full 404 KiB output could consume substantial tokens if copied into a coding-agent prompt. Consumers should request relevant `scope` or `content` and only the necessary result pages. The measurement has no model calls and does not yield an exact token count. Milestone 8 owns the final resource envelope and concurrency assessment.

## Package audit status

| Public package            | Current launch evidence                                                                                  | Remaining owner    |
| ------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------ |
| Repository                | Existing contract used by calibration; full audit pending                                                | Milestone 8        |
| Repository FS             | Full filesystem and OS audit pending                                                                     | Milestone 8        |
| Core                      | Severity contract and regression suite passed; full audit pending                                        | Milestone 8        |
| CLI                       | Schema 5 and packed warning/error suite passed; full audit pending                                       | Milestone 8        |
| Anthropic adapter         | Direct method family, effective options, output-schema and pinned SDK checks passed                      | Milestones 1 and 2 |
| OpenAI adapter            | Direct method family, effective options, output-schema and pinned SDK checks passed                      | Milestones 1 and 2 |
| Google Gen AI adapter     | Direct generate/stream source checks and pinned SDK typing passed                                        | Milestones 1 and 2 |
| Claude Agent SDK adapter  | Root/core imports, prompt controls, and pinned SDK checks passed; full audit pending                     | Milestones 3 and 8 |
| Cloudflare Agents adapter | Think boundary, context merge, deferred-tool and upstream checks passed; full audit pending              | Milestones 4 and 8 |
| Vercel AI SDK adapter     | Shared deferred-tool recognition and upstream AI SDK typing passed; full audit pending                   | Milestones 4 and 8 |
| Eve adapter               | Nested/workspace, workflow, exposure, defaults, exclusion and compiler checks passed; full audit pending | Milestones 5 and 8 |
| LangGraph adapter         | Severity contract; interrupt/tracing checks pending                                                      | Milestones 1 and 6 |
| LangChain adapter         | Severity contract; full advertised-surface audit pending                                                 | Milestones 1 and 6 |
| OpenAI Agents SDK adapter | Severity contract; full advertised-surface audit pending                                                 | Milestones 1 and 6 |
| Website UI                | Real consumer and visual audit pending                                                                   | Milestone 7        |

The packages website is an application consumer, not a sixteenth public package. Its schema 5 examples are updated in Milestone 1; its full examples, visual, accessibility, and artifact checks belong to Milestone 7. Final release propagation and a coherent launch verdict belong to Milestone 9.

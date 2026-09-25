# Package launch readiness

This report records implementation and verification for the [approved launch plan](../coding-agent-planning/1790360458_adapter-launch-readiness/plan.md). A package is not declared production ready merely because its version or compatibility range has been updated. Milestones 2–9 and the final combined consumer matrix remain pending.

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

## Package audit status

| Public package            | Current launch evidence                                              | Remaining owner    |
| ------------------------- | -------------------------------------------------------------------- | ------------------ |
| Repository                | Existing contract used by calibration; full audit pending            | Milestone 8        |
| Repository FS             | Full filesystem and OS audit pending                                 | Milestone 8        |
| Core                      | Severity contract and regression suite passed; full audit pending    | Milestone 8        |
| CLI                       | Schema 5 and packed warning/error suite passed; full audit pending   | Milestone 8        |
| Anthropic adapter         | Scoped ambiguity warning; request-family and upstream checks pending | Milestones 1 and 2 |
| OpenAI adapter            | Scoped ambiguity warning; request-family and upstream checks pending | Milestones 1 and 2 |
| Google Gen AI adapter     | Severity contract; streaming and upstream checks pending             | Milestones 1 and 2 |
| Claude Agent SDK adapter  | Severity contract; import/prompt checks pending                      | Milestones 1 and 3 |
| Cloudflare Agents adapter | Severity contract; Think and deferred-tool checks pending            | Milestones 1 and 4 |
| Vercel AI SDK adapter     | Severity contract; deferred-tool checks pending                      | Milestones 1 and 4 |
| Eve adapter               | Severity contract; nested/workspace checks pending                   | Milestones 1 and 5 |
| LangGraph adapter         | Severity contract; interrupt/tracing checks pending                  | Milestones 1 and 6 |
| LangChain adapter         | Severity contract; full advertised-surface audit pending             | Milestones 1 and 6 |
| OpenAI Agents SDK adapter | Severity contract; full advertised-surface audit pending             | Milestones 1 and 6 |
| Website UI                | Real consumer and visual audit pending                               | Milestone 7        |

The packages website is an application consumer, not a sixteenth public package. Its schema 5 examples are updated in Milestone 1; its full examples, visual, accessibility, and artifact checks belong to Milestone 7. Final release propagation and a coherent launch verdict belong to Milestone 9.

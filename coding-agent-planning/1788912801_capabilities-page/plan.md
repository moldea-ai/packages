# Capabilities page

## Objective and scope

Create `/capabilities/` as a visual, source-backed explanation of what the currently implemented packages can establish deterministically. Serve technical and non-technical visitors: make each example understandable while scrolling, with optional detailed results for developers.

Cover the visitor-facing package ecosystem: Core, Repository, Repository FS, CLI, all ten package-backed adapters, and Core's built-in `custom` runtime. Show failures, successful checks, runtime evidence, and useful inspection results. Do not present every operation as a validation verdict.

Keep the established platform and Skill branding, existing homepage examples, compact result controls, shared interaction states, and responsive section-header patterns.

The latest amendment is included: adding Capabilities must not crowd the header on smaller desktop screens. Show “Repo. Format” at compact desktop widths, with “Repository Format” on wider screens and in the mobile menu. Implement the optional compact label in Website UI rather than special-casing its rendering in the application.

### Explicit exclusions

- No changes to Core, reader, adapter, or CLI behavior or their public contracts.
- No new runtime targets, compatibility claims, maturity assignments, or compatibility JSON schema changes.
- No runtime execution, model/provider calls, visitor repository access, uploads, live playground, automatic repairs, or semantic evaluation.
- No claims that the packages execute variable substitution, establish arbitrary program correctness, prove schema equivalence, or verify that an unresolved requirement has been satisfied.
- No redesign of the homepage, adapter directory, package documentation, or footer. Homepage changes are limited to discovery and directly reused presentation.
- No visitor-facing Website UI package page, independent capability JSON API, new search engine, or new dialog implementation.
- No changes to sibling Platform or Skill repositories, protected coding instructions, database state, hosting infrastructure, or deployment workflows.
- No dependency upgrades, new third-party libraries, commits, pushes, npm publication, or deployment as part of implementation authorization.

## Repository evidence

Planning is based on the clean `new_skill` worktree at `a70774a4c2743eacefce3fc4e8f5fef0a958baa4`.

| Evidence                                                                                                   | Current behavior and consequence                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Root `README.md`, `package.json`, `turbo.json`                                                             | The private Astro website consumes published package boundaries. Root preparation currently builds Core's closure and Website UI; dependency preparation must expand for the new examples.                                           |
| `apps/website/README.md`, `src/lib/generation/generation.ts`, `src/lib/model/types.ts`                     | One generated model owns routes, search, machine navigation, package metadata, and examples. Extend this flow rather than adding a separate content pipeline.                                                                        |
| `src/lib/inspection-example/`, `src/lib/instruction-example/`                                              | Existing examples derive visible inputs and exact validation excerpts from real Core calls over synthetic memory snapshots. Unexpected results fail generation. Preserve that accuracy standard.                                     |
| `specifications/repository-format.md`, Core public exports, contracts, diagnostics, and package docs       | Core exposes eight operations and 81 structural diagnostic codes. The specification also discusses responsibilities outside the current package surface; specification prose alone is not evidence that an operation is implemented. |
| Repository and Repository FS exports and docs                                                              | Readers provide source-neutral metadata, bounded ranges, comparisons, explicit filesystem selection, and snapshot-bound continuation. Raw byte reads and Core's Unicode-safe text reads are different contracts.                     |
| CLI executable declaration and `docs/commands.md`, `docs/output-and-operations.md`, `docs/working-tree.md` | The public boundary is the executable, not an importable library. Schema 4 distinguishes validation, metadata inspection, scope, canonical content, composition, and operational errors.                                             |
| `compatibility/runtimes.yaml`, adapter public exports and docs, website maturity publication               | There are 14 targets, including `custom`, and 91 full or partial pattern entries. Technical support and display maturity have separate authoritative owners.                                                                         |
| Website UI public exports, README, components, styles, and tarball integration test                        | Reuse Dialog, StatusBadge, ActionLink, InlineBrandText, Markdown rendering, site utilities, and shared shells. The current header accepts one label per navigation item.                                                             |
| Platform website sections and dialog conventions; Skill `website/src/components/home-page/home-page.astro` | Preserve Ubuntu typography, semantic colors, section separation, split desktop headings, compact visual explanations, and shared interaction behavior. These are reference-only repositories.                                        |

Installed tooling: Astro 7.2.2, Tailwind CSS 4.3.3, TypeScript 6.0.3, Zod 4.3.6, Vitest 4.1.10, Playwright 1.62.1, Node.js 24.15.0, and pnpm 11.9.0. Website UI is currently 1.4.0.

No implementation checks or generators were run during planning.

## Intended visitor experience

### Page structure

Use one static page with six ordered sections and an ordinary, wrapping in-page navigation list:

1. Repository structure and connections.
2. Agent instructions and declared assets.
3. Decision history and relationships.
4. Runtime wiring.
5. Reading, comparing, and finding affected knowledge.
6. Using the checks from the command line.

Start with a short introduction explaining deterministic checks in everyday terms. State that examples use synthetic repositories and actual package results without executing the illustrated application.

Give sections stable fragment IDs. Use title-left, supporting-text-right headers at large widths, stacked on smaller screens. Separate sections with the existing spacing, border, and background treatments. Avoid a second sticky navigation layer.

Each example group must contain:

- A concise situation or question.
- A small, always-visible file, relationship, comparison, or record illustration.
- A prominent outcome with an icon and a short explanation.
- The responsible package or operation; runtime examples also identify their exact target.
- A compact optional “View result” control.
- A brief scope qualification where the illustration could otherwise imply more than the package proves.

Related variants may share a visual group. Show their distinct capabilities in concise visible rows, not exclusively inside dialogs. The page need not contain one full-sized card per diagnostic code or syntax variation.

Do not require tabs, filters, hover, animation, or dialog interaction to understand the capability. Do not duplicate the homepage's moved-file sequence or missing-delivery-tool story as the page's principal examples.

### Visual and result treatment

Use realistic project situations such as a returns-policy reference, a delivery-status instruction, a routing description, an accepted architecture decision, or a tool registration. Do not use credentials, password-reset conversations, arbitrary constants without context, or decorative terminal output.

File illustrations must look like files: file icon, concise label, inline-code filename, and identifiable content. Preserve the filename when abbreviating a long directory prefix. Keep the complete path accessible without requiring hover.

Use different presentations where the information differs:

| Result family        | Visible treatment                                              | Detailed result                                                                          |
| -------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Core validation      | Actual successful or failed structural outcome                 | Actual diagnostic excerpt with code, logical path, pointer, entity, and relevant details |
| Adapter inspection   | Established relationship, precise mismatch, or not established | Source-grounded evidence and any real diagnostics, scoped to one target                  |
| Reader or comparison | Entries, ranges, changed paths, or a stopped read              | Actual bounded result excerpt and continuation/completion facts                          |
| CLI                  | Command purpose and observed outcome                           | Invoked command, actual exit status, and schema 4 output excerpt                         |

Only use VALID or INVALID when the underlying result actually exposes that verdict. Lack of supported static evidence is not automatically a broken repository. Keep runtime maturity badges separate from example outcomes.

Dialogs retain the existing outcome-heading design: badged icon, balanced title and explanatory text, and compact status beside the title. Hide the icon on mobile, not the outcome. Use the existing heading slot and unique accessible title IDs. Do not add redundant dialog descriptions. Label partial JSON as a result excerpt and never present omitted fields as the complete public contract.

Code, JSON, YAML, Markdown source, and aligned trees preserve their lines and scroll within their own named, keyboard-focusable regions. Only explicit plain-text prose wraps. Prefer shorter source excerpts over forcing code to wrap.

All standalone visible references to `moldea` use inline code. Preserve approved link roles, logo behavior, semantic status colors, and footer styling.

## Coverage checklist

The implementation must maintain a machine-checked coverage ledger in the website-owned capabilities module. The following is the required content inventory, not a list of optional enhancements.

### Universal structure and agent checks

| Capability family                | Required illustration and coverage                                                                                          | Authority                                                                      |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Canonical layout                 | Missing foundation or manifest; unexpected canonical assets; incorrect entry types                                          | Format structure and strict validation; Core layout diagnostics                |
| Strict manifest parsing          | Malformed or duplicate-key YAML, unsupported version, unknown property, invalid type, and successful parsing                | Core `parseManifest`; format manifest rules                                    |
| IDs, paths, and globs            | Invalid/reserved IDs, prohibited paths or bindings, duplicate declarations, and exact-path versus glob rules                | Core manifest diagnostics; Repository logical-path contract                    |
| Repository relationships         | Existing versus missing/non-file references, context connections, and exact impact paths                                    | Core reference, context, and impact-path diagnostics                           |
| Text normalization and identity  | BOM/line-ending normalization, equal normalized digests, meaningful content changes, invalid Unicode/UTF-8 or NUL rejection | Core `normalizeText` and `calculateContentDigest`                              |
| Agent registration and identity  | Missing/unregistered agent directory, canonical instruction identity, required instruction and description                  | Core agent diagnostics and format agent rules                                  |
| Descriptions                     | Agent and handoff description validity; tool/skill description constraints                                                  | Core description diagnostics; format description normalization                 |
| Runtime variables                | Declared and used variable, undeclared placeholder, unused declaration, malformed placeholder, undeclared provider          | Core variable diagnostics; no substitution claim                               |
| Tools, skills, and bindings      | Required implementations, declared file connections, valid binding syntax, and invalid binding destinations                 | Core capability/reference diagnostics; adapter evidence for runtime resolution |
| Mirrors                          | Stale or missing mirror, ownership collision, prohibited destination/type, and normalized equality                          | Core mirror diagnostics; format mirror rules                                   |
| Runtime guidance and composition | Required guidance, missing/empty guidance, recognized runtime IDs, available versus missing adapter composition             | Core runtime diagnostics and built-in `custom` behavior                        |
| Unresolved requirements          | Valid structured declaration and related-reference traceability; show that a changed related file does not prove resolution | Core manifest parsing/scope matching; format unresolved-requirement rules      |

### Decisions, repository access, and CLI

| Capability family             | Required illustration and coverage                                                                                          | Authority                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Decision documents            | Valid decision parsing; filename, frontmatter, timestamp, body, and ID consistency                                          | Core `parseDecision` and decision diagnostics               |
| Decision graph                | Missing/self references, supersession cycle, inconsistent/orphaned status, and a valid replacement chain                    | Core project validation                                     |
| Active decision relationships | Accepted decision relationship versus an inactive decision reference                                                        | Core relationship diagnostics                               |
| Source-neutral reader         | File/directory/symlink metadata, deterministic listing, immutable input snapshot, and explicit byte ranges                  | Repository root and memory exports                          |
| Snapshot comparison           | Added, removed, modified, and type-changed paths, unchanged files, bounded continuation                                     | Repository comparison contract                              |
| Filesystem selection          | Explicit path selection versus directory selection; repository-logical output rather than host paths                        | Repository FS public factory and docs                       |
| Safe continuation             | Complete traversal over multiple pages; rejection of stale or mismatched continuation; resource and cancellation boundaries | Repository/Core/Filesystem contracts, kept distinct         |
| Content-free inspection       | Counts/digests and metadata, diagnostic, and evidence views without canonical bodies                                        | Core `validateProject` and `inspectProjectPage`             |
| Explicit canonical content    | Unicode-safe range reading, completion, and refusal of non-canonical selections                                             | Core `readCanonicalContentPage`; CLI content boundary       |
| Change relevance              | Exact references, glob matches, ownership, unrelated changes, and unresolved-related paths                                  | Core `matchManifestScope`; relevance is not semantic impact |
| CLI validation and selection  | Real `validate` output and exit status; tracked plus non-ignored untracked selection, without writes                        | CLI commands, working-tree, and output contracts            |
| CLI inspection and content    | Metadata-only `inspect` versus explicit `content`; bounded output and continuation                                          | CLI schema 4                                                |
| CLI scope                     | Single-path and NUL-delimited path input, matched/unmatched relevance, no adapter analysis                                  | CLI `scope`                                                 |
| Installed composition         | Actual package versions, active adapters, formats, and requirements; not target maturity                                    | CLI `composition`                                           |

Operational refusals must be presented as operational boundaries, not invented Core diagnostics. Demonstrate representative resource, cancellation, and snapshot failures where practical; link remaining detailed error contracts rather than turning every environmental failure into a marketing card.

### Runtime targets

Every target must have an identifiable visible example and a link to its existing exact-scope documentation. Multiple fixtures may feed one target group.

| Runtime and exact target ID                                | Required demonstration families                                                                                                                                                                                         |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `custom/custom`                                            | Explicit repository relationships and the limit of universal checks without runtime source inference                                                                                                                    |
| `anthropic/typescript-messages-api-0-117`                  | Direct Messages call, system loader, closed client tools, input schema                                                                                                                                                  |
| `claude-agent-sdk/typescript-query-subagents-0-3`          | Query wrappers, custom/preset instructions, programmatic agents, delegation availability, effective routing descriptions, query output schema, SDK MCP declarations/registration, inherited and explicit subagent tools |
| `cloudflare-agents/typescript-think-0-16-ai-sdk-7`         | Exported Think class, instruction methods, closed tools map, explicitly partial scope                                                                                                                                   |
| `cloudflare-agents/typescript-ai-chat-agent-0-10-ai-sdk-7` | Exported AIChatAgent class, direct generation, structured output and tools, explicitly partial scope                                                                                                                    |
| `eve/typescript-filesystem-agent-0-39`                     | Nested/flat roots, local subagents and descriptions, supported instruction forms, filesystem tools and normalized names/collisions, local namespaces, supported skill forms, connection/framework-tool limits           |
| `google-genai/typescript-models-generate-content-2`        | Direct generate-content call, system instruction, function declarations, JSON input schema                                                                                                                              |
| `langchain/typescript-create-agent-1-5`                    | Direct agent and primary package boundary, supported loaders/output strategies, function tools and closed collections                                                                                                   |
| `langgraph/typescript-state-graph-1-4`                     | Compiled graph, inline/single-owner builders, schemas, nodes, direct/conditional edges, runtime name                                                                                                                    |
| `langgraph/typescript-functional-api-1-4`                  | Entrypoint, tasks, interrupt, previous state, final state; no inferred arbitrary control flow                                                                                                                           |
| `openai/typescript-responses-api-7`                        | Direct Responses wrapper, instruction loader, static function tools, input schema                                                                                                                                       |
| `openai-agents-sdk/typescript-agent-handoffs-0-16`         | Agent constructor/factory, instructions, output schema, tools and their schemas, direct/configured handoffs, routing-description precedence                                                                             |
| `vercel-ai-sdk/typescript-tool-loop-agent-7`               | Agent construction, instruction loader, call-options schema, object output, closed tools and direct function bindings                                                                                                   |
| `vercel-ai-sdk/typescript-generate-stream-text-7`          | Generate/stream wrappers, instructions/system precedence, loaders, object output, closed tools and direct bindings                                                                                                      |

Read package ranges, technical support, maturity, and qualification links from the existing combined publication model. Do not copy them into a second maintained compatibility table.

Account for every current full/partial pattern entry in executable fixture coverage, allowing several entries to share a fixture only when its assertions establish each claimed behavior. Partial patterns must exercise their documented supported form and state the limit.

Account for ambiguous/unsupported patterns through the target's limitations and existing scope links. Include representative dynamic-source examples showing “not established”. Do not require a separate full-sized card for every unsupported syntax form.

### Coverage enforcement

- Use stable capability and case IDs with explicit references to owning operations, diagnostic codes, target/pattern IDs, documentation, and visible groups.
- Cover all eight `ICore` operations through a typed operation mapping.
- Account for all 81 current Core diagnostic codes in a typed mapping to a demonstrated family or a specifically explained linked boundary. Accounting for a code is not a claim that its exact variant was executed.
- Reject missing/stale target IDs, uncovered full/partial patterns, stale pattern IDs, duplicate cases/anchors, missing source links, and assertions detached from displayed examples.
- Every visitor-facing affirmative claim must have an executed supporting case. Every claimed failure must be derived from an actual failure result.
- New package behavior must not silently inherit an old claim. Generation or typechecking must expose relevant inventory drift.
- Keep the ledger with executable website content, not in a second manually synchronized Markdown catalog.

## Architecture and ownership

### Generation and example execution

Extend `IWebsiteModel` with a capabilities model and call `createCapabilities` from `createWebsiteModel`. Keep generated output in the existing ignored `.generated/model.json`.

Website-owned modules will contain editorial grouping, safe synthetic source fixtures, expected outcomes, public package calls, result projection, and coverage validation. There is no new backend or browser-side evaluator.

Use the public boundaries already established by the packages:

- `@moldea.ai/core` for all eight Core operations.
- `@moldea.ai/repository` and `@moldea.ai/repository/memory` for paths, readers, and comparisons.
- `@moldea.ai/repository-fs` for filesystem demonstrations.
- Each adapter's named singleton from its package root, composed through `createCore`.
- The CLI's declared public `moldea` executable for CLI examples. Do not import its internal command executor or add a library export.

Resolve the CLI package's declared bin from repository-discovered package metadata, require containment in that package, and execute its built JavaScript entry with `process.execPath` and an argument array. This follows the existing executable-test boundary without depending on shell shims.

Core and adapter examples use memory snapshots. Filesystem and repository-backed CLI examples use small, explicitly created disposable workspaces. Initialize Git only inside the CLI fixture workspace when its selection behavior requires it. Do not inspect or modify the developer's repository through an example command.

Temporary fixture lifecycle belongs to one focused website-owned module. Use native path APIs, portable names, bounded inputs, isolated Git configuration/templates, explicit process arguments, and cleanup in `finally`. Never follow fixture paths outside the temporary root or target the repository root for cleanup. Do not require native symlink privileges for ordinary generation; exercise logical symlinks with the memory reader and retain platform-specific filesystem verification where available.

Generation may create these disposable workspaces but must not modify maintained sources, the real Git worktree/index, or ordinary documentation. Update generation documentation to make this temporary I/O explicit.

Run each distinct case once per model generation and reuse its output for cards, dialogs, search, and coverage. Do not evaluate once per rendered component or repeatedly scan identical snapshots merely to format them.

### Truthful, deterministic output

Retain package-owned types at execution boundaries. Validate CLI JSON with Zod against the fields actually consumed from its documented envelope and command-specific results.

Compare expected statuses, diagnostics, paths, pointers, evidence relationships, and relevant source locations before projecting display output. Fail generation on unexpected additional diagnostics or changed outcomes. Do not merely check that an expected code appears somewhere.

Derive visible snippets from the same fixture used by the operation. Mark excerpts explicitly; do not author a separate illustrative file that can drift from the executed source.

Project results through explicit, typed allowlists. Omit temporary host paths, opaque source identities/cursor strings, process details, and unrelated bodies. Preserve useful real facts such as byte ranges, continuation availability, completion, counts, stable digests, target identity, and package versions. Never replace a nondeterministic field with a fabricated “real” value.

Repeatability means the same inputs, versions, and configuration establish the same relevant facts. It does not promise that independently created filesystem readers produce identical opaque tokens.

### Shared UI

Reuse these existing public exports:

`@moldea.ai/website-ui/dialog`, `status-badge`, `action-link`, `inline-brand-text`, `markdown`, `site`, `site-header`, and `site-footer`.

Add two genuinely reusable presentation components:

| Export                                 | Responsibility and customization                                                                                                                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@moldea.ai/website-ui/file-preview`   | Semantic file presentation with `path`, optional `label`, semantic `tone`, filename-preserving path display, and icon/status/body slots. It does not parse source, choose excerpts, or know Core.             |
| `@moldea.ai/website-ui/result-summary` | Balanced badged-icon/title/description layout with `title`, `description`, `tone`, optional `headingId`, `as` restricted to `p\|h2\|h3`, and `hideIconOnMobile`; icon and status slots remain consumer-owned. |

Use the existing semantic tone vocabulary. Keep literal classes with the elements they style and preserve the established card/dialog sizing. Publish these as source Astro subpath exports following the current package convention; consumers derive props through Astro's `ComponentProps`.

Refactor the existing app-owned `InspectionSummary` to compose ResultSummary while retaining its Core-specific outcome mapping. Use FilePreview for the homepage instruction file where it replaces the same presentation. Preserve the existing homepage copy, paths, missing-file state, controls, and visual proportions.

Capability cards, relationship diagrams, comparison views, CLI command explanations, result mapping, and fixture ownership remain application-specific. Do not export Core-specific result schemas from Website UI, force data into EvaluationReplay, or deep-import its private path-tree component.

Continue composing the existing Dialog. No second modal script, state machine, overlay, animation system, or generic result-fetching service is needed.

### Compact header labels

Add optional `compactLabel?: string` to `ISiteHeaderNavigationItem`. Existing consumers that omit it render exactly as before.

For desktop navigation below `xl` (1280px), display `compactLabel` when supplied. At `xl` and above, display `label`. The mobile menu always uses `label`. Keep the full destination label accessible, without announcing both visual spans.

The packages website supplies `compactLabel: 'Repo. Format'` only for Repository Format. Add Capabilities after Get started in header and footer navigation. Preserve the current `lg` desktop breakpoint, navigation state handling, logo, search, source, and theme controls. Do not solve crowding by shrinking fonts or hiding actions.

## Files and integration points

Paths below are repository-relative. New module entry files remain thin named export boundaries.

| Area                               | Planned additions or modifications                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Capabilities orchestration         | Add `apps/website/src/lib/capabilities/index.ts`, `types.ts`, `catalog.ts`, `coverage.ts`, `capabilities.ts`, `validations.ts`, and `transformers.ts`. Own the typed content/result model, coverage ledger, `createCapabilities`, and deterministic display projection.                                                                                                                                       |
| Core examples                      | Add `apps/website/src/lib/capabilities/core-examples/` with `index.ts`, `types.ts`, `constants.ts`, `structure.ts`, `agents.ts`, `decisions.ts`, `inspection.ts`, and `core-examples.ts`. Group actual Core calls and synthetic cases by responsibility.                                                                                                                                                      |
| Runtime examples                   | Add `apps/website/src/lib/capabilities/runtime-examples/` with `index.ts`, `types.ts`, `runtime-examples.ts`, `fixtures.ts`, and one fixture file each named `anthropic.ts`, `claude-agent-sdk.ts`, `cloudflare-agents.ts`, `eve.ts`, `google-genai.ts`, `langchain.ts`, `langgraph.ts`, `openai.ts`, `openai-agents-sdk.ts`, and `vercel-ai-sdk.ts`. Built-in custom stays with Core examples.               |
| Reader and CLI examples            | Add `reader-examples/` and `cli-examples/` under the capabilities module, each with `index.ts`, `types.ts`, `constants.ts`, and its correspondingly named implementation file. Add `fixture-workspace/` with `index.ts`, `types.ts`, and `fixture-workspace.ts` for their shared controlled filesystem lifecycle.                                                                                             |
| Generation                         | Modify `apps/website/src/lib/model/types.ts` and `src/lib/generation/generation.ts`: capabilities field, generation notice, route manifest, capability search records, and `llms.txt` discovery.                                                                                                                                                                                                              |
| Page and composition               | Add `apps/website/src/pages/capabilities/index.astro`. Add `capability-section/`, `capability-card/`, `capability-visual/`, and `capability-result/` under `src/components/`, each with `index.ts`, `types.ts`, and a matching `.component.astro` implementation. Keep non-trivial family-specific visuals in focused child modules if required by their actual complexity, not nested component definitions. |
| Shared presentation                | Add `projects/website-ui/src/components/file-preview/file-preview.component.astro` and `src/components/result-summary/result-summary.component.astro`. Add their explicit package subpath exports.                                                                                                                                                                                                            |
| Header                             | Modify `projects/website-ui/src/components/site-header/site-header.component.astro` and `apps/website/src/components/site-header.astro`.                                                                                                                                                                                                                                                                      |
| Existing page integration          | Modify `apps/website/src/components/site-footer.astro`, `inspection-example/inspection-example.astro` for an Explore capabilities link, `inspection-summary/inspection-summary.astro`, and `repository-check-preview/repository-check-preview.astro` for the narrowly shared presentation.                                                                                                                    |
| Build dependencies                 | Modify `apps/website/package.json`, root `package.json`, and `pnpm-lock.yaml`.                                                                                                                                                                                                                                                                                                                                |
| Documentation and release metadata | Update root `README.md`, `apps/website/README.md`, `projects/website-ui/README.md`, and `projects/website-ui/package.json`.                                                                                                                                                                                                                                                                                   |
| Artifact verification              | Extend `apps/website/scripts/verify-build.ts` and its existing integration test. Reuse SEO verification rather than creating parallel sitemap/metadata checks.                                                                                                                                                                                                                                                |

Add colocated tests:

- `capabilities.test-integration.ts`, `validations.test-unit.ts`, and `transformers.test-unit.ts` beside the corresponding capabilities implementations.
- `core-examples.test-integration.ts`, `runtime-examples.test-integration.ts`, `reader-examples.test-integration.ts`, `cli-examples.test-integration.ts`, and `fixture-workspace.test-integration.ts` in their owning modules.
- `apps/website/src/pages/capabilities/_index.test-e2e.ts`, following the established Astro page-test convention.
- Update generation integration tests, `base-layout.test-e2e.ts`, existing inspection-summary/result and repository-check-preview browser tests, and `projects/website-ui/src/index.test-integration.ts`.

Do not create separate files merely to satisfy this inventory when a listed trivial contract naturally belongs in its owning dedicated implementation. Do not use that allowance to combine distinct execution, validation, transformation, or rendering responsibilities.

## Dependencies, public contracts, and discovery

Add direct website build-time workspace dependencies for Repository FS, CLI, and the ten adapters. Retain Core and Repository as build-time dependencies. Use the repository's compatible-major workspace convention and synchronize only the affected lockfile entries. No provider SDK installation is required: illustrated SDK source is inspected, not imported or executed.

Change root `website:prepare` to:

```text
turbo run build --filter @moldea.ai/cli... --filter @moldea.ai/website-ui
```

The existing CLI dependency closure includes the readers, Core, and all adapters. The website's direct dependency declarations make Turbo's ordinary dependency build ordering complete as well. Existing cache inputs and Pages path triggers already cover these sources; do not change them without a demonstrated gap.

The additive Website UI components and optional header prop require a minor release: plan version 1.5.0 from current 1.4.0. Update its documented installation and packed-version assertion. Existing component imports, Dialog props, defaults, and consumers remain compatible. Skill can adopt the released exports later without being changed by this task.

Add one canonical content route, `/capabilities/`. Add stable group/case fragment links to search using the existing search index, not new physical routes. Generate search text from visible copy, operation/package names, and relevant diagnostic terms; do not index entire fixture bodies or repeated JSON.

Add Capabilities to generated `llms.txt`. Let Astro's existing sitemap integration emit the page once. Fragment links do not become sitemap entries. Preserve the compatibility redirect and JSON route exactly.

Use `withBase`, the shared site utilities, and BaseLayout for navigation, canonical metadata, Open Graph data, and alternate deployment prefixes. Do not hand-edit generated sitemap, search, machine-navigation, or model files.

## Strategic implementation sequence

1. **Establish the executable content contract.** Define the six-section catalog, typed result families, authoritative source references, and coverage ledger. Implement coverage validation with adversarial unit tests. Review the inventory against the tables above before authoring visual copy.
2. **Generate real examples.** Implement Core, runtime, reader, filesystem, and CLI generators through public boundaries. Add only required workspace dependencies and preparation changes. Keep fixture lifetime, execution, assertions, and result projection separate. Complete integration coverage with each generator and review actual outputs before treating them as publishable content.
3. **Extract reusable presentation and compact navigation.** Add FilePreview and ResultSummary, the optional compact header label, public exports, minor-version metadata, and consumer documentation. Adapt the two existing homepage presentation consumers without changing their stories. Verify a real packed Astro consumer and homepage regressions at this checkpoint.
4. **Compose the Capabilities page.** Render the catalog through the new domain components. Review the initial section and one example from each result family for hierarchy, density, mobile composition, and evidence clarity before applying the same treatment to the remaining groups. Complete all planned capability coverage, not just representative packages.
5. **Integrate discovery and build validation.** Add navigation, homepage discovery, routes, search fragments, machine navigation, generated notice, and artifact assertions. Synchronize the root and app ownership/workflow documentation in the same change.
6. **Verify the complete feature.** Run the affected correctness suites, types, lint, formatting, production build, packed-consumer checks, base-path verification, and deliberate browser review. Audit every affirmative claim against its source and generated result. Review the final diff for scope and unintended files.

These are ordered strategic steps, not independently authorized milestones. A separate `breakdown` can establish implementation checkpoints after the plan is reviewed.

## Verification and acceptance criteria

### Automated correctness

- Exercise real package integration rather than mocking Core, adapters, readers, or the CLI command implementation.
- Verify successful cases, intended failures, exact diagnostics, material evidence fields, source locations, and no unexpected extra diagnostics.
- Mutate a fixture so that a depicted failure is repaired, a claimed relationship disappears, or an extra error appears; generation must reject stale presentation expectations.
- Reject uncovered/stale capabilities, targets and patterns, duplicate IDs, unsafe/missing links, and incorrectly classified result families.
- Verify deterministic model generation across repeated runs and different temporary workspace names.
- Test reader first/final pages, exact boundaries, stable ordering, empty results, continuation, unchanged and type-changed paths, Unicode content boundaries, invalid continuation, and changed snapshots.
- Verify CLI schema/status/exit handling, metadata/content separation, both scope input forms, and representative operational errors. Preserve real command integration and assert fixture Git/source state is unchanged by the command.
- Verify temporary workspace cleanup after success and failure, path containment, portable generated names, and absence of leaked host paths or source bodies.
- Do not turn this feature into a duplicate of every package's complete conformance suite. Use existing package coverage for lower-level guarantees and add website tests where a claim, projection, composition, or presentation could be wrong.
- Extend the real tarball consumer to import and render both new UI exports, customize their slots/props, and typecheck header compact-label support. Verify old header usage without the prop still works and no tests enter the package artifact.

### Browser and visual review

Inspect at 320, 375, 768, 1024, 1100, 1279, 1280, and 1440px where relevant. Cover both light and dark themes.

- No horizontal page overflow, crowded header, wrapped desktop navigation labels, clipped actions, or sticky-header-obscured fragment destinations.
- “Repo. Format” appears at compact desktop widths, the full label appears from 1280px and in the mobile menu, and Capabilities has the correct active state.
- Primary information remains visible without JavaScript and without opening dialogs.
- Example cards communicate files, relationships, and outcomes at a glance. Mobile flattens redundant outer surfaces and uses available width.
- Dialogs have unique names, correctly linked headings, compact badges, mobile-hidden summary icons, bounded scrolling, and the existing overlay, Escape, focus-trap, close, and focus-return behavior.
- Test opening more than one result in sequence and navigation away from an open result to catch lifecycle regressions.
- Code regions are keyboard-scrollable and preserve source lines; explicit plain text wraps; long paths retain an identifiable filename and accessible full path.
- Check visible focus, keyboard navigation, link states, readable status labels, and contrast. Run the existing Axe integration on the page and representative open dialogs.
- Preserve reduced-motion behavior for shared dialogs and links. Add no decorative or layout-heavy animation.
- Compare representative screenshots with current packages, Platform, and Skill patterns. Passing DOM tests alone does not establish branding quality.

The new page is static Astro, not a React island. Avoid per-card client scripts, runtime package bundles, repeated hidden full-result payloads, or client-side rendering of the catalog. Inspect emitted JavaScript and HTML size; keep excerpts bounded by their authored purpose and avoid retaining complete reader snapshots. The catalog is a release-owned finite example collection, not a growing database collection, so it does not require visitor pagination.

### Commands

Run these during implementation, not during this planning turn. Use earlier focused checks while developing, then the complete existing correctness suites at the affected boundaries.

```bash
pnpm website:prepare
pnpm --filter @moldea.ai/packages-website test:unit
pnpm --filter @moldea.ai/website-ui test:unit
pnpm website:build
pnpm --filter @moldea.ai/packages-website test:integration
pnpm --filter @moldea.ai/website-ui test
pnpm --filter @moldea.ai/packages-website test
pnpm test:root
pnpm typecheck:root
pnpm --filter @moldea.ai/website-ui typecheck
pnpm --filter @moldea.ai/packages-website typecheck
pnpm lint:root
pnpm --filter @moldea.ai/website-ui lint
pnpm --filter @moldea.ai/packages-website lint
pnpm compatibility:check
pnpm docs:check
pnpm website:build
pnpm --filter @moldea.ai/packages-website check:links
```

Run the installed Prettier binary with `--write`, then `--check`, against the exact implementation-touched file list using the existing `.prettierrc`. Do not format unrelated files.

Repeat `pnpm website:build`, `check:links`, and the website E2E suite with process environment `SITE_URL=https://moldea-ai.github.io` and `BASE_PATH=/packages/`, using the existing portable environment mechanism rather than adding a POSIX-only script. Verify exact canonical/search/sitemap/fragment destinations, then restore the default build for final review.

Verify source-change invalidation and an unchanged warm Turbo cache hit using the established isolated-checkout workflow. Do not mutate the working source tree merely to test cache behavior.

If publication is later authorized, run `pnpm release:check-changes a70774a4c2743eacefce3fc4e8f5fef0a958baa4 HEAD` after the implementation commit exists. This plan does not authorize creating that commit.

### Completion conditions

The implementation is complete only when all listed capability families and targets are accounted for, every published affirmative claim has real supporting execution, all discovery surfaces agree, existing pages remain stable, shared UI is consumable from its tarball, and relevant verification has passed.

Report any unavailable browser/platform checks honestly. Do not claim cross-platform filesystem execution from Linux-only results. If an actual package defect prevents an intended example, stop and report the mismatch; do not fabricate evidence, silently change compatibility, or fix an out-of-scope package.

## Risks, compatibility, and rollback

- **Coverage versus density:** Group related variants, retain visible distinctions, and use concise examples. Do not hide the product's basic explanation behind dialogs or turn the page into an exhaustive error registry.
- **Overstated proof:** Keep universal checks, adapter evidence, unresolved static analysis, operational errors, and semantic questions separate throughout copy and status mapping.
- **Build cost:** Expanded generators add parsing and temporary local execution. Reuse work within one generation, use small fixtures, avoid provider dependencies, and measure cold/warm build behavior before changing timeouts.
- **Contract drift:** Fail on stale coverage and output expectations; preserve package-owned docs and compatibility as authority.
- **UI regressions:** Shared extraction and navigation changes affect existing pages and future consumers. Preserve defaults and require browser regression plus real tarball-consumer verification.
- **Portability:** Avoid shell execution and OS-dependent ordinary fixtures. Host-sensitive checks need explicit platform evidence or a reported limitation.
- **Release safety:** Only Website UI gains a new public surface. No data migration, backend rollout, or configuration migration is required.
- **Rollback:** The website can return to its previous static artifact. Existing consumers remain compatible with the additive UI release; sibling websites do not adopt it automatically. Do not remove or republish an already released npm version.

There are no unresolved product choices required before reviewing this plan. Source-backed grouping, compact desktop navigation, accurate result semantics, and the existing design system are the chosen approach.

## Approval required

Approval is requested for the complete Capabilities page and coverage inventory above; real build-time examples for the public package ecosystem; the necessary workspace preparation changes; reusable FilePreview and ResultSummary exports plus optional compact header labels in Website UI 1.5.0; narrowly scoped homepage reuse and discovery; search, sitemap, machine-navigation, documentation synchronization, and all associated verification.

Approval does not authorize commits, publication, deployment, sibling-repository changes, or changes to the deterministic package implementations. No implementation begins until this plan is explicitly approved.
